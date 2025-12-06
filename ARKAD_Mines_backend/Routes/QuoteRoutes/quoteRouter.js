import express from "express";
import rateLimit from "express-rate-limit"; 
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


// 1. Limiter for Creating/Updating Quotations
const createQuoteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: { error: "Too many quote requests created, please try again later." }
});

// 2. Limiter for PDF Downloads

const pdfDownloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, 
  message: { error: "Download limit exceeded. Please wait before downloading again." }
});

// 3. Limiter for accepting/rejecting/requesting revision/converting quotations

const actionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 10, 
  message: { error: "Too many actions. Please slow down." }
});


quoteRouter.post("/", verifyToken, createQuoteLimiter, createOrUpdateQuotation);
quoteRouter.get("/my", verifyToken, getMyQuotations);
quoteRouter.get("/admin", verifyToken, authorizeRoles("admin"), getAllQuotations);
quoteRouter.put("/:quoteId/issue", verifyToken, authorizeRoles("admin"), issueQuotation);
quoteRouter.get("/:quoteId/download", verifyToken, pdfDownloadLimiter, downloadQuotation);
quoteRouter.put("/:quoteId/approve", verifyToken, actionLimiter, approveQuotation);
quoteRouter.put("/:quoteId/reject", verifyToken, actionLimiter, rejectQuotation);
quoteRouter.put("/:quoteId/request-revision", verifyToken, actionLimiter, requestRevision);
quoteRouter.post("/:quoteId/convert-to-order", verifyToken, actionLimiter, convertToSalesOrder);

export default quoteRouter;