import express from "express";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";
import { getAllUsers, updateUserRole, deleteUser } from "../../Controllers/UserController/userController.js";
import { getAnalytics, exportAnalyticsPDF } from "../../Controllers/AnalyticsController/analyticsController.js";
import { enforceHTTPS } from "../../Middlewares/securityHeaders.js";
import { wafProtection } from "../../Middlewares/waf.js";
import { verifyAdminInDatabase } from "../../Middlewares/analyticsRBAC.js";
import { detectAnalyticsAnomalies } from "../../Middlewares/analyticsSecurity.js";

/** Admin routes: dashboard, users, role update, delete user, analytics, analytics PDF export. */
const adminRouter = express.Router();

adminRouter.get("/admin-dashboard", verifyToken, authorizeRoles("admin", "employee"), (req, res) => {
  res.json({ message: req.user?.role === "admin" ? "Welcome, Admin." : "Welcome." });
});

adminRouter.get("/users", verifyToken, authorizeRoles("admin", "employee"), getAllUsers);
adminRouter.put("/users/:userId/role", verifyToken, authorizeRoles("admin"), updateUserRole);
adminRouter.delete("/users/:userId", verifyToken, authorizeRoles("admin"), deleteUser);

adminRouter.get("/dashboard", 
  verifyToken,
  authorizeRoles("admin"),
  verifyAdminInDatabase,
  wafProtection,
  detectAnalyticsAnomalies,
  getAnalytics
);
adminRouter.post("/dashboard/export/pdf", 
  verifyToken,
  authorizeRoles("admin"),
  verifyAdminInDatabase,
  enforceHTTPS,
  exportAnalyticsPDF
);

/** Backward compatibility aliases for legacy analytics paths. */
adminRouter.get("/analytics", 
  verifyToken,
  authorizeRoles("admin"),
  verifyAdminInDatabase,
  wafProtection,
  detectAnalyticsAnomalies,
  getAnalytics
);
adminRouter.post("/analytics/export/pdf", 
  verifyToken,
  authorizeRoles("admin"),
  verifyAdminInDatabase,
  enforceHTTPS,
  exportAnalyticsPDF
);

export default adminRouter;
