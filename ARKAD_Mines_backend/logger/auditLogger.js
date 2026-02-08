import { fileURLToPath } from 'url';
import AuditLog from '../Models/AuditLog/auditLogModel.js';

// Writes audit entry to DB (redacts passwords); used for security and compliance.
export const logAudit = async ({
  userId = null,
  role = null,
  action,
  resourceId = null,
  quotationRequestId = null,
  quotationId = null,
  status,
  clientIp = null,
  userAgent = null,
  requestPayload = null,
  details = null
}) => {
  try {
    let sanitizedPayload = null;
    if (requestPayload) {
      sanitizedPayload = { ...requestPayload };
      if (sanitizedPayload.passwordConfirmation) {
        sanitizedPayload.passwordConfirmation = '[REDACTED]';
      }
      if (sanitizedPayload.password) {
        sanitizedPayload.password = '[REDACTED]';
      }
    }

    const auditEntry = {
      timestamp: new Date(),
      userId: userId ? (typeof userId === 'string' ? userId : userId.toString()) : null,
      role: role ? role.toUpperCase() : null,
      action,
      resourceId: resourceId ? (typeof resourceId === 'string' ? resourceId : resourceId.toString()) : null,
      quotationRequestId,
      quotationId,
      status,
      clientIp,
      userAgent: userAgent ? userAgent.substring(0, 500) : null,
      requestPayload: sanitizedPayload,
      details
    };

    try {
      const auditLog = new AuditLog(auditEntry);
      await auditLog.save();
      
      console.log('[AUDIT LOG]:', JSON.stringify({
        ...auditEntry,
        timestamp: auditEntry.timestamp.toISOString()
      }));
    } catch (dbError) {
      console.error('[AUDIT LOG DB ERROR]:', dbError.message);
      console.log('[AUDIT LOG FALLBACK]:', JSON.stringify({
        ...auditEntry,
        timestamp: auditEntry.timestamp.toISOString()
      }));
    }
    
  } catch (error) {
    console.error('[AUDIT LOGGER ERROR] Failed to log audit entry:', error.message);
    console.error('[AUDIT LOGGER ERROR] Stack:', error.stack);
  }
};

// Logs error and optional context to console for debugging and monitoring.
export const logError = (error, context = {}) => {
  try {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message || String(error),
      stack: error.stack || null,
      ...context
    };

    console.error('[SYSTEM ERROR]:', JSON.stringify(errorEntry));
    
  } catch (logError) {
    console.error('[ERROR LOGGER ERROR] Failed to log error:', logError.message);
  }
};

// Resolves client IP from x-forwarded-for, x-real-ip, or socket.
export const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         null;
};

// Returns request User-Agent or 'Unknown'.
export const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'Unknown';
};

// Maps role string to normalized value (ADMIN, BUYER, SALES_REP, GUEST).
export const normalizeRole = (role) => {
  if (!role) return 'GUEST';
  
  const roleMap = {
    'admin': 'ADMIN',
    'customer': 'BUYER',
    'employee': 'SALES_REP'
  };
  
  return roleMap[role.toLowerCase()] || 'GUEST';
};