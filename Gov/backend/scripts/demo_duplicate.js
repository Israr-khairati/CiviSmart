// Script to demonstrate duplicate detection logic
// Based on logic in controllers/complaintController.js

// 1. Haversine Formula for Distance Calculation
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// 2. Mock Data
const existingComplaints = [
  {
    id: "COMP001",
    description: "Pothole on Main St",
    location: { latitude: 12.9716, longitude: 77.5946 }, // Bangalore coordinates
    status: "Pending"
  },
  {
    id: "COMP002",
    description: "Garbage dump near Park",
    location: { latitude: 12.9780, longitude: 77.5990 },
    status: "In Progress"
  }
];

// 3. New Complaint Attempt
const newComplaint = {
  description: "Another pothole here",
  latitude: 12.9718, // Slightly different
  longitude: 77.5947
};

console.log("--- DUPLICATE DETECTION DEMO ---");
console.log(`Checking new complaint at [${newComplaint.latitude}, ${newComplaint.longitude}] against existing complaints...`);

// 4. Detection Logic
let duplicateFound = null;

// Search radius check (simplified bounding box logic would be here in DB query)
// Here we iterate through all mock complaints
for (const comp of existingComplaints) {
  const distance = calculateDistance(newComplaint.latitude, newComplaint.longitude, comp.location.latitude, comp.location.longitude);
  
  console.log(`\nComparing with ${comp.id}:`);
  console.log(`  Distance: ${distance.toFixed(2)} meters`);
  
  if (distance < 50) { // Threshold: 50 meters
    duplicateFound = comp;
    console.log(`  ⚠️  DUPLICATE DETECTED! (Within 50m radius)`);
    break;
  } else {
    console.log(`  ✅  Distance > 50m. Not a duplicate.`);
  }
}

if (duplicateFound) {
  console.log("\n--- RESULT ---");
  console.log(`This new complaint is a duplicate of ${duplicateFound.id}.`);
  console.log(`Action: The system will create the complaint but link it via 'isDuplicateOf: ${duplicateFound.id}'.`);
} else {
  console.log("\n--- RESULT ---");
  console.log("No duplicates found. New complaint created cleanly.");
}
