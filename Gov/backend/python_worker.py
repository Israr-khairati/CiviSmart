import sys
import os

# Set environment variables to reduce logging BEFORE any other imports
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['PYTHONWARNINGS'] = 'ignore'

import json
import time
import logging
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# Initialize logging early
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger("PythonWorker")

class PythonWorker:
    def __init__(self):
        self.models = {}
        self.initialized = False
        self.logger = logging.getLogger("PythonWorker")

    def load_models(self):
        """Pre-load critical image models at startup."""
        print("DEBUG: Loading critical models (Image)...", file=sys.stderr)
        
        # 1. Load Unified Image Classifier (TensorFlow) - CRITICAL
        try:
            import unified_image_classifier as unified
            self.models['unified_classifier'] = unified
            print("DEBUG: Image classifier loaded.", file=sys.stderr)
        except Exception as e:
            print(f"DEBUG: Error loading image classifier: {e}", file=sys.stderr)

        # 2. Load Authenticity Verifier Logic - CRITICAL
        try:
            import authenticity_verifier as auth
            self.models['authenticity'] = auth
            # Pre-load garbage model
            auth.load_garbage_model()
            print("DEBUG: Authenticity verifier loaded.", file=sys.stderr)
        except Exception as e:
            print(f"DEBUG: Error loading authenticity verifier: {e}", file=sys.stderr)

        # 3. Load Hugging Face CLIP Classifier - OPTIONAL
        try:
            import hf_classifier as hf
            self.models['hf_classifier'] = hf
            # Trigger lazy load
            print("DEBUG: Triggering CLIP model load...", file=sys.stderr)
            hf.get_model()
            print("DEBUG: HF CLIP classifier loaded.", file=sys.stderr)
        except Exception as e:
            print(f"DEBUG: Error loading HF classifier: {e}", file=sys.stderr)

        # 4. Load Local NLP Service (BERT & GPT) - NEW
        try:
            import local_nlp_service as nlp
            self.models['nlp_service'] = nlp
            # Trigger lazy load
            nlp.get_nlp_models()
            print("DEBUG: Local BERT/GPT NLP service loaded.", file=sys.stderr)
        except Exception as e:
            print(f"DEBUG: Error loading NLP service: {e}", file=sys.stderr)

        self.initialized = True
        print("READY") # Signal READY to Node.js
        sys.stdout.flush()
        print("DEBUG: All critical models pre-loaded and ready.", file=sys.stderr)

    def process_image_verification(self, image_path, categories):
        # Prefer HF CLIP classifier
        if 'hf_classifier' in self.models:
            try:
                hf = self.models['hf_classifier']
                results = hf.classify_image(image_path, categories)
                return results
            except Exception as e:
                print(f"DEBUG: HF verification error: {e}", file=sys.stderr)

        # Fallback to legacy classifier
        if 'unified_classifier' in self.models:
            try:
                unified = self.models['unified_classifier']
                all_scores = unified.get_predictions(image_path)
                results = {cat: all_scores.get(cat, 0.0) for cat in categories}
                if 'relevance' in all_scores:
                    results['relevance'] = all_scores['relevance']
                return results
            except Exception as e:
                print(f"DEBUG: Legacy image verification error: {e}", file=sys.stderr)

        return {cat: 0.0 for cat in categories}

    def process_authenticity(self, image_path):
        if 'authenticity' not in self.models:
            return {"score": 0, "is_authentic": False, "error": "Authenticity model not loaded"}

        try:
            auth = self.models['authenticity']
            results = auth.verify_authenticity(image_path)
            
            # Combine with AI-based authenticity if available
            if 'hf_classifier' in self.models:
                try:
                    hf = self.models['hf_classifier']
                    # We don't need to re-classify for all categories, just get authenticity
                    # But for simplicity we call classify_image which is fast enough
                    hf_results = hf.classify_image(image_path, [])
                    ai_auth_score = hf_results.get('ai_authenticity_score', 0.5)
                    
                    # Update total score (40% weight for AI authenticity)
                    # Current score is 0.0-1.0
                    original_score = results.get('score', 0.0)
                    combined_score = (original_score * 0.6) + (ai_auth_score * 0.4)
                    
                    results['score'] = float(combined_score)
                    results['ai_authenticity_score'] = float(ai_auth_score)
                    results['is_authentic'] = bool(combined_score >= 0.65)
                    results['details']['ai_authenticity'] = float(ai_auth_score)
                except Exception as e:
                    print(f"DEBUG: AI Authenticity error: {e}", file=sys.stderr)
                    
            return results
        except Exception as e:
            print(f"DEBUG: Authenticity error: {e}", file=sys.stderr)
            return {"score": 0, "is_authentic": False, "error": str(e)}

    def process_full_analysis(self, image_path, categories):
        """
        Runs both classification and authenticity checks in one pass to avoid reloading images/models.
        """
        response = {
            "scores": {},
            "auth": {"score": 0, "is_authentic": False}
        }
        
        # 1. Run Classification (CLIP) - Returns categories + relevance + ai_authenticity
        hf_results = {}
        if 'hf_classifier' in self.models:
            try:
                hf = self.models['hf_classifier']
                hf_results = hf.classify_image(image_path, categories)
                response['scores'] = hf_results
            except Exception as e:
                print(f"DEBUG: HF verification error: {e}", file=sys.stderr)
        
        # Fallback for scores if HF failed or not loaded
        if not response['scores'] and 'unified_classifier' in self.models:
            try:
                unified = self.models['unified_classifier']
                all_scores = unified.get_predictions(image_path)
                results = {cat: all_scores.get(cat, 0.0) for cat in categories}
                if 'relevance' in all_scores:
                    results['relevance'] = all_scores['relevance']
                response['scores'] = results
            except Exception as e:
                print(f"DEBUG: Legacy image verification error: {e}", file=sys.stderr)

        if not response['scores']:
             response['scores'] = {cat: 0.0 for cat in categories}

        # 2. Run Authenticity (ELA/Noise) - Avoids re-running CLIP
        if 'authenticity' in self.models:
            try:
                ai_auth_score = hf_results.get('ai_authenticity_score', 0.5)
                
                # EARLY EXIT: Skip computationally expensive ELA/Noise checks if AI is highly confident
                if ai_auth_score >= 0.85:
                    print("DEBUG: Early exit in Python worker - High AI authenticity score.", file=sys.stderr)
                    response['auth'] = {
                        "score": float(ai_auth_score),
                        "is_authentic": True,
                        "ai_authenticity_score": float(ai_auth_score),
                        "details": {"ai_authenticity": float(ai_auth_score), "early_exit": True}
                    }
                else:
                    auth = self.models['authenticity']
                    auth_results = auth.verify_authenticity(image_path)
                    
                    original_score = auth_results.get('score', 0.0)
                    combined_score = (original_score * 0.6) + (ai_auth_score * 0.4)
                    
                    auth_results['score'] = float(combined_score)
                    auth_results['ai_authenticity_score'] = float(ai_auth_score)
                    auth_results['is_authentic'] = bool(combined_score >= 0.65)
                    if 'details' not in auth_results:
                        auth_results['details'] = {}
                    auth_results['details']['ai_authenticity'] = float(ai_auth_score)
                    
                    response['auth'] = auth_results
            except Exception as e:
                print(f"DEBUG: Authenticity error: {e}", file=sys.stderr)
                response['auth'] = {"score": 0, "is_authentic": False, "error": str(e)}
        else:
             response['auth'] = {"score": 0, "is_authentic": False, "error": "Authenticity model not loaded"}

        return response

    def run(self):
        self.load_models()
        # READY signal is already sent inside load_models() after critical models load

        while True:
            line = sys.stdin.readline()
            if not line:
                break
            
            try:
                request = json.loads(line)
                task = request.get('task')
                request_id = request.get('id')
                
                result = {"id": request_id, "success": False}
                
                if task == 'image_verify':
                    result['scores'] = self.process_image_verification(
                        request.get('image_path'), 
                        request.get('categories', [])
                    )
                    result['success'] = True
                elif task == 'analyze_image':
                    result['analysis'] = self.process_full_analysis(
                        request.get('image_path'), 
                        request.get('categories', [])
                    )
                    result['success'] = True
                elif task == 'authenticity':
                    result['auth'] = self.process_authenticity(request.get('image_path'))
                    result['success'] = True
                elif task == 'nlp_query':
                    if 'nlp_service' in self.models:
                        nlp = self.models['nlp_service']
                        result['response'] = nlp.get_response(
                            request.get('query'), 
                            request.get('context', "")
                        )
                        result['success'] = True
                    else:
                        result['error'] = "NLP service not loaded"
                elif task == 'ping':
                    result['success'] = True
                    result['pong'] = True
                else:
                    result['error'] = "Unknown task"
                
                print(json.dumps(result), flush=True)
                
            except Exception as e:
                print(json.dumps({"error": str(e)}), flush=True)

if __name__ == "__main__":
    worker = PythonWorker()
    worker.run()
