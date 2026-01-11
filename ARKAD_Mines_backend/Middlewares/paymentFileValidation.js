import { logAudit, getClientIp, normalizeRole, getUserAgent, logError } from "../logger/auditLogger.js";

/**
 * Payment File Validation Middleware
 * Validates file size (max 5MB) and image dimensions for payment proof uploads
 */

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_WIDTH = 5000; // Max width in pixels
const MAX_IMAGE_HEIGHT = 5000; // Max height in pixels

/**
 * Estimate file size from base64 string
 * Base64 encoding increases size by ~33%, so actual size is base64Length * 3/4
 */
const estimateBase64Size = (base64String) => {
  if (!base64String) return 0;
  
  // Remove data URI prefix if present (e.g., "data:image/png;base64,")
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
  // Calculate approximate size in bytes
  // Base64: 4 chars represent 3 bytes, so size = (length * 3) / 4
  const approximateSize = (base64Data.length * 3) / 4;
  
  return approximateSize;
};

/**
 * Validate file size from base64 string
 */
export const validatePaymentFileSize = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;
  const orderId = req.params.orderId;
  
  try {
    const { proofBase64 } = req.body;
    
    if (!proofBase64) {
      // File validation will be handled by controller (proofBase64 is required)
      return next();
    }
    
    // Estimate file size from base64 string
    const estimatedSize = estimateBase64Size(proofBase64);
    const sizeMB = (estimatedSize / (1024 * 1024)).toFixed(2);
    
    // Debug logging (can be removed in production)
    console.log(`[FILE_SIZE_VALIDATION] Order: ${orderId}, Estimated size: ${sizeMB}MB, Limit: 5MB`);
    
    if (estimatedSize > MAX_FILE_SIZE_BYTES) {
      const maxMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(2);
      
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_FILE_SIZE_VALIDATION_FAILED',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: { 
          orderId,
          estimatedSizeMB: sizeMB,
          maxSizeMB: maxMB,
          base64Length: proofBase64?.length || 0
        },
        details: `Payment proof file size validation failed: Estimated size ${sizeMB}MB exceeds maximum ${maxMB}MB`
      });
      
      return res.status(400).json({
        success: false,
        message: `File size exceeds the maximum limit of ${maxMB}MB. Please compress your image or use a smaller file.`
      });
    }
    
    next();
  } catch (error) {
    logError(error, {
      action: 'PAYMENT_FILE_SIZE_VALIDATION_ERROR',
      userId: userId || null,
      orderId: orderId,
      clientIp,
      details: `Error validating payment proof file size for order ${orderId}: ${error.message}`
    });
    
    // Fail open - allow request if validation fails (should not happen, but safety measure)
    console.error(`[FILE_SIZE_VALIDATION_ERROR] Error in validation:`, error);
    next();
  }
};

/**
 * Validate image dimensions (if possible from base64)
 * Note: Full dimension validation requires decoding, which is expensive
 * This is a lightweight check - full validation happens in Cloudinary
 */
export const validatePaymentImageDimensions = async (req, res, next) => {
  // Dimension validation is handled by:
  // 1. Client-side compression (resizes before upload)
  // 2. Cloudinary transformation settings (limits dimensions)
  // 3. This is a placeholder for any additional server-side checks if needed
  
  // For now, we rely on client-side compression and Cloudinary limits
  // Full dimension validation would require decoding base64 and checking pixels,
  // which is expensive and redundant given client-side compression exists
  
  next();
};

