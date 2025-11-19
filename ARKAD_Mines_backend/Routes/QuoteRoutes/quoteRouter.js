import express from "express";
import {
  createOrUpdateQuotation,
  getMyQuotations,
  getAllQuotations,
} from "../../Controllers/QuotationController/quotationController.js";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";

const quoteRouter = express.Router();

quoteRouter.post("/", verifyToken, createOrUpdateQuotation);
quoteRouter.get("/my", verifyToken, getMyQuotations);
quoteRouter.get("/admin", verifyToken, authorizeRoles("admin"), getAllQuotations);

export default quoteRouter;

