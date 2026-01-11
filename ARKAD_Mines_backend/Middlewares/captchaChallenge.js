import axios from "axios";
import { getClientIp, getUserAgent, logAudit, normalizeRole } from "../logger/auditLogger.js";
import { RateLimitTracking, getRateLimitTracking, cleanOldRequests } from "./rateLimiting.js";

//CAPTCHA Challenge Middleware
//Requires CAPTCHA verification after certain number of approval requests
//Prevents automated attacks and bot-driven DoS

const verifyCaptcha = async (captchaToken) => {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.warn("RECAPTCHA_SECRET_KEY not configured - skipping verification");
      return true; // Skip verification if not configured (for development)
    }

    if (!captchaToken) {
      return false;
    }

    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: secretKey,
          response: captchaToken,
        },
      }
    );

    return response.data.success === true;
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    return false;
  }
};

//CAPTCHA Challenge Middleware
//Requires CAPTCHA after 3 approval requests from same source (user or IP)
export const requireCaptchaChallenge = async (req, res, next) => {
  const userId = req.user?.id;
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const endpoint = '/api/quotes/:quoteId/approve';
  const { captchaToken } = req.body;

  try {
    // Use same tracking mechanism as rate limiters to ensure consistency
    // Also clean old requests to get accurate count
    let tracking = null;
    if (userId) {
      tracking = await getRateLimitTracking(userId.toString(), 'user', endpoint);
      const windowMs = 60 * 60 * 1000; // 1 hour (same as rate limiter)
      await cleanOldRequests(tracking, windowMs);
    }

    //IP-based tracking
    let ipTracking = null;
    if (clientIp) {
      ipTracking = await getRateLimitTracking(clientIp, 'ip', endpoint);
      const windowMs = 60 * 60 * 1000; // 1 hour (same as rate limiter)
      await cleanOldRequests(ipTracking, windowMs);
    }

    // Check if CAPTCHA is required based on current request count (after cleaning old requests)
    // CAPTCHA should only be required AFTER 3 requests, so we check the actual count
    // rather than relying solely on the captchaRequired flag (which might be stale)
    const requestThreshold = 3;
    const userRequestCount = tracking?.requestCount || 0;
    const ipRequestCount = ipTracking?.requestCount || 0;
    
    // CAPTCHA is required if:
    // 1. The captchaRequired flag is set AND user count > threshold, OR
    // 2. The user count exceeds the threshold (even if flag is not set yet)
    // NOTE: Only check user count, not IP count, to avoid triggering CAPTCHA for new users on shared IPs (e.g., localhost)
    const captchaRequired = (tracking && tracking.captchaRequired && userRequestCount > requestThreshold) ||
                            (userRequestCount > requestThreshold);

    //CAPTCHA is required but not provided
    if (captchaRequired && !captchaToken) {
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'CAPTCHA_REQUIRED',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint
        },
        details: `CAPTCHA required but not provided. User requests: ${tracking?.requestCount || 0} (threshold: ${requestThreshold})`
      });

      return res.status(403).json({
        success: false,
        message: "CAPTCHA verification required. Please complete the CAPTCHA challenge.",
        requiresCaptcha: true,
        reason: 'RATE_LIMIT_THRESHOLD'
      });
    }

    if (captchaToken) {
      const isCaptchaValid = await verifyCaptcha(captchaToken);

      if (!isCaptchaValid) {
        
        if (tracking) {
          tracking.captchaAttempts = (tracking.captchaAttempts || 0) + 1;
          await tracking.save();
        }
        if (ipTracking) {
          ipTracking.captchaAttempts = (ipTracking.captchaAttempts || 0) + 1;
          await ipTracking.save();
        }

        await logAudit({
          userId: userId || null,
          role: normalizeRole(req.user?.role),
          action: 'CAPTCHA_VERIFICATION_FAILED',
          status: 'FAILED_VALIDATION',
          clientIp,
          userAgent,
          requestPayload: {
            method: req.method,
            path: req.path,
            endpoint
          },
          details: `CAPTCHA verification failed. User attempts: ${tracking?.captchaAttempts || 0}, IP attempts: ${ipTracking?.captchaAttempts || 0}`
        });

        return res.status(403).json({
          success: false,
          message: "CAPTCHA verification failed. Please try again.",
          requiresCaptcha: true,
          captchaFailed: true
        });
      }

      
      if (tracking) {
        tracking.captchaAttempts = 0;
        tracking.captchaRequired = false; 
        await tracking.save();
      }
      if (ipTracking) {
        ipTracking.captchaAttempts = 0;
        ipTracking.captchaRequired = false;
        await ipTracking.save();
      }
    }

    // If CAPTCHA is required (from the check above), set the flag if not already set
    if (captchaRequired) {
      if (tracking && !tracking.captchaRequired && userRequestCount > requestThreshold) {
        tracking.captchaRequired = true;
        await tracking.save();
      }
      if (ipTracking && !ipTracking.captchaRequired && ipRequestCount > requestThreshold) {
        ipTracking.captchaRequired = true;
        await ipTracking.save();
      }
    }

    next();
  } catch (error) {
    //CAPTCHA check fails, log but allow request (fail open)
    await logAudit({
      userId: userId || null,
      role: normalizeRole(req.user?.role),
      action: 'CAPTCHA_CHECK_ERROR',
      status: 'ERROR',
      clientIp,
      userAgent,
      details: `Error in CAPTCHA check: ${error.message}`
    });
    next();
  }
};

