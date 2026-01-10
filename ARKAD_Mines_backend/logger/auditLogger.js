import { fileURLToPath } from 'url';
import AuditLog from '../Models/AuditLog/auditLogModel.js';

// --- REMOVED FS (File System) imports to prevent crashes on Vercel ---
// import fs from 'fs';
// import path from 'path';

/**
 * Centralized audit logging system for security and compliance.
 * IMMUTABLE AUDIT TRAIL: All logs are stored in database and cannot be modified or deleted.
 * These logs form a non-repudiation trail for security-critical actions.
 * 
 * Data integrity is protected by:
 * - HTTPS/TLS encryption in transit (prevents tampering during transmission)
 * - Database-level immutability constraints (prevents modification/deletion)
 * - Server-side validation and authorization
 * 
 * For Vercel/deployment: Database storage ensures logs persist across deployments.
 */
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
  requestPayload = null, // Full request payload for non-repudiation
  details = null
}) => {
  try {
    // Sanitize request payload to remove sensitive information before logging
    let sanitizedPayload = null;
    if (requestPayload) {
      sanitizedPayload = { ...requestPayload };
      // Remove password fields (don't log actual passwords)
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
      userAgent: userAgent ? userAgent.substring(0, 500) : null, // Limit length for storage
      requestPayload: sanitizedPayload, // Store sanitized request payload
      details
    };

    // Store in database for immutable audit trail (non-repudiation)
    try {
      const auditLog = new AuditLog(auditEntry);
      await auditLog.save();
      
      // Also log to console for immediate visibility (Vercel/deployment logs)
      console.log('[AUDIT LOG]:', JSON.stringify({
        ...auditEntry,
        timestamp: auditEntry.timestamp.toISOString()
      }));
    } catch (dbError) {
      // If database save fails, still log to console as fallback
      console.error('[AUDIT LOG DB ERROR]:', dbError.message);
      console.log('[AUDIT LOG FALLBACK]:', JSON.stringify({
        ...auditEntry,
        timestamp: auditEntry.timestamp.toISOString()
      }));
      
      // In production, you might want to alert administrators about audit log failures
      // For now, we log to console as fallback to ensure we don't lose audit information
    }
    
  } catch (error) {
    // Even if audit logging fails completely, log the error
    console.error('[AUDIT LOGGER ERROR] Failed to log audit entry:', error.message);
    console.error('[AUDIT LOGGER ERROR] Stack:', error.stack);
  }
};

/**
 * Logs errors with context for debugging and security monitoring.
 */
export const logError = (error, context = {}) => {
  try {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message || String(error),
      stack: error.stack || null,
      ...context
    };

    // FIX: Use console.error instead of fs.appendFileSync
    console.error('[SYSTEM ERROR]:', JSON.stringify(errorEntry));
    
  } catch (logError) {
    console.error('[ERROR LOGGER ERROR] Failed to log error:', logError.message);
  }
};

/**
 * Helper function to get client IP from request
 */
export const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         null;
};

/**
 * Helper function to get user agent from request
 */
export const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'Unknown';
};

/**
 * Helper function to normalize user role for logging
 */
export const normalizeRole = (role) => {
  if (!role) return 'GUEST';
  
  const roleMap = {
    'admin': 'ADMIN',
    'customer': 'BUYER',
    'employee': 'SALES_REP'
  };
  
  return roleMap[role.toLowerCase()] || 'GUEST';
};