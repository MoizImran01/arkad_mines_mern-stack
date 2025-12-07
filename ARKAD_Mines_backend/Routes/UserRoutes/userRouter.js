import express from "express";
import rateLimit from "express-rate-limit"; 
import { loginUser, registerUser } from "../../Controllers/UserController/userController.js";

const userRouter = express.Router();



const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { 
    error: "Too many login or signup attempts. Please try again later." 
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});


userRouter.post("/register", authLimiter, registerUser);
userRouter.post("/login", authLimiter, loginUser);

export default userRouter;