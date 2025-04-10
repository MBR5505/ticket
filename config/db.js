const mongoose = require('mongoose');

/**
 * Database connection function
 * Uses MongoDB URI from environment variables
 */
const connectDB = async () => {
  try {
    // Get MongoDB URI from .env file
    const mongoURI = process.env.MONGODB_URI;
    
    // Check if MongoDB URI is defined
    if (!mongoURI) {
      console.error('MongoDB URI is not defined in environment variables. Please add MONGODB_URI to your .env file.');
      process.exit(1);
    }

    // Set connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected. Attempting to reconnect...');
    });

    // If the Node process ends, close the MongoDB connection
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return conn;
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
