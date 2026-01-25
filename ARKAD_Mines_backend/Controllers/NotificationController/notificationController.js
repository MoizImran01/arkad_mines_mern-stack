import notificationModel from "../../Models/notificationModel/notificationModel.js";
import orderModel from "../../Models/orderModel/orderModel.js";

export const createNotification = async (payload) => {
  try {
    await notificationModel.create(payload);
  } catch (error) {
    console.error("Notification create error:", error);
  }
};

export const getNotifications = async (req, res) => {
  try {
    const { role, id } = req.user;
    const query =
      role === "admin"
        ? { recipientType: "admin" }
        : { recipientType: "user", recipientId: id };

    const notifications = await notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error("Notification fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
    });
  }
};

export const clearNotifications = async (req, res) => {
  try {
    const { role, id } = req.user;
    const query =
      role === "admin"
        ? { recipientType: "admin" }
        : { recipientType: "user", recipientId: id };

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
    console.error("Notification clear error:", error);
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
    console.error("Payment summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment summary",
    });
  }
};

