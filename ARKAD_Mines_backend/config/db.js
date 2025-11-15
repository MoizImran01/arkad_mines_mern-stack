import mongoose from "mongoose";

//configurationn to establish connection with the database
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
