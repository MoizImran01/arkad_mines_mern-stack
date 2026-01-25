import mongoose from "mongoose";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";

/**
 * Session Activity Schema - Track user sessions for anomaly detection
 */
const sessionActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
    index: true
  },
  lastIpAddress: {
    type: String,
    required: true
  },
  lastUserAgent: {
    type: String,
    required: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  deviceFingerprint: {
    type: String,
    default: null
  },
  knownIps: [{
    ip: String,
    firstSeen: Date,
    lastSeen: Date,
    count: { type: Number, default: 1 }
  }]
}, {
  timestamps: true
});

// Compound index for efficient lookups
sessionActivitySchema.index({ userId: 1, lastActivity: -1 });

const SessionActivity = mongoose.models.SessionActivity || mongoose.model("SessionActivity", sessionActivitySchema);

/**
 * Get or create session activity record for user
 */
const getOrCreateSessionActivity = async (userId) => {
  let sessionActivity = await SessionActivity.findOne({ userId });
  
  if (!sessionActivity) {
    sessionActivity = new SessionActivity({
      userId,
      lastIpAddress: '',
      lastUserAgent: '',
      knownIps: []
    });
  }
  
  return sessionActivity;
};

/**
 * Anomaly Detection Middleware
 * Monitors for suspicious activity patterns like:
 * - IP address changes
 * - Device/user-agent changes
 * - Rapid approval actions from unusual locations
 */
export const detectAnomalies = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;
  const quoteId = req.params.quoteId || req.analyticsAnomalyContext?.resourceId;

  if (!userId) {
    // Skip anomaly detection if user is not authenticated
    return next();
  }

  try {
    const sessionActivity = await getOrCreateSessionActivity(userId);
    const currentIp = clientIp || 'Unknown';
    const truncatedUserAgent = userAgent.substring(0, 200); // Limit length
    
    let isAnomalous = false;
    let anomalyDetails = [];

    // Check 1: IP Address Change Detection
    if (sessionActivity.lastIpAddress && sessionActivity.lastIpAddress !== currentIp) {
      // Check if this IP is known for this user
      const knownIp = sessionActivity.knownIps.find(ip => ip.ip === currentIp);
      
      if (!knownIp) {
        // New IP address - potential anomaly
        isAnomalous = true;
        anomalyDetails.push(`New IP address detected: ${currentIp} (previous: ${sessionActivity.lastIpAddress})`);
        
        // Add to known IPs
        sessionActivity.knownIps.push({
          ip: currentIp,
          firstSeen: new Date(),
          lastSeen: new Date(),
          count: 1
        });
      } else {
        // Known IP, update stats
        knownIp.lastSeen = new Date();
        knownIp.count += 1;
      }
    } else if (!sessionActivity.lastIpAddress) {
      // First time tracking - add current IP
      sessionActivity.lastIpAddress = currentIp;
      sessionActivity.knownIps.push({
        ip: currentIp,
        firstSeen: new Date(),
        lastSeen: new Date(),
        count: 1
      });
    }

    // Check 2: User Agent Change Detection
    if (sessionActivity.lastUserAgent && sessionActivity.lastUserAgent !== truncatedUserAgent) {
      isAnomalous = true;
      anomalyDetails.push(`User-Agent change detected. Previous: ${sessionActivity.lastUserAgent.substring(0, 50)}...`);
    }

    // Check 3: Rapid Activity Detection (multiple approvals in short time)
    const timeSinceLastActivity = sessionActivity.lastActivity 
      ? (new Date() - sessionActivity.lastActivity) / 1000 // seconds
      : Infinity;
    
    // If multiple approvals within 60 seconds, flag as potential anomaly
    // Or rapid analytics access within 10 seconds
    if (req.path.includes('/approve') && timeSinceLastActivity < 60) {
      isAnomalous = true;
      anomalyDetails.push(`Rapid approval activity detected: ${timeSinceLastActivity.toFixed(1)}s since last activity`);
    } else if (req.path.includes('/analytics') && timeSinceLastActivity < 10) {
      isAnomalous = true;
      anomalyDetails.push(`Rapid analytics access: ${timeSinceLastActivity.toFixed(1)}s since last request`);
    }

    // Update session activity
    sessionActivity.lastIpAddress = currentIp;
    sessionActivity.lastUserAgent = truncatedUserAgent;
    sessionActivity.lastActivity = new Date();
    await sessionActivity.save();

    // Log anomaly if detected
    if (isAnomalous) {
      const actionName = req.analyticsAnomalyContext?.actionPrefix 
        ? `${req.analyticsAnomalyContext.actionPrefix}_ANOMALY_DETECTED`
        : 'ANOMALY_DETECTED';
      const resourceId = req.analyticsAnomalyContext?.resourceId || quoteId;

      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: actionName,
        status: 'WARNING',
        resourceId,
        quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
        quotationId: req.validatedQuotation?.referenceNumber || null,
        clientIp: currentIp,
        userAgent: truncatedUserAgent,
        requestPayload: req.analyticsAnomalyContext 
          ? { path: req.path }
          : { quoteId, comment: req.body?.comment || null },
        details: `Anomalous activity detected: ${anomalyDetails.join('; ')}`
      });
      
      // For high-risk anomalies (new IP + user agent change), we could require additional verification
      // For now, we just log and allow the request to proceed (re-auth middleware will handle additional security)
      // In production, you might want to trigger additional security challenges here
    }

    // Store anomaly flag in request for downstream middleware/handlers
    req.sessionAnomaly = {
      isAnomalous,
      details: anomalyDetails,
      currentIp,
      userAgent: truncatedUserAgent
    };

    next();
  } catch (error) {
    // Don't block the request if anomaly detection fails, but log it
    await logAudit({
      userId,
      role: normalizeRole(req.user?.role),
      action: req.analyticsAnomalyContext?.actionPrefix 
        ? `${req.analyticsAnomalyContext.actionPrefix}_ANOMALY_DETECTION_ERROR`
        : 'ANOMALY_DETECTION_ERROR',
      status: 'ERROR',
      resourceId: req.analyticsAnomalyContext?.resourceId || req.params.quoteId,
      quotationRequestId: req.validatedQuotation?.quotationRequestId || null,
      quotationId: req.validatedQuotation?.referenceNumber || null,
      clientIp,
      userAgent: getUserAgent(req),
      requestPayload: req.analyticsAnomalyContext 
        ? { path: req.path }
        : { quoteId: req.params.quoteId, comment: req.body?.comment || null },
      details: `Error in anomaly detection: ${error.message}`
    });
    
    // Continue with request even if anomaly detection fails
    next();
  }
};

export { SessionActivity };

