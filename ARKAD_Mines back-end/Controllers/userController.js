import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";


const createToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};


const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Business account not found. Please check your email or register." 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid password. Please try again." 
      });
    }

    const token = createToken(user._id, user.role);
    res.json({ 
  success: true, 
  token,
  user: {
    id: user._id,
    companyName: user.companyName,
    email: user.email,
    role: user.role
  }
});

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during authentication" 
    });
  }
};


const registerUser = async (req, res) => {
  const { companyName, email, password, role } = req.body;

  try {

    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.status(409).json({ 
        success: false, 
        message: "A business account with this email already exists." 
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid business email address." 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    if (!companyName || companyName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please provide your company name.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

   const newUser = new userModel({ 
    companyName: companyName.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    role: role || "customer"
    });


    const user = await newUser.save();

    const token = createToken(user._id, user.role);

    res.json({ 
  success: true, 
  token,
  user: {
    id: user._id,
    companyName: user.companyName,
    email: user.email,
    role: user.role
  }
});

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during account creation" 
    });
  }
};

export { loginUser, registerUser };