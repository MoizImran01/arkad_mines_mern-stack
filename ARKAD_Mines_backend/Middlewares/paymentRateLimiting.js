import { getClientIp } from "../logger/auditLogger.js";
import { logAudit, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import mongoose from "mongoose";
import { RateLimitTracking } from "./rateLimiting.js";

/**
 * Payment Rate Limiting Middleware
 * Implements per-user and per-IP rate limiting for payment submissions
 * Max 10 payment submissions per day per user
 * Max 20 payment submissions per day per IP address
 */

const getPaymentRateLimitTracking = async (identifier, type, endpoint) => {
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

const cleanOldPaymentRequests = async (tracking, windowMs) => {
  const cutoffTime = new Date(Date.now() - windowMs);
  tracking.requests = tracking.requests.filter(req => req.timestamp >= cutoffTime);
  tracking.requestCount = tracking.requests.length;
  await tracking.save();
};

// Per-User Rate Limiter for Payment Submission Endpoint
// Max 10 payment submissions per day per user
export const paymentPerUserLimiter = async (req, res, next) => {
  const userId = req.user?.id;
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const endpoint = '/api/orders/payment/submit/:orderId';

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  try {
    const tracking = await getPaymentRateLimitTracking(userId.toString(), 'user', endpoint);
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours (1 day)
    const maxRequests = 10; // Max 10 payment submissions per day

    await cleanOldPaymentRequests(tracking, windowMs);

    if (tracking.blockedUntil && tracking.blockedUntil > new Date()) {
      const remainingSeconds = Math.ceil((tracking.blockedUntil - new Date()) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      const remainingHours = Math.ceil(remainingMinutes / 60);
      
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_RATE_LIMIT_EXCEEDED',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint,
          orderId: req.params.orderId
        },
        details: `User payment submission rate limit exceeded. Blocked for ${remainingSeconds} seconds. Request count: ${tracking.requestCount}/${maxRequests}`
      });

      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. You have reached the maximum of ${maxRequests} payment submissions per day. Please try again in ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}.`,
        retryAfter: remainingSeconds,
        limitExceeded: true
      });
    }

    if (tracking.requestCount >= maxRequests) {
      tracking.blockedUntil = new Date(Date.now() + windowMs);
      await tracking.save();

      const blockDurationHours = Math.ceil(windowMs / 1000 / 60 / 60);

      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_RATE_LIMIT_EXCEEDED',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint,
          orderId: req.params.orderId
        },
        details: `User exceeded payment submission limit: ${tracking.requestCount}/${maxRequests} in 24 hours`
      });

      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Maximum ${maxRequests} payment submissions per day. Please try again in ${blockDurationHours} hour${blockDurationHours !== 1 ? 's' : ''}.`,
        retryAfter: Math.ceil(windowMs / 1000),
        limitExceeded: true
      });
    }

    tracking.requests.push({
      timestamp: new Date(),
      action: 'PAYMENT_SUBMISSION'
    });
    tracking.requestCount = tracking.requests.length;
    tracking.lastRequestAt = new Date();
    await tracking.save();

    req.paymentRateLimitInfo = {
      remaining: maxRequests - tracking.requestCount,
      resetAt: new Date(Date.now() + windowMs)
    };

    next();
  } catch (error) {
    await logAudit({
      userId: userId || null,
      role: normalizeRole(req.user?.role),
      action: 'PAYMENT_RATE_LIMIT_ERROR',
      status: 'ERROR',
      clientIp,
      userAgent,
      details: `Error in payment user rate limiting: ${error.message}`
    });
    next(); // Fail open - allow request if rate limiting fails
  }
};

// Per-IP Rate Limiter for Payment Submission Endpoint
// Max 20 payment submissions per day per IP address
export const paymentPerIPLimiter = async (req, res, next) => {
  const clientIp = getClientIp(req) || 'unknown';
  const userAgent = getUserAgent(req);
  const endpoint = '/api/orders/payment/submit/:orderId';

  try {
    const tracking = await getPaymentRateLimitTracking(clientIp, 'ip', endpoint);
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours (1 day)
    const maxRequests = 20; // Max 20 payment submissions per day per IP

    await cleanOldPaymentRequests(tracking, windowMs);

    if (tracking.blockedUntil && tracking.blockedUntil > new Date()) {
      const remainingSeconds = Math.ceil((tracking.blockedUntil - new Date()) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      const remainingHours = Math.ceil(remainingMinutes / 60);
      
      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_RATE_LIMIT_EXCEEDED_IP',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint,
          orderId: req.params.orderId
        },
        details: `IP payment submission rate limit exceeded. Blocked for ${remainingSeconds} seconds. Request count: ${tracking.requestCount}/${maxRequests}`
      });

      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for your IP address. Please try again in ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}.`,
        retryAfter: remainingSeconds,
        limitExceeded: true
      });
    }

    if (tracking.requestCount >= maxRequests) {
      tracking.blockedUntil = new Date(Date.now() + windowMs);
      await tracking.save();

      const blockDurationHours = Math.ceil(windowMs / 1000 / 60 / 60);

      await logAudit({
        userId: req.user?.id || null,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_RATE_LIMIT_EXCEEDED_IP',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint,
          orderId: req.params.orderId
        },
        details: `IP exceeded payment submission limit: ${tracking.requestCount}/${maxRequests} in 24 hours`
      });

      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for your IP address. Maximum ${maxRequests} payment submissions per day. Please try again in ${blockDurationHours} hour${blockDurationHours !== 1 ? 's' : ''}.`,
        retryAfter: Math.ceil(windowMs / 1000),
        limitExceeded: true
      });
    }

    tracking.requests.push({
      timestamp: new Date(),
      action: 'PAYMENT_SUBMISSION'
    });
    tracking.requestCount = tracking.requests.length;
    tracking.lastRequestAt = new Date();
    await tracking.save();

    next();
  } catch (error) {
    await logAudit({
      userId: req.user?.id || null,
      role: normalizeRole(req.user?.role),
      action: 'PAYMENT_RATE_LIMIT_ERROR_IP',
      status: 'ERROR',
      clientIp,
      userAgent,
      details: `Error in payment IP rate limiting: ${error.message}`
    });
    next(); // Fail open - allow request if rate limiting fails
  }
};

