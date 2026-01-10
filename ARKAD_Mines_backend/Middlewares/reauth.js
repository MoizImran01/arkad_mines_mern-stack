import bcrypt from "bcrypt";
import userModel from "../Models/Users/userModel.js";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";

/**
 * Re-authentication middleware for high-impact actions
 * Requires user to provide their password again for sensitive operations
 * like approving quotations that create financial obligations
 */
export const requireReauth = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const quoteId = req.params.quoteId;
  
  try {
    // Check if password confirmation is provided in request body
    const { passwordConfirmation, comment } = req.body;

    if (!passwordConfirmation || passwordConfirmation.trim() === "") {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'REAUTH_REQUIRED',
        status: 'FAILED_AUTH',
        resourceId: quoteId,
        quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
        quotationId: req.validatedQuotation?.referenceNumber || null,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: comment || null, hasPasswordConfirmation: false },
        details: `Re-authentication required but password not provided`
      });
      
      return res.status(401).json({
        success: false,
        message: "Re-authentication required. Please provide your password to confirm this action.",
        requiresReauth: true
      });
    }

    // Fetch user from database to get password hash
    const user = await userModel.findById(req.user.id).select('password email');
    
    if (!user) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'REAUTH_FAILED',
        status: 'FAILED_AUTH',
        resourceId: quoteId,
        quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
        quotationId: req.validatedQuotation?.referenceNumber || null,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: comment || null, hasPasswordConfirmation: true },
        details: `User not found during re-authentication`
      });
      
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(passwordConfirmation, user.password);

    if (!isPasswordValid) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'REAUTH_FAILED',
        status: 'FAILED_AUTH',
        resourceId: quoteId,
        quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
        quotationId: req.validatedQuotation?.referenceNumber || null,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: comment || null, hasPasswordConfirmation: true },
        details: `Invalid password provided for re-authentication`
      });
      
      return res.status(401).json({
        success: false,
        message: "Invalid password. Re-authentication failed."
      });
    }

    // Successful re-authentication
    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'REAUTH_SUCCESS',
      status: 'SUCCESS',
      resourceId: quoteId,
      quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
      quotationId: req.validatedQuotation?.referenceNumber || null,
      clientIp,
      userAgent,
      requestPayload: { quoteId, comment: comment || null, hasPasswordConfirmation: true },
      details: `Re-authentication successful`
    });

    // Password verified, proceed with the request
    next();
  } catch (error) {
    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'REAUTH_ERROR',
      status: 'ERROR',
      resourceId: req.params.quoteId,
      quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
      quotationId: req.validatedQuotation?.referenceNumber || null,
      clientIp,
      userAgent: getUserAgent(req),
      requestPayload: { quoteId: req.params.quoteId, comment: req.body?.comment || null },
      details: `Error during re-authentication: ${error.message}`
    });
    
    return res.status(500).json({
      success: false,
      message: "Error during re-authentication. Please try again."
    });
  }
};

