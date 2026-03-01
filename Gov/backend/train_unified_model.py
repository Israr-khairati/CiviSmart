import os
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, applications
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.model_selection import train_test_split
import cv2

# Configuration
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 20
CLASSES = ['Road', 'Garbage', 'Sewage', 'Electricity']
MODEL_SAVE_PATH = 'unified_model.keras'

# Paths (Using existing dataset locations found in other scripts)
DATA_PATHS = {
    'Road': r'c:\Gov\Gov\pothole-detection\versions\1\images',
    'Garbage': r'c:\Gov\Gov\Garbage\train\images',
    'Sewage': r'c:\Gov\Gov\Sewage',
    'Electricity': r'c:\Gov\Gov\Power'
}

def load_dataset():
    X = []
    y = []
    
    for class_idx, (class_name, dir_path) in enumerate(DATA_PATHS.items()):
        if not os.path.exists(dir_path):
            print(f"Warning: Directory {dir_path} for {class_name} not found. Skipping...")
            continue
            
        print(f"Loading {class_name} images from {dir_path}...")
        count = 0
        for img_file in os.listdir(dir_path):
            if not img_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
                
            img_path = os.path.join(dir_path, img_file)
            img = cv2.imread(img_path)
            if img is None: continue
            
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
            X.append(img)
            
            # Create one-hot label
            label = np.zeros(len(CLASSES))
            label[class_idx] = 1
            y.append(label)
            
            count += 1
            if count >= 500: break # Limit per class for demo
            
    return np.array(X), np.array(y)

def train():
    X, y = load_dataset()
    if len(X) == 0:
        print("No data found to train!")
        return

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Data Augmentation
    datagen = ImageDataGenerator(
        preprocessing_function=applications.mobilenet_v2.preprocess_input,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        fill_mode='nearest'
    )
    
    val_datagen = ImageDataGenerator(
        preprocessing_function=applications.mobilenet_v2.preprocess_input
    )

    # Build Model
    base_model = applications.MobileNetV2(input_shape=(IMG_SIZE, IMG_SIZE, 3),
                                         include_top=False,
                                         weights='imagenet')
    base_model.trainable = False

    model = models.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.4),
        layers.Dense(len(CLASSES), activation='softmax')
    ])

    model.compile(optimizer='adam',
                  loss='categorical_crossentropy',
                  metrics=['accuracy'])

    print("Starting training...")
    model.fit(
        datagen.flow(X_train, y_train, batch_size=BATCH_SIZE),
        epochs=EPOCHS,
        validation_data=val_datagen.flow(X_test, y_test, batch_size=BATCH_SIZE)
    )

    # Fine-tuning: unfreeze some layers of base model
    print("Fine-tuning...")
    base_model.trainable = True
    # Freeze all layers before the 100th layer
    for layer in base_model.layers[:100]:
        layer.trainable = False

    model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), # Lower learning rate for fine-tuning
                  loss='categorical_crossentropy',
                  metrics=['accuracy'])

    model.fit(
        datagen.flow(X_train, y_train, batch_size=BATCH_SIZE),
        epochs=10,
        validation_data=val_datagen.flow(X_test, y_test, batch_size=BATCH_SIZE)
    )

    model.save(MODEL_SAVE_PATH)
    print(f"Unified model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train()
