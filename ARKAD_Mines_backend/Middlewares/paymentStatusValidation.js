import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";



export const rejectClientPaymentStatus = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const orderId = req.params.orderId;
  
  try {
    if (req.body && req.body.paymentStatus !== undefined) {
      await logAudit({
        userId: userId || null,
        role: normalizeRole(userRole),
        action: 'PAYMENT_STATUS_MANIPULATION_ATTEMPT',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: {
          orderId,
          attemptedPaymentStatus: req.body.paymentStatus,
          requestBody: { ...req.body, proofBase64: req.body.proofBase64 ? '[REDACTED]' : undefined }
        },
        details: `Client attempt to set paymentStatus directly: ${req.body.paymentStatus}. Payment status can only be changed by admin via approval/rejection endpoints.`
      });
      
      return res.status(400).json({
        success: false,
        message: "Payment status cannot be set directly. Payment status is managed automatically by the system after admin approval."
      });
    }
    
    next();
  } catch (error) {
    await logAudit({
      userId: userId || null,
      role: normalizeRole(userRole),
      action: 'PAYMENT_STATUS_VALIDATION_ERROR',
      status: 'ERROR',
      resourceId: orderId,
      clientIp,
      userAgent,
      details: `Error in payment status validation: ${error.message}`
    });
    
    next(); 
  }
};

