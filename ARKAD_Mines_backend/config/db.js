import mongoose from 'mongoose';

// Cache the connection
let cached = global.mongoose || { conn: null, promise: null };

export const connectDB = async () => {
  // If we have a cached connection, return it
  if (cached.conn) {
    console.log("Using cached MongoDB connection");
    return cached.conn;
  }

  // If no connection promise exists, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Important for serverless
    };

    console.log("Creating new MongoDB connection...");
    cached.promise = mongoose.connect(process.env.MONGO_URI, opts)
      .then((mongoose) => {
        console.log("MongoDB Connected:", mongoose.connection.name);
        return mongoose;
      })
      .catch((error) => {
        console.error("MongoDB Connection Error:", error.message);
        cached.promise = null; // Reset on error
        throw error;
      });
  }

  // Wait for connection and cache it
  try {
    cached.conn = await cached.promise;
    global.mongoose = cached; // Store in global for hot reloads
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
};