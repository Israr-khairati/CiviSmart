import os
import sys

# Suppress warnings
os.environ['PYTHONWARNINGS'] = 'ignore'
import warnings
warnings.filterwarnings("ignore")

import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import json

# Load model and processor
MODEL_NAME = "openai/clip-vit-base-patch32"
model = None
processor = None

def get_model():
    global model, processor
    if model is None:
        try:
            model = CLIPModel.from_pretrained(MODEL_NAME)
            processor = CLIPProcessor.from_pretrained(MODEL_NAME, use_fast=True)
        except Exception as e:
            print(f"Error loading CLIP model: {e}", file=sys.stderr)
            return None, None
    return model, processor

def classify_image(image_path, categories):
    """
    Classifies an image using CLIP for the given categories.
    """
    model, processor = get_model()
    if model is None:
        return {cat: 0.0 for cat in categories}

    try:
        image = Image.open(image_path).convert("RGB")
        
        # Prepare labels for CLIP
        # We use descriptive labels for better accuracy
        label_map = {
            'Road': 'a photo of a pothole, damaged asphalt, or cracked road',
            'Garbage': 'a photo of a pile of garbage, trash, litter, or waste on the street',
            'Sewage': 'a photo of an overflowing sewage drain, manhole, or dirty water drainage',
            'Electricity': 'a photo of a broken street light, leaning electric pole, or damaged power lines',
            'Relevant': 'a real photo of a civil infrastructure issue or urban problem',
            'Irrelevant': 'a photo of a pet, person, indoor furniture, food, or something unrelated to civil issues',
            'Authentic': 'a real, original photo taken with a mobile phone camera',
            'Unauthentic': 'a computer-generated image, a screenshot, a downloaded stock photo, or a manipulated image'
        }
        
        # Labels for classification
        target_labels = [label_map.get(cat, f"a photo of {cat}") for cat in categories]
        # Add relevance and authenticity labels
        extra_labels = [label_map['Relevant'], label_map['Irrelevant'], label_map['Authentic'], label_map['Unauthentic']]
        all_labels = target_labels + extra_labels
        
        inputs = processor(text=all_labels, images=image, return_tensors="pt", padding=True)
        
        with torch.no_grad():
            outputs = model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1).cpu().numpy()[0]

        # Extract results
        results = {}
        for i, cat in enumerate(categories):
            results[cat] = float(probs[i])
            
        # Calculate relevance
        rel_idx = len(target_labels)
        irrel_idx = len(target_labels) + 1
        rel_prob = probs[rel_idx]
        irrel_prob = probs[irrel_idx]
        results['relevance'] = float(rel_prob / (rel_prob + irrel_prob + 1e-6))

        # Calculate AI Authenticity
        auth_idx = len(target_labels) + 2
        unauth_idx = len(target_labels) + 3
        auth_prob = probs[auth_idx]
        unauth_prob = probs[unauth_idx]
        results['ai_authenticity_score'] = float(auth_prob / (auth_prob + unauth_prob + 1e-6))
        
        return results
    except Exception as e:
        print(f"Error in CLIP classification: {e}", file=sys.stderr)
        return {cat: 0.0 for cat in categories}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    categories = sys.argv[2:] if len(sys.argv) > 2 else ['Road', 'Garbage', 'Sewage', 'Electricity']
    
    results = classify_image(image_path, categories)
    print(json.dumps(results))
