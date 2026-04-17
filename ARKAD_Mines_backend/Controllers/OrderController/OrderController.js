import orderModel from "../../Models/orderModel/orderModel.js";
import stonesModel from "../../Models/stonesModel/stonesModel.js";
import { cloudinary, configureCloudinary, generateSignedUrl } from '../../config/cloudinary.js';
import { logAudit, logError, getClientIp, normalizeRole, getUserAgent } from '../../logger/auditLogger.js';
import { createNotification } from "../NotificationController/notificationController.js";
import mongoose from "mongoose";
import {
  emitOrdersChangedForBuyer,
  emitOrdersChangedStaff,
  emitStonesChanged,
} from "../../socket/socketEmitter.js";

const roundToTwoDecimals = (value) => {
  return Math.round((value || 0) * 100) / 100;
};


const checkStockAvailability = async (orderItems) => {
  if (!orderItems || orderItems.length === 0) return;
  for (const item of orderItems) {
    const stone = await stonesModel.findById(item.stone?._id || item.stoneId);
    if (!stone) continue;
    const quantityNeeded = item.quantity || 1;
    const available = (stone.stockQuantity || 0) - (stone.quantityDelivered || 0);
    if (available < quantityNeeded) {
      throw new Error(`Not enough stock for ${stone.stoneName}. Need ${quantityNeeded}, only ${available} available.`);
    }
  }
};

const handleStockRestoration = async (orderItems) => {
  if (!orderItems) return;
  for (const item of orderItems) {
    const dispatched = Number(item.quantityDispatched || 0);
    if (dispatched <= 0) continue; 
    const stone = await stonesModel.findById(item.stone?._id || item.stoneId);
    if (!stone) continue;
    stone.quantityDelivered = Math.max(0, (stone.quantityDelivered || 0) - dispatched);
    const remaining = (stone.stockQuantity || 0) - stone.quantityDelivered;
    if (remaining > 0) stone.stockAvailability = "In Stock";
    await stone.save();
  }
};

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
    const { 
      status,
      page = 1,
      limit = 20
    } = req.query; 

    const query = { buyer: userId };
    const validStatuses = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];
    
    if (status && typeof status === 'string' && validStatuses.includes(status)) {
       query.status = String(status);
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20)); 
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await orderModel.countDocuments(query);
    
    const orders = await orderModel.find(query)
      .populate("buyer", "companyName email phone") 
      .select('-paymentProofs -paymentTimeline -timeline') 
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(); 

    res.json({ 
      success: true, 
      orders, 
      count: orders.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });

  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ success: false, message: "Server error while retrieving your orders" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    const validStatuses = ["draft", "confirmed", "dispatched", "delivered", "cancelled"];
    
    
    if (status && typeof status === 'string') {
      const safeStatus = String(status).trim();
      if (validStatuses.includes(safeStatus)) query.status = String(safeStatus);
    }

    
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { orderNumber: searchRegex },
        { 'buyer.companyName': searchRegex },
        { 'buyer.email': searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20)); 
    const skip = (pageNum - 1) * limitNum;

    
    const sortOptions = {};
    const validSortFields = ['createdAt', 'orderNumber', 'financials.grandTotal', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sortOptions[sortField] = sortOrder === 'asc' ? 1 : -1;

    
    const totalCount = await orderModel.countDocuments(query);

    
    const orders = await orderModel
      .find(query)
      .populate("buyer", "companyName email phone")
      .populate("quotation", "referenceNumber")
      .select('-paymentProofs -paymentTimeline -timeline') 
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(); 

    res.json({ 
      success: true, 
      orders, 
      count: orders.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });

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
            await checkStockAvailability(order.items);
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
        await handleStockRestoration(order.items);
        emitStonesChanged({ reason: "order_cancelled" });
    }

    order.status = status;
    order.timeline.push({ status, timestamp: new Date(), notes: notes || `Order status updated to ${status}` });

    await order.save();

    const statusBuyerId = order.buyer?.toString?.() || String(order.buyer);
    emitOrdersChangedForBuyer(statusBuyerId, { orderNumber: order.orderNumber });
    emitOrdersChangedStaff({ orderNumber: order.orderNumber });

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

    emitOrdersChangedForBuyer(buyerIdString, { orderId: String(order._id), orderNumber: order.orderNumber });
    emitOrdersChangedStaff({ orderId: String(order._id), orderNumber: order.orderNumber });
    
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
            await checkStockAvailability(order.items);
        } catch (e) { console.warn(e.message); }

        order.timeline.push({ status: "confirmed", timestamp: new Date(), notes: "Auto-confirmed via payment" });
      }
    }

    order.paymentTimeline.push({ action: "payment_approved", amountPaid: roundedAmountPaid, notes: notes || "Payment approved" });
    await order.save();

    const payBuyer = order.buyer?.toString?.() || String(order.buyer);
    emitOrdersChangedForBuyer(payBuyer, { orderId: String(order._id), orderNumber: order.orderNumber });
    emitOrdersChangedStaff({ orderId: String(order._id), orderNumber: order.orderNumber });

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

    const rejBuyer = order.buyer?.toString?.() || String(order.buyer);
    emitOrdersChangedForBuyer(rejBuyer, { orderId: String(order._id), orderNumber: order.orderNumber });
    emitOrdersChangedStaff({ orderId: String(order._id), orderNumber: order.orderNumber });

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

    const psBuyer = order.buyer?.toString?.() || String(order.buyer);
    emitOrdersChangedForBuyer(psBuyer, { orderId: String(order._id), orderNumber: order.orderNumber });
    emitOrdersChangedStaff({ orderId: String(order._id), orderNumber: order.orderNumber });
    
    await createNotification({ recipientType: "admin", title: "Payment status updated", message: `${order.orderNumber} - ${paymentStatus}`, type: "payment_status_updated", orderId: order._id, orderNumber: order.orderNumber, paymentStatus, amount: order.financials?.grandTotal });
    await createNotification({ recipientType: "user", recipientId: order.buyer, title: "Payment status updated", message: `Status is now ${paymentStatus}`, type: "payment_status_updated", orderId: order._id, orderNumber: order.orderNumber, paymentStatus, amount: order.financials?.grandTotal });

    res.json({ success: true, message: `Status updated to ${paymentStatus}`, order });

  } catch (error) {
    logError(error, { action: 'UPDATE_PAYMENT_STATUS_ERROR', userId: adminId, orderId: req.params.orderId });
    res.status(500).json({ success: false, message: "Error updating status." });
  }
};

const extractQrCodeId = (qrInput) => {
  const raw = String(qrInput || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('{')) return raw;

  try {
    const parsed = JSON.parse(raw);
    return String(parsed.blockId || parsed.qrCode || '').trim();
  } catch (_err) {
    return raw;
  }
};

const dispatchOrderItemByQr = async (req, res) => {
  try {
    const { orderNumber, qrCode, quantity } = req.body || {};
    const safeOrderNumber = String(orderNumber || '').trim();
    const safeQrCode = extractQrCodeId(qrCode);
    const hasQuantityInput = !(quantity === undefined || quantity === null || String(quantity).trim() === '');

    if (!safeOrderNumber || !safeQrCode) {
      return res.status(400).json({
        success: false,
        message: 'orderNumber and qrCode are required.'
      });
    }

    const order = await orderModel.findOne({ orderNumber: safeOrderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const stone = await stonesModel.findOne({ qrCode: safeQrCode });
    if (!stone) {
      return res.status(404).json({ success: false, message: 'Stone block not found for provided QR code.' });
    }

    const itemIndex = order.items.findIndex((item) => String(item.stone) === String(stone._id));
    if (itemIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'This QR block does not belong to the selected order.'
      });
    }

    const orderItem = order.items[itemIndex];
    const alreadyDispatched = Number(orderItem.quantityDispatched || 0);
    const orderedQty = Number(orderItem.quantity || 0);
    const remainingForOrder = orderedQty - alreadyDispatched;
    const qty = hasQuantityInput ? Number.parseInt(quantity, 10) : remainingForOrder;

    if (remainingForOrder <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This order item is already fully dispatched.'
      });
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch quantity must be a positive number.'
      });
    }

    if (qty > remainingForOrder) {
      return res.status(400).json({
        success: false,
        message: `Dispatch quantity exceeds remaining order quantity (${remainingForOrder}).`
      });
    }

    orderItem.quantityDispatched = alreadyDispatched + qty;
    orderItem.dispatchedBlocks.push({
      blockId: stone._id,
      quantityFromBlock: qty,
      qrCode: stone.qrCode
    });

    stone.quantityDelivered = Number(stone.quantityDelivered || 0) + qty;
    const remainingInventory = Number(stone.stockQuantity || 0) - Number(stone.quantityDelivered || 0);
    stone.stockAvailability = remainingInventory <= 0 ? 'Out of Stock' : 'In Stock';
    stone.status = remainingInventory <= 0 ? 'Dispatched' : 'In Warehouse';
    stone.dispatchHistory.push({
      orderId: order._id,
      quantityDispatched: qty,
      dispatchedAt: new Date(),
      orderNumber: order.orderNumber
    });

    const allItemsDispatched = order.items.every(
      (item) => Number(item.quantityDispatched || 0) >= Number(item.quantity || 0)
    );
    if (allItemsDispatched && order.status !== 'dispatched') {
      order.status = 'dispatched';
      order.timeline.push({
        status: 'dispatched',
        timestamp: new Date(),
        notes: 'Order auto-marked dispatched from QR dispatch flow'
      });
    }

    await stone.save();
    await order.save();

    emitStonesChanged({ stoneId: String(stone._id) });
    const dispatchBuyerId = order.buyer?.toString?.() || String(order.buyer);
    emitOrdersChangedForBuyer(dispatchBuyerId, { orderNumber: order.orderNumber });
    emitOrdersChangedStaff({ orderNumber: order.orderNumber });

    return res.json({
      success: true,
      message: 'Dispatch recorded successfully.',
      dispatch: {
        orderNumber: order.orderNumber,
        stoneId: stone._id,
        qrCode: stone.qrCode,
        quantityDispatched: qty,
        remainingForOrder: remainingForOrder - qty
      }
    });
  } catch (error) {
    logError(error, { action: 'DISPATCH_ORDER_ITEM_BY_QR', userId: req.user?.id });
    return res.status(500).json({
      success: false,
      message: 'Server error while dispatching order item by QR.'
    });
  }
};


const getOrdersByBlockQr = async (req, res) => {
  try {
    const { qrCode } = req.params;
    const safeQrCode = extractQrCodeId(qrCode);

    if (!safeQrCode) {
      return res.status(400).json({ success: false, message: 'QR code is required.' });
    }

    const stone = await stonesModel.findOne({ qrCode: safeQrCode });
    if (!stone) {
      return res.status(404).json({ success: false, message: 'Stone block not found for this QR code.' });
    }

    const orders = await orderModel
      .find({ 'items.stone': stone._id, status: { $nin: ['cancelled'] } })
      .select('orderNumber status paymentStatus buyer items financials createdAt')
      .populate('buyer', 'companyName email')
      .sort({ createdAt: -1 })
      .lean();

    const ordersWithDispatchStatus = orders.map((order) => {
      const item = order.items.find((i) => String(i.stone) === String(stone._id));
      const alreadyDispatched = Number(item?.quantityDispatched || 0);
      const ordered = Number(item?.quantity || 0);
      const remaining = ordered - alreadyDispatched;
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus || 'pending',
        buyerName: order.buyer?.companyName || order.buyer?.email || 'Unknown',
        orderedQuantity: ordered,
        quantityDispatched: alreadyDispatched,
        remainingQuantity: remaining,
        fullyDispatched: remaining <= 0,
        grandTotal: order.financials?.grandTotal,
        createdAt: order.createdAt,
      };
    });

    return res.json({
      success: true,
      orders: ordersWithDispatchStatus,
      stoneId: stone._id,
      stoneName: stone.stoneName,
    });
  } catch (error) {
    logError(error, { action: 'GET_ORDERS_BY_BLOCK_QR', userId: req.user?.id });
    return res.status(500).json({ success: false, message: 'Server error while fetching orders for block.' });
  }
};


const searchOrderNumbers = async (req, res) => {
  try {
    const { search = '', limit = 30 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 30));

    const query = { status: { $nin: ['cancelled'] } };

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { orderNumber: searchRegex },
        { 'buyer.companyName': searchRegex },
        { 'buyer.email': searchRegex },
      ];
    }

    const orders = await orderModel
      .find(query)
      .select('orderNumber status buyer financials.grandTotal createdAt')
      .populate('buyer', 'companyName email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    const orderList = orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      buyerName: o.buyer?.companyName || o.buyer?.email || 'Unknown',
      grandTotal: o.financials?.grandTotal,
    }));

    return res.json({ success: true, orders: orderList });
  } catch (error) {
    logError(error, { action: 'SEARCH_ORDER_NUMBERS', userId: req.user?.id });
    return res.status(500).json({ success: false, message: 'Server error while searching order numbers.' });
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
  updatePaymentStatus,
  dispatchOrderItemByQr,
  getOrdersByBlockQr,
  searchOrderNumbers
};