import { RateLimitTracking } from "./rateLimitModel.js";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import axios from "axios";

const verifyCaptcha = async (captchaToken) => {
  if (!captchaToken) return false;
  try {
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: captchaToken
        }
      }
    );
    return response.data.success === true;
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    return false;
  }
};

export const createCaptchaChallenge = ({
  endpoint,
  windowMs = 60 * 60 * 1000,
  requestThreshold = 3,
  actionName = 'CAPTCHA_REQUIRED'
}) => {
  return async (req, res, next) => {
    const rawIdentifier = req.user?.id || getClientIp(req);
    const rawType = req.user?.id ? 'user' : 'ip';
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);
    const rawEndpoint = endpoint;

    // Sanitize inputs to prevent NoSQL injection
    const identifier = String(rawIdentifier || '').trim();
    const type = rawType === 'user' ? 'user' : 'ip';
    const normalizedEndpoint = String(rawEndpoint || '').trim();

    try {
      let tracking = await RateLimitTracking.findOne({
        identifier,
        type,
        endpoint: normalizedEndpoint
      });

      const windowStart = new Date(Date.now() - windowMs);
      
      if (!tracking || new Date(tracking.windowStart) < windowStart) {
        tracking = await RateLimitTracking.findOneAndUpdate(
          { identifier, type, endpoint: normalizedEndpoint },
          {
            identifier: identifier,
            type: type,
            endpoint: normalizedEndpoint,
            requestCount: 1,
            windowStart: new Date(),
            lastRequest: new Date()
          },
          { upsert: true, new: true }
        );
      } else {
        tracking.requestCount = (tracking.requestCount || 0) + 1;
        tracking.lastRequest = new Date();
        await tracking.save();
      }

      const requestCount = tracking.requestCount || 0;

      if (requestCount >= requestThreshold) {
        const captchaToken = req.body?.captchaToken || req.query?.captchaToken;

        if (!captchaToken) {
          await logAudit({
            userId: req.user?.id || null,
            role: normalizeRole(req.user?.role),
            action: actionName,
            status: 'FAILED_VALIDATION',
            resourceId: normalizedEndpoint,
            clientIp,
            userAgent,
            details: `CAPTCHA required after ${requestCount} requests`
          });

          return res.status(403).json({
            success: false,
            requiresCaptcha: true,
            message: "CAPTCHA verification required. Please complete the CAPTCHA and try again."
          });
        }

        const isValid = await verifyCaptcha(captchaToken);
        if (!isValid) {
          tracking.captchaAttempts = (tracking.captchaAttempts || 0) + 1;
          await tracking.save();

          await logAudit({
            userId: req.user?.id || null,
            role: normalizeRole(req.user?.role),
            action: actionName,
            status: 'FAILED_VALIDATION',
            resourceId: normalizedEndpoint,
            clientIp,
            userAgent,
            details: `CAPTCHA verification failed`
          });

          return res.status(403).json({
            success: false,
            requiresCaptcha: true,
            message: "CAPTCHA verification failed. Please try again."
          });
        }

        tracking.captchaAttempts = 0;
        tracking.requestCount = 0;
        tracking.windowStart = new Date();
        await tracking.save();
      }

      next();
    } catch (error) {
      console.error("Error in CAPTCHA challenge:", error);
      next();
    }
  };
};
