import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
const auditLogPath = path.join(logsDir, 'audit.log');
const errorLogPath = path.join(logsDir, 'error.log');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Centralized audit logging system for security and compliance.
 * 
 * Supports:
 * - STRIDE category: Repudiation - Provides non-repudiable audit trail of user actions
 * - OWASP: Security Logging & Monitoring Failures - Ensures security events are logged
 * 
 * Security Notes:
 * - Audit log file should be treated as append-only for integrity
 * - Never logs sensitive data (passwords, tokens, API keys, full card numbers)
 * - Logs are written synchronously to ensure no data loss
 * - Failures in logging do not crash the application
 * 
 * @param {Object} params - Audit log parameters
 * @param {string|null} params.userId - User ID if known, otherwise null
 * @param {string|null} params.role - User role: "BUYER", "SALES_REP", "ADMIN", "GUEST", or null
 * @param {string} params.action - Action identifier (e.g., "LOGIN_SUCCESS", "CREATE_QUOTATION")
 * @param {string|null} params.resourceId - Generic resource identifier (e.g., item ID, quotation DB ID)
 * @param {string|null} params.quotationRequestId - Unique ID when buyer requests a quotation
 * @param {string|null} params.quotationId - Business ID for quotation (reference number)
 * @param {string} params.status - Status: "SUCCESS", "FAILED_AUTH", "FAILED_VALIDATION", "FAILED_BUSINESS_RULE", "FAILED_CONCURRENCY", "ERROR"
 * @param {string|null} params.clientIp - Client IP address
 * @param {string|null} params.details - Short text with non-sensitive context
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

    // Write as JSON line (append-only)
    const logLine = JSON.stringify(auditEntry) + '\n';
    
    fs.appendFileSync(auditLogPath, logLine, { encoding: 'utf8' });
  } catch (error) {
    // Do not crash the application if logging fails
    console.error('[AUDIT LOGGER ERROR] Failed to write audit log:', error.message);
  }
};

/**
 * Logs errors with context for debugging and security monitoring.
 * 
 * @param {Error} error - Error object
 * @param {Object} context - Additional context (action, userId, quotationId, etc.)
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

    // Write as JSON line
    const logLine = JSON.stringify(errorEntry) + '\n';
    
    fs.appendFileSync(errorLogPath, logLine, { encoding: 'utf8' });
  } catch (logError) {
    // Fallback to console if file logging fails
    console.error('[ERROR LOGGER ERROR] Failed to write error log:', logError.message);
    console.error('Original error:', error);
  }
};

/**
 * Helper function to get client IP from request
 * @param {Object} req - Express request object
 * @returns {string|null} - Client IP address
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
 * Maps internal roles to standardized audit log roles
 * @param {string} role - Internal role (admin, customer, employee)
 * @returns {string} - Standardized role (ADMIN, BUYER, SALES_REP, GUEST)
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

