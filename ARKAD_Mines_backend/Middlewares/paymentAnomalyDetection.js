import orderModel from "../Models/orderModel/orderModel.js";
import AuditLog from "../Models/AuditLog/auditLogModel.js";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import mongoose from "mongoose";

const RAPID_SUBMISSION_WINDOW_MS = 5 * 60 * 1000;
const MAX_SUBMISSIONS_IN_WINDOW = 3;
const AMOUNT_VARIANCE_THRESHOLD = 0.5;

export const detectPaymentAnomalies = async (req, res, next) => {
  const userId = req.user?.id;
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const orderId = req.params.orderId;
  const { amountPaid } = req.body;

  if (!userId) {
    return next();
  }

  try {
    const numericAmount = Number.parseFloat(amountPaid);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return next();
    }

    let anomalyDetails = [];
    const order = await orderModel.findById(orderId).select('buyer orderNumber').lean();

    if (!order || order.buyer.toString() !== userId.toString()) {
      return next();
    }

    const recentPayments = await orderModel.find({
      buyer: userId,
      'paymentProofs.status': { $in: ['pending', 'approved'] },
      'paymentProofs.uploadedAt': {
        $gte: new Date(Date.now() - RAPID_SUBMISSION_WINDOW_MS)
      }
    }).select('paymentProofs.amountPaid paymentProofs.uploadedAt').lean();

    const recentSubmissionCount = recentPayments.reduce((count, order) => {
      return count + order.paymentProofs.filter(proof => {
        const uploadTime = new Date(proof.uploadedAt);
        return uploadTime >= new Date(Date.now() - RAPID_SUBMISSION_WINDOW_MS);
      }).length;
    }, 0);

    if (recentSubmissionCount >= MAX_SUBMISSIONS_IN_WINDOW) {
      anomalyDetails.push(`Rapid payment submissions detected: ${recentSubmissionCount + 1} submissions in ${RAPID_SUBMISSION_WINDOW_MS / 1000 / 60} minutes`);
    }

    const allUserOrders = await orderModel.find({
      buyer: userId,
      'paymentProofs.status': 'approved'
    }).select('paymentProofs.amountPaid').lean();

    const historicalAmounts = allUserOrders.flatMap(order =>
      order.paymentProofs
        .filter(proof => proof.status === 'approved')
        .map(proof => proof.amountPaid)
    ).filter(amount => amount > 0);

    if (historicalAmounts.length > 0) {
      const avgAmount = historicalAmounts.reduce((sum, amt) => sum + amt, 0) / historicalAmounts.length;
      const maxAmount = Math.max(...historicalAmounts);
      const variance = Math.abs(numericAmount - avgAmount) / avgAmount;

      if (variance > AMOUNT_VARIANCE_THRESHOLD && numericAmount > avgAmount) {
        anomalyDetails.push(`Unusual payment amount: Rs ${numericAmount.toFixed(2)} (average: Rs ${avgAmount.toFixed(2)}, max: Rs ${maxAmount.toFixed(2)})`);
      }
    }

    const recentPaymentLogs = await AuditLog.find({
      userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
      action: { $in: ['PAYMENT_SUBMITTED', 'PAYMENT_MFA_SUCCESS'] },
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).select('clientIp').lean();

    const uniqueIPs = [...new Set(recentPaymentLogs.map(log => log.clientIp).filter(Boolean))];
    if (uniqueIPs.length > 0 && !uniqueIPs.includes(clientIp)) {
      anomalyDetails.push(`New IP address for payment: ${clientIp} (previous IPs: ${uniqueIPs.join(', ')})`);
    }

    if (anomalyDetails.length > 0) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_ANOMALY_DETECTED',
        status: 'WARNING',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, amountPaid: numericAmount },
        details: `Payment anomaly detected: ${anomalyDetails.join('; ')}`
      });

      req.paymentAnomaly = {
        detected: true,
        details: anomalyDetails
      };
    }

    next();
  } catch (error) {
    await logAudit({
      userId: userId || null,
      role: normalizeRole(req.user?.role),
      action: 'PAYMENT_ANOMALY_DETECTION_ERROR',
      status: 'ERROR',
      resourceId: orderId,
      clientIp,
      userAgent,
      requestPayload: { orderId, amountPaid },
      details: `Error in payment anomaly detection: ${error.message}`
    });
    next();
  }
};

