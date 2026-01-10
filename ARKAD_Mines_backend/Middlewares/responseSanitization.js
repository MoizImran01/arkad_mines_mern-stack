import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import { quotationBuyerDTO, quotationAdminDTO, quotationsListBuyerDTO, quotationsListAdminDTO, approveQuotationBuyerDTO } from "../Utils/DTOs/quotationDTO.js";

/**
 * Response Sanitization Middleware
 * Automatically sanitizes API responses based on user role
 * Prevents information disclosure of sensitive data
 * 
 * This middleware intercepts responses and applies DTOs based on:
 * - User role (BUYER vs ADMIN/SALES_REP)
 * - Response type (quotation, order, etc.)
 * - Endpoint context
 */

/**
 * Sanitize quotation response based on user role
 * Automatically strips sensitive fields for buyers
 */
export const sanitizeQuotationResponse = (req, res, next) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to sanitize response
  res.json = function (data) {
    try {
      let sanitizedData = data;

      // Check if response contains quotation data
      if (data.quotation && typeof data.quotation === 'object') {
        const userRole = normalizeRole(req.user?.role);
        
        // Log data access attempt
        const clientIp = getClientIp(req);
        const userAgent = getUserAgent(req);
        
        logAudit({
          userId: req.user?.id,
          role: userRole,
          action: 'DATA_ACCESS_QUOTATION',
          status: 'SUCCESS',
          resourceId: data.quotation._id || data.quotation.id,
          quotationId: data.quotation.referenceNumber || null,
          quotationRequestId: data.quotation.quotationRequestId || null,
          clientIp,
          userAgent,
          requestPayload: {
            method: req.method,
            path: req.path,
            params: req.params,
          },
          details: `Quotation data accessed: role=${userRole}, quotationId=${data.quotation.referenceNumber || 'unknown'}`
        });

        // Apply DTO based on role
        if (userRole === 'BUYER') {
          sanitizedData.quotation = quotationBuyerDTO(data.quotation);
        } else if (userRole === 'ADMIN' || userRole === 'SALES_REP') {
          sanitizedData.quotation = quotationAdminDTO(data.quotation);
        }
      }

      // Check if response contains quotations array
      if (Array.isArray(data.quotations) && data.quotations.length > 0) {
        const userRole = normalizeRole(req.user?.role);
        
        // Log data access attempt
        const clientIp = getClientIp(req);
        const userAgent = getUserAgent(req);
        
        logAudit({
          userId: req.user?.id,
          role: userRole,
          action: 'DATA_ACCESS_QUOTATIONS_LIST',
          status: 'SUCCESS',
          clientIp,
          userAgent,
          requestPayload: {
            method: req.method,
            path: req.path,
            query: req.query,
          },
          details: `Quotations list accessed: role=${userRole}, count=${data.quotations.length}`
        });

        // Apply DTO based on role
        if (userRole === 'BUYER') {
          sanitizedData.quotations = quotationsListBuyerDTO(data.quotations);
        } else if (userRole === 'ADMIN' || userRole === 'SALES_REP') {
          sanitizedData.quotations = quotationsListAdminDTO(data.quotations);
        }
      }

      // Check if this is an approval response (contains both quotation and order)
      if (data.success && data.quotation && data.order) {
        const userRole = normalizeRole(req.user?.role);
        
        // Log approval response access
        const clientIp = getClientIp(req);
        const userAgent = getUserAgent(req);
        
        logAudit({
          userId: req.user?.id,
          role: userRole,
          action: 'DATA_ACCESS_APPROVAL_RESPONSE',
          status: 'SUCCESS',
          quotationId: data.quotation.referenceNumber || null,
          quotationRequestId: data.quotation.quotationRequestId || null,
          clientIp,
          userAgent,
          requestPayload: {
            method: req.method,
            path: req.path,
            params: req.params,
          },
          details: `Approval response accessed: role=${userRole}, orderNumber=${data.order.orderNumber || 'unknown'}`
        });

        // Apply DTO based on role
        if (userRole === 'BUYER') {
          const sanitized = approveQuotationBuyerDTO(data.quotation, data.order);
          return originalJson(sanitized);
        }
        // Admin/Sales Rep get full data
      }

      // Send sanitized data
      return originalJson(sanitizedData);
    } catch (error) {
      // If sanitization fails, log error but send original response
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'DATA_SANITIZATION_ERROR',
        status: 'ERROR',
        clientIp: getClientIp(req),
        userAgent: getUserAgent(req),
        details: `Error sanitizing response: ${error.message}`
      });
      
      // Send original response if sanitization fails
      return originalJson(data);
    }
  };

  next();
};

/**
 * Role-based response sanitization
 * Can be used selectively on specific routes
 */
export const sanitizeForBuyer = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    try {
      if (data.quotation) {
        data.quotation = quotationBuyerDTO(data.quotation);
      }
      if (Array.isArray(data.quotations)) {
        data.quotations = quotationsListBuyerDTO(data.quotations);
      }
      return originalJson(data);
    } catch (error) {
      return originalJson(data);
    }
  };

  next();
};

