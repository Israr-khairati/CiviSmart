const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Load NLP Dataset for keyword spelling handling
let nlpDataset = { keywords: {} };
try {
  const datasetPath = path.join(__dirname, '..', 'nlp_dataset.json');
  if (fs.existsSync(datasetPath)) {
    nlpDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    console.log('✅ NLP Dataset loaded for spelling handling.');
  }
} catch (error) {
  console.error('❌ Failed to load nlp_dataset.json:', error.message);
}

/**
 * Pre-processes the user query to handle common misspellings and keywords.
 * This enables faster local handling and cleaner LLM input.
 * @param {string} query - The raw user query.
 * @returns {string} - The corrected query.
 */
const preprocessQuery = (query) => {
  if (!query) return "";
  let correctedQuery = query.toLowerCase();

  // Simple keyword mapping based on nlp_dataset.json
  Object.entries(nlpDataset.keywords).forEach(([correctWord, misspellings]) => {
    misspellings.forEach(misspelling => {
      // Use regex with word boundaries to avoid partial replacements
      const regex = new RegExp(`\\b${misspelling}\\b`, 'gi');
      correctedQuery = correctedQuery.replace(regex, correctWord);
    });
  });

  return correctedQuery;
};

// Initialize the Gemini API
const geminiKey = process.env.GEMINI_API_KEY;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

// Centralized model configuration - Using gemini-1.5-flash for faster responses and better tool calling/JSON schema support
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest";

const _getModelCandidates = () => {
  const candidates = [
    process.env.GEMINI_MODEL,
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
  ].filter(Boolean);
  return [...new Set(candidates)];
};

const _shouldTryAnotherModel = (error) => {
  const msg = (error && error.message) ? String(error.message) : "";
  return msg.includes("404") || msg.includes("not found") || msg.includes("models/");
};

/**
 * Converts local file information to a GoogleGenerativeAI.Part object.
 * @param {string} path - The path to the local file.
 * @param {string} mimeType - The MIME type of the file.
 * @returns {object} - The generative part object.
 */
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

/**
 * Evaluates the priority of a civil complaint using Google Gemini AI Vision.
 * @param {string} imagePath - The path to the uploaded image.
 * @param {string} category - The detected or provided category.
 * @returns {Promise<{priority: string, reasoning: string}>}
 */
const evaluatePriorityWithAI = async (imagePath, category) => {
  // Local fallback logic based on category if AI is unavailable
  const getLocalPriorityFallback = (cat) => {
    switch (cat) {
      case 'Electricity':
      case 'Sewage':
        return { priority: 'High', reasoning: 'Potentially hazardous category, assigned High priority via local fallback.' };
      case 'Road':
        return { priority: 'Medium', reasoning: 'Infrastructure issue, assigned Medium priority via local fallback.' };
      case 'Garbage':
      default:
        return { priority: 'Medium', reasoning: 'General maintenance issue, assigned Medium priority via local fallback.' };
    }
  };

  try {
    if (!genAI) {
      return getLocalPriorityFallback(category);
    }

    let prompt = "";
    let visualPart = null;

    if (imagePath && fs.existsSync(imagePath)) {
      // Detect mime type based on extension
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

      visualPart = fileToGenerativePart(imagePath, mimeType);
      prompt = `
        You are an expert civil service dispatcher. Your task is to evaluate the priority of a citizen complaint based on the provided IMAGE.
        
        Complaint Category (Detected): ${category}
        
        Look at the image carefully and evaluate the priority as either "Low", "Medium", or "High" based on these criteria:
        - "High": Immediate danger to life, safety, or significant property damage (e.g., live wires, major flooding, gas leaks, huge potholes on main roads, toxic waste).
        - "Medium": Significant inconvenience or potential for damage if not addressed soon (e.g., standard potholes, street lights out in dark areas, overflowing bins, water leaks).
        - "Low": Minor inconvenience, cosmetic issues, or non-urgent maintenance (e.g., small litter, graffiti, minor pavement cracks).
        
        Return ONLY a JSON object with the following structure:
        {
          "priority": "High" | "Medium" | "Low",
          "reasoning": "A short 1-sentence explanation of why this priority was chosen based on visual evidence in the image."
        }
      `;
    } else {
      // Fallback if no image is provided (though the user wants image-based)
      return {
        priority: 'Medium',
        reasoning: 'No image provided for visual evaluation, defaulted to Medium.'
      };
    }

    let lastError = null;
    let text = "";
    for (const modelName of _getModelCandidates()) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([prompt, visualPart]);
        const response = await result.response;
        text = response.text();
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (_shouldTryAnotherModel(e)) {
          continue;
        }
        throw e;
      }
    }
    if (lastError) {
      throw lastError;
    }

    // Improved JSON extraction to handle markdown or conversational text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const evaluation = JSON.parse(jsonStr);

    console.log(`🤖 Gemini AI Vision Priority Evaluation: ${evaluation.priority} (${evaluation.reasoning})`);

    return {
      priority: evaluation.priority || 'Medium',
      reasoning: evaluation.reasoning || 'Standard visual evaluation.'
    };
  } catch (error) {
    const isQuotaExceeded = error.status === 429 || (error.message && error.message.includes('429'));

    if (isQuotaExceeded) {
      console.warn('⚠️ Gemini AI Quota Exceeded (429). Using local priority fallback.');
      return getLocalPriorityFallback(category);
    }

    console.error('❌ Gemini AI Priority Error:', error.message);
    // Fallback to Medium if AI fails for other reasons
    return {
      priority: 'Medium',
      reasoning: 'AI visual evaluation unavailable, defaulted to Medium.'
    };
  }
};

/**
 * Verifies the authenticity and relevance of an image using Gemini AI Vision.
 * This is used to prevent fake, computer-generated, or irrelevant uploads.
 * @param {string} imagePath - The path to the uploaded image.
 * @returns {Promise<{is_authentic: boolean, score: number, relevance: number, reason: string}>}
 */
const verifyImageAuthenticityWithAI = async (imagePath) => {
  try {
    if (!genAI) {
      return {
        is_authentic: false,
        is_screenshot: false,
        score: 0,
        relevance: 0,
        priority: 'Medium',
        ai_reasoning: "Gemini API key not configured, relying on local verification.",
        reason: "Gemini API key not configured, relying on local verification.",
        api_failed: true
      };
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
      return { is_authentic: false, score: 0, relevance: 0, reason: "No image provided." };
    }

    // Detect mime type based on extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const visualPart = fileToGenerativePart(imagePath, mimeType);
    const prompt = `
      AI auditor for CiviSmart. Analyze this image for civil infrastructure issues (potholes, garbage, sewage leaks, etc.).
      
      Rules:
      1. is_screenshot: true if UI elements/borders/phone screen visible.
      2. is_authentic: false if screenshot/manipulated.
      3. relevance: 0.0-1.0 (low for pets/people/interiors).
      4. category: Suggest one of [Road, Electricity, Garbage, Sewage, Water Supply, Other Issue].
      5. priority: Evaluate priority as "High", "Medium", or "Low" based on the severity of the issue in the image (e.g. huge potholes = High, small litter = Low).
      6. priority_reasoning: Provide a short 1-sentence explanation of why this priority was chosen.

      JSON output: {"is_authentic":bool, "is_screenshot":bool, "authenticity_score":num, "relevance_score":num, "category":"str", "priority":"str", "priority_reasoning":"str", "reason":str}
    `;

    let lastError = null;
    let text = "";
    for (const modelName of _getModelCandidates()) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([prompt, visualPart]);
        const response = await result.response;
        text = response.text();
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (_shouldTryAnotherModel(e)) {
          continue;
        }
        throw e;
      }
    }
    if (lastError) {
      throw lastError;
    }

    // Improved JSON extraction
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const evaluation = JSON.parse(jsonStr);

    console.log(`🛡️ Gemini AI Image Verification: Authentic=${evaluation.is_authentic}, Screenshot=${evaluation.is_screenshot}, Category=${evaluation.category}, Relevance=${evaluation.relevance_score.toFixed(2)} (${evaluation.reason})`);

    return {
      is_authentic: evaluation.is_authentic,
      is_screenshot: !!evaluation.is_screenshot,
      score: evaluation.authenticity_score,
      relevance: evaluation.relevance_score,
      category: evaluation.category,
      reason: evaluation.reason,
      priority: evaluation.priority || 'Medium',
      ai_reasoning: evaluation.priority_reasoning || evaluation.reason || 'Standard visual evaluation.'
    };
  } catch (error) {
    const isQuotaExceeded = error.status === 429 || (error.message && error.message.includes('429'));

    if (isQuotaExceeded) {
      console.warn('⚠️ Gemini AI Quota Exceeded (429). Falling back to local verification only.');
      return {
        is_authentic: false,
        is_screenshot: false,
        score: 0,
        relevance: 0,
        priority: 'Medium',
        ai_reasoning: "Gemini API quota exceeded, relying on local verification.",
        reason: "Gemini API quota exceeded, relying on local verification.",
        api_failed: true
      };
    }

    console.error('❌ Gemini AI Verification Error:', error.message);
    return {
      is_authentic: false,
      is_screenshot: false,
      score: 0,
      relevance: 0,
      priority: 'Medium',
      ai_reasoning: "AI verification service unavailable, using cautious fallback.",
      reason: "AI verification service unavailable, using cautious fallback.",
      api_failed: true
    };
  }
};

/**
 * Enhances handleChatQuery to include context about the user's complaints and schedule.
 */
const natural = require('natural');

// Pre-load the Local NLP Model
let chatbotClassifier;
const modelPath = path.join(__dirname, 'chatbot_model.json');

try {
  if (fs.existsSync(modelPath)) {
    natural.BayesClassifier.load(modelPath, null, (err, classifier) => {
      if (err) {
        console.error('❌ Error loading Local NLP Chatbot model:', err);
      } else {
        chatbotClassifier = classifier;
        console.log('🤖 Local NLP Chatbot model loaded successfully.');
      }
    });
  }
} catch (error) {
  console.error('❌ Failed to initialize Local NLP Chatbot:', error.message);
}

/**
 * Handles the chatbot query using a COMPLETELY local NLP system.
 * Uses a pre-trained Bayes classifier for intent detection.
 */
const handleChatQuery = async (query, context = "", userId = null, onChunk = null) => {
  const correctedQuery = preprocessQuery(query);
  const lowerQuery = correctedQuery.toLowerCase();

  console.log(`🚀 Local NLP Processing: "${query}" -> "${correctedQuery}"`);

  let responseText = "";

  // 1. Check for User-Specific Context first (Manual Override)
  // Only trigger if the query is explicitly about checking status/complaints
  // and ensure we don't accidentally hijack other intents (like profile update)
  const isStatusCheck =
    (lowerQuery.includes('status') || lowerQuery.includes('track') || lowerQuery.includes('check') || lowerQuery.includes('recent')) &&
    !lowerQuery.includes('profile') &&
    !lowerQuery.includes('account') &&
    !lowerQuery.includes('language') &&
    !lowerQuery.includes('password') &&
    !lowerQuery.includes('login') &&
    !lowerQuery.includes('help');

  if (userId && isStatusCheck) {
    try {
      const Complaint = require('../models/Complaint');
      const userComplaints = await Complaint.find({ user: userId }).sort({ createdAt: -1 }).limit(1);
      if (userComplaints.length > 0) {
        const last = userComplaints[0];
        responseText = `Your most recent report (#${last.complaintId}) for ${last.category} is currently ${last.status}. You can see full details in 'My Complaints'.`;
        if (onChunk) onChunk(responseText);
        return responseText;
      }
    } catch (err) {
      console.warn('⚠️ Error fetching user context:', err.message);
    }
  }

  // 2. Try the New Local BERT/GPT NLP Service via Python Worker
  try {
    const pythonManager = require('./pythonManager');
    const localResponse = await pythonManager.handleNLPQuery(correctedQuery, context);
    if (localResponse && !localResponse.includes("unavailable") && !localResponse.includes("couldn't process")) {
      console.log('🤖 Local BERT/GPT response successful.');
      responseText = localResponse;
      if (onChunk) onChunk(responseText);
      return responseText;
    }
  } catch (error) {
    console.error('❌ Local Python NLP failed, falling back to Naive Bayes:', error.message);
  }

  // 3. Fallback to the Trained Naive Bayes Classifier (Natural Library)
  if (chatbotClassifier) {
    const intent = chatbotClassifier.classify(lowerQuery);
    console.log(`🎯 Detected Intent (Naive Bayes Fallback): ${intent}`);

    const intentResponses = {
      'greetings': "**Hello!** 👋 I'm **CiviBot**, your AI assistant. How can I assist you today? 🤖",
      'tech_info': "**Technical Info:** ⚙️\nI use **local intent detection** (keyword normalization + a trained Naive Bayes intent model).\n\nFor complaint images, the system can run AI-based checks like:\n- **Authenticity/Relevance** 🛡️\n- **Priority Scoring** 🚨",
      'report_issue': "**To report a civic issue:** 📝\n1. Click **'Raise Complaint'** / **'Report an Issue'**.\n2. Add address or **mark on map** 📍.\n3. Upload a **real photo** 📸 of the issue.\n4. Click **Submit**.",
      'track_status': "**Track Status:** 🚦\nYou can track your complaints in the **'My Complaints'** section.\n\nWe update the status in **real-time** as our officers resolve the issue.",
      'category_road': "**Road Issue?** 🛣️\nUse **'Raise Complaint'** with a clear photo.\n\nOur system identifies road damage locally to alert the **Public Works department**.",
      'category_garbage': "**Garbage Issue?** 🗑️\nFor garbage accumulation or waste issues, report it via **'Raise Complaint'**.\n\nWe'll notify the **sanitation team** immediately.",
      'category_sewage': "**Sewage Issue?** 💧\nSewage or drainage problems can be reported through the app.\n\n*Please provide a clear photo so we can assess the urgency.*",
      'category_electricity': "**Electricity Issue?** ⚡\nDangerous wires or street light outages are **High Priority**.\n\n**Report them immediately** for quick resolution.",
      'portal_notifications': "**Notifications:** 🔔\nYou can check your latest updates and alerts in the **Notifications panel**.\n\nWe'll notify you here whenever there is a **status change** in your reported complaints.",
      'portal_features': "**CiviSmart Portal Features:** 🌟\n- **Raise Complaints**: With AI verification 📸\n- **Track Real-time**: Monitor progress ⏱️\n- **Update Profile**: Keep info current 👤\n- **Notifications**: Instant alerts 🔔\n\nYou can access all these from your **personal dashboard**.",
      'login_register': "**Login/Register:** 🔐\n- **Login**: Uses Aadhar/Username + Password.\n- **Register**: Requires mobile OTP verification.\n\nOnce logged in, you'll be redirected to your **dashboard**.",
      'map_help': "**Map Help:** 🗺️\n1. Use the **map picker** to mark your complaint location.\n2. Allow **location permission**.\n3. Search an address or **move the pin**.\n4. **Submit**.",
      'upload_rules': "**Upload Rules:** 📸\n- **Format**: JPG/PNG only.\n- **Content**: Real-world photo of the issue.\n- **Avoid**: Screenshots or unrelated images.",
      'image_authenticity': "**Image Rejected?** ⚠️\nReasons may include:\n- Looks like a **screenshot**.\n- **Low quality**.\n- **Unrelated** to the issue type.\n\n*Retake a real photo and try again.*",
      'duplicate_detection': "**Duplicate Detected?** 🔄\nIf your complaint is marked duplicate, it likely matches an existing nearby complaint.\n\nIt is linked to avoid **duplicate tickets**.",
      'priority_info': "**Priority System:** 🚨\nPriority is assigned as **Low/Medium/High** based on:\n- Issue type\n- Severity signals\n- AI reasoning from complaint content & image.",
      'resolution_process': "**Resolution Process:** ✅\n1. Officers update status: **Pending** → **In Progress** → **Resolved**.\n2. They upload **resolution evidence** (after-fix photo).\n3. You can review the evidence.",
      'feedback_help': "**Give Feedback:** ⭐\nAfter a complaint is **Resolved**:\n1. Open the complaint.\n2. Use the **Give Feedback** option.\n3. Add a star rating and comment.",
      'reraise_issue': "**Issue Not Fixed?** 🔄\n1. Open **My Complaints**.\n2. Find the resolved complaint.\n3. Click **Re-raise Issue**.\n4. Upload a fresh photo and submit.",
      'admin_analytics': "**Admin Analytics:** 📊\nAdmins can view:\n- **City-wide complaint analytics**.\n- **Filters** & status breakdowns.\n- **Hotspot-style insights** to prioritize work.",
      'officer_workflow': "**Officer Workflow:** 👮\n1. Manage complaints in **Officer Dashboard**.\n2. Move to **In Progress**.\n3. Mark **Resolved** with resolution evidence.",
      'language_help': "**Language Help:** 🌐\nUse the **language selector** in the portal to switch between available languages (e.g., **English, Hindi, Kannada**).",
      'troubleshooting': "**Troubleshooting:** 🛠️\n- **Refresh** the page.\n- Check **Network**.\n- **Log in** again.\n- **Upload error?** Try a smaller JPG/PNG photo.",
      'security_privacy': "**Security & Privacy:** 🔒\n**CiviSmart** takes your privacy seriously. Your data is **encrypted** and used solely for resolving civic issues.\n\nYou can manage your privacy settings in your **account profile**.",
      'contact_support': "**Contact Support:** 📞\nNeed help? Contact the support team at `support@civismart.gov` for technical assistance.",
      'thanks': "**You're very welcome!** 😊\nI'm here to help make our city smarter. Let me know if there's anything else! 🏙️",
      'out_of_scope': "**I'm here to help with CiviSmart!** 🏙️\nI can answer questions about:\n- 📝 Complaints\n- 🚦 Tracking\n- 🔐 Login\n- 🔔 Notifications\n- 🧠 AI Checks",
      'emergency_contact': "**Emergency:** 🚨\nFor immediate danger, dial **100** (Police) or **101** (Fire).\n\nCiviSmart is for **non-emergency** issues.",
      'delete_account': "**Delete Account:** 🗑️\nGo to **Profile** → **Settings** → **Delete Account**.\n\n*Note: This cannot be undone.*",
      'upload_error': "**Upload Error?** ⚠️\n- Use **JPG/PNG** (<5MB).\n- Check **Network**.\n- **Re-login** if stuck.",
    };

    if (intentResponses[intent]) {
      responseText = intentResponses[intent];
    }
  }

  // 4. Final Fallback
  if (!responseText) {
    responseText = "**I am here to provide answers specifically related to CiviSmart!** 🏙️\n\nPlease let me know if you have any questions regarding:\n- 📝 **Complaint Registration**\n- 🚦 **Status Tracking**";
  }

  if (onChunk) onChunk(responseText);
  return responseText;
};

module.exports = {
  evaluatePriorityWithAI,
  handleChatQuery,
  verifyImageAuthenticityWithAI,
  genAI,
  fileToGenerativePart,
  GEMINI_MODEL
};
