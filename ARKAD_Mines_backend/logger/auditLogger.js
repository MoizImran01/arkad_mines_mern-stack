import { fileURLToPath } from 'url';

// --- REMOVED FS (File System) imports to prevent crashes on Vercel ---
// import fs from 'fs';
// import path from 'path';

/**
 * Centralized audit logging system for security and compliance.
 * MODIFIED FOR VERCEL: Now logs to Console (Standard Output) instead of a physical file.
 */
export const logAudit = ({
  userId = null,
  role = null,
  action,
  resourceId = null,
  quotationRequestId = null,
  quotationId = null,
  status,
  clientIp = null,
  details = null
}) => {
  try {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      userId,
      role: role ? role.toUpperCase() : null,
      action,
      resourceId,
      quotationRequestId,
      quotationId,
      status,
      clientIp,
      details
    };

    // FIX: Use console.log instead of fs.appendFileSync
    // Vercel captures this automatically in the "Runtime Logs" tab.
    console.log('[AUDIT LOG]:', JSON.stringify(auditEntry));
    
  } catch (error) {
    console.error('[AUDIT LOGGER ERROR] Failed to log audit entry:', error.message);
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