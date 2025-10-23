import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";


//creates JWT token containing user ID and role - used for maintaining authenticated sessions
//the token expires after 7 days, requiring users to log in again for security
const createToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};


//handles the user login process - validates credentials and returns auth token
const loginUser = async (req, res) => {
  //extract email and password from the request body sent by frontend
  const { email, password } = req.body;

  try 
  {
    //search database for user with the provided email address
    const user = await userModel.findOne({ email });
    //if no user found, return a json response 401 Unauthorized with helpful message
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Business account not found. Please check your email or register." 
      });
    }

    //compare the provided password with the hashed password stored in database
    //bcrypt.compare handles the hashing and comparison securely
    const isMatch = await bcrypt.compare(password, user.password);
    //if passwords don't match, return 401 Unauthorized
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid password. Please try again." 
      });
    }

    //if credentials are valid, generate JWT token for this user session
    const token = createToken(user._id, user.role);
    //return success response with token and user data to frontend
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
    //log the actual error for debugging but don't expose details to client
    console.error("Login error:", error);
    //return 500 Internal Server Error with generic message
    res.status(500).json({ 
      success: false, 
      message: "Server error during authentication" 
    });
  }
};


//handles new user registration - validates input and creates new user account
const registerUser = async (req, res) => {
  //extract all required fields from request body
  const { companyName, email, password, role } = req.body;

  try {
    //check if a user already exists with this email to prevent duplicates
    const exists = await userModel.findOne({ email });
    if (exists) {
      //return 409 Conflict status if email already registered
      return res.status(409).json({ 
        success: false, 
        message: "A business account with this email already exists." 
      });
    }

    //validate that the email format is correct using validator library
    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid business email address." 
      });
    }

    //enforce minimum password length requirement for security
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    //validate that company name is provided and has reasonable length
    if (!companyName || companyName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please provide your company name.",
      });
    }

    //generate salt for password hashing - higher cost factor means more secure but slower
    const salt = await bcrypt.genSalt(10);
    //hash the plain text password before storing to database
    const hashedPassword = await bcrypt.hash(password, salt);

   //create new user object with validated and processed data
   const newUser = new userModel({ 
    companyName: companyName.trim(), //remove extra whitespace
    email: email.toLowerCase().trim(), //normalize email to lowercase
    password: hashedPassword, //store only the hashed password, never plain text
    role: role || "customer" //default to customer role if not specified
    });


    //save the new user to MongoDB database
    const user = await newUser.save();

    //generate JWT token immediately so user is logged in after registration
    const token = createToken(user._id, user.role);

    //return success response with token and user data
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
    //log detailed error for server-side debugging
    console.error("Registration error:", error);
    //return generic error message to client for security
    res.status(500).json({ 
      success: false, 
      message: "Server error during account creation" 
    });
  }
};

export { loginUser, registerUser };