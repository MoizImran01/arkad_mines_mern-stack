import bcrypt from "bcrypt";
import userModel from "../Models/Users/userModel.js";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";

export const requireMFAForPayment = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const orderId = req.params.orderId;
  const userId = req.user?.id;

  try {
    const { passwordConfirmation } = req.body;

    if (!passwordConfirmation || passwordConfirmation.trim() === "") {
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_MFA_REQUIRED',
        status: 'FAILED_AUTH',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, hasPasswordConfirmation: false },
        details: `MFA required for payment submission but password not provided`
      });

      return res.status(401).json({
        success: false,
        message: "Multi-factor authentication required. Please provide your password to confirm this payment submission.",
        requiresMFA: true
      });
    }

    if (!userId) {
      await logAudit({
        userId: null,
        role: 'GUEST',
        action: 'PAYMENT_MFA_FAILED',
        status: 'FAILED_AUTH',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, hasPasswordConfirmation: true },
        details: `User not authenticated for payment MFA`
      });

      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const user = await userModel.findById(userId).select('password email');

    if (!user) {
      await logAudit({
        userId: userId,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_MFA_FAILED',
        status: 'FAILED_AUTH',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, hasPasswordConfirmation: true },
        details: `User not found during payment MFA`
      });

      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const isPasswordValid = await bcrypt.compare(passwordConfirmation, user.password);

    if (!isPasswordValid) {
      await logAudit({
        userId: userId,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_MFA_FAILED',
        status: 'FAILED_AUTH',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { orderId, hasPasswordConfirmation: true },
        details: `Invalid password provided for payment MFA`
      });

      return res.status(401).json({
        success: false,
        message: "Invalid password. Multi-factor authentication failed."
      });
    }

    await logAudit({
      userId: userId,
      role: normalizeRole(req.user?.role),
      action: 'PAYMENT_MFA_SUCCESS',
      status: 'SUCCESS',
      resourceId: orderId,
      clientIp,
      userAgent,
      requestPayload: { orderId, hasPasswordConfirmation: true },
      details: `MFA successful for payment submission`
    });

    next();
  } catch (error) {
    await logAudit({
      userId: userId || null,
      role: normalizeRole(req.user?.role),
      action: 'PAYMENT_MFA_ERROR',
      status: 'ERROR',
      resourceId: orderId,
      clientIp,
      userAgent: getUserAgent(req),
      requestPayload: { orderId, hasPasswordConfirmation: !!req.body?.passwordConfirmation },
      details: `Error during payment MFA: ${error.message}`
    });

    return res.status(500).json({
      success: false,
      message: "Error during multi-factor authentication. Please try again."
    });
  }
};

