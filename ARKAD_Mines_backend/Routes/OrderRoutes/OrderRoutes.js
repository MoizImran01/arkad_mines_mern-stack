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

const orderRouter = express.Router();

// Route to get all orders for the logged-in user (Dashboard)
orderRouter.get('/my', verifyToken, getUserOrders);

// Route to get specific order details by order number
orderRouter.get('/status/:orderNumber', verifyToken, getOrderDetails);

// Route to get order details with payment information
orderRouter.get('/details/:orderId', verifyToken, getOrderDetailsWithPayment);

// Client side - Submit payment proof (handled in controller; uploads to Cloudinary)
orderRouter.post('/payment/submit/:orderId', verifyToken, submitPaymentProof);

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