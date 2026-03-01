const natural = require('natural');
const fs = require('fs');
const path = require('path');

const trainingDataPath = path.join(__dirname, 'chatbot_training_data.json');
const modelSavePath = path.join(__dirname, 'chatbot_model.json');

const trainModel = () => {
  console.log('🏗️ Starting Local NLP Model Training...');
  
  const classifier = new natural.BayesClassifier();
  
  if (!fs.existsSync(trainingDataPath)) {
    console.error('❌ Training data not found!');
    return;
  }

  const data = JSON.parse(fs.readFileSync(trainingDataPath, 'utf8'));

  // Add documents to classifier
  Object.keys(data).forEach(intent => {
    data[intent].forEach(phrase => {
      classifier.addDocument(phrase, intent);
    });
  });

  console.log('🧠 Training classifier...');
  classifier.train();

  console.log('💾 Saving model...');
  classifier.save(modelSavePath, (err, classifier) => {
    if (err) {
      console.error('❌ Error saving model:', err);
    } else {
      console.log(`✅ Model trained and saved to ${modelSavePath}`);
    }
  });
};

trainModel();
