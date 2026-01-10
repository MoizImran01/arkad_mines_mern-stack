import rateLimit from "express-rate-limit";
import { getClientIp } from "../logger/auditLogger.js";
import { logAudit, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import mongoose from "mongoose";


//Implements per-user and per-IP rate limiting for quotation approval

const rateLimitTrackingSchema = new mongoose.Schema({
  identifier: { type: String, required: true, index: true }, // userId or IP address
  type: { type: String, enum: ['user', 'ip'], required: true, index: true },
  endpoint: { type: String, required: true, index: true },
  requests: [{
    timestamp: { type: Date, required: true },
    action: { type: String, required: true }
  }],
  lastRequestAt: { type: Date, default: Date.now },
  requestCount: { type: Number, default: 0 },
  blockedUntil: { type: Date, default: null }, // Temporary block
  captchaRequired: { type: Boolean, default: false }, // CAPTCHA required flag
  captchaAttempts: { type: Number, default: 0 }, // Failed CAPTCHA attempts
}, {
  timestamps: true
});

rateLimitTrackingSchema.index({ identifier: 1, endpoint: 1, type: 1 });
rateLimitTrackingSchema.index({ blockedUntil: 1 }, { expireAfterSeconds: 3600 }); // Auto-delete expired blocks

const RateLimitTracking = mongoose.models.RateLimitTracking || mongoose.model("RateLimitTracking", rateLimitTrackingSchema);


const getRateLimitTracking = async (identifier, type, endpoint) => {
  let tracking = await RateLimitTracking.findOne({
    identifier,
    type,
    endpoint
  });

  if (!tracking) {
    tracking = new RateLimitTracking({
      identifier,
      type,
      endpoint,
      requests: [],
      requestCount: 0
    });
    await tracking.save();
  }

  return tracking;
};

const cleanOldRequests = async (tracking, windowMs) => {
  const cutoffTime = new Date(Date.now() - windowMs);
  tracking.requests = tracking.requests.filter(req => req.timestamp >= cutoffTime);
  tracking.requestCount = tracking.requests.length;
  await tracking.save();
};

//Per-User Rate Limiter for Approval Endpoint
//Max 5 approvals per hour per user
export const approvalPerUserLimiter = async (req, res, next) => {
  const userId = req.user?.id;
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const endpoint = '/api/quotes/:quoteId/approve';

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  try {
    const tracking = await getRateLimitTracking(userId.toString(), 'user', endpoint);
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxRequests = 5; // Max 5 approvals per hour

    await cleanOldRequests(tracking, windowMs);

    if (tracking.blockedUntil && tracking.blockedUntil > new Date()) {
      const remainingSeconds = Math.ceil((tracking.blockedUntil - new Date()) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'RATE_LIMIT_EXCEEDED',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint
        },
        details: `User rate limit exceeded. Blocked for ${remainingSeconds} seconds. Request count: ${tracking.requestCount}/${maxRequests}`
      });

      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. You have reached the maximum of ${maxRequests} approvals per hour. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        retryAfter: remainingSeconds,
        limitExceeded: true
      });
    }

    if (tracking.requestCount >= maxRequests) {
      tracking.blockedUntil = new Date(Date.now() + windowMs);
      tracking.captchaRequired = true; //Require CAPTCHA after limit
      await tracking.save();

      const blockDurationMinutes = Math.ceil(windowMs / 1000 / 60);

      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'RATE_LIMIT_EXCEEDED',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint
        },
        details: `User exceeded approval limit: ${tracking.requestCount}/${maxRequests} in ${blockDurationMinutes} minutes`
      });

      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Maximum ${maxRequests} approvals per hour. Please try again in ${blockDurationMinutes} minute${blockDurationMinutes !== 1 ? 's' : ''}.`,
        retryAfter: Math.ceil(windowMs / 1000),
        limitExceeded: true,
        requiresCaptcha: true
      });
    }

    tracking.requests.push({
      timestamp: new Date(),
      action: 'APPROVE_QUOTATION'
    });
    tracking.requestCount = tracking.requests.length;
    tracking.lastRequestAt = new Date();
    await tracking.save();

    req.rateLimitInfo = {
      remaining: maxRequests - tracking.requestCount,
      resetAt: new Date(Date.now() + windowMs),
      requiresCaptcha: tracking.captchaRequired
    };

    next();
  } catch (error) {
    // If rate limiting fails, log but allow request (fail open)
    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: 'RATE_LIMIT_ERROR',
      status: 'ERROR',
      clientIp,
      userAgent,
      details: `Error in rate limiting: ${error.message}`
    });
    next();
  }
};

//Per-IP Rate Limiter for Approval Endpoint
//Max 10 approvals per hour per IP address
export const approvalPerIPLimiter = async (req, res, next) => {
  const clientIp = getClientIp(req) || 'unknown';
  const userAgent = getUserAgent(req);
  const endpoint = '/api/quotes/:quoteId/approve';

  try {
    const tracking = await getRateLimitTracking(clientIp, 'ip', endpoint);
    const windowMs = 60 * 60 * 1000; //1 hour
    const maxRequests = 10; //Max 10 approvals per hour per IP

    await cleanOldRequests(tracking, windowMs);

    if (tracking.blockedUntil && tracking.blockedUntil > new Date()) {
      const remainingSeconds = Math.ceil((tracking.blockedUntil - new Date()) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      
      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: 'RATE_LIMIT_EXCEEDED_IP',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint
        },
        details: `IP rate limit exceeded. Blocked for ${remainingSeconds} seconds. Request count: ${tracking.requestCount}/${maxRequests}`
      });

      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for your IP address. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        retryAfter: remainingSeconds,
        limitExceeded: true
      });
    }

    // Check if request count exceeds limit
    if (tracking.requestCount >= maxRequests) {
      // Block IP for 1 hour
      tracking.blockedUntil = new Date(Date.now() + windowMs);
      tracking.captchaRequired = true;
      await tracking.save();

      const blockDurationMinutes = Math.ceil(windowMs / 1000 / 60);

      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: 'RATE_LIMIT_EXCEEDED_IP',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint
        },
        details: `IP exceeded approval limit: ${tracking.requestCount}/${maxRequests} in ${blockDurationMinutes} minutes`
      });

      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for your IP address. Maximum ${maxRequests} approvals per hour. Please try again in ${blockDurationMinutes} minute${blockDurationMinutes !== 1 ? 's' : ''}.`,
        retryAfter: Math.ceil(windowMs / 1000),
        limitExceeded: true,
        requiresCaptcha: true
      });
    }

    tracking.requests.push({
      timestamp: new Date(),
      action: 'APPROVE_QUOTATION'
    });
    tracking.requestCount = tracking.requests.length;
    tracking.lastRequestAt = new Date();
    await tracking.save();

    next();
  } catch (error) {
    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'RATE_LIMIT_ERROR_IP',
      status: 'ERROR',
      clientIp,
      userAgent,
      details: `Error in IP rate limiting: ${error.message}`
    });
    next();
  }
};

export { RateLimitTracking };

