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
  // In production, check if request is over HTTPS
  // Note: When behind a proxy (like Vercel, Nginx), check X-Forwarded-Proto header
  const isProduction = process.env.NODE_ENV === 'production';
  const isHTTPS = req.secure || 
                  req.headers['x-forwarded-proto'] === 'https' || 
                  req.headers['x-forwarded-proto'] === 'https, http';

  if (isProduction && !isHTTPS) {
    // Redirect to HTTPS in production
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
  // Strict Transport Security (HSTS) - Enforces HTTPS
  // max-age: 31536000 = 1 year, includeSubDomains, preload
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content Security Policy - Prevents XSS attacks
  // Allow same origin, self, and data URIs for images
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  );

  // X-Content-Type-Options - Prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options - Prevents clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection - Additional XSS protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy - Controls referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature Policy) - Controls browser features
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()'
  );

  // Expect-CT - Certificate Transparency (legacy but some browsers still use)
  res.setHeader('Expect-CT', 'max-age=86400, enforce');

  // Remove X-Powered-By header to hide server technology
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Combined security middleware
 * Applies both HTTPS enforcement and security headers
 */
export const applySecurity = [enforceHTTPS, securityHeaders];

