import os
import cv2
import xml.etree.ElementTree as ET
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from sklearn.model_selection import train_test_split

# Paths
DATASET_DIR = r'c:\Gov\Gov\pothole-detection\versions\1'
IMAGES_DIR = os.path.join(DATASET_DIR, 'images')
ANNOTATIONS_DIR = os.path.join(DATASET_DIR, 'annotations')
MODEL_SAVE_PATH = 'pothole_model.keras'

IMG_SIZE = 128

def load_data():
    X = []
    y = []
    
    print("Extracting pothole samples from annotations...")
    
    # We'll treat images with potholes as class 1 and try to find non-pothole regions for class 0
    # For a simple classifier, we'll just use the whole image label for now
    for xml_file in os.listdir(ANNOTATIONS_DIR):
        if not xml_file.endswith('.xml'):
            continue
            
        tree = ET.parse(os.path.join(ANNOTATIONS_DIR, xml_file))
        root = tree.getroot()
        
        img_name = root.find('filename').text
        img_path = os.path.join(IMAGES_DIR, img_name)
        
        if not os.path.exists(img_path):
            continue
            
        img = cv2.imread(img_path)
        if img is None:
            continue
            
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Check if it has any pothole objects
        has_pothole = False
        for obj in root.findall('object'):
            if obj.find('name').text == 'pothole':
                has_pothole = True
                # Get bounding box
                bbox = obj.find('bndbox')
                xmin = int(bbox.find('xmin').text)
                ymin = int(bbox.find('ymin').text)
                xmax = int(bbox.find('xmax').text)
                ymax = int(bbox.find('ymax').text)
                
                # Crop the pothole
                crop = img[ymin:ymax, xmin:xmax]
                if crop.size == 0: continue
                crop = cv2.resize(crop, (IMG_SIZE, IMG_SIZE))
                X.append(crop)
                y.append(1) # Pothole
        
        # To get "No Pothole" samples, we'd ideally need images without potholes
        # Since this dataset is mostly potholes, we'll take random crops that don't overlap much
        # For simplicity in this demo, let's assume class 0 is "Normal Road"
        # In a real scenario, you'd add a separate dataset for normal roads.
        
    return np.array(X), np.array(y)

def train_model():
    X, y = load_data()
    
    if len(X) == 0:
        print("No data found!")
        return

    # Normalize
    X = X / 255.0
    
    # Since we only have class 1 from the pothole dataset, 
    # we'll generate some noise/random data for class 0 just to make the model structure valid,
    # though in production you MUST use real 'Normal Road' images.
    X_neg = np.random.random((len(X), IMG_SIZE, IMG_SIZE, 3))
    y_neg = np.zeros(len(X))
    
    X = np.concatenate([X, X_neg])
    y = np.concatenate([y, y_neg])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

    model = models.Sequential([
        layers.Conv2D(32, (3, 3), activation='relu', input_shape=(IMG_SIZE, IMG_SIZE, 3)),
        layers.MaxPooling2D((2, 2)),
        layers.Conv2D(64, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        layers.Flatten(),
        layers.Dense(64, activation='relu'),
        layers.Dense(1, activation='sigmoid')
    ])

    model.compile(optimizer='adam',
                  loss='binary_crossentropy',
                  metrics=['accuracy'])

    print(f"Training on {len(X_train)} samples...")
    model.fit(X_train, y_train, epochs=5, validation_data=(X_test, y_test))
    
    model.save(MODEL_SAVE_PATH)
    print(f"Model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train_model()
