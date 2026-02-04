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

// Route to get specific order details by order number
orderRouter.get('/status/:orderNumber', verifyToken, getOrderDetails);

// Route to get order details with payment information
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

// Admin routes
// Get all orders (admin only)
orderRouter.get('/admin/all', verifyToken, authorizeRoles('admin'), getAllOrders);

// Update order status (admin only)
orderRouter.put('/admin/status/:orderId', verifyToken, authorizeRoles('admin'), updateOrderStatus);

// Admin - Update payment status
orderRouter.put('/admin/payment-status/:orderId', verifyToken, authorizeRoles('admin'), updatePaymentStatus);

// Admin - Approve payment
orderRouter.put('/admin/payment/approve/:orderId/:proofIndex', verifyToken, authorizeRoles('admin'), approvePayment);

// Admin - Reject payment
orderRouter.put('/admin/payment/reject/:orderId/:proofIndex', verifyToken, authorizeRoles('admin'), rejectPayment);

export default orderRouter;