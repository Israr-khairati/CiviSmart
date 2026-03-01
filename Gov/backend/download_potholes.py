import kagglehub

# Download latest version of the pothole detection dataset
print("Downloading dataset from Kaggle...")
path = kagglehub.dataset_download("andrewmvd/pothole-detection")

print("Path to dataset files:", path)
