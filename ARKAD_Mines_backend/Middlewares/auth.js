import jwt from "jsonwebtoken";
import { logAudit, getClientIp, normalizeRole } from "../logger/auditLogger.js";

//middleware to verify JWT token from authorization header

export const verifyToken = (req, res, next) => {

  const authHeader = req.headers.authorization;
  const clientIp = getClientIp(req);

  if (!authHeader) {
    logAudit({
      userId: null,
      role: 'GUEST',
      action: 'AUTH_TOKEN_VERIFY',
      status: 'FAILED_AUTH',
      clientIp,
      details: 'No token provided'
    });
    return res.status(401).json({ message: "No token provided" });
  }


  const token = authHeader.split(" ")[1];
  
  // Check if JWT_SECRET is configured
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured!");
    logAudit({
      userId: null,
      role: 'GUEST',
      action: 'AUTH_TOKEN_VERIFY',
      status: 'FAILED_AUTH',
      clientIp,
      details: 'JWT_SECRET not configured'
    });
    return res.status(500).json({ message: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    const errorDetails = err.message || err.name || 'Unknown error';
    console.error("Token verification failed:", errorDetails);
    
    logAudit({
      userId: null,
      role: 'GUEST',
      action: 'AUTH_TOKEN_VERIFY',
      status: 'FAILED_AUTH',
      clientIp,
      details: `Token verification failed: ${errorDetails}`
    });

    res.status(403).json({ message: "Invalid or expired token" });
  }
};

export const authorizeRoles = (...allowedRoles) => {

  return (req, res, next) => {
    const clientIp = getClientIp(req);

    if (!allowedRoles.includes(req.user.role)) {
      logAudit({
        userId: req.user?.id,
        role: normalizeRole(req.user?.role),
        action: 'AUTHORIZE_ROLES',
        status: 'FAILED_AUTH',
        clientIp,
        details: `Required roles: ${allowedRoles.join(', ')}, user role: ${req.user.role}`
      });

      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};