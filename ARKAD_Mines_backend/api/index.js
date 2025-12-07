import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });

import express from "express";
import cors from "cors";
import { connectDB } from "../config/db.js";
import userRouter from "../Routes/UserRoutes/userRouter.js";
import adminRouter from "../Routes/AdminRoutes/adminRouter.js";
import stonesRouter from "../Routes/StonesRoutes/StonesRoutes.js";
import quoteRouter from "../Routes/QuoteRoutes/quoteRouter.js";

const app = express();

//Middlewares
app.use(express.json());
app.use(cors());

///database configuration
connectDB().catch((e) => console.error("DB connect error:", e));


// Legacy: Keep serving local uploads for any existing images
// New images are stored on Cloudinary and served via full URLs
app.use("/images", express.static("uploads"));

//Routes
app.use("/api/user", userRouter);
app.use("/api", adminRouter);
app.use("/api/stones", stonesRouter);
app.use("/api/quotes", quoteRouter);


app.get("/", (req, res) => res.status(200).send(" Server running successfully"));


export default app;


if (!process.env.VERCEL) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Local API on ${port}`));
}