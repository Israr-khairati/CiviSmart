import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from sklearn.model_selection import train_test_split

# Paths
SEWAGE_DIR = r'c:\Gov\Gov\sewage'
GARBAGE_DIR = r'c:\Gov\Gov\Garbage'
POTHOLE_DIR = r'c:\Gov\Gov\pothole-detection\versions\1'

TRAIN_SEWAGE_DIR = os.path.join(SEWAGE_DIR, 'train', 'images')
VALID_SEWAGE_DIR = os.path.join(SEWAGE_DIR, 'valid', 'images')
TRAIN_GARBAGE_DIR = os.path.join(GARBAGE_DIR, 'train', 'images')
TRAIN_POTHOLE_DIR = os.path.join(POTHOLE_DIR, 'images')

MODEL_SAVE_PATH = 'sewage_model.keras'
IMG_SIZE = 128

def load_images_from_dir(directory, label, limit=200):
    X = []
    y = []
    if not os.path.exists(directory):
        print(f"Warning: {directory} not found.")
        return X, y

    count = 0
    for img_file in os.listdir(directory):
        if not (img_file.lower().endswith(('.jpg', '.png', '.jpeg', '.webp'))):
            continue
            
        img_path = os.path.join(directory, img_file)
        img = cv2.imread(img_path)
        if img is None:
            continue
            
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
        X.append(img)
        y.append(label)
        count += 1
        if count >= limit: break
    
    return X, y

def train_model():
    print("Loading data...")
    X_pos = []
    y_pos = []
    
    # Load Sewage images (Class 1)
    x, y = load_images_from_dir(TRAIN_SEWAGE_DIR, 1)
    X_pos.extend(x)
    y_pos.extend(y)
    x, y = load_images_from_dir(VALID_SEWAGE_DIR, 1)
    X_pos.extend(x)
    y_pos.extend(y)
    
    # Load Non-Sewage images (Class 0)
    X_neg = []
    y_neg = []
    # Use garbage and potholes as negative samples for sewage detection
    x, y = load_images_from_dir(TRAIN_GARBAGE_DIR, 0, limit=len(X_pos)//2)
    X_neg.extend(x)
    y_neg.extend(y)
    x, y = load_images_from_dir(TRAIN_POTHOLE_DIR, 0, limit=len(X_pos)//2)
    X_neg.extend(x)
    y_neg.extend(y)
    
    # If still not enough negatives, add some noise
    if len(X_neg) < len(X_pos):
        diff = len(X_pos) - len(X_neg)
        noise = np.random.random((diff, IMG_SIZE, IMG_SIZE, 3)) * 255
        X_neg.extend(noise.astype(np.uint8))
        y_neg.extend([0] * diff)

    X = np.array(X_pos + X_neg)
    y = np.array(y_pos + y_neg)
    
    if len(X) == 0:
        print("No data found!")
        return

    # Normalize
    X = X / 255.0
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Data Augmentation
    datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        fill_mode='nearest'
    )

    model = models.Sequential([
        layers.Conv2D(32, (3, 3), activation='relu', input_shape=(IMG_SIZE, IMG_SIZE, 3)),
        layers.MaxPooling2D((2, 2)),
        
        layers.Conv2D(64, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        
        layers.Conv2D(128, (3, 3), activation='relu'),
        layers.MaxPooling2D((2, 2)),
        
        layers.Flatten(),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(1, activation='sigmoid')
    ])

    model.compile(optimizer='adam',
                  loss='binary_crossentropy',
                  metrics=['accuracy'])

    print(f"Training Sewage Model on {len(X_train)} samples with augmentation...")
    
    # Train with augmentation
    model.fit(datagen.flow(X_train, y_train, batch_size=16),
              epochs=50,
              validation_data=(X_test, y_test))
    
    model.save(MODEL_SAVE_PATH)
    print(f"Model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train_model()
