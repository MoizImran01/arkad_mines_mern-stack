import jwt from "jsonwebtoken";
import { logAudit, getClientIp, normalizeRole } from "../logger/auditLogger.js";

// Verifies JWT from Authorization header and sets req.user.
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
  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; 

    next();
  } catch (err) {
    logAudit({
      userId: null,
      role: 'GUEST',
      action: 'AUTH_TOKEN_VERIFY',
      status: 'FAILED_AUTH',
      clientIp,
      details: `Token verification failed: ${err.name}`
    });

    res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Restricts access to routes by role; responds 403 if req.user.role not in allowedRoles.
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