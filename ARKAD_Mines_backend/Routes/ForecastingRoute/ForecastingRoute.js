import express from "express"
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js"
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js"
import { getAIForecast } from "../../Controllers/InventoryController.js"

const forecastingRouter = express.Router();

const forecastRateLimiter = createRateLimiter({
  endpoint: '/api/forecasting/forecast',
  windowMs: 60 * 1000,
  maxRequests: 30,
  actionName: 'FORECAST_ACCESS',
  actionType: 'FORECAST_RATE_LIMIT_EXCEEDED'
});

forecastingRouter.get(
  "/forecast",
  verifyToken,
  authorizeRoles("admin", "employee"),
  forecastRateLimiter.userLimiter,
  forecastRateLimiter.ipLimiter,
  getAIForecast
);

export default forecastingRouter;