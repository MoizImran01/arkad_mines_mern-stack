import express from "express";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";
import { getAllUsers, updateUserRole, deleteUser } from "../../Controllers/UserController/userController.js";
import { getAnalytics, exportAnalyticsPDF } from "../../Controllers/AnalyticsController/analyticsController.js";
import { enforceHTTPS } from "../../Middlewares/securityHeaders.js";
import { analyticsRateLimiter, analyticsThrottling, analyticsWAF } from "../../Middlewares/analyticsPerformance.js";
import { strictAnalyticsRBAC, verifyAdminInDatabase } from "../../Middlewares/analyticsRBAC.js";
import { detectAnalyticsAnomalies, createIPWhitelist } from "../../Middlewares/analyticsSecurity.js";
import { strictAnalyticsCSP } from "../../Middlewares/analyticsTamperingProtection.js";
import { createReauthMiddleware } from "../../Middlewares/genericReauth.js";

// Admin routes: dashboard, users, role update, delete user, analytics, analytics PDF export.
const adminRouter = express.Router();

const requireAnalyticsMFA = createReauthMiddleware({
  actionName: 'ANALYTICS_MFA',
  actionType: 'ANALYTICS_MFA_REQUIRED',
  passwordField: 'passwordConfirmation',
  responseFlag: 'requiresMFA',
  getResourceId: () => 'analytics-dashboard',
  getAdditionalContext: (req) => ({
    path: req.path,
    queryParams: req.query
  })
});

const analyticsIPWhitelist = createIPWhitelist(
  process.env.ANALYTICS_ALLOWED_IPS ? process.env.ANALYTICS_ALLOWED_IPS.split(',') : [],
  process.env.ENFORCE_ANALYTICS_IP_WHITELIST === 'true'
);

adminRouter.get("/admin-dashboard", verifyToken, authorizeRoles("admin", "employee"), (req, res) => {
  res.json({ message: req.user?.role === "admin" ? "Welcome, Admin." : "Welcome." });
});

adminRouter.get("/users", verifyToken, authorizeRoles("admin", "employee"), getAllUsers);
adminRouter.put("/users/:userId/role", verifyToken, authorizeRoles("admin"), updateUserRole);
adminRouter.delete("/users/:userId", verifyToken, authorizeRoles("admin"), deleteUser);

adminRouter.get("/analytics", 
  verifyToken,
  strictAnalyticsRBAC,
  authorizeRoles("admin"),
  verifyAdminInDatabase,
  analyticsIPWhitelist,
  strictAnalyticsCSP,
  analyticsWAF,
  analyticsThrottling,
  analyticsRateLimiter.userLimiter,
  analyticsRateLimiter.ipLimiter,
  detectAnalyticsAnomalies,
  requireAnalyticsMFA,
  getAnalytics
);
adminRouter.post("/analytics/export/pdf", 
  verifyToken,
  strictAnalyticsRBAC,
  authorizeRoles("admin"),
  verifyAdminInDatabase,
  enforceHTTPS,
  exportAnalyticsPDF
);

export default adminRouter;
