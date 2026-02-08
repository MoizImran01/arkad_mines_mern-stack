import userModel from "../../Models/Users/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import axios from "axios";
import { logAudit, logError, getClientIp, normalizeRole } from "../../logger/auditLogger.js";


const createToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const verifyCaptcha = async (captchaToken) => {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.warn("RECAPTCHA_SECRET_KEY not configured - skipping verification");
      return true; // Skip verification if not configured
    }

    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: secretKey,
          response: captchaToken,
        },
      }
    );

    return response.data.success;
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    return false;
  }
};


const loginUser = async (req, res) => {
  const { email, password, captchaToken } = req.body;
  const clientIp = getClientIp(req);

  try {
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    const safeEmail = email.toLowerCase().trim();

    if (captchaToken) {
      const isCaptchaValid = await verifyCaptcha(captchaToken);
      if (!isCaptchaValid) {
        await logAudit({
          userId: null,
          role: 'GUEST',
          action: 'LOGIN_FAILED',
          status: 'FAILED_VALIDATION',
          clientIp,
          details: `CAPTCHA verification failed for email=${safeEmail}`
        });
        return res.status(400).json({
          success: false,
          message: "CAPTCHA verification failed. Please try again."
        });
      }
    }
    const user = await userModel.findOne({ email: safeEmail });

    if (!user) {
      await logAudit({
        userId: null,
        role: 'GUEST',
        action: 'LOGIN_FAILED',
        status: 'FAILED_AUTH',
        clientIp,
        details: `User not found for email=${email}`
      });
      return res.status(401).json({ 
        success: false, 
        message: "Business account not found. Please check your email or register." 
      });
    }

    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const lockoutMinutes = Math.ceil((user.accountLockedUntil - new Date()) / (1000 * 60));
      await logAudit({
        userId: user._id.toString(),
        role: normalizeRole(user.role),
        action: 'LOGIN_BLOCKED',
        status: 'FAILED_AUTH',
        clientIp,
        details: `Account locked due to multiple failed login attempts. Unlocks in ${lockoutMinutes} minutes`
      });
      return res.status(403).json({
        success: false,
        message: `Account locked due to multiple failed login attempts. Please try again in ${lockoutMinutes} minute${lockoutMinutes === 1 ? '' : 's'}.`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const MAX_FAILED_ATTEMPTS = 5;
      const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.accountLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await user.save();

        await logAudit({
          userId: user._id.toString(),
          role: normalizeRole(user.role),
          action: 'ACCOUNT_LOCKED',
          status: 'FAILED_AUTH',
          clientIp,
          details: `Account locked after ${MAX_FAILED_ATTEMPTS} failed login attempts. Unlocks in ${LOCKOUT_DURATION_MS / 1000 / 60} minutes`
        });

        return res.status(403).json({
          success: false,
          message: `Account locked due to multiple failed login attempts. Please try again in ${LOCKOUT_DURATION_MS / 1000 / 60} minutes.`
        });
      } else {
        await user.save();
      }

      await logAudit({
        userId: user._id.toString(),
        role: normalizeRole(user.role),
        action: 'LOGIN_FAILED',
        status: 'FAILED_AUTH',
        clientIp,
        details: `Invalid password for userId=${user._id}, email=${email}. Failed attempts: ${user.failedLoginAttempts}/${MAX_FAILED_ATTEMPTS}`
      });
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    user.lastLoginIp = clientIp;
    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user._id, user.role);

    await logAudit({
      userId: user._id.toString(),
      role: normalizeRole(user.role),
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      clientIp,
      details: `User logged in successfully, email=${email}`
    });

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

    logError(error, {
      action: 'LOGIN_ERROR',
      clientIp,
      details: `Unexpected error during login for email=${email}`
    });

    res.status(500).json({ 
      success: false, 
      message: "Server error during authentication" 
    });
  }
};


const registerUser = async (req, res) => {
  const { companyName, email, password, role, captchaToken } = req.body;
  const clientIp = getClientIp(req);

  try {
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    const safeEmail = email.toLowerCase().trim();
    if (captchaToken) {
      const isCaptchaValid = await verifyCaptcha(captchaToken);
      if (!isCaptchaValid) {
        logAudit({
          userId: null,
          role: 'GUEST',
          action: 'REGISTER_FAILED',
          status: 'FAILED_VALIDATION',
          clientIp,
          details: `CAPTCHA verification failed for email=${safeEmail}`
        });
        return res.status(400).json({
          success: false,
          message: "CAPTCHA verification failed. Please try again."
        });
      }
    }


    const exists = await userModel.findOne({ email: safeEmail });
    if (exists) {
      logAudit({
        userId: null,
        role: 'GUEST',
        action: 'REGISTER_FAILED',
        status: 'FAILED_VALIDATION',
        clientIp,
        details: `Email already exists: email=${email}`
      });
      return res.status(409).json({ 
        success: false, 
        message: "A business account with this email already exists." 
      });
    }


    if (!validator.isEmail(email)) {
      logAudit({
        userId: null,
        role: 'GUEST',
        action: 'REGISTER_FAILED',
        status: 'FAILED_VALIDATION',
        clientIp,
        details: `Invalid email format: email=${email}`
      });
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid business email address." 
      });
    }


    if (password.length < 8) {
      logAudit({
        userId: null,
        role: 'GUEST',
        action: 'REGISTER_FAILED',
        status: 'FAILED_VALIDATION',
        clientIp,
        details: `Password too short for email=${email}`
      });
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }


    if (!companyName || companyName.trim().length < 2) {
      logAudit({
        userId: null,
        role: 'GUEST',
        action: 'REGISTER_FAILED',
        status: 'FAILED_VALIDATION',
        clientIp,
        details: `Invalid company name for email=${email}`
      });
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

    logAudit({
      userId: user._id.toString(),
      role: normalizeRole(user.role),
      action: 'REGISTER_SUCCESS',
      status: 'SUCCESS',
      clientIp,
      details: `New user registered: email=${email}, companyName=${companyName}`
    });

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

    logError(error, {
      action: 'REGISTER_ERROR',
      clientIp,
      details: `Unexpected error during registration for email=${email}`
    });

    res.status(500).json({ 
      success: false, 
      message: "Server error during account creation" 
    });
  }
};

const getAllUsers = async (req, res) => {
  const clientIp = getClientIp(req);
  try {

    const users = await userModel.find({}).select('-password');
    
    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'VIEW_ALL_USERS',
      status: 'SUCCESS',
      clientIp,
      details: `Admin viewed all users, count=${users.length}`
    });
    
    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    logError(error, {
      action: 'VIEW_ALL_USERS',
      userId: req.user?.id,
      clientIp
    });
    res.status(500).json({
      success: false,
      message: "Error fetching users"
    });
  }
};

// Updates user role (admin only).
const updateUserRole = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { userId } = req.params;
    if (!userId || !validator.isMongoId(String(userId))) {
         return res.status(400).json({ success: false, message: "Invalid User ID" });
    }
    
    const { role } = req.body;


    const validRoles = ["admin", "employee", "customer"];
    if (!validRoles.includes(role)) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'UPDATE_USER_ROLE',
        status: 'FAILED_VALIDATION',
        resourceId: userId,
        clientIp,
        details: `Invalid role provided: role=${role}`
      });
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be one of: admin, employee, customer"
      });
    }


    if (req.user.id === userId && role !== "admin") {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'UPDATE_USER_ROLE',
        status: 'FAILED_BUSINESS_RULE',
        resourceId: userId,
        clientIp,
        details: `Admin attempted to remove own admin privileges`
      });
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
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'UPDATE_USER_ROLE',
        status: 'FAILED_VALIDATION',
        resourceId: userId,
        clientIp,
        details: `User not found: userId=${userId}`
      });
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'UPDATE_USER_ROLE',
      status: 'SUCCESS',
      resourceId: userId,
      clientIp,
      details: `Role updated: targetUserId=${userId}, oldRole=${updatedUser.role}, newRole=${role}`
    });

    res.json({
      success: true,
      message: "User role updated successfully",
      user: updatedUser
    });
  } catch (error) {
    logError(error, {
      action: 'UPDATE_USER_ROLE',
      userId: req.user?.id,
      resourceId: req.params.userId,
      clientIp
    });
    res.status(500).json({
      success: false,
      message: "Error updating user role"
    });
  }
};

const deleteUser = async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { userId } = req.params;

    if (!userId || !validator.isMongoId(String(userId))) {
         return res.status(400).json({ success: false, message: "Invalid User ID" });
    }


    if (req.user.id === userId) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'DELETE_USER',
        status: 'FAILED_BUSINESS_RULE',
        resourceId: userId,
        clientIp,
        details: `Admin attempted to delete own account`
      });
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own account"
      });
    }


    const deletedUser = await userModel.findByIdAndDelete(userId);

    if (!deletedUser) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'DELETE_USER',
        status: 'FAILED_VALIDATION',
        resourceId: userId,
        clientIp,
        details: `User not found: userId=${userId}`
      });
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'DELETE_USER',
      status: 'SUCCESS',
      resourceId: userId,
      clientIp,
      details: `User deleted: deletedUserId=${userId}, email=${deletedUser.email}`
    });

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    logError(error, {
      action: 'DELETE_USER',
      userId: req.user?.id,
      resourceId: req.params.userId,
      clientIp
    });
    res.status(500).json({
      success: false,
      message: "Error deleting user"
    });
  }
};

export { loginUser, registerUser, getAllUsers, updateUserRole, deleteUser };