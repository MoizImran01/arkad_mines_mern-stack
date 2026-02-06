import express from 'express';
import { listDocuments, downloadDocument } from '../../Controllers/DocumentController/DocumentController.js';
import { verifyToken, authorizeRoles } from '../../Middlewares/auth.js';
import { createRateLimiter } from '../../Middlewares/genericRateLimiting.js';
import { wafProtection } from '../../Middlewares/waf.js';
import { enforceHTTPS } from '../../Middlewares/securityHeaders.js';

const documentRouter = express.Router();

const documentListRateLimiter = createRateLimiter({
  endpoint: '/api/documents',
  windowMs: 60 * 1000,
  maxRequests: 30,
  actionName: 'DOCUMENT_LIST',
  actionType: 'DOCUMENT_LIST_RATE_LIMIT_EXCEEDED',
  enableCaptcha: false
});

const documentDownloadRateLimiter = createRateLimiter({
  endpoint: '/api/documents/:documentId/download',
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  actionName: 'DOCUMENT_DOWNLOAD',
  actionType: 'DOCUMENT_DOWNLOAD_RATE_LIMIT_EXCEEDED',
  enableCaptcha: false
});

documentRouter.get(
  '/',
  enforceHTTPS,
  verifyToken,
  wafProtection,
  documentListRateLimiter.userLimiter,
  documentListRateLimiter.ipLimiter,
  listDocuments
);

// Download document (buyer only, admin can access all)
// Handle with format parameter
documentRouter.get(
  '/:documentId/download/:format',
  enforceHTTPS,
  verifyToken,
  wafProtection,
  documentDownloadRateLimiter.userLimiter,
  documentDownloadRateLimiter.ipLimiter,
  downloadDocument
);

documentRouter.get(
  '/:documentId/download',
  enforceHTTPS,
  verifyToken,
  wafProtection,
  documentDownloadRateLimiter.userLimiter,
  documentDownloadRateLimiter.ipLimiter,
  downloadDocument
);

export default documentRouter;
