import dotenv from "dotenv";
// Load environment variables from config.env for local development
// In production (Vercel), environment variables are set via Vercel dashboard
if (!process.env.VERCEL) {
  dotenv.config({ path: "./config.env" });
} else {
  // In Vercel, just load from process.env (already available)
  dotenv.config();
}

// Verify critical environment variables are set
if (!process.env.JWT_SECRET) {
  console.error("WARNING: JWT_SECRET is not configured! Authentication will fail.");
}

import express from "express";
import cors from "cors";
import { connectDB } from "../config/db.js";
import userRouter from "../Routes/UserRoutes/userRouter.js";
import adminRouter from "../Routes/AdminRoutes/adminRouter.js";
import stonesRouter from "../Routes/StonesRoutes/StonesRoutes.js";
import quoteRouter from "../Routes/QuoteRoutes/quoteRouter.js";
import orderRouter from "../Routes/OrderRoutes/OrderRoutes.js";
const app = express();

//Middlewares
// Increase payload size limit for base64 image uploads (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration - support both development and production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'https://arkad-mines-mern-stack.vercel.app',
  'https://arkad-mines-mern-stack-aleb.vercel.app',
  'https://arkad-mines-mern-stack-vua5.vercel.app',
  // Allow any Vercel preview deployment
  /^https:\/\/arkad-mines-mern-stack.*\.vercel\.app$/
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

///database configuration
connectDB().catch((e) => console.error("DB connect error:", e));


app.use("/images", express.static("uploads"));

//Routes
app.use("/api/user", userRouter);
app.use("/api", adminRouter);
app.use("/api/stones", stonesRouter);
app.use("/api/quotes", quoteRouter);
app.use("/api/orders", orderRouter);


app.get("/", (req, res) => res.status(200).send(" Server running successfully"));


export default app;


if (!process.env.VERCEL) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Local API on ${port}`));
}