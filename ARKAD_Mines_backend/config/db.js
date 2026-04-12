import mongoose from "mongoose";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Connects to MongoDB using MONGO_URI with retries (for K8s when Mongo starts first).
export const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }
  const maxAttempts = Number(process.env.MONGO_CONNECT_MAX_ATTEMPTS || 30);
  const delayMs = Number(process.env.MONGO_CONNECT_DELAY_MS || 2000);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log("MongoDB Connected:", mongoose.connection.name);
      return;
    } catch (err) {
      console.error(
        `MongoDB connection attempt ${attempt}/${maxAttempts}:`,
        err.message
      );
      if (attempt === maxAttempts) {
        process.exit(1);
      }
      await sleep(delayMs);
    }
  }
};
