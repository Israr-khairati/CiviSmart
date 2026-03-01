import os
import sys

# Suppress TF warnings BEFORE any imports
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings("ignore")

import json
import numpy as np
import cv2
import tensorflow as tf

# Further suppress TF/Keras logging
tf.get_logger().setLevel('ERROR')
try:
    tf.compat.v1.logging.set_verbosity(tf.compat.v1.logging.ERROR)
except:
    pass

from tensorflow.keras import layers, models, applications
from tensorflow.keras.applications.mobilenet_v2 import decode_predictions

IMG_SIZE = 224
CLASSES = ['Road', 'Garbage', 'Sewage', 'Electricity']
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'unified_model.keras')
SECONDARY_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'trained_model.keras')

# Pre-load a global instance of the general-purpose model for relevance checking
# This uses ImageNet weights to detect common objects like dogs, cats, etc.
GENERAL_MODEL = None
UNIFIED_MODEL = None
INDIVIDUAL_MODELS = {}

def get_general_model():
    global GENERAL_MODEL
    if GENERAL_MODEL is None:
        try:
            GENERAL_MODEL = applications.MobileNetV2(weights='imagenet')
        except Exception:
            return None
    return GENERAL_MODEL

def get_unified_model():
    global UNIFIED_MODEL
    if UNIFIED_MODEL is None:
        try:
            current_model_path = None
            if os.path.exists(MODEL_PATH):
                current_model_path = MODEL_PATH
            elif os.path.exists(SECONDARY_MODEL_PATH):
                current_model_path = SECONDARY_MODEL_PATH
            
            if current_model_path:
                print(f"DEBUG: Pre-loading unified model at {current_model_path}")
                UNIFIED_MODEL = tf.keras.models.load_model(current_model_path)
        except Exception as e:
            print(f"DEBUG: Error pre-loading unified model: {e}")
    return UNIFIED_MODEL

def get_individual_model(category):
    global INDIVIDUAL_MODELS
    if category not in INDIVIDUAL_MODELS:
        model_files = {
            'Road': "pothole_model.keras",
            'Garbage': "garbage_model.keras",
            'Sewage': "sewage_model.keras",
            'Electricity': "power_model.keras"
        }
        filename = model_files.get(category)
        if filename:
            path = os.path.join(os.path.dirname(__file__), filename)
            if os.path.exists(path):
                try:
                    print(f"DEBUG: Pre-loading individual model for {category}: {filename}")
                    INDIVIDUAL_MODELS[category] = tf.keras.models.load_model(path)
                except Exception as e:
                    print(f"DEBUG: Error pre-loading individual model {category}: {e}")
    return INDIVIDUAL_MODELS.get(category)

def check_relevance(image_path):
    """
    Checks if the image contains objects that are likely irrelevant to civil issues
    (e.g., pets, animals, household items).
    Returns a 'relevance_score' where 1.0 is highly relevant and 0.0 is likely irrelevant.
    """
    try:
        model = get_general_model()
        if model is None: return 1.0 # Default to relevant if model fails
        
        img = cv2.imread(image_path)
        if img is None: return 0.0
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (224, 224))
        img = applications.mobilenet_v2.preprocess_input(img)
        img = np.expand_dims(img, axis=0)
        
        preds = model.predict(img, verbose=0)
        decoded = decode_predictions(preds, top=5)[0]
        
        # List of ImageNet keywords that are definitely NOT civil issues
        irrelevant_keywords = [
            'dog', 'cat', 'puppy', 'kitten', 'animal', 'pet', 'hound', 'terrier', 'retriever',
            'spaniel', 'shepherd', 'collie', 'pug', 'bulldog', 'beagle', 'poodle',
            'dalmatian', 'chihuahua', 'pomeranian', 'samoyed', 'husky', 'mastiff',
            'bird', 'fish', 'insect', 'toy', 'furniture', 'person', 'face',
            'man', 'woman', 'child', 'baby', 'food', 'fruit', 'vegetable',
            'flower', 'plant', 'tree', 'forest', 'jungle', 'mammal', 'wildlife',
            'indoor', 'room', 'bedroom', 'kitchen', 'living_room',
            'office', 'desk', 'computer', 'laptop', 'phone',
            'car', 'bus', 'truck', 'vehicle', 'automobile', 'racing car',
            'bicycle', 'bike', 'motorcycle', 'scooter'
        ]
        
        # Check if top predictions contain any irrelevant keywords
        for _, label, confidence in decoded:
            # Handle potential byte strings or other types
            label_str = label
            if isinstance(label, bytes):
                label_str = label.decode('utf-8')
            label_lower = str(label_str).lower().replace('_', ' ')
            
            print(f"DEBUG: Top prediction: {label_lower} ({confidence:.2f})")
            
            if any(k in label_lower for k in irrelevant_keywords):
                # If an irrelevant object is found, apply an extremely heavy penalty
                # Even low confidence detections of animals/people should be suspicious
                if confidence > 0.03: # Lowered threshold from 0.05
                    # Exponential penalty for animals/irrelevant objects
                    penalty = confidence * 10.0 # Increased penalty from 5.0
                    relevance = float(max(0.0, 1.0 - penalty))
                    print(f"🚨 DEBUG: Detected irrelevant object: {label_lower} ({confidence:.2f}) -> Relevance: {relevance:.2f}")
                    return relevance
        
        return 1.0
    except Exception as e:
        print(f"DEBUG: Relevance check error: {e}")
        return 1.0

def build_model():
    """Builds a multi-class classifier using Transfer Learning (MobileNetV2)"""
    base_model = applications.MobileNetV2(input_shape=(IMG_SIZE, IMG_SIZE, 3),
                                         include_top=False,
                                         weights='imagenet')
    base_model.trainable = False 

    model = models.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(len(CLASSES), activation='softmax')
    ])

    model.compile(optimizer='adam',
                  loss='categorical_crossentropy',
                  metrics=['accuracy'])
    return model

def preprocess_image(image_path):
    """Loads and preprocesses an image for MobileNetV2"""
    try:
        img = cv2.imread(image_path)
        if img is None: return None
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
        # MobileNetV2 expects input in range [-1, 1]
        img = applications.mobilenet_v2.preprocess_input(img)
        return np.expand_dims(img, axis=0)
    except Exception:
        return None

def get_predictions(image_path):
    """Performs inference using the unified model or fallbacks to individual models"""
    results = {c: 0.0 for c in CLASSES}
    results['relevance'] = 1.0 # New: relevance score
    
    if not os.path.exists(image_path):
        return results

    # 1. Check Relevance (General purpose object detection)
    relevance = check_relevance(image_path)
    results['relevance'] = float(relevance)

    img = preprocess_image(image_path)
    if img is None:
        return results

    # Try Primary or Secondary Unified Model
    model = get_unified_model()
    if model:
        try:
            preds = model.predict(img, verbose=0)[0]
            for i, cat in enumerate(CLASSES):
                results[cat] = float(preds[i])
            
            # If we have a very strong prediction, we can trust it
            max_score = max([results[c] for c in CLASSES])
            if max_score > 0.85:
                return results
            
            print(f"DEBUG: Unified model confidence low ({max_score:.2f}). Trying individual models.")
        except Exception as e:
            print(f"DEBUG: Error during inference with unified model: {e}")
            
    # Fallback to individual models if unified model doesn't exist or confidence is low
    for cat in CLASSES:
        m = get_individual_model(cat)
        if m:
            try:
                # Individual models might use different input sizes (128)
                img_small = cv2.resize(cv2.imread(image_path), (128, 128))
                img_small = cv2.cvtColor(img_small, cv2.COLOR_BGR2RGB) / 255.0
                img_small = np.expand_dims(img_small, axis=0)
                
                p = m.predict(img_small, verbose=0)
                results[cat] = float(p[0][0])
            except Exception as e:
                print(f"DEBUG: Error during inference with individual model {cat}: {e}")
                results[cat] = 0.0
                
    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    scores = get_predictions(image_path)
    print(json.dumps(scores))
