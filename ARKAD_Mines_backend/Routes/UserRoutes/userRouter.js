import express from "express";
import { loginUser, registerUser } from "../../Controllers/UserController/userController.js";
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js";

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

export default userRouter;