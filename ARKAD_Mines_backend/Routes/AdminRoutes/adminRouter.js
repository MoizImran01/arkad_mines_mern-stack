import express from "express";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";

const adminRouter = express.Router();

adminRouter.get("/admin-dashboard", verifyToken, authorizeRoles("admin"), (req, res) => {
  res.json({ message: "Welcome, Admin." });
});

export default adminRouter;
