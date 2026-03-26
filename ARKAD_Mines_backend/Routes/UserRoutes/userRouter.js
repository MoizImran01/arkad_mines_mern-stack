import express from "express";
import {
  loginUser,
  registerUser,
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
  forgotPassword,
  resetPassword,
  sendVerificationCode,
  verifyEmailCode,
} from "../../Controllers/UserController/userController.js";
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js";
import { verifyToken } from "../../Middlewares/auth.js";

const userRouter = express.Router();

const authRateLimiter = createRateLimiter({
  endpoint: '/api/user/auth',
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  actionName: 'AUTH_ATTEMPT',
  actionType: 'AUTH_RATE_LIMIT_EXCEEDED'
});

const resetRateLimiter = createRateLimiter({
  endpoint: '/api/user/password-reset',
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  actionName: 'PASSWORD_RESET_ATTEMPT',
  actionType: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
});

userRouter.post("/register", authRateLimiter.userLimiter, authRateLimiter.ipLimiter, registerUser);
userRouter.post("/login", authRateLimiter.userLimiter, authRateLimiter.ipLimiter, loginUser);
userRouter.post("/forgot-password", resetRateLimiter.ipLimiter, forgotPassword);
userRouter.post("/reset-password", resetRateLimiter.ipLimiter, resetPassword);
userRouter.post("/send-verification", resetRateLimiter.ipLimiter, sendVerificationCode);
userRouter.post("/verify-email", resetRateLimiter.ipLimiter, verifyEmailCode);
userRouter.get("/me", verifyToken, getMyProfile);
userRouter.put("/me", verifyToken, updateMyProfile);
userRouter.put("/me/password", verifyToken, updateMyPassword);

export default userRouter;