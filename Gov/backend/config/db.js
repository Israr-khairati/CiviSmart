const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {});

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    try {
      const usersCollection = conn.connection.db.collection('users');
      const indexes = await usersCollection.indexes();
      const emailIndex = indexes.find((idx) => idx.key && idx.key.email === 1);
      if (emailIndex && emailIndex.name) {
        await usersCollection.dropIndex(emailIndex.name);
      }
    } catch (e) {
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
