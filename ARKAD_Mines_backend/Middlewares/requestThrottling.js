import { logAudit, getClientIp, getUserAgent, normalizeRole } from "../logger/auditLogger.js";

/**
 * Request Throttling Middleware
 * Implements simple request throttling to prevent server overload
 * Uses in-memory tracking of concurrent requests per endpoint
 */

// Track active requests per endpoint
const activeRequests = new Map();

// Configuration
const MAX_CONCURRENT_REQUESTS = 5; // Max concurrent requests per endpoint
const THROTTLE_WINDOW_MS = 60000; // 1 minute window for throttling check

/**
 * Request Throttling Middleware
 * Limits concurrent requests per endpoint to prevent overload
 */
export const requestThrottling = async (req, res, next) => {
  const endpoint = req.path || req.route?.path || 'unknown';
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;

  // Only apply throttling to approval endpoint
  if (!endpoint.includes('/approve')) {
    return next();
  }

  try {
    // Get or initialize active requests counter for this endpoint
    if (!activeRequests.has(endpoint)) {
      activeRequests.set(endpoint, {
        count: 0,
        lastReset: Date.now()
      });
    }

    const throttleState = activeRequests.get(endpoint);

    // Reset counter if window has passed
    if (Date.now() - throttleState.lastReset > THROTTLE_WINDOW_MS) {
      throttleState.count = 0;
      throttleState.lastReset = Date.now();
    }

    // Check if we're at concurrent request limit
    if (throttleState.count >= MAX_CONCURRENT_REQUESTS) {
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'THROTTLE_LIMIT_EXCEEDED',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint
        },
        details: `Too many concurrent requests: ${throttleState.count}/${MAX_CONCURRENT_REQUESTS}`
      });

      return res.status(503).json({
        success: false,
        message: "Server is currently handling high volume of requests. Please try again in a few moments.",
        serviceUnavailable: true,
        retryAfter: 10 // Suggest retry after 10 seconds
      });
    }

    // Increment active request counter
    throttleState.count++;

    // Log throttling activity if we're near the limit
    if (throttleState.count >= MAX_CONCURRENT_REQUESTS * 0.8) {
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'THROTTLE_WARNING',
        status: 'WARNING',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint
        },
        details: `High concurrent request load: ${throttleState.count}/${MAX_CONCURRENT_REQUESTS}`
      });
    }

    // Wrap response to decrement counter when request completes
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);

    let responseSent = false;

    const decrementCounter = () => {
      if (!responseSent) {
        responseSent = true;
        if (throttleState.count > 0) {
          throttleState.count--;
        }
      }
    };

    res.json = function(body) {
      decrementCounter();
      return originalJson(body);
    };

    res.end = function(...args) {
      decrementCounter();
      return originalEnd(...args);
    };

    // Handle errors to ensure counter is decremented
    res.on('close', decrementCounter);
    res.on('finish', decrementCounter);

    // Process request
    next();

  } catch (error) {
    // If throttling fails, log but allow request (fail open)
    await logAudit({
      userId: userId || null,
      role: normalizeRole(req.user?.role),
      action: 'THROTTLING_ERROR',
      status: 'ERROR',
      clientIp,
      userAgent,
      details: `Error in request throttling: ${error.message}`
    });

    // Fail open and process normally
    next();
  }
};

/**
 * Get throttling statistics (for monitoring)
 */
export const getThrottlingStats = (endpoint) => {
  const throttleState = activeRequests.get(endpoint);
  if (!throttleState) {
    return {
      count: 0,
      maxConcurrent: MAX_CONCURRENT_REQUESTS,
      available: MAX_CONCURRENT_REQUESTS
    };
  }

  return {
    count: throttleState.count,
    maxConcurrent: MAX_CONCURRENT_REQUESTS,
    available: MAX_CONCURRENT_REQUESTS - throttleState.count,
    lastReset: new Date(throttleState.lastReset)
  };
};

