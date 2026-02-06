import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RateLimitTracking } from "./rateLimitModel.js";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";

export const createRateLimiter = ({
  endpoint,
  windowMs = 60 * 60 * 1000,
  maxRequests = 10,
  actionName = 'RATE_LIMIT',
  actionType = 'RATE_LIMIT_EXCEEDED',
  enableCaptcha = false,
  captchaThreshold = 3
}) => {
  const userLimiter = rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req) => {
      if (req.user?.id) {
        return String(req.user.id);
      }
      return ipKeyGenerator(req);
    },
    message: { error: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes.` },
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: actionName,
        status: 'FAILED_VALIDATION',
        resourceId: endpoint,
        clientIp: getClientIp(req),
        userAgent: getUserAgent(req),
        details: `Rate limit exceeded for ${actionName}`
      });

      res.status(429).json({
        success: false,
        error: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes.`
      });
    }
  });

  const ipLimiter = rateLimit({
    windowMs,
    max: maxRequests * 2,
    keyGenerator: ipKeyGenerator,
    message: { error: `Rate limit exceeded for your IP address. Please try again later.` },
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: actionName,
        status: 'FAILED_VALIDATION',
        resourceId: endpoint,
        clientIp: getClientIp(req),
        userAgent: getUserAgent(req),
        details: `IP rate limit exceeded for ${actionName}`
      });

      res.status(429).json({
        success: false,
        error: `Rate limit exceeded for your IP address. Please try again later.`
      });
    }
  });

  return { userLimiter, ipLimiter };
};
