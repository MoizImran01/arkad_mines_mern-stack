import mongoose from "mongoose";

// Connects to MongoDB using MONGO_URI; exits on failure.
export const connectDB = async () => {
  try
  {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected:", mongoose.connection.name);
  } 
  catch (err) {
    console.error("MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};
