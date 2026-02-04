import orderModel from "../../Models/orderModel/orderModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import { cloudinary, configureCloudinary, generateSignedUrl } from '../../config/cloudinary.js';
import { logAudit, logError, getClientIp, normalizeRole, getUserAgent } from '../../logger/auditLogger.js';
import { createNotification } from "../NotificationController/notificationController.js";
import mongoose from "mongoose";

const roundToTwoDecimals = (value) => {
  return Math.round((value || 0) * 100) / 100;
};

// Helper: Handle Stock Deduction
const handleStockDeduction = async (orderItems) => {
  if (!orderItems || orderItems.length === 0) return;

  for (const item of orderItems) {
    const stone = await stonesModel.findById(item.stone?._id || item.stoneId);
    if (stone) {
      const quantityToDeduct = item.quantity || 1;
      // Check stock
      const remainingBeforeDeduct = stone.stockQuantity - (stone.quantityDelivered || 0);
      if (remainingBeforeDeduct < quantityToDeduct) {
        throw new Error(`Not enough stock available for ${stone.stoneName}. Need ${quantityToDeduct}, but only ${remainingBeforeDeduct} available.`);
      }
      
      stone.quantityDelivered = (stone.quantityDelivered || 0) + quantityToDeduct;
      const remainingQuantity = stone.stockQuantity - stone.quantityDelivered;
      if (remainingQuantity <= 0) stone.stockAvailability = "Out of Stock";
      
      await stone.save();
    }
  }
};

const handleStockRestoration = async (orderItems) => {
  if (!orderItems) return;
  for (const item of orderItems) {
    const stone = await stonesModel.findById(item.stone?._id || item.stoneId);
    if (stone) {
      const quantityToRestore = item.quantity || 1;
      stone.quantityDelivered = Math.max(0, (stone.quantityDelivered || 0) - quantityToRestore);
      
      const remainingQuantity = stone.stockQuantity - stone.quantityDelivered;
      if (remainingQuantity > 0) stone.stockAvailability = "In Stock";
      
      await stone.save();
    }
  }
};

// Helper: Generate Signed URLs
const generateSignedUrlsForPaymentProofs = (order) => {
  if (!order) return order;
  const orderObj = order.toObject ? order.toObject() : order;
  
  if (orderObj.paymentProofs && Array.isArray(orderObj.paymentProofs)) {
    orderObj.paymentProofs = orderObj.paymentProofs.map(proof => {
      if (proof.proofFile) proof.proofFile = generateSignedUrl(proof.proofFile, 3600);
      return proof;
    });
  }
  
  if (orderObj.paymentTimeline && Array.isArray(orderObj.paymentTimeline)) {
    orderObj.paymentTimeline = orderObj.paymentTimeline.map(timeline => {
      if (timeline.proofFile) timeline.proofFile = generateSignedUrl(timeline.proofFile, 3600);
      return timeline;
    });
  }
  return orderObj;
};

// Helper: Upload to Cloudinary (Extracts logic from submitPaymentProof)
const uploadPaymentProofToCloudinary = async (base64, orderId, userId) => {
  if (!base64) return null;
  
  configureCloudinary();
  const timestamp = new Date().toISOString();
  
  return await cloudinary.uploader.upload(base64, {
    folder: 'arkad_mines/payment_proofs',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ quality: 'auto:good' }, { fetch_format: 'auto' }],
    context: {
      orderId: orderId || 'unknown',
      uploadedAt: timestamp,
      uploadedBy: userId?.toString() || 'unknown'
    },
    tags: ['payment_proof', 'secure', orderId || 'unknown']
  });
};

// --- CONTROLLERS ---

const getOrderDetails = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const safeOrderNumber = String(orderNumber);

    const order = await orderModel.findOne({ 
      orderNumber: safeOrderNumber,
      buyer: req.user.id 
    }).populate("buyer", "companyName email");

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ success: false, message: "Server error while retrieving order" });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { status } = req.query; 

    const query = { buyer: userId };
    const validStatuses = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];
    

    if (status && typeof status === 'string' && validStatuses.includes(status)) {
       query.status = status;
    }
    
    const orders = await orderModel.find(query)
      .populate("buyer", "companyName email phone") 
      .sort({ createdAt: -1 });

    res.json({ success: true, orders, count: orders.length });

  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ success: false, message: "Server error while retrieving your orders" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    const validStatuses = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];
    
    if (status && typeof status === 'string') {
      const safeStatus = String(status).trim();
      if (validStatuses.includes(safeStatus)) query.status = safeStatus;
    }

    const orders = await orderModel
      .find(query)
      .populate("buyer", "companyName email phone")
      .populate("quotation", "referenceNumber")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders, count: orders.length });

  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ success: false, message: "Server error while retrieving orders" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, courierService, trackingNumber, courierLink, notes } = req.body;
    
    if (!orderId || !mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).json({ success: false, message: "Invalid Order ID" });
    }

    const validStatuses = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status.` });
    }

    const order = await orderModel.findById(orderId).populate("items.stone");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });


    if (status === "confirmed") {
        if (order.paymentStatus !== "fully_paid") {
            return res.status(400).json({ success: false, message: "Cannot confirm order. Full payment required." });
        }
        try {
            await handleStockDeduction(order.items);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }

    if (status === "dispatched") {
        if (order.paymentStatus !== "fully_paid") {
            return res.status(400).json({ success: false, message: "Cannot dispatch order. Full payment required." });
        }
        if (!courierService || !trackingNumber) {
            return res.status(400).json({ success: false, message: "Courier service and tracking number required." });
        }
        order.courierTracking = { isDispatched: true, courierService, trackingNumber, courierLink: courierLink || "", dispatchedAt: new Date() };
    }

    if (status === "delivered" && order.paymentStatus !== "fully_paid") {
        return res.status(400).json({ success: false, message: "Cannot mark delivered. Full payment required." });
    }

    if (status === "cancelled") {
        if ((order.status === "confirmed" || order.status === "dispatched")) {
            await handleStockRestoration(order.items);
        }
    }

    order.status = status;
    order.timeline.push({ status, timestamp: new Date(), notes: notes || `Order status updated to ${status}` });

    await order.save();
    res.json({ success: true, message: `Order status updated to ${status}`, order });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Server error while updating order status" });
  }
};


const submitPaymentProof = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const { orderId } = req.params;
  const { amountPaid } = req.body;

  try {
    let proofFileUrl = null;
    

    if (req.body.proofBase64) {
        try {
            const uploadRes = await uploadPaymentProofToCloudinary(req.body.proofBase64, orderId, req.user?.id);
            proofFileUrl = uploadRes.secure_url;
        } catch (uploadErr) {
            logError(uploadErr, { action: 'CLOUDINARY_UPLOAD_ERROR', userId: req.user?.id, orderId });
            return res.status(500).json({ success: false, message: 'Error uploading payment proof.' });
        }
    }

    let address = null;
    if (req.body.address) {
      try {
        address = typeof req.body.address === 'string' ? JSON.parse(req.body.address) : req.body.address;
      } catch (e) { address = null; }
    }

    if (!orderId || amountPaid === undefined || amountPaid === null) {
      return res.status(400).json({ success: false, message: "Order ID and amount paid are required" });
    }
    if (!proofFileUrl) {
      return res.status(400).json({ success: false, message: "Payment proof file is required" });
    }

    const order = await orderModel.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    let buyerIdString = null;
    if (order.buyer) {
        buyerIdString = typeof order.buyer === 'object' ? order.buyer.toString() : String(order.buyer);
    }
    
    const userIdString = req.user?.id?.toString();

    if (!userIdString || !buyerIdString || buyerIdString !== userIdString) {
      await logAudit({
          userId: req.user?.id,
          role: normalizeRole(req.user?.role),
          action: 'PAYMENT_OWNERSHIP_VALIDATION_FAILED',
          status: 'FAILED_AUTH',
          resourceId: orderId,
          clientIp,
          userAgent
      });
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }


    if (address || req.body.street) {
        const newAddr = address || req.body;
        order.deliveryAddress = {
            street: newAddr.street || order.deliveryAddress?.street || "",
            city: newAddr.city || order.deliveryAddress?.city || "",
            state: newAddr.state || order.deliveryAddress?.state || "",
            zipCode: newAddr.zipCode || order.deliveryAddress?.zipCode || "",
            country: newAddr.country || order.deliveryAddress?.country || "",
            phone: newAddr.phone || order.deliveryAddress?.phone || ""
        };
    }


    const numericAmount = roundToTwoDecimals(Number.parseFloat(amountPaid));
    if (!Number.isFinite(numericAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid amountPaid value' });
    }

    const roundedOutstandingBalance = roundToTwoDecimals(order.outstandingBalance);
    const FLOATING_POINT_TOLERANCE = 0.01;
    
    if (numericAmount > roundedOutstandingBalance + FLOATING_POINT_TOLERANCE) {
      return res.status(400).json({ success: false, message: `Amount exceeds outstanding balance.` });
    }

    order.paymentProofs.push({ proofFile: proofFileUrl, amountPaid: roundToTwoDecimals(numericAmount), status: "pending" });
    order.paymentTimeline.push({ action: "payment_submitted", amountPaid: numericAmount, proofFile: proofFileUrl, notes: `Payment submitted` });

    if (order.paymentStatus === "pending") order.paymentStatus = "payment_in_progress";
    
    await order.save();
    
    await createNotification({
      recipientType: "admin",
      title: "Payment proof submitted",
      message: `${order.orderNumber} - ${numericAmount.toFixed(2)} submitted`,
      type: "payment_submitted",
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      amount: numericAmount,
    });

    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'PAYMENT_SUBMITTED',
      status: 'SUCCESS',
      resourceId: orderId,
      clientIp,
      userAgent,
      requestPayload: { orderId, amountPaid: numericAmount },
      details: `Payment proof submitted: Rs ${numericAmount.toFixed(2)}`
    });

    res.json({ success: true, message: "Payment proof submitted successfully.", order: generateSignedUrlsForPaymentProofs(order) });

  } catch (error) {
    logError(error, { action: 'PAYMENT_SUBMISSION_ERROR', userId: req.user?.id, orderId: req.params.orderId });
    res.status(500).json({ success: false, message: "An error occurred." });
  }
};

const approvePayment = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const adminId = req.user.id;
  
  try {
    const { orderId, proofIndex } = req.params;
    const { notes } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order || !order.paymentProofs[proofIndex]) {
      return res.status(404).json({ success: false, message: "Order or proof not found" });
    }

    const paymentProof = order.paymentProofs[proofIndex];
    paymentProof.status = "approved";
    paymentProof.approvedAt = new Date();
    paymentProof.approvedBy = adminId;
    paymentProof.notes = notes || "";

    const roundedAmountPaid = roundToTwoDecimals(paymentProof.amountPaid);
    order.totalPaid = roundToTwoDecimals(order.totalPaid + roundedAmountPaid);
    order.outstandingBalance = roundToTwoDecimals(order.financials.grandTotal - order.totalPaid);

    if (order.outstandingBalance <= 0) {
      order.paymentStatus = "fully_paid";
      if (order.status === "draft") {
        order.status = "confirmed";

        await order.populate("items.stone");
        try {
            await handleStockDeduction(order.items);
        } catch (e) { console.warn(e.message); } 
        
        order.timeline.push({ status: "confirmed", timestamp: new Date(), notes: "Auto-confirmed via payment" });
      }
    }

    order.paymentTimeline.push({ action: "payment_approved", amountPaid: roundedAmountPaid, notes: notes || "Payment approved" });
    await order.save();

    await createNotification({ recipientType: "admin", title: "Payment approved", message: `${order.orderNumber} approved`, type: "payment_approved", orderId: order._id, orderNumber: order.orderNumber, amount: roundedAmountPaid });
    await createNotification({ recipientType: "user", recipientId: order.buyer, title: "Payment approved", message: `Payment approved for ${order.orderNumber}`, type: "payment_approved", orderId: order._id, orderNumber: order.orderNumber, amount: roundedAmountPaid });

    await logAudit({ userId: adminId, role: normalizeRole(req.user.role), action: 'PAYMENT_APPROVED', status: 'SUCCESS', resourceId: orderId, clientIp, userAgent, details: `Amount Rs ${roundedAmountPaid.toFixed(2)}` });

    res.json({ success: true, message: "Payment approved successfully", order: generateSignedUrlsForPaymentProofs(order) });

  } catch (error) {
    logError(error, { action: 'PAYMENT_APPROVAL_ERROR', userId: adminId, orderId: req.params.orderId });
    res.status(500).json({ success: false, message: "Error processing approval." });
  }
};

const rejectPayment = async (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const adminId = req.user.id;
  
  try {
    const { orderId, proofIndex } = req.params;
    const { notes, rejectionReason } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order || !order.paymentProofs[proofIndex]) return res.status(404).json({ success: false, message: "Not found" });

    const paymentProof = order.paymentProofs[proofIndex];
    paymentProof.status = "rejected";
    paymentProof.notes = rejectionReason || notes || "";

    order.paymentTimeline.push({ action: "payment_rejected", amountPaid: paymentProof.amountPaid, notes: rejectionReason || "Rejected" });
    await order.save();

    await createNotification({ recipientType: "admin", title: "Payment rejected", message: `${order.orderNumber} rejected`, type: "payment_rejected", orderId: order._id, orderNumber: order.orderNumber, amount: paymentProof.amountPaid });
    await createNotification({ recipientType: "user", recipientId: order.buyer, title: "Payment rejected", message: `Payment rejected for ${order.orderNumber}`, type: "payment_rejected", orderId: order._id, orderNumber: order.orderNumber, amount: paymentProof.amountPaid });

    await logAudit({ userId: adminId, role: normalizeRole(req.user.role), action: 'PAYMENT_REJECTED', status: 'SUCCESS', resourceId: orderId, clientIp, userAgent, details: `Amount Rs ${paymentProof.amountPaid.toFixed(2)}` });

    res.json({ success: true, message: "Payment rejected successfully", order: generateSignedUrlsForPaymentProofs(order) });

  } catch (error) {
    logError(error, { action: 'PAYMENT_REJECTION_ERROR', userId: adminId, orderId: req.params.orderId });
    res.status(500).json({ success: false, message: "Error rejecting payment." });
  }
};

const getOrderDetailsWithPayment = async (req, res) => {
  const userId = req.user?.id;
  try {
    const { orderId } = req.params;
    const isAdmin = req.user.role === "admin";

    if (!orderId || !mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    let query = { _id: new mongoose.Types.ObjectId(String(orderId)) };
    if (!isAdmin) {
      if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return res.status(400).json({ success: false, message: "Invalid user ID" });
      query.buyer = new mongoose.Types.ObjectId(String(userId));
    }

    const order = await orderModel.findOne(query).populate("buyer", "companyName email phone");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, order: generateSignedUrlsForPaymentProofs(order) });
  } catch (error) {
    logError(error, { action: 'GET_ORDER_DETAILS_WITH_PAYMENT_ERROR', userId: userId, orderId: req.params.orderId });
    res.status(500).json({ success: false, message: "Error retrieving order." });
  }
};

const updatePaymentStatus = async (req, res) => {
  const adminId = req.user?.id;
  try {
    const { orderId } = req.params;
    const { paymentStatus, notes } = req.body;
    const validPaymentStatuses = ["pending", "payment_in_progress", "fully_paid"];

    if (!validPaymentStatuses.includes(paymentStatus)) return res.status(400).json({ success: false, message: "Invalid status" });

    const order = await orderModel.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.paymentStatus = paymentStatus;
    order.paymentTimeline.push({ action: `payment_${paymentStatus}`, timestamp: new Date(), notes: notes || `Status updated to ${paymentStatus}` });

    await order.save();
    
    // Notifications...
    await createNotification({ recipientType: "admin", title: "Payment status updated", message: `${order.orderNumber} - ${paymentStatus}`, type: "payment_status_updated", orderId: order._id, orderNumber: order.orderNumber, paymentStatus, amount: order.financials?.grandTotal });
    await createNotification({ recipientType: "user", recipientId: order.buyer, title: "Payment status updated", message: `Status is now ${paymentStatus}`, type: "payment_status_updated", orderId: order._id, orderNumber: order.orderNumber, paymentStatus, amount: order.financials?.grandTotal });

    res.json({ success: true, message: `Status updated to ${paymentStatus}`, order });

  } catch (error) {
    logError(error, { action: 'UPDATE_PAYMENT_STATUS_ERROR', userId: adminId, orderId: req.params.orderId });
    res.status(500).json({ success: false, message: "Error updating status." });
  }
};

export { 
  getOrderDetails, 
  getUserOrders, 
  getAllOrders, 
  updateOrderStatus,
  submitPaymentProof,
  approvePayment,
  rejectPayment,
  getOrderDetailsWithPayment,
  updatePaymentStatus
};