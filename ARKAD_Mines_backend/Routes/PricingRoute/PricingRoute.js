import express from "express";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js";
import {
    getPriceSuggestion,
    getBatchPriceSuggestions,
    getPricingHealth,
} from "../../Controllers/PricingController.js";

const pricingRouter = express.Router();

const pricingRateLimiter = createRateLimiter({
    endpoint: "/api/pricing",
    windowMs: 60 * 1000,
    maxRequests: 30,
    actionName: "PRICING_ACCESS",
    actionType: "PRICING_RATE_LIMIT_EXCEEDED",
});

// Single item price prediction
pricingRouter.post(
    "/predict-price",
    verifyToken,
    authorizeRoles("admin", "employee"),
    pricingRateLimiter.userLimiter,
    pricingRateLimiter.ipLimiter,
    getPriceSuggestion
);

// Batch price prediction (for all items in a quotation)
pricingRouter.post(
    "/predict-prices",
    verifyToken,
    authorizeRoles("admin", "employee"),
    pricingRateLimiter.userLimiter,
    pricingRateLimiter.ipLimiter,
    getBatchPriceSuggestions
);

// Health check
pricingRouter.get(
    "/health",
    verifyToken,
    authorizeRoles("admin", "employee"),
    getPricingHealth
);

export default pricingRouter;
