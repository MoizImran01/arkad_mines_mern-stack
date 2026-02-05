import notificationModel from "../../Models/notificationModel/notificationModel.js";
import orderModel from "../../Models/orderModel/orderModel.js";
import mongoose from "mongoose";
import { logError } from "../../logger/auditLogger.js";

export const createNotification = async (payload) => {
  try {
    const { 
      recipientType, 
      recipientId, 
      title, 
      message, 
      type, 
      orderId, 
      orderNumber, 
      paymentStatus, 
      amount 
    } = payload;

    await notificationModel.create({
      recipientType,
      recipientId,
      title,
      message,
      type,
      orderId,
      orderNumber,
      paymentStatus,
      amount
    });

  } catch (error) {
    logError(error, { action: 'CREATE_NOTIFICATION', orderId: payload?.orderId });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const { role, id } = req.user;
    
    // Sanitize and validate inputs to prevent NoSQL injection
    const safe_role = String(role || '').trim();
    
    let query = {};
    if (safe_role === "admin") {
      query.recipientType = "admin";
    } else {

      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format"
        });
      }
      query.recipientType = "user";
      query.recipientId = new mongoose.Types.ObjectId(String(id));
    }

    const notifications = await notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    logError(error, { action: 'FETCH_NOTIFICATIONS', userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
    });
  }
};

export const clearNotifications = async (req, res) => {
  try {
    const { role, id } = req.user;
    
    // Sanitize and validate inputs to prevent NoSQL injection
    const safe_role = String(role || '').trim();
    
    // Construct query explicitly to prevent injection
    let query = {};
    if (safe_role === "admin") {
      query.recipientType = "admin";
    } else {
      // Validate ObjectId format before using in query
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format"
        });
      }
      query.recipientType = "user";
      query.recipientId = new mongoose.Types.ObjectId(String(id));
    }

    const clearedAt = new Date();

    const result = await notificationModel.updateMany(query, {
      $set: { clearedAt, readAt: clearedAt },
    });

    res.status(200).json({
      success: true,
      message: "Notifications cleared",
      modifiedCount: result.modifiedCount || result.nModified || 0,
      clearedAt,
    });
  } catch (error) {
    logError(error, { action: 'CLEAR_NOTIFICATIONS', userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: "Error clearing notifications",
    });
  }
};

export const getAdminPaymentSummary = async (req, res) => {
  try {
    const summary = await orderModel.aggregate([
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: "$buyer",
          latestOrderNumber: { $first: "$orderNumber" },
          latestPaymentStatus: { $first: "$paymentStatus" },
          latestUpdatedAt: { $first: "$updatedAt" },
          outstandingBalance: { $first: "$outstandingBalance" },
          totalPaid: { $first: "$totalPaid" },
          grandTotal: { $first: "$financials.grandTotal" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "buyerInfo",
        },
      },
      { $unwind: "$buyerInfo" },
      {
        $project: {
          _id: 0,
          buyerId: "$_id",
          companyName: "$buyerInfo.companyName",
          email: "$buyerInfo.email",
          latestOrderNumber: 1,
          latestPaymentStatus: 1,
          latestUpdatedAt: 1,
          outstandingBalance: 1,
          totalPaid: 1,
          grandTotal: 1,
        },
      },
      { $sort: { latestUpdatedAt: -1 } },
    ]);

    res.status(200).json({ success: true, summary });
  } catch (error) {
    logError(error, { action: 'GET_ADMIN_PAYMENT_SUMMARY', userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: "Error fetching payment summary",
    });
  }
};

