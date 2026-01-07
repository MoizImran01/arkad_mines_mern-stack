import express from 'express';
import { getOrderDetails, getUserOrders, getAllOrders, updateOrderStatus } from '../../Controllers/OrderController/OrderController.js';
import { verifyToken, authorizeRoles } from '../../Middlewares/auth.js';

const orderRouter = express.Router();

// Route to get all orders for the logged-in user (Dashboard)
orderRouter.get('/my', verifyToken, getUserOrders);

// Route to get specific order details by order number
orderRouter.get('/status/:orderNumber', verifyToken, getOrderDetails);

// Admin routes
// Get all orders (admin only)
orderRouter.get('/admin/all', verifyToken, authorizeRoles('admin'), getAllOrders);

// Update order status (admin only)
orderRouter.put('/admin/status/:orderId', verifyToken, authorizeRoles('admin'), updateOrderStatus);

export default orderRouter;