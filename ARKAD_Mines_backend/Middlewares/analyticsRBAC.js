import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import userModel from "../Models/Users/userModel.js";

export const strictAnalyticsRBAC = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;

  if (!userId) {
    await logAudit({
      userId: null,
      role: 'GUEST',
      action: 'ANALYTICS_UNAUTHORIZED_ACCESS',
      status: 'FAILED_AUTH',
      resourceId: 'analytics-dashboard',
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path
      },
      details: 'Unauthorized access attempt: No user ID found'
    });

    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  const userRole = req.user?.role;
  const normalizedRole = normalizeRole(userRole);

  if (normalizedRole !== 'ADMIN') {
    await logAudit({
      userId,
      role: normalizedRole,
      action: 'ANALYTICS_UNAUTHORIZED_ACCESS',
      status: 'FAILED_AUTH',
      resourceId: 'analytics-dashboard',
      clientIp,
      userAgent,
      requestPayload: {
        method: req.method,
        path: req.path,
        attemptedRole: userRole
      },
      details: `Unauthorized access attempt: User role '${userRole}' is not ADMIN`
    });

    return res.status(403).json({
      success: false,
      message: "Access denied: Admin privileges required"
    });
  }

  next();
};

export const verifyAdminInDatabase = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const user = await userModel.findById(userId).select('role').lean();
    
    if (!user) {
      await logAudit({
        userId,
        role: 'UNKNOWN',
        action: 'ANALYTICS_UNAUTHORIZED_ACCESS',
        status: 'FAILED_AUTH',
        resourceId: 'analytics-dashboard',
        clientIp: getClientIp(req),
        userAgent: getUserAgent(req),
        details: 'Unauthorized access attempt: User not found in database'
      });

      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const normalizedRole = normalizeRole(user.role);
    if (normalizedRole !== 'ADMIN') {
      await logAudit({
        userId,
        role: normalizedRole,
        action: 'ANALYTICS_UNAUTHORIZED_ACCESS',
        status: 'FAILED_AUTH',
        resourceId: 'analytics-dashboard',
        clientIp: getClientIp(req),
        userAgent: getUserAgent(req),
        details: `Database role verification failed: User role '${user.role}' is not admin`
      });

      return res.status(403).json({
        success: false,
        message: "Access denied: Admin privileges required"
      });
    }

    req.verifiedAdminRole = true;
    next();
  } catch (error) {
    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'ANALYTICS_RBAC_ERROR',
      status: 'ERROR',
      resourceId: 'analytics-dashboard',
      clientIp: getClientIp(req),
      userAgent: getUserAgent(req),
      details: `Error in database role verification: ${error.message}`
    });

    return res.status(500).json({
      success: false,
      message: "Authorization verification failed"
    });
  }
};
