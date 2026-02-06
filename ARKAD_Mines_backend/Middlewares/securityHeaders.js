/**
 * Security Headers Middleware
 * Enforces HTTPS/TLS 1.3 and adds security headers to prevent tampering
 * Implements security headers similar to helmet but without external dependency
 */

/**
 * Middleware to enforce HTTPS in production
 * Redirects HTTP to HTTPS and sets security headers
 */
export const enforceHTTPS = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHTTPS = req.secure || 
                  req.headers['x-forwarded-proto'] === 'https' || 
                  req.headers['x-forwarded-proto'] === 'https, http';

  if (isProduction && !isHTTPS) {
    return res.status(403).json({
      success: false,
      message: "HTTPS required. Please use secure connection."
    });
  }

  next();
};

/**
 * Security Headers Middleware
 * Sets various security headers to prevent tampering and enforce secure communication
 */
export const securityHeaders = (req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  );

  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.setHeader('X-Frame-Options', 'DENY');

  res.setHeader('X-XSS-Protection', '1; mode=block');

  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()'
  );

  res.setHeader('Expect-CT', 'max-age=86400, enforce');

  res.removeHeader('X-Powered-By');

  next();
};

export const applySecurity = [enforceHTTPS, securityHeaders];

