import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });

import http from "http";
import express from "express";
import { initSocketServer } from "../socket/socketServer.js";
import cors from "cors";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import userRouter from "../Routes/UserRoutes/userRouter.js";
import adminRouter from "../Routes/AdminRoutes/adminRouter.js";
import stonesRouter from "../Routes/StonesRoutes/StonesRoutes.js";
import quoteRouter from "../Routes/QuoteRoutes/quoteRouter.js";
import notificationRouter from "../Routes/NotificationRoutes/notificationRouter.js";
import orderRouter from "../Routes/OrderRoutes/OrderRoutes.js";
import documentRouter from "../Routes/DocumentRoutes/DocumentRoutes.js";
import customerRouter from "../Routes/CustomerRoutes/customerRouter.js";
import forecastingRouter from "../Routes/ForecastingRoute/ForecastingRoute.js";
import procurementRouter from "../Routes/ProcurementRoute/ProcurementRoute.js";
import pricingRouter from "../Routes/PricingRoute/PricingRoute.js";
import contactRouter from "../Routes/ContactRoutes/contactRouter.js";
const app = express();

/** CORS allowed origins: CLIENT_URL plus localhost dev URLs and OKE deployment URLs. */
const configuredOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : [];
const localOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://localhost:4000'
];
const productionOrigins = [
  'http://80.225.198.154',
  'http://80.225.255.14'
];
const allowedOrigins = [...configuredOrigins, ...localOrigins, ...productionOrigins];

function verifySocketOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (origin.endsWith('.ngrok-free.dev') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok.io')) {
    return callback(null, true);
  }
  const localNetworkPattern = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)\d+\.\d+(:\d+)?$/;
  if (localNetworkPattern.test(origin)) return callback(null, true);
  if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
  return callback(new Error('Not allowed by CORS'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (origin.endsWith('.ngrok-free.dev') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok.io')) {
      return callback(null, true);
    }

    const localNetworkPattern = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)\d+\.\d+(:\d+)?$/;
    if (localNetworkPattern.test(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Expires',
    'X-Requested-With'
  ]
}));

app.get("/live", (req, res) => res.status(200).type("text").send("ok"));
app.get("/ready", (req, res) => {
  if (mongoose.connection.readyState === 1) {
    return res.status(200).type("text").send("ok");
  }
  res.status(503).type("text").send("not ready");
});

app.use("/images", express.static("uploads"));

app.use("/api/user", userRouter);
app.use("/api", adminRouter);
app.use("/api/stones", stonesRouter);
app.use("/api/quotes", quoteRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/orders", orderRouter);
app.use("/api/documents", documentRouter);
app.use("/api/customers", customerRouter);
app.use("/api/forecasting", forecastingRouter);
app.use("/api/procurement", procurementRouter);
app.use("/api/pricing", pricingRouter);
app.use("/api/contact", contactRouter);
app.get("/", (req, res) => res.status(200).send(" Server running successfully"));


export default app;

async function start() {
  if (!process.env.VERCEL) {
    await connectDB();
  } else {
    connectDB().catch((e) => console.error("DB connect error:", e));
  }

  try {
    const { startRetentionCleanup } = await import("../Utils/dataRetention.js");
    startRetentionCleanup();
  } catch (error) {
    console.warn("Data retention cleanup not available:", error.message);
  }

  try {
    const { ensureAnalyticsIndexes } = await import("../Utils/analyticsIndexes.js");
    setTimeout(() => ensureAnalyticsIndexes(), 5000);
  } catch (error) {
    console.warn("Analytics indexes not available:", error.message);
  }

  
  try {
    const { warmUpPricingService } = await import("../Controllers/PricingController.js");
    setTimeout(() => warmUpPricingService(), 2000);
    setInterval(() => warmUpPricingService(), 10 * 60 * 1000);
  } catch (error) {
    console.warn("Pricing warm-up not available:", error.message);
  }

  if (!process.env.VERCEL) {
    const port = process.env.PORT || 4000;
    const server = http.createServer(app);
    initSocketServer(server, verifySocketOrigin);
    server.listen(port, () => console.log(`Local API + WebSocket on ${port}`));
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
