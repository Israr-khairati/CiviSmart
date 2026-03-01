import os
import sys
import json
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AutoModelForCausalLM, pipeline

# Suppress warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings("ignore")

# Model names
BERT_MODEL_NAME = "typeform/distilbert-base-uncased-mnli" # Zero-Shot Classification Model

# Global models and tokenizers
classifier = None
_keyword_dataset = None
_training_data = None
_normalized_training_phrases = None
_cached_responses = None
_cached_intent_phrases = None
_cached_normalization_regex = None
_cached_normalization_map = None

def get_nlp_models():
    global classifier
    if classifier is None:
        try:
            print("DEBUG: Loading local BERT Zero-Shot classifier...", file=sys.stderr)
            # Use DistilBERT MNLI for Zero-Shot Classification
            classifier = pipeline("zero-shot-classification", model=BERT_MODEL_NAME, device=-1, framework="pt") 
        except Exception as e:
            print(f"DEBUG: Error loading BERT: {e}", file=sys.stderr)
            classifier = "FALLBACK"
            
    return classifier

import re
from difflib import get_close_matches

def _load_keyword_dataset():
    global _keyword_dataset
    if _keyword_dataset is not None:
        return _keyword_dataset

    dataset_path = os.path.join(os.path.dirname(__file__), "nlp_dataset.json")
    try:
        with open(dataset_path, "r", encoding="utf-8") as f:
            _keyword_dataset = json.load(f)
    except Exception as e:
        print(f"DEBUG: Unable to load nlp_dataset.json: {e}", file=sys.stderr)
        _keyword_dataset = {"keywords": {}}

    return _keyword_dataset

def _normalize_text(text):
    text = text if isinstance(text, str) else str(text)
    text = text.replace("\u2019", "'")
    text = text.lower().strip()
    text = re.sub(r"[-_/]+", " ", text)
    text = re.sub(r"[^0-9a-zA-Z\s\u0900-\u097F\u0C80-\u0CFF]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text

def _get_normalization_regex():
    global _cached_normalization_regex, _cached_normalization_map
    if _cached_normalization_regex is not None:
        return _cached_normalization_regex, _cached_normalization_map

    dataset = _load_keyword_dataset()
    keywords = dataset.get("keywords", {}) if isinstance(dataset, dict) else {}
    
    mapping = {}
    variants_list = []
    
    for canonical, variants in keywords.items():
        if not variants: continue
        for v in variants:
            if not v or not isinstance(v, str): continue
            v_clean = v.strip().lower()
            if not v_clean: continue
            mapping[v_clean] = canonical
            variants_list.append(v_clean)
            
    # Sort by length descending to match longest phrases first
    variants_list.sort(key=len, reverse=True)
    
    if not variants_list:
        _cached_normalization_regex = False
        _cached_normalization_map = {}
        return None, {}

    # Escape all variants and join with OR
    pattern = r"\b(" + "|".join(re.escape(v) for v in variants_list) + r")\b"
    try:
        regex = re.compile(pattern, re.IGNORECASE)
        _cached_normalization_regex = regex
        _cached_normalization_map = mapping
    except Exception as e:
        print(f"DEBUG: Regex compilation error: {e}", file=sys.stderr)
        _cached_normalization_regex = False
        _cached_normalization_map = {}
        
    return _cached_normalization_regex, _cached_normalization_map

def _apply_keyword_normalization(text):
    regex, mapping = _get_normalization_regex()
    
    if not regex:
        return re.sub(r"\s+", " ", text).strip()
        
    def replace(match):
        return mapping.get(match.group(0).lower(), match.group(0))
        
    normalized = regex.sub(replace, text)
    return re.sub(r"\s+", " ", normalized).strip()

def _load_training_data():
    global _training_data
    if _training_data is not None:
        return _training_data

    training_path = os.path.join(os.path.dirname(__file__), "utils", "chatbot_training_data.json")
    try:
        with open(training_path, "r", encoding="utf-8") as f:
            _training_data = json.load(f)
    except Exception as e:
        print(f"DEBUG: Unable to load chatbot_training_data.json: {e}", file=sys.stderr)
        _training_data = {}

    return _training_data

def _get_normalized_training_phrases():
    global _normalized_training_phrases
    if _normalized_training_phrases is not None:
        return _normalized_training_phrases

    data = _load_training_data()
    normalized = {}
    if isinstance(data, dict):
        for intent, phrases in data.items():
            if not isinstance(phrases, list):
                continue
            cleaned = []
            seen = set()
            for p in phrases:
                if not isinstance(p, str) or not p.strip():
                    continue
                np = _apply_keyword_normalization(_normalize_text(p))
                if not np:
                    continue
                if np in seen:
                    continue
                seen.add(np)
                cleaned.append(np)
            normalized[intent] = cleaned

    _normalized_training_phrases = normalized
    return _normalized_training_phrases

def _extract_role(context):
    if not context:
        return ""
    m = re.search(r"user role:\s*([a-zA-Z_]+)", str(context), flags=re.IGNORECASE)
    if not m:
        return ""
    return (m.group(1) or "").strip().lower()

def _contains_phrase(text, phrase):
    if not phrase:
        return False
    haystack = f" {text} "
    needle = f" {phrase} "
    return needle in haystack

def _score_intent(text, phrases):
    score = 0
    for p in phrases:
        if _contains_phrase(text, p):
            score += 2 if " " in p else 1
    return score

def _build_intent_phrases():
    global _cached_intent_phrases
    if _cached_intent_phrases:
        return _cached_intent_phrases

    training_phrases = _get_normalized_training_phrases()

    defaults = {
        "greetings": ["hi", "hello", "hey", "namaste", "नमस्ते", "ನಮಸ್ಕಾರ"],
        "thanks": ["thanks", "thank you", "thx", "ty", "appreciate", "bye", "goodbye"],
        "tech_info": ["architecture", "algorithm", "model", "naive bayes", "nlp", "ai", "training data", "dataset", "keyword normalization"],
        "report_issue": ["raise complaint", "report issue", "new complaint", "submit complaint", "file a report", "report", "pothole", "garbage", "sewage"],
        "track_status": ["track", "status", "check status", "my complaints", "pending", "in progress", "resolved"],
        "portal_notifications": ["notification", "notifications", "alerts", "messages", "unread"],
        "portal_features": ["portal features", "what can i do", "dashboard features", "how to use the app"],
        "login_register": ["login", "log in", "sign in", "register", "sign up", "otp", "forgot password", "reset password"],
        "map_help": ["map", "mark location", "drop a pin", "gps", "location permission", "coordinates", "address search"],
        "upload_rules": ["upload", "photo rules", "image guidelines", "supported format", "size limit", "screenshot"],
        "image_authenticity": ["authenticity", "authenticity score", "relevance score", "fake image", "screenshot detected", "rejected image"],
        "duplicate_detection": ["duplicate", "already reported", "existing complaint", "same complaint", "nearby complaint"],
        "priority_info": ["priority", "high", "medium", "low", "urgent", "emergency", "reasoning"],
        "resolution_process": ["resolved evidence", "resolution evidence", "resolved image", "mark as resolved", "officer assigned"],
        "feedback_help": ["feedback", "rating", "review", "stars", "rate"],
        "reraise_issue": ["reraise", "re raise", "reopen", "open again", "still not fixed", "same problem again"],
        "profile_edit": ["edit profile", "update profile", "change name", "change mobile", "update mobile"],
        "voice_help": ["voice", "audio", "transcribe", "speech to text", "voice complaint"],
        "chatbot_help": ["chatbot help", "what can you do", "supported queries", "commands"],
        "api_help": ["api", "endpoints", "routes", "controllers", "bearer token", "authorization"],
        "deployment_help": ["how to run project", "start backend", "start frontend", "npm start", "deployment", "env file"],
        "roles_permissions": ["roles", "permissions", "authorized", "not authorized", "access denied"],
        "complaint_rules": ["complaint rules", "required", "image required", "description mandatory", "rejected"],
        "admin_analytics": ["admin", "analytics", "stats", "heatmap", "hotspot", "filters"],
        "officer_workflow": ["officer", "resolve", "mark resolved", "upload resolution", "in progress", "assign", "verify"],
        "security_privacy": ["privacy", "security", "data safe", "who can see", "location private"],
        "contact_support": ["contact", "support", "help desk", "email", "phone", "bug"],
        "troubleshooting": ["error", "failed", "not working", "cannot", "cant", "unable", "server error", "network"],
        "emergency_contact": ["emergency number", "police number", "ambulance", "fire reporting", "urgent help needed", "immediate danger", "who to call in emergency", "disaster helpline", "sos"],
        "delete_account": ["delete my account", "remove my data", "close my account", "deregister", "erase my profile", "i want to leave civismart", "cancel registration"],
        "upload_error": ["upload failed", "image not uploading", "photo upload error", "cannot attach image", "taking too long to upload", "upload stuck", "file too large error"],
    }

    merged = {}
    intents = set(training_phrases.keys()) | set(defaults.keys())
    for intent in intents:
        phrases = []
        if intent in defaults:
            phrases.extend(defaults[intent])
        if intent in training_phrases:
            phrases.extend(training_phrases[intent])
        normalized_phrases = []
        seen = set()
        for p in phrases:
            np = _apply_keyword_normalization(_normalize_text(p))
            if not np or np in seen:
                continue
            seen.add(np)
            normalized_phrases.append(np)
        merged[intent] = normalized_phrases

    _cached_intent_phrases = merged
    return _cached_intent_phrases

def _get_intent_responses():
    global _cached_responses
    if _cached_responses:
        return _cached_responses

    _cached_responses = {
        "greetings": "**Hello!** 👋 I’m **CiviBot**. I can help with:\n- 📝 **Reporting Issues**\n- 🚦 **Tracking Complaints**\n- 🔐 **Login/Registration**\n- 🔔 **Notifications**\n- 🏛️ **Using the Gov Portal**",
        "thanks": "**You’re welcome!** 😊 Tell me what you want to do in **CiviSmart**.",
        "tech_info": "**Technical Info:** 🤖\nThis project uses **keyword normalization** (`nlp_dataset.json`) + a **Naive Bayes intent model**.\n\nFor fallback, it uses a **BERT Zero-Shot Classifier** to understand context.",
        "report_issue": "**To report an issue:** 📝\n1. Open the **Citizen Dashboard**.\n2. Click **'Raise Complaint/Report an Issue'**.\n3. Enter address or **mark on map** 📍.\n4. Upload a **real photo** 📸 of the issue.\n5. Click **Submit**.\n\nThe system categorizes the complaint and sets priority automatically.",
        "track_status": "**To track status:** 🚦\n1. Go to **Citizen Dashboard** → **My Complaints**.\n2. Each complaint shows **Pending** / **In Progress** / **Resolved**.\n3. Open a complaint card to see details and evidence.",
        "portal_notifications": "**Notifications** 🔔 appear on your dashboard when:\n- Complaint status changes.\n- Officers update the complaint.\n\nCheck the **Notifications tab** for unread alerts.",
        "portal_features": "**CiviSmart Features:** 🌟\n- **Raise Complaints**: Photo + Location 📸📍\n- **Track Status**: Real-time updates ⏱️\n- **Notifications**: Instant alerts 🔔\n- **Feedback**: Rate resolved issues ⭐\n- **Profile**: Manage your account 👤",
        "language_help": "Use the **Language Selector** 🌐 in the portal to switch between available languages (e.g., **English, Hindi, Kannada**).",
        "login_register": "**Login/Register:** 🔐\n- **Login**: Uses Aadhar/Username + Password.\n- **Register**: Requires mobile OTP verification.\n\n*If login fails, re-check your Aadhar length (12 digits) and password.*",
        "map_help": "**Map Help:** 🗺️\nIf you can’t find the address:\n1. Use the **Map Picker**.\n2. Allow **Location Permission**.\n3. Search an address or **move the pin**.\n4. **Submit**.\n\n*Latitude/longitude are saved with the complaint.*",
        "upload_rules": "**Upload Rules:** 📸\n- **Format**: JPG/PNG only.\n- **Content**: Real photo of the issue.\n- **Avoid**: Screenshots or unrelated images.\n\n*If upload fails, check file size and network connection.*",
        "image_authenticity": "**Image Rejected?** ⚠️\nCommon reasons:\n- Looks like a **screenshot**.\n- **Unrelated** to the selected issue type.\n- **Low quality** or blurry.\n\n*Please retake a real-world photo of the issue area and submit again.*",
        "duplicate_detection": "**Duplicate Detected?** 🔄\nIf a complaint is marked duplicate, it likely matches an existing nearby complaint.\n\nThe system links it to the earlier one so officers don’t get multiple tickets for the same spot.",
        "priority_info": "**Priority System:** 🚨\n- **High**: Safety risks, urgent civic disruptions.\n- **Medium**: Standard issues (e.g., potholes).\n- **Low**: Minor cosmetic issues.\n\nPriority is set based on **issue type**, **severity signals**, and **AI reasoning** from the photo.",
        "resolution_process": "**Resolution Process:** ✅\n1. Officers update status: **Pending** → **In Progress** → **Resolved**.\n2. They upload **resolution evidence** (after-fix photo) 📸.\n3. You can then view the evidence and give feedback.",
        "feedback_help": "**Give Feedback:** ⭐\nAfter a complaint is **Resolved**:\n1. Open the complaint.\n2. Click **Give Feedback**.\n3. Submit a star rating and comment.",
        "reraise_issue": "**Issue Not Fixed?** 🔄\nIf the same issue returns after it was marked Resolved:\n1. Go to **My Complaints**.\n2. Find the resolved complaint.\n3. Click **Re-raise Issue**.\n4. Upload a fresh photo and submit.\n\n*A new complaint is created and linked to the original.*",
        "profile_edit": "**Edit Profile:** 👤\n1. Open the **Profile tab**.\n2. Click **Edit Profile**.\n3. Update your **Name** or **Mobile Number**.\n4. Click **Save Changes**.",
        "voice_help": "**Voice Reporting:** 🎤\n- Uses a **voice-to-text** flow.\n- If upload fails, check **microphone permission**.\n- Try a short, clear recording.",
        "chatbot_help": "**I can help with:** 🤖\n- 📝 Reporting issues\n- 🚦 Tracking status\n- 🔐 Login/Registration\n- 🗺️ Map/Location\n- 📸 Upload rules\n- 🧠 AI checks (authenticity/priority)\n- 👮 Officer/Admin workflows",
        "api_help": "**API Help:** 🔌\nBackend APIs use **Bearer token auth**. Common routes:\n- `/api/users` (login/register/otp)\n- `/api/complaints` (create, list, update)\n- `/api/admin` (analytics)",
        "deployment_help": "**Deployment:** 🚀\n1. Start **Backend Server**.\n2. Start **React Frontend**.\n3. Ensure `.env` vars (JWT_SECRET, DB_URI) are set.",
        "roles_permissions": "**Roles:** 👥\n- **Citizen**: Raise/track/feedback.\n- **Officer**: Manage status & resolution evidence.\n- **Admin**: Analytics & user management.\n\n*Access Denied? You might be logged in with the wrong role.*",
        "complaint_rules": "**Complaint Rules:** ⚠️\n- **Address/Location** required.\n- **Real Photo** recommended for faster processing.\n- **Valid Description** helps officers understand the issue.",
        "admin_analytics": "**Admin Analytics:** 📊\n- City-wide complaint view.\n- **Filters** by category/status.\n- **Hotspots/Heatmap** insights.\n- **Resolution tracking** for decision making.",
        "officer_workflow": "**Officer Workflow:** 👮\n1. **User Dashboard** to pick complaints.\n2. Move to **In Progress**.\n3. Mark **Resolved** with a **resolution photo**.\n\n*This updates the citizen’s dashboard instantly.*",
        "security_privacy": "**Security & Privacy:** 🔒\n- Data is tied to your account.\n- Location is used **only** for mapping issues.\n- Only **authorized roles** can access specific data.",
        "contact_support": "**Need Help?** 📞\nContact support at `support@civismart.gov` or use the in-app **Help** section.",
        "troubleshooting": "**Troubleshooting:** 🛠️\n- **Refresh** the page.\n- Check **Network** connection.\n- **Log out** and log back in.\n- **Upload error?** Try a smaller JPG/PNG.\n- **Empty Dashboard?** Check your role.",
        "out_of_scope": "**I can help with CiviSmart!** 🏙️\nAsk me about:\n- 📝 Complaints & Tracking\n- 🔐 Login & Accounts\n- 🔔 Notifications\n- 🧠 AI Features",
        "emergency_contact": "**Emergency:** 🚨\nFor immediate danger, please dial **100** (Police) or **101** (Fire) or **108** (Ambulance). CiviSmart is for **non-emergency** civic issues only.",
        "delete_account": "**Delete Account:** 🗑️\nTo delete your account, please go to **Profile** → **Settings** → **Delete Account**. \n\n*Note: This action is irreversible.*",
        "upload_error": "**Upload Error?** ⚠️\n- Check if file is **JPG/PNG**.\n- Ensure size is under **5MB**.\n- Try a **stable network**.\n\n*If it persists, try re-logging in.*",
    }
    return _cached_responses

_cached_vocab = None

def _get_vocab():
    global _cached_vocab
    if _cached_vocab:
        return _cached_vocab
    
    vocab = set()
    
    # 1. Add words from nlp_dataset.json (both canonicals and variants)
    dataset = _load_keyword_dataset()
    keywords = dataset.get("keywords", {})
    for canonical, variants in keywords.items():
        vocab.add(canonical)
        for v in variants:
            vocab.update(v.split())

    # 2. Add words from intent phrases (normalized)
    intent_phrases = _build_intent_phrases()
    for phrases in intent_phrases.values():
        for phrase in phrases:
            vocab.update(phrase.split())
    
    _cached_vocab = sorted(list(vocab))
    return _cached_vocab

def _correct_typos(text):
    vocab = _get_vocab()
    words = text.split()
    corrected_words = []
    
    for word in words:
        if word in vocab:
            corrected_words.append(word)
            continue
            
        if len(word) < 4:
            corrected_words.append(word)
            continue
            
        matches = get_close_matches(word, vocab, n=1, cutoff=0.8)
        if matches:
            print(f"DEBUG: Typo correction: '{word}' -> '{matches[0]}'", file=sys.stderr)
            corrected_words.append(matches[0])
        else:
            corrected_words.append(word)
            
    return " ".join(corrected_words)

def get_response(query, context=""):
    """
    Handles chatbot queries using local intent routing, keyword normalization, and BERT Zero-Shot fallback.
    """
    # classifier = get_nlp_models() # Lazy load only if needed
    
    raw = _normalize_text(query)
    corrected = _correct_typos(raw)
    normalized = _apply_keyword_normalization(corrected)
    role = _extract_role(context)

    domain_tokens = [
        "civismart", "complaint", "report", "issue", "status", "track",
        "road", "pothole", "garbage", "sewage", "electricity",
        "notification", "dashboard", "officer", "admin",
        "login", "register", "password", "otp",
        "location", "map", "latitude", "longitude", "upload", "image",
        "evidence", "priority", "duplicate", "feedback", "reraise",
        "profile", "mobile", "voice", "chatbot", "api", "permissions"
    ]

    intent_phrases = _build_intent_phrases()
    responses = _get_intent_responses()

    intent_priority = {
        "greetings": 0,
        "thanks": 1,
        "chatbot_help": 2,
        "tech_info": 3,
        "login_register": 10,
        "profile_edit": 11,
        "map_help": 12,
        "upload_rules": 13,
        "track_status": 20,
        "report_issue": 21,
        "portal_notifications": 22,
        "portal_features": 23,
            "language_help": 25,
        "image_authenticity": 30,
        "duplicate_detection": 31,
        "priority_info": 32,
        "resolution_process": 33,
        "feedback_help": 34,
        "reraise_issue": 35,
        "officer_workflow": 40,
        "admin_analytics": 41,
        "roles_permissions": 50,
        "complaint_rules": 51,
        "api_help": 52,
        "deployment_help": 53,
        "security_privacy": 60,
        "contact_support": 61,
        "troubleshooting": 62,
        "out_of_scope": 999,
    }

    best_intent = "out_of_scope"
    best_score = 0
    for intent_name in sorted(intent_phrases.keys(), key=lambda k: (intent_priority.get(k, 100), k)):
        phrases = intent_phrases[intent_name]
        s = _score_intent(normalized, phrases)
        if s > best_score:
            best_score = s
            best_intent = intent_name
        elif s == best_score and s > 0:
            if intent_priority.get(intent_name, 100) < intent_priority.get(best_intent, 100):
                best_intent = intent_name

    # Check relevance if no keyword match
    if best_score == 0:
        is_relevant = any(t in normalized for t in domain_tokens) or bool(role)
        if not is_relevant:
            # We can still try BERT if it's potentially a natural language query not catching keywords
            pass 

    # Fallback to BERT Zero-Shot Classification only if NO keyword match found
    # Optimizing for speed: Trust keyword matches (even single words) to avoid slow BERT inference
    classifier = None
    if best_score == 0:
        classifier = get_nlp_models()

    if best_score == 0 and classifier != "FALLBACK":
        try:
            print("DEBUG: No keyword match, using BERT...", file=sys.stderr)
            # Create human-readable labels for better Zero-Shot performance
            # Custom mapping for better model understanding
            custom_labels = {
                "language_help": "changing language",
                "report_issue": "reporting a complaint",
                "track_status": "tracking status",
                "login_register": "login and registration",
                "map_help": "using the map",
                "upload_rules": "uploading photos",
                "image_authenticity": "image verification",
                "duplicate_detection": "duplicate complaints",
                "priority_info": "complaint priority",
                "resolution_process": "resolution process",
                "feedback_help": "giving feedback",
                "reraise_issue": "re-opening a complaint",
                "profile_edit": "editing profile",
                "voice_help": "voice reporting",
                "chatbot_help": "chatbot capabilities",
                "api_help": "API documentation",
                "deployment_help": "deployment instructions",
                "roles_permissions": "user roles",
                "complaint_rules": "complaint rules",
                "admin_analytics": "admin analytics",
                "officer_workflow": "officer workflow",
                "security_privacy": "security and privacy",
                "contact_support": "contacting support",
                "troubleshooting": "troubleshooting errors",
                "greetings": "greeting",
                "thanks": "expressing gratitude",
                "tech_info": "technical information",
                "emergency_contact": "emergency contact",
                "delete_account": "deleting account",
                "upload_error": "upload error issues"
            }
            
            label_map = {}
            for k in intent_phrases.keys():
                if k == "out_of_scope": continue
                readable = custom_labels.get(k, k.replace("_", " "))
                label_map[readable] = k
                
            candidate_labels = list(label_map.keys())
            
            result = classifier(normalized, candidate_labels)
            
            top_human_label = result['labels'][0]
            top_score = result['scores'][0]
            
            # Confidence threshold for BERT
            if top_score > 0.25: # Lower threshold as natural labels are more specific
                # If keyword match was weak (score 1) and BERT is confident, take BERT
                # Or if no keyword match, take BERT
                if best_score == 0 or top_score > 0.55:
                    predicted_intent = label_map[top_human_label]
                    print(f"DEBUG: BERT Override: {predicted_intent} ({top_score:.2f})", file=sys.stderr)
                    best_intent = predicted_intent
        except Exception as e:
            print(f"DEBUG: BERT inference error: {e}", file=sys.stderr)

    if role == "admin" and best_intent in ["report_issue", "track_status", "portal_features"] and _contains_phrase(normalized, "analytics"):
        best_intent = "admin_analytics"

    if role == "officer" and best_intent in ["resolution_process", "track_status"] and _contains_phrase(normalized, "resolve"):
        best_intent = "officer_workflow"

    return responses.get(best_intent, responses["out_of_scope"])

if __name__ == "__main__":
    # Test
    print(get_response("How do I report a pothole?"))
