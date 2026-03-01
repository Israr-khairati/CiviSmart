import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from sklearn.model_selection import train_test_split

# Paths
GARBAGE_DIR = r'c:\Gov\Gov\Garbage'
TRAIN_DIR = os.path.join(GARBAGE_DIR, 'train', 'images')
MODEL_SAVE_PATH = 'garbage_model.keras'

IMG_SIZE = 128

def load_data():
    X = []
    y = []
    
    print(f"Loading garbage images from {TRAIN_DIR}...")
    
    if not os.path.exists(TRAIN_DIR):
        print(f"Error: {TRAIN_DIR} not found.")
        return np.array([]), np.array([])

    count = 0
    for img_file in os.listdir(TRAIN_DIR):
        if not (img_file.endswith('.jpg') or img_file.endswith('.png') or img_file.endswith('.jpeg')):
            continue
            
        img_path = os.path.join(TRAIN_DIR, img_file)
        img = cv2.imread(img_path)
        if img is None:
            continue
            
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
        X.append(img)
        y.append(1) # Garbage class
        count += 1
        if count >= 500: break # Limit for speed in this environment
        
    return np.array(X), np.array(y)

def train_model():
    X, y = load_data()
    
    if len(X) == 0:
        print("No garbage data found!")
        return

    # Normalize
    X = X / 255.0
    
    # Generate negative samples (random noise for demo purposes, 
    # in real world use images of clean streets)
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

    print("Training Garbage Model...")
    model.fit(X_train, y_train, epochs=5, validation_data=(X_test, y_test))
    
    model.save(MODEL_SAVE_PATH)
    print(f"Model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train_model()
