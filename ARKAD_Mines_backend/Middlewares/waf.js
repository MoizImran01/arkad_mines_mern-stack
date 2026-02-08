import { getClientIp, getUserAgent, logAudit, normalizeRole } from "../logger/auditLogger.js";
import { RateLimitTracking } from "./rateLimitModel.js";

// Checks user-agent, query, body, and path for common attack patterns.
const detectMaliciousPatterns = (req) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const suspiciousPatterns = [];

  const maliciousUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /hydra/i,
    /python-requests/i,
    /curl/i,
    /wget/i,
    /scanner/i,
    /bot/i,
    /crawler/i,
    /spider/i,
    /^$/
  ];

  if (maliciousUserAgents.some(pattern => pattern.test(userAgent))) {
    suspiciousPatterns.push(`Suspicious User-Agent: ${userAgent}`);
  }

  const queryString = JSON.stringify(req.query);
  const sqlInjectionPatterns = [
    /('|(\\')|(;)|(\\;)|(\*)|(\/\*)|(\))|(--))/i,
    /union.*select/i,
    /drop.*table/i,
    /insert.*into/i,
    /delete.*from/i,
    /update.*set/i,
    /exec.*\(/i,
    /xp_cmdshell/i
  ];

  if (sqlInjectionPatterns.some(pattern => pattern.test(queryString))) {
    suspiciousPatterns.push('Potential SQL injection in query parameters');
  }

  const bodyString = JSON.stringify(req.body);
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  if (xssPatterns.some(pattern => pattern.test(bodyString))) {
    suspiciousPatterns.push('Potential XSS in request body');
  }

  const pathPatterns = [
    /\.\.\//g,
    /\.\.\\/g,
    /etc\/passwd/i,
    /proc\/self/i,
    /windows\/system32/i
  ];

  if (pathPatterns.some(pattern => pattern.test(req.path))) {
    suspiciousPatterns.push('Potential path traversal attack');
  }

  return suspiciousPatterns;
};

// Blocks requests with malicious patterns or too many failed CAPTCHA attempts; logs and 403.
export const wafProtection = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;

  try {
    const suspiciousPatterns = detectMaliciousPatterns(req);

    if (suspiciousPatterns.length > 0) {
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'WAF_BLOCKED',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          query: req.query,
          bodyKeys: req.body ? Object.keys(req.body) : []
        },
        details: `Malicious traffic detected: ${suspiciousPatterns.join('; ')}`
      });

      return res.status(403).json({
        success: false,
        message: "Request blocked: Suspicious activity detected. If you believe this is an error, please contact support.",
        blocked: true,
        reason: 'WAF_FILTER'
      });
    }

    const safe_ip_address = String(clientIp || '').trim();
    const safe_endpoint = String(req.path || '').trim();

    const failedAttempts = await RateLimitTracking.findOne({
      identifier: safe_ip_address,
      type: 'ip',
      endpoint: safe_endpoint,
      captchaAttempts: { $gte: 5 }
    });

    if (failedAttempts) {
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'WAF_BLOCKED_FAILED_ATTEMPTS',
        status: 'FAILED_VALIDATION',
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path
        },
        details: `Blocked due to excessive failed CAPTCHA attempts from IP: ${clientIp}`
      });

      return res.status(403).json({
        success: false,
        message: "Request blocked: Too many failed verification attempts from your IP address. Please try again later.",
        blocked: true,
        reason: 'EXCESSIVE_FAILED_ATTEMPTS'
      });
    }

    next();
  } catch (error) {
    await logAudit({
      userId: userId || null,
      role: normalizeRole(req.user?.role),
      action: 'WAF_ERROR',
      status: 'ERROR',
      clientIp,
      userAgent,
      details: `Error in WAF: ${error.message}`
    });
    next();
  }
};
