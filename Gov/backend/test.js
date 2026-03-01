const fs = require('fs');
const path = require('path');

function runTest() {
  const datasetPath = path.join(__dirname, 'nlp_dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const Complaint = require('./models/Complaint');
  const User = require('./models/User');
  const { GEMINI_MODEL, genAI } = require('./utils/aiPriority');

  const complaintCategories = Complaint.schema.path('category').enumValues;
  const userDepartments = User.schema.path('department').enumValues;

  console.log('Complaint categories:', complaintCategories);
  console.log('User departments:', userDepartments);
  console.log('NLP keywords include water_supply:', !!(dataset.keywords && dataset.keywords.water_supply));
  console.log('Gemini enabled:', !!genAI);
  console.log('Gemini model:', GEMINI_MODEL);
}

runTest();
