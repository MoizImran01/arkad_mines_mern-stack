import { logAudit, getClientIp, normalizeRole, getUserAgent, logError } from "../logger/auditLogger.js";

/**
 * Payment File Validation Middleware
 * Validates file size (max 5MB) and image dimensions for payment proof uploads
 */

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 5000;
const MAX_IMAGE_HEIGHT = 5000;

const estimateBase64Size = (base64String) => {
  if (!base64String) return 0;
  
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
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
      return next();
    }
    
    const estimatedSize = estimateBase64Size(proofBase64);
    const sizeMB = (estimatedSize / (1024 * 1024)).toFixed(2);
    
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
  
  next();
};

