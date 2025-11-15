import mongoose from "mongoose";

//define the user schema for MongoDB
const userSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, "Company name is required"], 
    trim: true,
    maxLength: [100, "Company name cannot exceed 100 characters"] 
  },
  email: {
    type: String,
    required: [true, "Business email is required"], 
    unique: true, 
    lowercase: true, 
    trim: true, 
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"] 
  },
  password: {
    type: String,
    required: [true, "Password is required"], 
    minlength: [8, "Password must be at least 8 characters long"]
  },
  role: {
    type: String,
    enum: ["admin", "employee", "customer"], 
    default: "customer" 
  }
}, {
  timestamps: true 
});

const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;