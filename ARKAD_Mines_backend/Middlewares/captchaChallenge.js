import axios from "axios";
import { getClientIp, getUserAgent, logAudit, normalizeRole } from "../logger/auditLogger.js";
import { RateLimitTracking } from "./rateLimiting.js";

/**
 * CAPTCHA Challenge Middleware
 * Requires CAPTCHA verification after certain number of approval requests
 * Prevents automated attacks and bot-driven DoS
 */

/**
 * Verify CAPTCHA token with Google reCAPTCHA
 */
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

/**
 * CAPTCHA Challenge Middleware
 * Requires CAPTCHA after 3 approval requests from same source (user or IP)
 */
export const requireCaptchaChallenge = async (req, res, next) => {
  const userId = req.user?.id;
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const endpoint = '/api/quotes/:quoteId/approve';
  const { captchaToken } = req.body;

  try {
    // Check if CAPTCHA is required for this user
    let tracking = null;
    if (userId) {
      tracking = await RateLimitTracking.findOne({
        identifier: userId.toString(),
        type: 'user',
        endpoint
      });
    }

    // Also check IP-based tracking
    let ipTracking = null;
    if (clientIp) {
      ipTracking = await RateLimitTracking.findOne({
        identifier: clientIp,
        type: 'ip',
        endpoint
      });
    }

    const captchaRequired = (tracking && tracking.captchaRequired) || 
                            (ipTracking && ipTracking.captchaRequired);

    // If CAPTCHA is required but not provided
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
        details: `CAPTCHA required but not provided. User requests: ${tracking?.requestCount || 0}, IP requests: ${ipTracking?.requestCount || 0}`
      });

      return res.status(403).json({
        success: false,
        message: "CAPTCHA verification required. Please complete the CAPTCHA challenge.",
        requiresCaptcha: true,
        reason: 'RATE_LIMIT_THRESHOLD'
      });
    }

    // If CAPTCHA is provided, verify it
    if (captchaToken) {
      const isCaptchaValid = await verifyCaptcha(captchaToken);

      if (!isCaptchaValid) {
        // Increment failed CAPTCHA attempts
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

      // CAPTCHA verified successfully - reset attempts
      if (tracking) {
        tracking.captchaAttempts = 0;
        tracking.captchaRequired = false; // Clear requirement after successful verification
        await tracking.save();
      }
      if (ipTracking) {
        ipTracking.captchaAttempts = 0;
        ipTracking.captchaRequired = false;
        await ipTracking.save();
      }
    }

    // Check if CAPTCHA should be required (after 3 requests)
    const requestThreshold = 3;
    if (!captchaRequired) {
      const userRequestCount = tracking?.requestCount || 0;
      const ipRequestCount = ipTracking?.requestCount || 0;

      if (userRequestCount >= requestThreshold || ipRequestCount >= requestThreshold) {
        // Require CAPTCHA for future requests
        if (tracking) {
          tracking.captchaRequired = true;
          await tracking.save();
        }
        if (ipTracking) {
          ipTracking.captchaRequired = true;
          await ipTracking.save();
        }

        await logAudit({
          userId: userId || null,
          role: normalizeRole(req.user?.role),
          action: 'CAPTCHA_REQUIREMENT_SET',
          status: 'SUCCESS',
          clientIp,
          userAgent,
          details: `CAPTCHA requirement set after ${Math.max(userRequestCount, ipRequestCount)} requests`
        });
      }
    }

    next();
  } catch (error) {
    // If CAPTCHA check fails, log but allow request (fail open)
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

