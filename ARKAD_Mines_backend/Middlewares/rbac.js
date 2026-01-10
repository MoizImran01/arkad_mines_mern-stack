import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import quotationModel from "../Models/quotationModel/quotationModel.js";
import mongoose from "mongoose";

//Enforces strict permission checks based on user roles


const ROLE_PERMISSIONS = {
  BUYER: {
    canApproveQuotation: true,
    canRejectQuotation: true,
    canRequestQuotationRevision: true,
    canViewOwnQuotations: true,
    canCreateQuotationRequest: true,
    canViewOwnOrders: true,
    canSubmitPaymentProof: true,
    canIssueQuotation: false,
    canViewAllQuotations: false,
    canManageUsers: false,
    canManageOrders: false,
    canManageStones: false
  },
  SALES_REP: {
    canApproveQuotation: false,
    canRejectQuotation: false,
    canRequestQuotationRevision: false,
    canViewOwnQuotations: false,
    canCreateQuotationRequest: false,
    canViewOwnOrders: false,
    canSubmitPaymentProof: false,
    canIssueQuotation: true,
    canViewAllQuotations: true,
    canManageUsers: false,
    canManageOrders: true,
    canManageStones: false
  },
  ADMIN: {
    canApproveQuotation: false,
    canRejectQuotation: false,
    canRequestQuotationRevision: false,
    canViewOwnQuotations: false,
    canCreateQuotationRequest: false,
    canViewOwnOrders: false,
    canSubmitPaymentProof: false,
    canIssueQuotation: true,
    canViewAllQuotations: true,
    canManageUsers: true,
    canManageOrders: true,
    canManageStones: true
  },
  GUEST: {
    canApproveQuotation: false,
    canRejectQuotation: false,
    canRequestQuotationRevision: false,
    canViewOwnQuotations: false,
    canCreateQuotationRequest: false,
    canViewOwnOrders: false,
    canSubmitPaymentProof: false,
    canIssueQuotation: false,
    canViewAllQuotations: false,
    canManageUsers: false,
    canManageOrders: false,
    canManageStones: false
  }
};


const hasPermission = (userRole, permission) => {
  const normalizedRole = normalizeRole(userRole);
  const rolePermissions = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS.GUEST;
  return rolePermissions[permission] === true;
};


export const requirePermission = (permission) => {
  return async (req, res, next) => {
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Ensure user is authenticated
    if (!userId || !userRole) {
      await logAudit({
        userId: null,
        role: 'GUEST',
        action: 'RBAC_CHECK',
        status: 'FAILED_AUTH',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          permission
        },
        details: `Permission check failed: User not authenticated. Required permission: ${permission}`
      });

      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    //Check if user has required permission
    if (!hasPermission(userRole, permission)) {
      await logAudit({
        userId,
        role: normalizeRole(userRole),
        action: 'RBAC_CHECK',
        status: 'FAILED_AUTH',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          permission,
          userRole
        },
        details: `Permission denied: User role '${userRole}' does not have permission '${permission}'. Required permission: ${permission}`
      });

      return res.status(403).json({
        success: false,
        message: "Access denied: You do not have permission to perform this action."
      });
    }

   
    await logAudit({
      userId,
      role: normalizeRole(userRole),
      action: 'RBAC_CHECK',
      status: 'SUCCESS',
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        permission,
        userRole
      },
      details: `Permission granted: User role '${userRole}' has permission '${permission}'`
    });

    next();
  };
};


export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      await logAudit({
        userId: null,
        role: 'GUEST',
        action: 'RBAC_ROLE_CHECK',
        status: 'FAILED_AUTH',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          allowedRoles
        },
        details: `Role check failed: User not authenticated. Required roles: ${allowedRoles.join(', ')}`
      });

      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    
    const normalizedAllowedRoles = allowedRoles.map(role => 
      normalizeRole(role).toLowerCase()
    );
    const normalizedUserRole = normalizeRole(userRole).toLowerCase();


    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      await logAudit({
        userId,
        role: normalizeRole(userRole),
        action: 'RBAC_ROLE_CHECK',
        status: 'FAILED_AUTH',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          allowedRoles,
          userRole
        },
        details: `Role access denied: User role '${userRole}' not in allowed roles [${allowedRoles.join(', ')}]`
      });

      return res.status(403).json({
        success: false,
        message: "Access denied: Insufficient permissions."
      });
    }

    
    await logAudit({
      userId,
      role: normalizeRole(userRole),
      action: 'RBAC_ROLE_CHECK',
      status: 'SUCCESS',
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        allowedRoles,
        userRole
      },
      details: `Role access granted: User role '${userRole}' matches allowed roles [${allowedRoles.join(', ')}]`
    });

    next();
  };
};


export const verifyStrictOwnership = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;
  const { quoteId } = req.params;

  
  if (!userId) {
    await logAudit({
      userId: null,
      role: 'GUEST',
      action: 'STRICT_OWNERSHIP_VERIFY',
      status: 'FAILED_AUTH',
      clientIp,
      userAgent,
      resourceId: quoteId,
      requestPayload: {
        method: req.method,
        path: req.path,
        quoteId
      },
      details: 'Strict ownership verification failed: User not authenticated'
    });

    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  
  if (!quoteId || !mongoose.Types.ObjectId.isValid(quoteId)) {
    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'STRICT_OWNERSHIP_VERIFY',
      status: 'FAILED_VALIDATION',
      resourceId: quoteId,
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        quoteId
      },
      details: `Invalid quotation ID format: ${quoteId}`
    });

    return res.status(400).json({
      success: false,
      message: "Invalid quotation ID format"
    });
  }

  try {
    // Fetch quotation with strict ownership check
    // Use findOne with explicit buyer check in query - prevents race conditions
    const quotation = await quotationModel.findOne({
      _id: new mongoose.Types.ObjectId(quoteId),
      buyer: new mongoose.Types.ObjectId(userId) // Strict ownership check in query
    }).select('_id buyer status referenceNumber').lean();

    if (!quotation) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'STRICT_OWNERSHIP_VERIFY',
        status: 'FAILED_AUTH',
        resourceId: quoteId,
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          quoteId,
          userId
        },
        details: `Strict ownership verification failed: User ${userId} does not own quotation ${quoteId}. Possible elevation of privilege attempt.`
      });

      return res.status(403).json({
        success: false,
        message: "Unauthorized: You do not have permission to perform this action on this quotation."
      });
    }

    // Additional verification: Ensure buyer ID matches exactly
    const buyerId = quotation.buyer ? 
      (quotation.buyer._id ? quotation.buyer._id.toString() : quotation.buyer.toString()) : 
      null;
    const normalizedUserId = userId.toString();

    if (buyerId !== normalizedUserId) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'STRICT_OWNERSHIP_VERIFY',
        status: 'FAILED_AUTH',
        resourceId: quoteId,
        quotationId: quotation.referenceNumber,
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          quoteId,
          userId,
          buyerId
        },
        details: `Strict ownership verification failed: ID mismatch. buyerId=${buyerId}, userId=${normalizedUserId}. Possible elevation of privilege attempt.`
      });

      return res.status(403).json({
        success: false,
        message: "Unauthorized: Ownership verification failed. Possible security violation."
      });
    }

    // Strict ownership verified successfully
    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'STRICT_OWNERSHIP_VERIFY',
      status: 'SUCCESS',
      resourceId: quoteId,
      quotationId: quotation.referenceNumber,
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        quoteId
      },
      details: `Strict ownership verified: User ${userId} owns quotation ${quotation.referenceNumber}`
    });

    // Attach verified quotation to request for downstream use
    req.verifiedQuotation = {
      id: quotation._id,
      buyerId: buyerId,
      referenceNumber: quotation.referenceNumber,
      status: quotation.status
    };

    next();
  } catch (error) {
    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'STRICT_OWNERSHIP_VERIFY',
      status: 'ERROR',
      resourceId: quoteId,
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        quoteId
      },
      details: `Error in strict ownership verification: ${error.message}`
    });

    return res.status(500).json({
      success: false,
      message: "Error verifying quotation ownership"
    });
  }
};

/**
 * Export role permissions for use in other modules
 */
export { ROLE_PERMISSIONS, hasPermission };

