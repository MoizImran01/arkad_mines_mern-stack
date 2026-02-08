import express from "express";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js";
import { enforceHTTPS } from "../../Middlewares/securityHeaders.js";
import {
  searchCustomers,
  getCustomerHistory,
  exportCustomerHistory,
} from "../../Controllers/CustomerHistoryController/customerHistoryController.js";

// Customer routes: search, history, export (admin/sales rep only).
const customerRouter = express.Router();

const allowedRoles = ["admin", "employee"];

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

customerRouter.get(
  "/search",
  verifyToken,
  authorizeRoles(...allowedRoles),
  searchRateLimiter.userLimiter,
  searchRateLimiter.ipLimiter,
  searchCustomers
);

customerRouter.get(
  "/:customerId/history",
  verifyToken,
  authorizeRoles(...allowedRoles),
  historyRateLimiter.userLimiter,
  historyRateLimiter.ipLimiter,
  getCustomerHistory
);

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
