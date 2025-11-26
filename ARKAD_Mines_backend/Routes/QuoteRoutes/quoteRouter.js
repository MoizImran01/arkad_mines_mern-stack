import express from "express";
import {
  createOrUpdateQuotation,
  getMyQuotations,
  getAllQuotations,
  issueQuotation, 
  downloadQuotation
} from "../../Controllers/QuotationController/quotationController.js";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";

const quoteRouter = express.Router();

quoteRouter.post("/", verifyToken, createOrUpdateQuotation);
quoteRouter.get("/my", verifyToken, getMyQuotations);
quoteRouter.get("/admin", verifyToken, authorizeRoles("admin"), getAllQuotations);
quoteRouter.put("/:quoteId/issue", verifyToken, authorizeRoles("admin"), issueQuotation);
quoteRouter.get("/:quoteId/download", verifyToken, authorizeRoles("admin"), downloadQuotation);

export default quoteRouter;