import { createRateLimiter } from "./genericRateLimiting.js";
import { createRequestQueue } from "./genericRequestQueue.js";
import { wafProtection } from "./waf.js";

export const analyticsRateLimiter = createRateLimiter({
  endpoint: '/api/dashboard',
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  actionName: 'ANALYTICS_ACCESS',
  actionType: 'ANALYTICS_RATE_LIMIT_EXCEEDED',
  enableCaptcha: false
});

export const analyticsThrottling = createRequestQueue({
  endpoint: '/api/dashboard',
  maxConcurrent: 3,
  timeoutMs: 60000,
  actionName: 'ANALYTICS_THROTTLING',
  shouldApply: (req) => req.path.includes('/analytics') || req.path.includes('/dashboard'),
  getResourceId: (req) => req.user?.id || req.ip
});

export const analyticsWAF = wafProtection;
