import express from "express";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js";
import { enforceHTTPS } from "../../Middlewares/securityHeaders.js";
import {
  searchCustomers,
  getCustomerHistory,
  exportCustomerHistory,
} from "../../Controllers/CustomerHistoryController/customerHistoryController.js";

const customerRouter = express.Router();

// STRIDE S & E: only admin and employee (sales rep) can access
const allowedRoles = ["admin", "employee"];

// STRIDE D: rate limits to prevent DoS
const searchRateLimiter = createRateLimiter({
  endpoint: "/api/customers/search",
  windowMs: 60 * 1000,
  maxRequests: 60,
  actionName: "CUSTOMER_SEARCH",
  actionType: "CUSTOMER_SEARCH_RATE_LIMIT_EXCEEDED",
});

const historyRateLimiter = createRateLimiter({
  endpoint: "/api/customers/:customerId/history",
  windowMs: 60 * 1000,
  maxRequests: 60,
  actionName: "VIEW_CUSTOMER_HISTORY",
  actionType: "VIEW_CUSTOMER_HISTORY_RATE_LIMIT_EXCEEDED",
});

const exportRateLimiter = createRateLimiter({
  endpoint: "/api/customers/:customerId/history/export",
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  actionName: "EXPORT_CUSTOMER_HISTORY",
  actionType: "EXPORT_CUSTOMER_HISTORY_RATE_LIMIT_EXCEEDED",
});

// Search: sales rep searches for customer profile
customerRouter.get(
  "/search",
  verifyToken,
  authorizeRoles(...allowedRoles),
  searchRateLimiter.userLimiter,
  searchRateLimiter.ipLimiter,
  searchCustomers
);

// View customer history: contact details, quotes, orders
customerRouter.get(
  "/:customerId/history",
  verifyToken,
  authorizeRoles(...allowedRoles),
  historyRateLimiter.userLimiter,
  historyRateLimiter.ipLimiter,
  getCustomerHistory
);

// Export history for offline review (alternate course)
customerRouter.get(
  "/:customerId/history/export",
  enforceHTTPS,
  verifyToken,
  authorizeRoles(...allowedRoles),
  exportRateLimiter.userLimiter,
  exportRateLimiter.ipLimiter,
  exportCustomerHistory
);

export default customerRouter;
