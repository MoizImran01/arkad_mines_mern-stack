import express from "express";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";
import { getAllUsers, updateUserRole, deleteUser } from "../../Controllers/UserController/userController.js";
import { getAnalytics } from "../../Controllers/AnalyticsController/analyticsController.js";

const adminRouter = express.Router();

adminRouter.get("/admin-dashboard", verifyToken, authorizeRoles("admin"), (req, res) => {
  res.json({ message: "Welcome, Admin." });
});

adminRouter.get("/users", verifyToken, authorizeRoles("admin"), getAllUsers);
adminRouter.put("/users/:userId/role", verifyToken, authorizeRoles("admin"), updateUserRole);
adminRouter.delete("/users/:userId", verifyToken, authorizeRoles("admin"), deleteUser);

// Analytics route
adminRouter.get("/analytics", verifyToken, authorizeRoles("admin"), getAnalytics);

export default adminRouter;
