/**
 * User auth, JWT sessions, profile, password reset, and email verification flows.
 */
import userModel from "../../Models/Users/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import validator from "validator";
import axios from "axios";
import { logAudit, logError, getClientIp, normalizeRole } from "../../logger/auditLogger.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../../Utils/emailService.js";

const auditLog = (userId, role, clientIp, overrides) => logAudit({ userId, role, clientIp, ...overrides });
const guestAudit = (clientIp, overrides) => auditLog(null, 'GUEST', clientIp, overrides);
const userAudit = (req, clientIp, overrides) => auditLog(req.user?.id, normalizeRole(req.user?.role), clientIp, overrides);

const pendingVerifications = new Map();


const createToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const verifyCaptcha = async (captchaToken) => {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.warn("RECAPTCHA_SECRET_KEY not configured - skipping verification");
      return true; 
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
        await guestAudit(clientIp, {
          action: 'LOGIN_FAILED',
          status: 'FAILED_VALIDATION',
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
      await guestAudit(clientIp, {
        action: 'LOGIN_FAILED',
        status: 'FAILED_AUTH',
        details: `User not found for email=${email}`
      });
      return res.status(401).json({ 
        success: false, 
        message: "Business account not found. Please check your email or register." 
      });
    }

    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const lockoutMinutes = Math.ceil((user.accountLockedUntil - new Date()) / (1000 * 60));
      await auditLog(user._id.toString(), normalizeRole(user.role), clientIp, {
        action: 'LOGIN_BLOCKED',
        status: 'FAILED_AUTH',
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

        await auditLog(user._id.toString(), normalizeRole(user.role), clientIp, {
          action: 'ACCOUNT_LOCKED',
          status: 'FAILED_AUTH',
          details: `Account locked after ${MAX_FAILED_ATTEMPTS} failed login attempts. Unlocks in ${LOCKOUT_DURATION_MS / 1000 / 60} minutes`
        });

        return res.status(403).json({
          success: false,
          message: `Account locked due to multiple failed login attempts. Please try again in ${LOCKOUT_DURATION_MS / 1000 / 60} minutes.`
        });
      } else {
        await user.save();
      }

      await auditLog(user._id.toString(), normalizeRole(user.role), clientIp, {
        action: 'LOGIN_FAILED',
        status: 'FAILED_AUTH',
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

    await auditLog(user._id.toString(), normalizeRole(user.role), clientIp, {
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
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

    const pending = pendingVerifications.get(safeEmail);
    if (!pending || !pending.verified) {
      return res.status(400).json({ success: false, message: "Email has not been verified. Please verify your email first." });
    }

    if (captchaToken) {
      const isCaptchaValid = await verifyCaptcha(captchaToken);
      if (!isCaptchaValid) {
        guestAudit(clientIp, {
          action: 'REGISTER_FAILED',
          status: 'FAILED_VALIDATION',
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
      guestAudit(clientIp, {
        action: 'REGISTER_FAILED',
        status: 'FAILED_VALIDATION',
        details: `Email already exists: email=${email}`
      });
      return res.status(409).json({
        success: false,
        message: "A business account with this email already exists."
      });
    }

    if (!validator.isEmail(email)) {
      guestAudit(clientIp, {
        action: 'REGISTER_FAILED',
        status: 'FAILED_VALIDATION',
        details: `Invalid email format: email=${email}`
      });
      return res.status(400).json({
        success: false,
        message: "Please enter a valid business email address."
      });
    }

    if (password.length < 8) {
      guestAudit(clientIp, {
        action: 'REGISTER_FAILED',
        status: 'FAILED_VALIDATION',
        details: `Password too short for email=${email}`
      });
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    if (!companyName || companyName.trim().length < 2) {
      guestAudit(clientIp, {
        action: 'REGISTER_FAILED',
        status: 'FAILED_VALIDATION',
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
      email: safeEmail,
      password: hashedPassword,
      role: role || "customer"
    });

    const user = await newUser.save();
    pendingVerifications.delete(safeEmail);

    const token = createToken(user._id, user.role);

    auditLog(user._id.toString(), normalizeRole(user.role), clientIp, {
      action: 'REGISTER_SUCCESS',
      status: 'SUCCESS',
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
    
    userAudit(req, clientIp, {
      action: 'VIEW_ALL_USERS',
      status: 'SUCCESS',
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

/** Updates user role (admin only). */
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
      userAudit(req, clientIp, {
        action: 'UPDATE_USER_ROLE',
        status: 'FAILED_VALIDATION',
        resourceId: userId,
        details: `Invalid role provided: role=${role}`
      });
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be one of: admin, employee, customer"
      });
    }


    if (req.user.id === userId && role !== "admin") {
      userAudit(req, clientIp, {
        action: 'UPDATE_USER_ROLE',
        status: 'FAILED_BUSINESS_RULE',
        resourceId: userId,
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
      userAudit(req, clientIp, {
        action: 'UPDATE_USER_ROLE',
        status: 'FAILED_VALIDATION',
        resourceId: userId,
        details: `User not found: userId=${userId}`
      });
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    userAudit(req, clientIp, {
      action: 'UPDATE_USER_ROLE',
      status: 'SUCCESS',
      resourceId: userId,
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
      userAudit(req, clientIp, {
        action: 'DELETE_USER',
        status: 'FAILED_BUSINESS_RULE',
        resourceId: userId,
        details: `Admin attempted to delete own account`
      });
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own account"
      });
    }


    const deletedUser = await userModel.findByIdAndDelete(userId);

    if (!deletedUser) {
      userAudit(req, clientIp, {
        action: 'DELETE_USER',
        status: 'FAILED_VALIDATION',
        resourceId: userId,
        details: `User not found: userId=${userId}`
      });
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    userAudit(req, clientIp, {
      action: 'DELETE_USER',
      status: 'SUCCESS',
      resourceId: userId,
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

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        companyName: user.companyName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error loading profile" });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { companyName, email } = req.body;
    const updates = {};

    if (typeof companyName === "string") {
      return res.status(400).json({ success: false, message: "Company name cannot be updated from profile settings." });
    }

    if (typeof email === "string") {
      const normalizedEmail = email.toLowerCase().trim();
      if (!validator.isEmail(normalizedEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid business email address." });
      }

      const existing = await userModel.findOne({ email: normalizedEmail, _id: { $ne: userId } });
      if (existing) {
        return res.status(409).json({ success: false, message: "This email is already in use by another account." });
      }
      updates.email = normalizedEmail;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: "No profile changes provided." });
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        companyName: updatedUser.companyName,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating profile" });
  }
};

const updateMyPassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All password fields are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters long." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New password and confirm password do not match." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "New password must be different from current password." });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating password" });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const clientIp = getClientIp(req);

  try {
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const safeEmail = email.toLowerCase().trim();
    const user = await userModel.findOne({ email: safeEmail });

    if (!user) {
      return res.status(404).json({ success: false, notFound: true, message: "No account found with this email address." });
    }

    const resetCode = crypto.randomInt(100000, 999999).toString();
    const hashedCode = crypto.createHash("sha256").update(resetCode).digest("hex");

    user.resetPasswordToken = hashedCode;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendPasswordResetEmail(safeEmail, resetCode);

    await auditLog(user._id.toString(), normalizeRole(user.role), clientIp, {
      action: "PASSWORD_RESET_REQUESTED",
      status: "SUCCESS",
      details: `Password reset code sent to email=${safeEmail}`,
    });

    res.json({ success: true, message: "A reset code has been sent to your email." });
  } catch (error) {
    logError(error, {
      action: "PASSWORD_RESET_REQUEST_ERROR",
      clientIp,
      details: `Error during forgot password for email=${email}`,
    });
    res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
};

const resetPassword = async (req, res) => {
  const { email, code, newPassword, confirmPassword } = req.body;
  const clientIp = getClientIp(req);

  try {
    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }

    const safeEmail = email.toLowerCase().trim();
    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

    const user = await userModel.findOne({
      email: safeEmail,
      resetPasswordToken: hashedCode,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      await guestAudit(clientIp, {
        action: "PASSWORD_RESET_FAILED",
        status: "FAILED_VALIDATION",
        details: `Invalid or expired reset code for email=${safeEmail}`,
      });
      return res.status(400).json({ success: false, message: "Invalid or expired reset code. Please request a new one." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    await user.save();

    await auditLog(user._id.toString(), normalizeRole(user.role), clientIp, {
      action: "PASSWORD_RESET_SUCCESS",
      status: "SUCCESS",
      details: `Password reset successfully for email=${safeEmail}`,
    });

    res.json({ success: true, message: "Password has been reset successfully. You can now log in with your new password." });
  } catch (error) {
    logError(error, {
      action: "PASSWORD_RESET_ERROR",
      clientIp,
      details: `Error during password reset for email=${email}`,
    });
    res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
};

const sendVerificationCode = async (req, res) => {
  const { email } = req.body;
  const clientIp = getClientIp(req);

  try {
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const safeEmail = email.toLowerCase().trim();

    const exists = await userModel.findOne({ email: safeEmail });
    if (exists) {
      return res.status(409).json({ success: false, message: "A business account with this email already exists." });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

    pendingVerifications.set(safeEmail, {
      hashedCode,
      expires: Date.now() + 15 * 60 * 1000,
    });

    await sendVerificationEmail(safeEmail, code);

    await guestAudit(clientIp, {
      action: "EMAIL_VERIFICATION_SENT",
      status: "SUCCESS",
      details: `Verification code sent to email=${safeEmail}`,
    });

    res.json({ success: true, message: "A verification code has been sent to your email." });
  } catch (error) {
    logError(error, {
      action: "EMAIL_VERIFICATION_ERROR",
      clientIp,
      details: `Error sending verification code for email=${email}`,
    });
    res.status(500).json({ success: false, message: "Failed to send verification email. Please try again." });
  }
};

const verifyEmailCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({ success: false, message: "Email and code are required." });
    }

    const safeEmail = email.toLowerCase().trim();
    const pending = pendingVerifications.get(safeEmail);

    if (!pending || pending.expires < Date.now()) {
      pendingVerifications.delete(safeEmail);
      return res.status(400).json({ success: false, message: "Verification code has expired. Please request a new one." });
    }

    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

    if (hashedCode !== pending.hashedCode) {
      return res.status(400).json({ success: false, message: "Invalid verification code." });
    }

    pending.verified = true;
    pendingVerifications.set(safeEmail, pending);

    res.json({ success: true, message: "Email verified successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error during verification." });
  }
};

export {
  loginUser,
  registerUser,
  getAllUsers,
  updateUserRole,
  deleteUser,
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
  forgotPassword,
  resetPassword,
  sendVerificationCode,
  verifyEmailCode,
};