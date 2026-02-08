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
import { createRateLimiter } from "../../Middlewares/genericRateLimiting.js";
import { createReauthMiddleware } from "../../Middlewares/genericReauth.js";
import { createCaptchaChallenge } from "../../Middlewares/genericCaptchaChallenge.js";
import { createRequestQueue } from "../../Middlewares/genericRequestQueue.js";
import { createOwnershipValidator } from "../../Middlewares/genericOwnershipValidation.js";
import { validateQuotationStatus } from "../../Middlewares/quotationStatusValidation.js";
import { wafProtection } from "../../Middlewares/waf.js";
import { detectAnomalies } from "../../Middlewares/anomalyDetection.js";
import { requirePermission } from "../../Middlewares/rbac.js";
import quotationModel from "../../Models/quotationModel/quotationModel.js";

// Quote routes: create, my, admin list, issue, download, approve, reject, revision, convert.
const quoteRouter = express.Router();

const createQuoteRateLimiter = createRateLimiter({
  endpoint: '/api/quotes',
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  actionName: 'CREATE_QUOTATION',
  actionType: 'QUOTATION_RATE_LIMIT_EXCEEDED'
});

const pdfDownloadRateLimiter = createRateLimiter({
  endpoint: '/api/quotes/:quoteId/download',
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  actionName: 'PDF_DOWNLOAD',
  actionType: 'PDF_DOWNLOAD_RATE_LIMIT_EXCEEDED'
});

const actionRateLimiter = createRateLimiter({
  endpoint: '/api/quotes/:quoteId/action',
  windowMs: 1 * 60 * 1000,
  maxRequests: 10,
  actionName: 'QUOTATION_ACTION',
  actionType: 'QUOTATION_ACTION_RATE_LIMIT_EXCEEDED'
});

const approvalRateLimiter = createRateLimiter({
  endpoint: '/api/quotes/:quoteId/approve',
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  actionName: 'APPROVE_QUOTATION',
  actionType: 'APPROVE_QUOTATION_RATE_LIMIT_EXCEEDED',
  enableCaptcha: true,
  captchaThreshold: 3
});

const requireQuotationReauth = createReauthMiddleware({
  actionName: 'APPROVE_QUOTATION_REAUTH',
  actionType: 'REAUTH_REQUIRED',
  passwordField: 'passwordConfirmation',
  responseFlag: 'requiresReauth',
  getResourceId: (req) => req.params.quoteId,
  getAdditionalContext: (req) => ({
    quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
    quotationId: req.validatedQuotation?.referenceNumber || null
  })
});

const requireQuotationCaptcha = createCaptchaChallenge({
  endpoint: '/api/quotes',
  windowMs: 60 * 60 * 1000,
  requestThreshold: 3,
  actionName: 'CAPTCHA_REQUIRED'
});

const quotationThrottling = createRequestQueue({
  endpoint: '/api/quotes/:quoteId/approve',
  maxConcurrent: 5,
  timeoutMs: 60000,
  actionName: 'QUOTATION_THROTTLING',
  shouldApply: (req) => req.path.includes('/approve'),
  getResourceId: (req) => req.params.quoteId
});

const validateQuotationOwnership = createOwnershipValidator({
  model: quotationModel,
  ownerField: 'buyer',
  paramName: 'quoteId',
  actionName: 'VALIDATE_QUOTATION_OWNERSHIP',
  selectFields: '_id buyer status referenceNumber validity orderNumber buyerDecision quotationRequestId',
  getAdditionalContext: (req) => ({
    quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
    quotationId: req.validatedQuotation?.referenceNumber || null
  }),
  onSuccess: (resource, req) => {
    if (!req.validatedQuotation) {
      req.validatedQuotation = {};
    }
    req.validatedQuotation.id = resource._id;
    req.validatedQuotation.buyerId = resource.buyer;
    req.validatedQuotation.status = resource.status;
    req.validatedQuotation.referenceNumber = resource.referenceNumber;
    req.validatedQuotation.validity = resource.validity;
    req.validatedQuotation.orderNumber = resource.orderNumber;
    req.validatedQuotation.buyerDecision = resource.buyerDecision;
    req.validatedQuotation.quotationRequestId = resource.quotationRequestId || null;
  }
});


quoteRouter.post("/", verifyToken, createQuoteRateLimiter.userLimiter, createQuoteRateLimiter.ipLimiter, createOrUpdateQuotation);
quoteRouter.get("/my", verifyToken, getMyQuotations);
quoteRouter.get("/admin", verifyToken, authorizeRoles("admin"), getAllQuotations);
quoteRouter.put("/:quoteId/issue", verifyToken, authorizeRoles("admin"), issueQuotation);
quoteRouter.get("/:quoteId/download", verifyToken, pdfDownloadRateLimiter.userLimiter, pdfDownloadRateLimiter.ipLimiter, downloadQuotation);
quoteRouter.put("/:quoteId/approve", 
  verifyToken,
  requirePermission('canApproveQuotation'),
  wafProtection,
  quotationThrottling,
  requireQuotationCaptcha,
  approvalRateLimiter.userLimiter,
  approvalRateLimiter.ipLimiter,
  actionRateLimiter.userLimiter,
  actionRateLimiter.ipLimiter,
  detectAnomalies,
  validateQuotationOwnership,
  validateQuotationStatus,
  requireQuotationReauth,
  approveQuotation
);
quoteRouter.put("/:quoteId/reject", verifyToken, actionRateLimiter.userLimiter, actionRateLimiter.ipLimiter, rejectQuotation);
quoteRouter.put("/:quoteId/request-revision", verifyToken, actionRateLimiter.userLimiter, actionRateLimiter.ipLimiter, requestRevision);
quoteRouter.post("/:quoteId/convert-to-order", verifyToken, actionRateLimiter.userLimiter, actionRateLimiter.ipLimiter, convertToSalesOrder);

export default quoteRouter;