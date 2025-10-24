import mongoose from "mongoose";

//define the user schema for MongoDB - this shapes how user data is stored
const userSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, "Company name is required"], //must be provided, with custom error message
    trim: true, //automatically remove whitespace from beginning and end
    maxLength: [100, "Company name cannot exceed 100 characters"] //prevent overly long names
  },
  email: {
    type: String,
    required: [true, "Business email is required"], //email is mandatory field
    unique: true, //no two users can have same email - enforced at database level
    lowercase: true, //automatically convert to lowercase to avoid case-sensitive duplicates
    trim: true, //remove any accidental whitespace
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"] //regex pattern for email validation
  },
  password: {
    type: String,
    required: [true, "Password is required"], //password field is mandatory
    minlength: [8, "Password must be at least 8 characters long"] //enforce minimum password length
  },
  role: {
    type: String,
    enum: ["admin", "employee", "customer"], //only these three values are allowed for role field
    default: "customer" //if no role specified, automatically assign 'customer' role
  }
}, {
  timestamps: true //automatically add createdAt and updatedAt fields to track when documents are created/modified
});

//check if model already exists (to prevent OverwriteModelError during hot reloads)
//if 'user' model already exists, use it; otherwise create new model
const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;