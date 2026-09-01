const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/justdraw';

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    // In production (Render etc.), don't try memory server — just fail clearly
    if (process.env.NODE_ENV === 'production') {
      console.error(`MongoDB connection failed: ${error.message}`);
      console.error('Make sure MONGODB_URI is set and your Atlas cluster allows access from 0.0.0.0/0');
      process.exit(1);
    }

    // Local development fallback to MongoMemoryServer
    console.warn(`Local MongoDB not detected (${error.message}). Starting MongoMemoryServer fallback...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const dbDir = path.join(__dirname, '../../.mongodata');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const mongoServer = await MongoMemoryServer.create({
        instance: { dbPath: dbDir }
      });
      const mongoUri = mongoServer.getUri();
      const conn = await mongoose.connect(mongoUri);
      console.log(`Persistent Embedded MongoDB connected successfully: ${conn.connection.host}`);
    } catch (memErr) {
      console.error(`MongoDB connection error: ${memErr.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
