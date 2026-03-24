import express from "express";
import {
  loginUser,
  registerUser,
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
} from "../../Controllers/UserController/userController.js";
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js";
import { verifyToken } from "../../Middlewares/auth.js";

// User auth routes: register, login (rate-limited).
const userRouter = express.Router();

const authRateLimiter = createRateLimiter({
  endpoint: '/api/user/auth',
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  actionName: 'AUTH_ATTEMPT',
  actionType: 'AUTH_RATE_LIMIT_EXCEEDED'
});

userRouter.post("/register", authRateLimiter.userLimiter, authRateLimiter.ipLimiter, registerUser);
userRouter.post("/login", authRateLimiter.userLimiter, authRateLimiter.ipLimiter, loginUser);
userRouter.get("/me", verifyToken, getMyProfile);
userRouter.put("/me", verifyToken, updateMyProfile);
userRouter.put("/me/password", verifyToken, updateMyPassword);

export default userRouter;