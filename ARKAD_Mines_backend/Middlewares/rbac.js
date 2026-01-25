import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";

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

export { ROLE_PERMISSIONS, hasPermission };
