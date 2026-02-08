import express from 'express';
import { 
  getOrderDetails, 
  getUserOrders, 
  getAllOrders, 
  updateOrderStatus,
  submitPaymentProof,
  approvePayment,
  rejectPayment,
  getOrderDetailsWithPayment,
  updatePaymentStatus
} from '../../Controllers/OrderController/OrderController.js';
import { verifyToken, authorizeRoles } from '../../Middlewares/auth.js';
import { createRateLimiter } from '../../Middlewares/genericRateLimiting.js';
import { createReauthMiddleware } from '../../Middlewares/genericReauth.js';
import { createCaptchaChallenge } from '../../Middlewares/genericCaptchaChallenge.js';
import { createRequestQueue } from '../../Middlewares/genericRequestQueue.js';
import { wafProtection } from '../../Middlewares/waf.js';
import { detectPaymentAnomalies } from '../../Middlewares/paymentAnomalyDetection.js';
import { validatePaymentFileSize, validatePaymentImageDimensions } from '../../Middlewares/paymentFileValidation.js';
import { rejectClientPaymentStatus } from '../../Middlewares/paymentStatusValidation.js';
import { enforceHTTPS } from '../../Middlewares/securityHeaders.js';

// Order routes: my orders, payment submit, admin order management.
const orderRouter = express.Router();

const paymentRateLimiter = createRateLimiter({
  endpoint: '/api/orders/payment/submit/:orderId',
  windowMs: 24 * 60 * 60 * 1000,
  maxRequests: 10,
  actionName: 'PAYMENT_SUBMISSION',
  actionType: 'PAYMENT_RATE_LIMIT_EXCEEDED',
  enableCaptcha: false
});

const requirePaymentMFA = createReauthMiddleware({
  actionName: 'PAYMENT_MFA',
  actionType: 'PAYMENT_MFA_REQUIRED',
  passwordField: 'passwordConfirmation',
  responseFlag: 'requiresMFA',
  getResourceId: (req) => req.params.orderId
});

const paymentProcessingQueue = createRequestQueue({
  endpoint: '/api/orders/payment/submit/:orderId',
  maxConcurrent: 3,
  timeoutMs: 30000,
  actionName: 'PAYMENT_PROCESSING',
  getResourceId: (req) => req.params.orderId
});

const requirePaymentCaptcha = createCaptchaChallenge({
  endpoint: '/api/orders/payment/submit',
  windowMs: 24 * 60 * 60 * 1000,
  requestThreshold: 3,
  actionName: 'PAYMENT_CAPTCHA_REQUIRED'
});

orderRouter.get('/my', verifyToken, getUserOrders);
orderRouter.get('/status/:orderNumber', verifyToken, getOrderDetails);
orderRouter.get('/details/:orderId', verifyToken, getOrderDetailsWithPayment);

orderRouter.post('/payment/submit/:orderId',
  enforceHTTPS,
  verifyToken,
  wafProtection,
  requirePaymentCaptcha,
  paymentRateLimiter.userLimiter,
  paymentRateLimiter.ipLimiter,
  validatePaymentFileSize,
  validatePaymentImageDimensions,
  paymentProcessingQueue,
  rejectClientPaymentStatus,
  requirePaymentMFA,
  detectPaymentAnomalies,
  submitPaymentProof
);

orderRouter.get('/admin/all', verifyToken, authorizeRoles('admin'), getAllOrders);
orderRouter.put('/admin/status/:orderId', verifyToken, authorizeRoles('admin'), updateOrderStatus);
orderRouter.put('/admin/payment-status/:orderId', verifyToken, authorizeRoles('admin'), updatePaymentStatus);
orderRouter.put('/admin/payment/approve/:orderId/:proofIndex', verifyToken, authorizeRoles('admin'), approvePayment);
orderRouter.put('/admin/payment/reject/:orderId/:proofIndex', verifyToken, authorizeRoles('admin'), rejectPayment);

export default orderRouter;