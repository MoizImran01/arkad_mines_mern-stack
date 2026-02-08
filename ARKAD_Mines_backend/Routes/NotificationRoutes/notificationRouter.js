import express from "express";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";
import {
  clearNotifications,
  getAdminPaymentSummary,
  getNotifications,
} from "../../Controllers/NotificationController/notificationController.js";

// Notification routes: list, clear, admin payment summary.
const notificationRouter = express.Router();

notificationRouter.get("/", verifyToken, getNotifications);
notificationRouter.post("/clear", verifyToken, clearNotifications);
notificationRouter.get(
  "/admin/payment-summary",
  verifyToken,
  authorizeRoles("admin"),
  getAdminPaymentSummary
);

export default notificationRouter;

