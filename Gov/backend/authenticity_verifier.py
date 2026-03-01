import sys
import os
import json
import numpy as np
import cv2
import joblib
from PIL import Image, ImageChops, ImageEnhance
from PIL.ExifTags import TAGS, GPSTAGS

# Garbage Model Constants
GARBAGE_MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'garbage_model_sklearn.pkl')
IMG_SIZE_HOG = (64, 64)
GARBAGE_MODEL = None

def load_garbage_model():
    """Loads the garbage model globally."""
    global GARBAGE_MODEL
    if GARBAGE_MODEL is None and os.path.exists(GARBAGE_MODEL_PATH):
        try:
            GARBAGE_MODEL = joblib.load(GARBAGE_MODEL_PATH)
            print("DEBUG: Garbage model loaded.", file=sys.stderr)
        except Exception as e:
            print(f"DEBUG: Error loading garbage model: {e}", file=sys.stderr)

def extract_hog_features(img):
    """Extracts HOG features for the scikit-learn model."""
    try:
        img_resized = cv2.resize(img, IMG_SIZE_HOG)
        gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
        hog = cv2.HOGDescriptor(_winSize=(64, 64),
                                _blockSize=(16, 16),
                                _blockStride=(8, 8),
                                _cellSize=(8, 8),
                                _nbins=9)
        features = hog.compute(gray)
        return features.flatten()
    except Exception:
        return None

def verify_category_authenticity(image_path, category='Garbage'):
    """
    Verifies if the image content matches the reported category.
    """
    cat_lower = category.lower()
    
    # Special HOG-based model for Garbage (legacy support)
    if cat_lower == 'garbage':
        try:
            if GARBAGE_MODEL is None and os.path.exists(GARBAGE_MODEL_PATH):
                 # Fallback load if not pre-loaded
                 load_garbage_model()
                 
            if GARBAGE_MODEL:
                img = cv2.imread(image_path)
                if img is None: return None
                features = extract_hog_features(img)
                if features is None: return None
                prob = GARBAGE_MODEL.predict_proba(features.reshape(1, -1))[0][1]
                return {"is_match": bool(prob > 0.5), "confidence": float(prob)}
        except Exception as e:
            print(f"DEBUG: Garbage verification error: {e}", file=sys.stderr)
            pass

    # For all categories, we now rely on the unified_image_classifier
    # which is called from the controller. This function can be a placeholder
    # or we can integrate it here if needed for standalone use.
    return None

def get_exif_data(image):
    """Extracts EXIF data from an image."""
    exif_data = {}
    try:
        info = image._getexif()
        if info:
            for tag, value in info.items():
                decoded = TAGS.get(tag, tag)
                if decoded == "GPSInfo":
                    gps_data = {}
                    for t in value:
                        sub_decoded = GPSTAGS.get(t, t)
                        gps_data[sub_decoded] = value[t]
                    exif_data[decoded] = gps_data
                else:
                    exif_data[decoded] = value
    except Exception:
        pass
    return exif_data

def perform_ela(image_path, quality=90):
    """
    Performs Error Level Analysis (ELA) on an image using in-memory buffers.
    Returns a score indicating the likelihood of manipulation.
    """
    try:
        from io import BytesIO
        
        original = Image.open(image_path).convert('RGB')
        
        # Save to memory buffer instead of disk
        buffer = BytesIO()
        original.save(buffer, 'JPEG', quality=quality)
        buffer.seek(0)
        
        temporary = Image.open(buffer)

        ela_image = ImageChops.difference(original, temporary)
        
        # Calculate extreme values
        extrema = ela_image.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        if max_diff == 0:
            max_diff = 1
        
        scale = 255.0 / max_diff
        ela_image = ImageEnhance.Brightness(ela_image).enhance(scale)
        
        # Calculate average brightness of ELA image
        stat = np.array(ela_image).mean()
        
        return float(stat)
    except Exception:
        return 0.0

def analyze_noise(image_path):
    """
    Analyzes noise consistency in the image using vectorized operations.
    Manipulated images often have inconsistent noise patterns.
    """
    try:
        img = cv2.imread(image_path)
        if img is None: return 0.0
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Use a high-pass filter to extract noise/edges
        kernel = np.array([[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]])
        noise = cv2.filter2D(img_gray, -1, kernel)
        
        # Split image into 8x8 blocks and calculate variance consistency
        # Vectorized approach using reshaping
        h, w = noise.shape
        block_size = 32
        
        # Crop to multiple of block_size
        h_crop = h - (h % block_size)
        w_crop = w - (w % block_size)
        
        if h_crop < block_size or w_crop < block_size:
            return float(np.std(noise))

        noise_crop = noise[:h_crop, :w_crop]
        
        # Reshape to (n_blocks_y, block_size, n_blocks_x, block_size)
        # Then transpose to (n_blocks_y, n_blocks_x, block_size, block_size)
        blocks = noise_crop.reshape(h_crop // block_size, block_size, w_crop // block_size, block_size)
        blocks = blocks.transpose(0, 2, 1, 3)
        
        # Calculate variance for each block
        block_variances = np.var(blocks, axis=(2, 3)).flatten()
        
        if block_variances.size == 0:
            return float(np.std(noise))
            
        # If noise is consistent, the coefficient of variation should be low
        # Inconsistent noise (tampering) leads to high variance of variances
        var_of_vars = np.std(block_variances) / (np.mean(block_variances) + 1e-6)
        
        return float(var_of_vars)
    except Exception:
        return 0.0

def verify_authenticity(image_path, category='Garbage'):
    results = {
        "score": 0.0,
        "details": {},
        "is_authentic": False,
        "category_verification": None
    }
    
    try:
        if not os.path.exists(image_path):
            return results

        img_pil = Image.open(image_path)
        exif = get_exif_data(img_pil)
        
        # 0. Category Verification (Integration of the new garbage model)
        results["category_verification"] = verify_category_authenticity(image_path, category)
        has_exif = len(exif) > 0
        has_gps = "GPSInfo" in exif
        has_camera = "Make" in exif or "Model" in exif
        
        metadata_score = 0.5 
        if has_exif: metadata_score += 0.2
        if has_camera: metadata_score += 0.15
        if has_gps: metadata_score += 0.15
        
        results["details"]["has_metadata"] = bool(has_exif)
        results["details"]["has_gps"] = bool(has_gps)
        results["details"]["has_camera_info"] = bool(has_camera)
        
        # 2. ELA Check (40% weight)
        ela_stat = perform_ela(image_path)
        ela_score = 1.0
        if ela_stat > 20.0:
            ela_score = max(0, 1.0 - (ela_stat - 20.0) / 20.0)
        elif ela_stat < 0.1:
            ela_score = 0.6 
            
        results["details"]["ela_stat"] = float(ela_stat)
        
        # 3. Noise Analysis (25% weight)
        noise_val = analyze_noise(image_path)
        # Real photos usually have some noise (std > 2.0)
        # Extremely low noise might indicate computer generated or AI image
        # Extremely high noise might indicate heavy manipulation
        noise_score = 1.0
        if noise_val < 1.0:
            noise_score = 0.5
        elif noise_val > 50.0:
            noise_score = 0.7
            
        results["details"]["noise_intensity"] = float(noise_val)
        
        # 4. Sharpness/Blur Analysis (20% weight)
        img_cv = cv2.imread(image_path)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        results["details"]["sharpness"] = float(laplacian_var)
        
        # Final Score Calculation
        total_score = (metadata_score * 0.15) + \
                      (ela_score * 0.40) + \
                      (noise_score * 0.25) + \
                      (min(1.0, laplacian_var / 300.0) * 0.20)
        
        # Boost score if it has GPS
        if has_gps:
            total_score = min(1.0, total_score + 0.15)
            
        results["score"] = float(total_score)
        results["is_authentic"] = bool(total_score >= 0.65) # Stricter threshold (was 0.55)
        
        return results

    except Exception as e:
        results["error"] = str(e)
        return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    category = sys.argv[2] if len(sys.argv) > 2 else 'Garbage'
    authenticity_results = verify_authenticity(image_path, category)
    print(json.dumps(authenticity_results))
