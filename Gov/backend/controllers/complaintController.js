const asyncHandler = require('express-async-handler');
const Complaint = require('../models/Complaint');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const pythonManager = require('../utils/pythonManager');

// Helper to calculate distance between two coordinates in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Generate AI recommendations based on category and priority
const generateAIRecommendations = (category, priority, description = "") => {
  const recommendations = [];
  const descLower = description ? description.toLowerCase() : "";

  switch (category) {
    case 'Road':
      recommendations.push('Dispatch road inspection team to assess damage');
      if (priority === 'High') recommendations.push('Set up temporary safety barriers around the hazard');
      if (descLower.includes('pothole')) recommendations.push('Schedule asphalt patching work');
      break;
    case 'Electricity':
      recommendations.push('Assign a certified electrician for immediate inspection');
      if (descLower.includes('dark') || descLower.includes('lamp')) recommendations.push('Check street light circuit breaker and bulb replacement');
      if (priority === 'High') recommendations.push('Coordinate with power department for area-wide check');
      break;
    case 'Garbage':
      recommendations.push('Redirect nearest waste collection truck to the location');
      if (descLower.includes('smell') || descLower.includes('stink')) recommendations.push('Apply disinfectant after waste removal');
      recommendations.push('Check if community bins are undersized for the area');
      break;
    case 'Sewage':
      recommendations.push('Deploy sewage suction machine to clear blockage');
      recommendations.push('Inspect manhole covers and structural integrity of the drain');
      if (descLower.includes('overflow')) recommendations.push('Check for downstream blockages in the main line');
      break;
    case 'Water Supply':
      recommendations.push('Dispatch water supply maintenance team for inspection');
      recommendations.push('Check for pipeline leakage and valve faults');
      if (priority === 'High') recommendations.push('Arrange immediate isolation of leakage and temporary water supply if needed');
      break;
    default:
      recommendations.push('Assign field officer for manual verification');
      recommendations.push('Contact reporter for additional details if needed');
  }

  return recommendations;
};

// Image Verification Model using Python worker
const verifyAllCategories = async (imagePath, categories) => {
  if (!imagePath || !categories || categories.length === 0) return {};

  try {
    const absoluteImagePath = path.isAbsolute(imagePath) ? imagePath : path.join(__dirname, '..', imagePath);

    console.log(`🚀 Starting batch image verification for categories: ${categories.join(', ')}`);
    const startTime = Date.now();
    const scores = await pythonManager.verifyImage(absoluteImagePath, categories);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`⏱️ Batch verification took ${duration.toFixed(2)}s`);
    Object.keys(scores).forEach(cat => {
      console.log(`🔍 Confidence for ${cat}: ${scores[cat].toFixed(2)}`);
    });
    return scores;
  } catch (error) {
    console.error('Image verification error:', error);
    return {};
  }
};

// Image Authenticity Verification using a two-stage process:
// Stage 1: Local Keras Models (trained for civil issues)
// Stage 2: Gemini AI (for final authenticity, screenshot detection, and fallback)
const verifyImageAuthenticity = async (imagePath, reportedCategory) => {
  if (!imagePath) return { score: 0, is_authentic: false, relevance: 0, reason: "No image provided" };

  try {
    const absoluteImagePath = path.isAbsolute(imagePath) ? imagePath : path.join(__dirname, '..', imagePath);
    console.log(`🛡️ Starting Optimized Verification for: ${reportedCategory}`);

    // --- STEP 1: FAST LOCAL VERIFICATION ---
    const categoriesToCheck = ['Road', 'Garbage', 'Sewage', 'Electricity'];

    // Run Optimized Single-Pass Analysis (Replaces parallel calls)
    console.log(`🚀 Starting optimized single-pass image analysis...`);
    const startTime = Date.now();

    const analysis = await pythonManager.analyzeImage(absoluteImagePath, categoriesToCheck).catch(err => {
      console.error('Image analysis failed:', err);
      return { scores: { relevance: 0 }, auth: { is_authentic: true, score: 0.5 } };
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`⏱️ Analysis took ${duration.toFixed(2)}s`);

    const localScores = analysis.scores || {};
    const localAuthResult = analysis.auth || { is_authentic: true, score: 0.5 };

    const localRelevance = localScores.relevance || 0;

    const kerasConfidence = (reportedCategory && localScores[reportedCategory]) ? localScores[reportedCategory] : 0;

    // Find the highest confidence among all categories
    let maxConfidence = 0;
    let detectedCategory = null;

    for (const [cat, score] of Object.entries(localScores)) {
      if (cat !== 'relevance' && score > maxConfidence) {
        maxConfidence = score;
        detectedCategory = cat;
      }
    }

    console.log(`📊 Local Model Analysis - Max Confidence: ${maxConfidence.toFixed(2)} (${detectedCategory}), Authenticity: ${localAuthResult.is_authentic}`);

    // EARLY EXIT: If Local Model is confident (either in reported category OR any category) AND image is authentic
    // Lower threshold slightly to 0.85 to be more permissive with local models
    const isConfident = (kerasConfidence > 0.85) || (maxConfidence > 0.85);
    const isLocalAuthentic = localAuthResult.is_authentic && localAuthResult.score > 0.6;
    const isRelevant = localRelevance > 0.75;

    if (isConfident && isLocalAuthentic && isRelevant) {
      console.log(`⚡ EARLY EXIT: High Local confidence (${maxConfidence.toFixed(2)}). Skipping Gemini.`);
      return {
        score: localAuthResult.score,
        is_authentic: true,
        is_screenshot: false,
        relevance: localRelevance,
        category: detectedCategory || reportedCategory,
        reason: "Verified by local high-confidence model",
        keras_confidence: maxConfidence,
        localScores: localScores,
        speed: "fast"
      };
    }

    // --- STEP 2: GEMINI FALLBACK (Only if needed or for extra security) ---
    console.log(`📡 Keras confidence low (${kerasConfidence.toFixed(2)}). Calling Gemini fallback...`);
    const aiResult = await verifyImageAuthenticityWithAI(absoluteImagePath);

    let finalRelevance = Math.max(aiResult.relevance, localRelevance);
    let finalScore = (aiResult.score * 0.6) + (localAuthResult.score * 0.4);
    let isAuthentic = (aiResult.is_authentic || localAuthResult.is_authentic) && finalRelevance > 0.7;

    if (aiResult.api_failed) {
      finalRelevance = localRelevance;
      finalScore = localAuthResult.score;
      isAuthentic = localAuthResult.is_authentic && finalRelevance > 0.7;
    }

    return {
      score: finalScore,
      is_authentic: isAuthentic,
      is_screenshot: aiResult.is_screenshot,
      relevance: finalRelevance,
      category: aiResult.category || detectedCategory || reportedCategory,
      reason: aiResult.reason,
      keras_confidence: kerasConfidence,
      localScores: localScores,
      speed: "full",
      priority: aiResult.priority,
      ai_reasoning: aiResult.ai_reasoning
    };
  } catch (error) {
    console.error('Two-stage verification error:', error);
    return { score: 0, is_authentic: false, relevance: 0, reason: "Verification failed" };
  }
};

const {
  evaluatePriorityWithAI,
  verifyImageAuthenticityWithAI,
  handleChatQuery,
  genAI,
  fileToGenerativePart,
  GEMINI_MODEL
} = require('../utils/aiPriority');

// @desc    Voice to Complaint transcription using Gemini (Online Mode) or Local Fallback
// @route   POST /api/complaints/voice-transcribe
// @access  Private
const transcribeVoice = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No audio file provided');
  }

  try {
    if (!genAI) {
      return res.status(200).json({
        transcription: "Voice transcription unavailable right now.",
        category: "Other Issue",
        summary: "Please type your description manually."
      });
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const audioPath = req.file.path;
    const audioData = fileToGenerativePart(audioPath, req.file.mimetype);

    const prompt = `
      You are a civil complaint transcriber. Listen to this audio recording and:
      1. Transcribe the user's description of the issue.
      2. Detect the category (Road, Electricity, Garbage, Sewage, Water Supply, or Other Issue).
      3. Summarize the main complaint.
      
      Return ONLY a JSON object:
      {
        "transcription": "full text",
        "category": "Detected Category",
        "summary": "Short summary"
      }
    `;

    const result = await model.generateContent([prompt, audioData]);
    const response = await result.response;
    const data = JSON.parse(response.text().replace(/```json|```/g, '').trim());

    res.status(200).json(data);
  } catch (error) {
    const isQuotaExceeded = error.status === 429 || (error.message && error.message.includes('429'));
    const isAuthError = error.status === 403 || (error.message && error.message.includes('PERMISSION_DENIED')) || (error.message && error.message.includes('unregistered callers'));
    const isModelError = error.status === 404 || (error.message && error.message.includes('models/')) || (error.message && error.message.toLowerCase().includes('not found'));

    if (isQuotaExceeded) {
      console.warn('⚠️ Gemini AI Transcription Quota Exceeded (429). Returning local fallback.');
      return res.status(200).json({
        transcription: "Voice transcription unavailable due to high traffic.",
        category: "Other Issue",
        summary: "Please type your description manually."
      });
    }

    if (isAuthError || isModelError) {
      return res.status(200).json({
        transcription: "Voice transcription unavailable right now.",
        category: "Other Issue",
        summary: "Please type your description manually."
      });
    }

    console.error('Voice transcription error:', error.message);
    res.status(500).json({ message: 'Transcription failed. Please type your description.' });
  }
});

const getComplaints = asyncHandler(async (req, res) => {
  // Check IAM Permissions for officers
  if (req.user.userType === 'officer' && !req.user.permissions?.canRead) {
    res.status(403);
    throw new Error('IAM Permission Denied: You do not have read access to complaints.');
  }

  const complaints = await Complaint.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.status(200).json(complaints);
});

const createComplaint = asyncHandler(async (req, res) => {
  let { description, latitude, longitude, reRaisedFrom } = req.body;
  let { address, category } = req.body;

  let reRaisedFromId = null;
  if (reRaisedFrom) {
    const originalComplaint = await Complaint.findById(reRaisedFrom);
    if (!originalComplaint) {
      res.status(400);
      throw new Error('Original complaint not found for re-raise');
    }

    if (originalComplaint.user.toString() !== req.user.id.toString()) {
      res.status(403);
      throw new Error('Not authorized to re-raise this complaint');
    }

    if (originalComplaint.status !== 'Resolved') {
      res.status(400);
      throw new Error('Only resolved complaints can be re-raised');
    }

    reRaisedFromId = originalComplaint._id;
    if (!category) category = originalComplaint.category;
    if (!address) address = originalComplaint.address;
    if (!latitude && originalComplaint.location?.latitude) latitude = originalComplaint.location.latitude;
    if (!longitude && originalComplaint.location?.longitude) longitude = originalComplaint.location.longitude;
  }

  // Validate that either address or map coordinates are provided
  // DESCRIPTION IS NO LONGER REQUIRED
  if (!address && !latitude) {
    res.status(400);
    throw new Error('Please provide either an address or map location');
  }

  // If no image is provided, we might still need a description as a fallback, 
  // but the user's requirement says "use only image as the main source".
  // However, for safety, if there's no image AND no description, we can't do much.
  if (!req.file && !description) {
    res.status(400);
    throw new Error('Please upload an image of the issue');
  }

  // If address is missing or looks like coordinates, try to get a complete address
  if (latitude && longitude && (!address || address.startsWith('Map Location') || address.includes('('))) {
    const fetchNominatimAddress = async (lat, lng) => {
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { 'User-Agent': 'CiviSmart-Gov/1.0' } }
        );
        if (response.data && response.data.display_name) {
          console.log(`✅ Nominatim address found: ${response.data.display_name}`);
          return response.data.display_name;
        }
      } catch (err) {
        console.error('Nominatim fallback failed:', err.message);
      }
      return null;
    };

    try {
      console.log(`🌍 Reverse geocoding for complete address: ${latitude}, ${longitude}`);
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const googleResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
        );

        if (googleResponse.data.status === 'OK' && googleResponse.data.results[0]) {
          address = googleResponse.data.results[0].formatted_address;
          console.log(`✅ Google Address found: ${address}`);
        } else {
          const fallback = await fetchNominatimAddress(latitude, longitude);
          if (fallback) address = fallback;
        }
      } else {
        const fallback = await fetchNominatimAddress(latitude, longitude);
        if (fallback) address = fallback;
      }
    } catch (error) {
      console.error('Error reverse geocoding in backend:', error.message);
      const fallback = await fetchNominatimAddress(latitude, longitude);
      if (fallback) address = fallback;
    }
  }

  // 1. Check for Potential Duplicates (Geospatial)
  // We prioritize location now as description is optional
  const potentialDuplicates = await Complaint.find({
    status: { $in: ['Pending', 'In Progress'] },
    'location.latitude': { $gte: parseFloat(latitude) - 0.002, $lte: parseFloat(latitude) + 0.002 },
    'location.longitude': { $gte: parseFloat(longitude) - 0.002, $lte: parseFloat(longitude) + 0.002 }
  }).limit(5);

  let duplicateFound = null;
  if (latitude && longitude && potentialDuplicates.length > 0) {
    for (const comp of potentialDuplicates) {
      const distance = calculateDistance(latitude, longitude, comp.location.latitude, comp.location.longitude);
      if (distance < 50) { // Very close proximity (50m)
        duplicateFound = comp;
        console.log(`⚠️ Potential duplicate found by location: ${duplicateFound.complaintId}`);
        break;
      }
    }
  }

  // Initial Category (Placeholder if not provided)
  if (!category) category = 'Other Issue';

  // Language Detection (defaulted since description analysis removed)
  const detectedLanguage = 'English';

  // Default priority if no image evaluation is possible
  let priority = 'Medium';
  let aiReasoning = 'Default priority assigned.';

  // 3. Image Verification & Category Detection (THE MAIN SOURCE)
  let isVerified = true;
  let isAuthentic = false;
  let authenticityScore = 0;
  const supportedCategories = ['Road', 'Electricity', 'Garbage', 'Sewage', 'Water Supply', 'Other Issue'];
  const categoriesNeedingVerification = ['Road', 'Garbage', 'Sewage', 'Electricity'];

  if (req.file) {
    console.log(`🖼️ Processing image for CATEGORIZATION and AUTHENTICITY.`);

    // 1. Explicitly check for "screenshot" in the original filename
    const originalName = req.file.originalname.toLowerCase();
    if (originalName.includes('screenshot') || originalName.includes('scrn') || originalName.includes('capture')) {
      console.warn(`🚨 Filename-based screenshot detected: ${req.file.originalname}. Blocking upload.`);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(400);
      throw new Error(' "Screenshots" are not allowed. Please upload a real, original photo taken with your camera.');
    }

    const authResult = await verifyImageAuthenticity(req.file.path, category);
    isAuthentic = authResult.is_authentic;
    authenticityScore = authResult.score;
    const relevance = authResult.relevance;
    const aiSuggestedCategory = authResult.category;

    if (authResult.priority) {
      priority = authResult.priority;
      aiReasoning = authResult.ai_reasoning;
    }

    if (authResult.is_screenshot) {
      console.warn(`🚨 AI-detected screenshot. Blocking upload.`);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(400);
      throw new Error('Screenshots are not allowed. Please upload a real, original photo taken with your camera.');
    }

    const aiCategoryKey = typeof aiSuggestedCategory === 'string' ? aiSuggestedCategory.trim().toLowerCase() : '';
    const matchedCategory = aiCategoryKey ? supportedCategories.find(c => c.toLowerCase() === aiCategoryKey) : null;
    if (matchedCategory) {
      console.log(`🤖 AI Suggested Category: ${matchedCategory}`);
      category = matchedCategory;
    }

    // Get confidence scores (reuse from authentication step to save time)
    const scores = authResult.localScores || await verifyAllCategories(req.file.path, categoriesNeedingVerification);

    console.log(`📊 Final Combined Relevance: ${relevance.toFixed(2)}`);

    // If relevance is low, block it immediately
    if (relevance < 0.75) {
      console.warn(`🚨 Irrelevant image detected (${relevance.toFixed(2)}). Blocking upload.`);

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(400);
      throw new Error('The uploaded image is not relevant to a civil issue (e.g., it looks like an animal, person, or indoor scene). Please upload a clear photo of the problem.');
    }

    // If authenticity is low, block it immediately
    if (!isAuthentic || authenticityScore < 0.65) {
      console.warn(`🚨 Inauthentic or suspicious image detected (Score: ${authenticityScore.toFixed(2)}). Blocking upload.`);

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(400);
      throw new Error('The uploaded image appears to be manipulated, computer-generated, or not an original photo. Please upload a real, original photo.');
    }

    console.log(`📊 Image Relevance Score: ${relevance.toFixed(2)}`);

    let highestScore = 0;
    if (categoriesNeedingVerification.includes(category)) {
      let bestCategory = category;
      highestScore = -1;

      Object.keys(scores).forEach(cat => {
        if (cat !== 'relevance') {
          const penaltyFactor = relevance < 0.8 ? Math.pow(relevance, 2) : relevance;
          scores[cat] *= penaltyFactor;
        }
      });

      const priorityOrder = ['Garbage', 'Sewage', 'Road', 'Electricity'];
      const CONFIDENCE_THRESHOLD = 0.96;

      const confidentCats = priorityOrder.filter(cat => (scores[cat] || 0) > CONFIDENCE_THRESHOLD);

      if (confidentCats.length === 1) {
        bestCategory = confidentCats[0];
        highestScore = scores[bestCategory];
      } else {
        for (const cat of priorityOrder) {
          const score = scores[cat] || 0;
          if (score > highestScore) {
            highestScore = score;
            bestCategory = cat;
          }
        }
      }

      if (bestCategory !== category) {
        console.log(`✨ Category corrected from ${category} to ${bestCategory} (Score: ${highestScore.toFixed(2)})`);
        category = bestCategory;
      } else {
        const threshold = category === 'Road' ? 0.6 : 0.7;

        if (relevance < 0.8) {
          console.log(`⚠️ Image has low relevance to civil issues (Relevance: ${relevance.toFixed(2)})`);
          isVerified = false;
        } else if (!isAuthentic && authenticityScore < 0.5) {
          console.log(`⚠️ Image flagged as suspicious (Authenticity: ${authenticityScore.toFixed(2)})`);
          isVerified = false;
        } else if (highestScore < threshold) {
          console.log(`⚠️ Image does not strongly match ${category} (Score: ${highestScore.toFixed(2)}, Threshold: ${threshold})`);
          isVerified = false;
        } else {
          console.log(`✅ Image verified as ${category} (Score: ${highestScore.toFixed(2)})`);
        }
      }
    }

    // FINAL BLOCKING LOGIC: Balanced strictness.
    // Block if:
    // 1. Not verified AND (Not authentic OR relevance is low)
    if (!isVerified && (!isAuthentic || relevance < 0.8)) { // Increased from 0.75 to 0.8
      console.warn(`🚨 BLOCKING: Image failed verification and relevance/authenticity is insufficient.`);

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(400);
      throw new Error('Image validation failed. The photo does not match the reported issue or seems irrelevant. Please upload a clear, original photo of the problem.');
    }

    // Boost priority if image verification is extremely confident and it's currently Medium
    // Only boost if the image is also authentic
    if (highestScore > 0.98 && isAuthentic && priority === 'Medium') {
      console.log(`🚀 Boosting priority to High due to extremely high AI confidence (${highestScore.toFixed(2)})`);
      priority = 'High';
      aiReasoning = 'High confidence from local image analysis.';
    }
  }

  // 4. Generate Unique Complaint ID
  // Using a combination of year, current count, and a random suffix to ensure uniqueness
  const year = new Date().getFullYear();
  const count = await Complaint.countDocuments();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const complaintId = `CMP-${year}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;

  const complaint = await Complaint.create({
    user: req.user.id,
    complaintId,
    category,
    description,
    address,
    location: {
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    },
    priority,
    status: 'Pending',
    image: req.file ? `/uploads/${req.file.filename}` : null,
    isVerified: isVerified, // Track if the image matches the category
    isAuthentic: isAuthentic, // Back to showing authenticity if the verifier says so
    authenticityScore: authenticityScore,
    isDuplicateOf: duplicateFound ? duplicateFound._id : null,
    reRaisedFrom: reRaisedFromId,
    aiPriorityReasoning: aiReasoning,
    aiRecommendations: generateAIRecommendations(category, priority, description),
    detectedLanguage: detectedLanguage
  });

  if (complaint) {
    res.status(201).json(complaint);
  } else {
    res.status(400);
    throw new Error('Invalid complaint data');
  }
});

const getPublicComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('user', 'name citizenId mobileNumber');
  res.status(200).json(complaints);
});

const getAllComplaints = asyncHandler(async (req, res) => {
  // Check IAM Permissions for officers
  if (req.user.userType === 'officer' && !req.user.permissions?.canRead) {
    res.status(403);
    throw new Error('IAM Permission Denied: You do not have read access to view all complaints.');
  }

  let query = {};
  const { startDate, endDate } = req.query;

  // Date filtering
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      // Set to end of day if only date is provided
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // IAM Logic: Officers only see complaints from their department
  if (req.user.userType === 'officer') {
    if (!req.user.department || req.user.department === 'None') {
      res.status(403);
      throw new Error('Officer has no assigned department');
    }
    query.category = req.user.department;
    console.log(`🔒 IAM: Filtering complaints for ${req.user.name} (Dept: ${req.user.department})`);
  } else if (req.user.userType !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view all complaints');
  }

  const complaints = await Complaint.find(query)
    .sort({ createdAt: -1 })
    .populate('user', 'name citizenId mobileNumber');

  res.status(200).json(complaints);
});

const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, priority } = req.body;
  const complaint = await Complaint.findById(req.params.id);

  if (!complaint) {
    res.status(404);
    throw new Error('Complaint not found');
  }

  // Check IAM Permissions
  if (req.user.userType === 'officer' && req.user.permissions?.canWrite === false) {
    res.status(403);
    throw new Error('IAM Permission Denied: You do not have write access to update complaints.');
  }

  // If status is being changed to Resolved, ensure evidence is provided
  if (status === 'Resolved') {
    if (!req.file && !complaint.resolvedImage) {
      res.status(400);
      throw new Error('Resolution picture is required to mark a complaint as Resolved.');
    }

    if (req.file) {
      complaint.resolvedImage = `/uploads/${req.file.filename}`;
    }
  }

  if (status) complaint.status = status;
  if (priority) complaint.priority = priority;

  const updatedComplaint = await complaint.save();

  // Emit real-time notification
  const io = req.app.get('socketio');
  if (io) {
    io.to(complaint.user.toString()).emit('notification', {
      type: 'STATUS_UPDATE',
      title: 'Complaint Update',
      message: `Your complaint #${complaint.complaintId} status has been changed to "${status}".`,
      complaintId: complaint._id,
      status: status,
      timestamp: new Date()
    });
  }

  res.json(updatedComplaint);
});

const deleteComplaint = asyncHandler(async (req, res) => {
  // Check IAM Permissions
  if (req.user.userType === 'officer' && req.user.permissions?.canDelete === false) {
    res.status(403);
    throw new Error('IAM Permission Denied: You do not have delete access.');
  }

  if (req.user.userType !== 'admin' && req.user.userType !== 'officer') {
    res.status(403);
    throw new Error('Not authorized. Only admins or authorized officers can delete complaints.');
  }

  const complaint = await Complaint.findById(req.params.id);

  if (!complaint) {
    res.status(404);
    throw new Error('Complaint not found');
  }

  await complaint.deleteOne();

  res.status(200).json({ message: 'Complaint removed successfully' });
});

// @desc    Submit feedback for a resolved complaint
// @route   POST /api/complaints/:id/feedback
// @access  Private (Citizen only)
const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const complaint = await Complaint.findById(req.params.id);

  if (!complaint) {
    res.status(404);
    throw new Error('Complaint not found');
  }

  // Ensure only the user who created the complaint can give feedback
  if (complaint.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error('User not authorized to give feedback on this complaint');
  }

  // Ensure complaint is resolved
  if (complaint.status !== 'Resolved') {
    res.status(400);
    throw new Error('Feedback can only be given for resolved complaints');
  }

  complaint.feedback = {
    rating,
    comment,
    submittedAt: new Date(),
  };

  const updatedComplaint = await complaint.save();

  res.status(200).json(updatedComplaint);
});

// GET /api/complaints/hotspots
// Get clusters of complaints for hotspot analysis
const getComplaintHotspots = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ status: { $ne: 'Resolved' } });

  const hotspots = [];
  const visited = new Set();
  const CLUSTER_RADIUS_METERS = 500; // 500m radius for a hotspot

  for (let i = 0; i < complaints.length; i++) {
    if (visited.has(complaints[i]._id.toString())) continue;
    if (!complaints[i].location || !complaints[i].location.latitude) continue;

    const cluster = [complaints[i]];
    visited.add(complaints[i]._id.toString());

    for (let j = i + 1; j < complaints.length; j++) {
      if (visited.has(complaints[j]._id.toString())) continue;
      if (!complaints[j].location || !complaints[j].location.latitude) continue;

      const distance = calculateDistance(
        complaints[i].location.latitude,
        complaints[i].location.longitude,
        complaints[j].location.latitude,
        complaints[j].location.longitude
      );

      if (distance < CLUSTER_RADIUS_METERS) {
        cluster.push(complaints[j]);
        visited.add(complaints[j]._id.toString());
      }
    }

    if (cluster.length >= 2) { // Only consider groups of 2 or more as a hotspot
      // Calculate center of the hotspot
      const avgLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
      const avgLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;

      // Count categories in this hotspot
      const categoryCounts = {};
      cluster.forEach(c => {
        categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      });

      hotspots.push({
        center: { latitude: avgLat, longitude: avgLng },
        count: cluster.length,
        categories: categoryCounts,
        complaints: cluster.map(c => c.complaintId)
      });
    }
  }

  res.status(200).json(hotspots.sort((a, b) => b.count - a.count));
});

module.exports = {
  getComplaints,
  createComplaint,
  getPublicComplaints,
  getAllComplaints,
  updateComplaintStatus,
  deleteComplaint,
  getComplaintHotspots,
  submitFeedback,
  transcribeVoice,
};
