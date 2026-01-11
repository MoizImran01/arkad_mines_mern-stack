import { getClientIp, getUserAgent, logAudit, normalizeRole } from "../logger/auditLogger.js";
import { RateLimitTracking } from "./rateLimiting.js";

/**
 * Web Application Firewall (WAF) Middleware
 * Detects and filters malicious traffic patterns
 * Prevents common attack vectors
 */

/**
 * Check for suspicious request patterns
 */
const detectMaliciousPatterns = (req) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const suspiciousPatterns = [];

  // Pattern 1: Suspicious User-Agent strings (bots, scanners, tools)
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
    /^$/ // Empty user agent
  ];

  if (maliciousUserAgents.some(pattern => pattern.test(userAgent))) {
    suspiciousPatterns.push(`Suspicious User-Agent: ${userAgent}`);
  }

  // Pattern 2: Suspicious query parameters (SQL injection patterns)
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

  // Pattern 3: Suspicious body content (SQL injection, XSS patterns)
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

  // Pattern 4: Suspicious path patterns (path traversal, directory listing)
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

  // Pattern 5: Rapid requests from same IP (DoS pattern)
  // This will be checked separately in rate limiting

  return suspiciousPatterns;
};

/**
 * WAF Middleware
 * Filters malicious traffic patterns
 */
export const wafProtection = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;

  try {
    // Detect malicious patterns
    const suspiciousPatterns = detectMaliciousPatterns(req);

    if (suspiciousPatterns.length > 0) {
      // Log the suspicious activity
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

      // Block the request
      return res.status(403).json({
        success: false,
        message: "Request blocked: Suspicious activity detected. If you believe this is an error, please contact support.",
        blocked: true,
        reason: 'WAF_FILTER'
      });
    }

    // Check for too many failed attempts from same IP
    const failedAttempts = await RateLimitTracking.findOne({
      identifier: clientIp,
      type: 'ip',
      endpoint: req.path,
      captchaAttempts: { $gte: 5 } // 5 or more failed CAPTCHA attempts
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
    // If WAF fails, log but allow request (fail open to prevent DoS of WAF itself)
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

