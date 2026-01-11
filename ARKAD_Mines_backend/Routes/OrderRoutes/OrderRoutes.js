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
import { requireMFAForPayment } from '../../Middlewares/paymentMFA.js';
import { detectPaymentAnomalies } from '../../Middlewares/paymentAnomalyDetection.js';
import { enforceHTTPS } from '../../Middlewares/securityHeaders.js';
import { wafProtection } from '../../Middlewares/waf.js';
import { paymentPerUserLimiter, paymentPerIPLimiter } from '../../Middlewares/paymentRateLimiting.js';
import { validatePaymentFileSize, validatePaymentImageDimensions } from '../../Middlewares/paymentFileValidation.js';
import { queuePaymentProcessing } from '../../Middlewares/paymentProcessingQueue.js';
import { rejectClientPaymentStatus } from '../../Middlewares/paymentStatusValidation.js';

const orderRouter = express.Router();

// Route to get all orders for the logged-in user (Dashboard)
orderRouter.get('/my', verifyToken, getUserOrders);

// Route to get specific order details by order number
orderRouter.get('/status/:orderNumber', verifyToken, getOrderDetails);

// Route to get order details with payment information
orderRouter.get('/details/:orderId', verifyToken, getOrderDetailsWithPayment);

// Client side - Submit payment proof (handled in controller; uploads to Cloudinary)
// Security and performance layers (applied in order):
// 1. enforceHTTPS - Enforce HTTPS/TLS for payment data in transit
// 2. verifyToken - Authentication
// 3. wafProtection - Web Application Firewall filters malicious traffic
// 4. paymentPerUserLimiter - Per-user rate limiting (max 10 submissions per day)
// 5. paymentPerIPLimiter - Per-IP rate limiting (max 20 submissions per day)
// 6. validatePaymentFileSize - File size validation (max 5MB)
// 7. validatePaymentImageDimensions - Image dimension validation placeholder
// 8. queuePaymentProcessing - Queue image processing to prevent resource exhaustion (max 3 concurrent, 30s timeout)
// 9. rejectClientPaymentStatus - Reject any client attempts to set paymentStatus directly
// 10. requireMFAForPayment - Multi-factor authentication (password confirmation)
// 11. detectPaymentAnomalies - Anomaly detection (rapid submissions, unusual amounts, IP changes)
// 12. submitPaymentProof - Payment submission handler (server-side logic only, no client-submitted paymentStatus)
orderRouter.post('/payment/submit/:orderId', 
  enforceHTTPS, 
  verifyToken, 
  wafProtection, 
  paymentPerUserLimiter, 
  paymentPerIPLimiter, 
  validatePaymentFileSize, 
  validatePaymentImageDimensions, 
  queuePaymentProcessing, 
  rejectClientPaymentStatus, 
  requireMFAForPayment, 
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