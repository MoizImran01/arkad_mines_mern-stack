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
import { requireReauth } from "../../Middlewares/reauth.js";
import { detectAnomalies } from "../../Middlewares/anomalyDetection.js";
import { validateQuotationOwnership, validateQuotationStatus } from "../../Middlewares/ownershipValidation.js";
import { sanitizeQuotationResponse } from "../../Middlewares/responseSanitization.js";
import { wafProtection } from "../../Middlewares/waf.js";
import { approvalPerUserLimiter, approvalPerIPLimiter } from "../../Middlewares/rateLimiting.js";
import { requireCaptchaChallenge } from "../../Middlewares/captchaChallenge.js";
import { requestThrottling } from "../../Middlewares/requestThrottling.js";
import { requirePermission, verifyStrictOwnership } from "../../Middlewares/rbac.js";

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


//filters sensitive data based on user role
quoteRouter.use(sanitizeQuotationResponse);

quoteRouter.post("/", verifyToken, createQuoteLimiter, createOrUpdateQuotation);
quoteRouter.get("/my", verifyToken, getMyQuotations);
quoteRouter.get("/admin", verifyToken, authorizeRoles("admin"), getAllQuotations);
quoteRouter.put("/:quoteId/issue", verifyToken, authorizeRoles("admin"), issueQuotation);
quoteRouter.get("/:quoteId/download", verifyToken, pdfDownloadLimiter, downloadQuotation);


// Approve quotation route with comprehensive Elevation of Privilege mitigations:
// 1. verifyToken - ensures user is authenticated
// 2. requirePermission('canApproveQuotation') - RBAC check (only BUYER role can approve)
// 3. wafProtection - Web Application Firewall filters malicious traffic
// 4. requestThrottling - Queue management and throttling
// 5. approvalPerUserLimiter - Per-user rate limiting (5/hour)
// 6. approvalPerIPLimiter - Per-IP rate limiting (10/hour)
// 7. requireCaptchaChallenge - CAPTCHA after 3 requests
// 8. actionLimiter - General rate limiting (backup)
// 9. detectAnomalies - Monitors IP/device changes
// 10. verifyStrictOwnership - STRICT ownership verification (req.user.id === quotation.buyer._id)
// 11. validateQuotationOwnership - Additional ownership validation (defense in depth)
// 12. validateQuotationStatus - Validates status is "issued" and not expired
// 13. requireReauth - Requires password confirmation for high-impact action
// 14. approveQuotation - Final defense-in-depth ownership check in controller
quoteRouter.put("/:quoteId/approve", 
  verifyToken,                          // Authentication
  requirePermission('canApproveQuotation'), // RBAC: Only BUYER role can approve
  wafProtection,                        // Filter malicious traffic
  requestThrottling,                    // Request throttling
  approvalPerUserLimiter,               // Per-user rate limit (5/hour)
  approvalPerIPLimiter,                 // Per-IP rate limit (10/hour)
  requireCaptchaChallenge,              // CAPTCHA after 3 requests
  actionLimiter,                        // General rate limiting (backup)
  detectAnomalies,                      // Anomaly detection
  verifyStrictOwnership,                // STRICT ownership verification (req.user.id === quotation.buyer._id)
  validateQuotationOwnership,           // Additional ownership validation (defense in depth)
  validateQuotationStatus,              // Status validation
  requireReauth,                        // Re-authentication
  approveQuotation                      // Final ownership check in controller
);
quoteRouter.put("/:quoteId/reject", verifyToken, actionLimiter, rejectQuotation);
quoteRouter.put("/:quoteId/request-revision", verifyToken, actionLimiter, requestRevision);
quoteRouter.post("/:quoteId/convert-to-order", verifyToken, actionLimiter, convertToSalesOrder);

export default quoteRouter;