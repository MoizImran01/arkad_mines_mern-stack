import quotationModel from "../Models/quotationModel/quotationModel.js";
import mongoose from "mongoose";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";

/**
 * Ownership Validation Middleware
 * Ensures the authenticated user is the legitimate owner of the quotation
 * Prevents tampering by validating ownership server-side
 */
export const validateQuotationOwnership = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const { quoteId } = req.params;
  const userId = req.user?.id;

  try {
    // Validate quoteId format (MongoDB ObjectId)
    if (!quoteId || !mongoose.Types.ObjectId.isValid(quoteId)) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_OWNERSHIP',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        quotationRequestId: null,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: `Invalid quotation ID format: ${quoteId}`
      });

      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID format"
      });
    }

    // Fetch quotation with ownership validation
    // Use findOne with explicit buyer check to prevent tampering
    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(quoteId),
      buyer: new mongoose.Types.ObjectId(userId)
    }).select('_id buyer status referenceNumber validity orderNumber buyerDecision quotationRequestId').lean(); // Use lean() for performance, only select needed fields

    if (!quotation) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_OWNERSHIP',
        status: 'FAILED_AUTH',
        resourceId: quoteId,
        quotationRequestId: null,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: `Quotation not found or user does not own this quotation. UserId: ${userId}, QuoteId: ${quoteId}`
      });

      return res.status(403).json({
        success: false,
        message: "Unauthorized: You do not have permission to access this quotation"
      });
    }

    // Additional validation: Ensure quotation exists and is not deleted
    if (!quotation._id) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_OWNERSHIP',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        quotationRequestId: quotation.quotationRequestId || null,
        quotationId: quotation.referenceNumber,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: 'Quotation ID mismatch after ownership validation'
      });

      return res.status(404).json({
        success: false,
        message: "Quotation not found"
      });
    }

    // Store validated quotation info in request for downstream use
    req.validatedQuotation = {
      id: quotation._id,
      buyerId: quotation.buyer,
      status: quotation.status,
      referenceNumber: quotation.referenceNumber,
      validity: quotation.validity,
      orderNumber: quotation.orderNumber,
      buyerDecision: quotation.buyerDecision,
      quotationRequestId: quotation.quotationRequestId || null
    };

    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'VALIDATE_QUOTATION_OWNERSHIP',
      status: 'SUCCESS',
      quotationRequestId: quotation.quotationRequestId || null,
      quotationId: quotation.referenceNumber,
      resourceId: quoteId,
      clientIp,
      userAgent,
      requestPayload: { quoteId, comment: req.body?.comment || null },
      details: `Ownership validated successfully for quotation ${quotation.referenceNumber}`
    });

    next();
  } catch (error) {
    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'VALIDATE_QUOTATION_OWNERSHIP',
      status: 'ERROR',
      resourceId: quoteId,
      quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
      clientIp,
      userAgent,
      requestPayload: { quoteId, comment: req.body?.comment || null },
      details: `Error validating ownership: ${error.message}`
    });

    return res.status(500).json({
      success: false,
      message: "Error validating quotation ownership"
    });
  }
};

/**
 * Quotation Status Validation Middleware
 * Validates that quotation status is "issued" and not already approved or expired
 * Must be used AFTER validateQuotationOwnership middleware
 */
export const validateQuotationStatus = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const validatedQuote = req.validatedQuotation;

  if (!validatedQuote) {
    return res.status(500).json({
      success: false,
      message: "Quotation validation error. Please ensure ownership validation ran first."
    });
  }

  try {
    const { status, validity, referenceNumber, orderNumber, buyerDecision, quotationRequestId } = validatedQuote;
    const quoteId = req.params.quoteId;

    // Check 1: Status must be "issued"
    if (status !== "issued") {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_BUSINESS_RULE',
        quotationRequestId: quotationRequestId || null,
        quotationId: referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: `Invalid status for approval: currentStatus=${status}, requiredStatus=issued`
      });

      return res.status(400).json({
        success: false,
        message: `Cannot approve quotation with status: "${status}". Only quotations with status "issued" can be approved.`
      });
    }

    // Check 2: Validate quotation has not expired
    if (!validity || !validity.end) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_VALIDATION',
        quotationRequestId: quotationRequestId || null,
        quotationId: referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: 'Quotation validity information missing'
      });

      return res.status(400).json({
        success: false,
        message: "Quotation validity information is missing. Please contact support."
      });
    }

    const now = new Date();
    const validityEnd = new Date(validity.end);

    if (validityEnd < now) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_BUSINESS_RULE',
        quotationRequestId: quotationRequestId || null,
        quotationId: referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: `Quotation expired: validityEnd=${validityEnd.toISOString()}, currentTime=${now.toISOString()}`
      });

      return res.status(400).json({
        success: false,
        message: "This quotation has expired. Please request a refreshed quote from the sales team.",
        expiredAt: validityEnd.toISOString()
      });
    }

    // Check 3: Ensure quotation is not already approved
    // Check if orderNumber exists (indicates quotation was already converted to order)
    if (orderNumber) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_BUSINESS_RULE',
        quotationRequestId: quotationRequestId || null,
        quotationId: referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: `Quotation already converted to order. OrderNumber: ${orderNumber}`
      });

      return res.status(409).json({
        success: false,
        message: "This quotation has already been approved and converted to an order.",
        orderNumber: orderNumber
      });
    }

    // Check if buyerDecision shows approval
    if (buyerDecision && buyerDecision.decision === "approved") {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_BUSINESS_RULE',
        quotationRequestId: quotationRequestId || null,
        quotationId: referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: `Quotation already approved (buyerDecision exists). Status: ${status}, buyerDecision: ${buyerDecision.decision}`
      });

      return res.status(409).json({
        success: false,
        message: "This quotation has already been approved.",
        orderNumber: orderNumber || null
      });
    }

    // Check 4: Double-check by fetching fresh from database (prevents race conditions)
    // This ensures status hasn't changed between validation and processing
    const freshQuotation = await quotationModel.findById(quoteId).select('status buyerDecision orderNumber').lean();
    
    if (!freshQuotation) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_VALIDATION',
        quotationRequestId: quotationRequestId || null,
        quotationId: referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: 'Quotation not found during status validation'
      });

      return res.status(404).json({
        success: false,
        message: "Quotation not found"
      });
    }

    // Final check: ensure status hasn't changed
    if (freshQuotation.status === "approved" || 
        freshQuotation.buyerDecision?.decision === "approved" ||
        freshQuotation.orderNumber) {
      await logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_BUSINESS_RULE',
        quotationRequestId: quotationRequestId || null,
        quotationId: referenceNumber,
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: { quoteId, comment: req.body?.comment || null },
        details: `Quotation state changed after validation. Status: ${freshQuotation.status}, buyerDecision: ${freshQuotation.buyerDecision?.decision}, orderNumber: ${freshQuotation.orderNumber}`
      });

      return res.status(409).json({
        success: false,
        message: "This quotation has already been processed. Please refresh and try again.",
        orderNumber: freshQuotation.orderNumber || null
      });
    }

    // All validations passed
    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'VALIDATE_QUOTATION_STATUS',
      status: 'SUCCESS',
      quotationRequestId: quotationRequestId || null,
      quotationId: referenceNumber,
      resourceId: quoteId,
      clientIp,
      userAgent,
      requestPayload: { quoteId, comment: req.body?.comment || null },
      details: `Quotation status validated successfully: status=${status}, validUntil=${validityEnd.toISOString()}`
    });

    next();
  } catch (error) {
    await logAudit({
      userId: req.user?.id,
      role: normalizeRole(req.user?.role),
      action: 'VALIDATE_QUOTATION_STATUS',
      status: 'ERROR',
      quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
      resourceId: req.params.quoteId,
      clientIp,
      userAgent,
      requestPayload: { quoteId: req.params.quoteId, comment: req.body?.comment || null },
      details: `Error validating quotation status: ${error.message}`
    });

    return res.status(500).json({
      success: false,
      message: "Error validating quotation status"
    });
  }
};

