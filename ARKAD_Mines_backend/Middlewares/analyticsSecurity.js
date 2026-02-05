import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import { detectAnomalies } from "./anomalyDetection.js";

export const detectAnalyticsAnomalies = async (req, res, next) => {
  req.analyticsAnomalyContext = {
    resourceId: 'analytics-dashboard',
    actionPrefix: 'ANALYTICS'
  };
  await detectAnomalies(req, res, next);
};

export const createIPWhitelist = (allowedIPs = [], enforceWhitelist = true) => {
  return async (req, res, next) => {
    if (!enforceWhitelist || allowedIPs.length === 0) {
      return next();
    }

    const clientIp = getClientIp(req);
    const isAllowed = allowedIPs.some(ip => {
      if (ip === clientIp) return true;
      if (ip.includes('*')) {
        const pattern = ip.replaceAll('*', '.*');
        return new RegExp(`^${pattern}$`).test(clientIp);
      }
      return false;
    });

    if (!isAllowed) {
      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: 'ANALYTICS_IP_WHITELIST_BLOCKED',
        status: 'FAILED_VALIDATION',
        resourceId: 'analytics-dashboard',
        clientIp,
        userAgent: getUserAgent(req),
        details: `IP address ${clientIp} not in whitelist. Allowed IPs: ${allowedIPs.join(', ')}`
      });

      return res.status(403).json({
        success: false,
        message: "Access denied: Your IP address is not authorized to access analytics."
      });
    }

    next();
  };
};
