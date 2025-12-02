import express from "express";
import {
  createOrUpdateQuotation,
  getMyQuotations,
  getAllQuotations,
  issueQuotation, 
  downloadQuotation,
  approveQuotation,
  rejectQuotation,
  requestRevision,
  convertToSalesOrder
} from "../../Controllers/QuotationController/quotationController.js";
import { verifyToken, authorizeRoles } from "../../Middlewares/auth.js";

const quoteRouter = express.Router();

quoteRouter.post("/", verifyToken, createOrUpdateQuotation);
quoteRouter.get("/my", verifyToken, getMyQuotations);
quoteRouter.get("/admin", verifyToken, authorizeRoles("admin"), getAllQuotations);
quoteRouter.put("/:quoteId/issue", verifyToken, authorizeRoles("admin"), issueQuotation);
quoteRouter.get("/:quoteId/download", verifyToken, downloadQuotation);
quoteRouter.put("/:quoteId/approve", verifyToken, approveQuotation);
quoteRouter.put("/:quoteId/reject", verifyToken, rejectQuotation);
quoteRouter.put("/:quoteId/request-revision", verifyToken, requestRevision);
quoteRouter.post("/:quoteId/convert-to-order", verifyToken, convertToSalesOrder);

export default quoteRouter;