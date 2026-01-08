import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });

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
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
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