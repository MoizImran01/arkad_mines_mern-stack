import quotationModel from "../Models/quotationModel/quotationModel.js";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import mongoose from "mongoose";

export const validateQuotationStatus = async (req, res, next) => {
  const quoteId = req.params.quoteId;
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;

  try {
    // Sanitize and validate inputs to prevent NoSQL injection
    if (!quoteId || !mongoose.Types.ObjectId.isValid(quoteId)) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        clientIp,
        userAgent,
        details: `Invalid quotation ID format: ${quoteId}`
      });
      return res.status(400).json({
        success: false,
        message: "Invalid quotation ID format"
      });
    }
    const safeQuoteId = String(quoteId).trim();
    
    const quotation = await quotationModel.findById(safeQuoteId).select('status validity referenceNumber');

    if (!quotation) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        clientIp,
        userAgent,
        details: `Quotation not found: ${quoteId}`
      });

      return res.status(404).json({
        success: false,
        message: "Quotation not found"
      });
    }

    if (quotation.status !== 'issued') {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'VALIDATE_QUOTATION_STATUS',
        status: 'FAILED_VALIDATION',
        resourceId: quoteId,
        quotationId: quotation.referenceNumber,
        clientIp,
        userAgent,
        details: `Quotation status is '${quotation.status}', must be 'issued' to approve`
      });

      return res.status(400).json({
        success: false,
        message: `Cannot approve quotation. Current status: ${quotation.status}. Quotation must be 'issued' to approve.`
      });
    }

    if (quotation.validity && quotation.validity.end) {
      const validityEnd = new Date(quotation.validity.end);
      const now = new Date();

      if (now > validityEnd) {
        await logAudit({
          userId,
          role: normalizeRole(req.user?.role),
          action: 'VALIDATE_QUOTATION_STATUS',
          status: 'FAILED_VALIDATION',
          resourceId: quoteId,
          quotationId: quotation.referenceNumber,
          clientIp,
          userAgent,
          details: `Quotation expired on ${validityEnd.toISOString()}`
        });

        return res.status(400).json({
          success: false,
          message: "This quotation has expired and can no longer be approved."
        });
      }
    }

    req.validatedQuotation = {
      id: quotation._id,
      status: quotation.status,
      referenceNumber: quotation.referenceNumber,
      validity: quotation.validity
    };

    next();
  } catch (error) {
    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'VALIDATE_QUOTATION_STATUS',
      status: 'ERROR',
      resourceId: quoteId,
      clientIp,
      userAgent,
      details: `Error validating quotation status: ${error.message}`
    });

    return res.status(500).json({
      success: false,
      message: "Error validating quotation status"
    });
  }
};
