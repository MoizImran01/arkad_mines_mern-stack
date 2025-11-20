import userModel from "../../Models/Users/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";


//creates JWT token containing user ID and role, it is used for maintaining authenticated sessions

const createToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};


//handles the user login process. it validates credentials and returns auth token
const loginUser = async (req, res) => {

  const { email, password } = req.body;

  try 
  {

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


//handles new user registration it validates input and creates new user account
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

//Get all users, Admin only functionality
const getAllUsers = async (req, res) => {
  try {

    const users = await userModel.find({}).select('-password');
    
    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users"
    });
  }
};

// Update user role, Admin only functionality
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;


    const validRoles = ["admin", "employee", "customer"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be one of: admin, employee, customer"
      });
    }


    if (req.user.id === userId && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You cannot remove your own admin privileges"
      });
    }


    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { role: role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User role updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user role"
    });
  }
};

//Delete user, Admin only functionality
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;


    if (req.user.id === userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own account"
      });
    }


    const deletedUser = await userModel.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user"
    });
  }
};

export { loginUser, registerUser, getAllUsers, updateUserRole, deleteUser };