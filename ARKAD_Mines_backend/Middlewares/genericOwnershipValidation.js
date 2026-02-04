import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import mongoose from "mongoose";

export const createOwnershipValidator = ({
  model,
  ownerField = 'buyer',
  paramName = 'id',
  actionName = 'OWNERSHIP_VALIDATION',
  selectFields = (resource) => resource,
  getAdditionalContext = (req) => ({}),
  onSuccess = null
}) => {
  return async (req, res, next) => {
    const resourceId = req.params[paramName];
    const userId = req.user?.id;
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);

    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: "Resource ID required"
      });
    }

    if (!userId) {
      await logAudit({
        userId: null,
        role: 'GUEST',
        action: actionName,
        status: 'FAILED_AUTH',
        resourceId,
        clientIp,
        userAgent,
        details: `Ownership validation failed: User not authenticated`
      });

      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    try {
      let selectString = ownerField;
      if (typeof selectFields === 'function') {
        const sampleFields = selectFields({});
        if (sampleFields && typeof sampleFields === 'object') {
          selectString = Object.keys(sampleFields).join(' ');
        }
      } else if (typeof selectFields === 'string') {
        selectString = selectFields;
      } else if (Array.isArray(selectFields)) {
        selectString = selectFields.join(' ');
      }

      // Sanitize and validate inputs to prevent NoSQL injection
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        await logAudit({
          userId,
          role: normalizeRole(req.user?.role),
          action: actionName,
          status: 'FAILED_VALIDATION',
          resourceId,
          clientIp,
          userAgent,
          details: `Invalid resource ID format: ${resourceId}`
        });
        return res.status(400).json({
          success: false,
          message: "Invalid resource ID format"
        });
      }
      const safeResourceId = String(resourceId).trim();
      
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        await logAudit({
          userId: null,
          role: normalizeRole(req.user?.role),
          action: actionName,
          status: 'FAILED_AUTH',
          resourceId: safeResourceId,
          clientIp,
          userAgent,
          details: `Invalid user ID format: ${userId}`
        });
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format"
        });
      }
      
      const resource = await model.findById(safeResourceId).select(selectString).lean();

      if (!resource) {
        await logAudit({
          userId,
          role: normalizeRole(req.user?.role),
          action: actionName,
          status: 'FAILED_VALIDATION',
          resourceId,
          clientIp,
          userAgent,
          details: `Resource not found: ${resourceId}`
        });

        return res.status(404).json({
          success: false,
          message: "Resource not found"
        });
      }

      let ownerId = resource[ownerField];
      if (ownerId && typeof ownerId === 'object' && ownerId._id) {
        ownerId = ownerId._id.toString();
      } else if (ownerId) {
        ownerId = ownerId.toString();
      } else {
        ownerId = null;
      }
      const userIdStr = userId.toString();

      if (ownerId !== userIdStr) {
        await logAudit({
          userId,
          role: normalizeRole(req.user?.role),
          action: actionName,
          status: 'FAILED_AUTH',
          resourceId,
          clientIp,
          userAgent,
          requestPayload: {
            method: req.method,
            path: req.path,
            ...getAdditionalContext(req)
          },
          details: `Ownership validation failed: User ${userId} does not own resource ${resourceId}`
        });

        return res.status(403).json({
          success: false,
          message: "Access denied: You do not have permission to access this resource"
        });
      }

      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(resource, req);
      }

      next();
    } catch (error) {
      console.error(`[OWNERSHIP_VALIDATION_ERROR] ${actionName}:`, error);
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: actionName,
        status: 'ERROR',
        resourceId,
        clientIp,
        userAgent,
        details: `Error in ownership validation: ${error.message}`
      });

      return res.status(500).json({
        success: false,
        message: "Error validating resource ownership",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};
