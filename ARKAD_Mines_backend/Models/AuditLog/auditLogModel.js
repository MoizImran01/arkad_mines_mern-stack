import mongoose from "mongoose";

/**
 * Audit Log Schema - Immutable audit trail for non-repudiation
 * These logs should NEVER be modified or deleted once created
 * They form a permanent record of all security-critical actions
 * 
 * Data integrity is protected by:
 * - HTTPS/TLS encryption in transit
 * - Database-level immutability constraints
 * - Server-side validation and authorization
 */
const auditLogSchema = new mongoose.Schema({
  // Timestamp - ISO 8601 format
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: false,
    index: true
  },
  role: {
    type: String,
    enum: ["ADMIN", "BUYER", "SALES_REP", "GUEST"],
    required: false
  },
  
  // Action details
  action: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ["SUCCESS", "FAILED_AUTH", "FAILED_VALIDATION", "FAILED_BUSINESS_RULE", "ERROR", "WARNING"],
    index: true
  },
  
  // Resource identifiers
  resourceId: {
    type: String,
    required: false,
    index: true
  },
  quotationRequestId: {
    type: String,
    required: false,
    index: true
  },
  quotationId: {
    type: String,
    required: false,
    index: true
  },
  
  // Network and device information
  clientIp: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false,
    maxlength: 500
  },
  
  // Full request payload (for non-repudiation)
  requestPayload: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  
  // Detailed information
  details: {
    type: String,
    required: false
  }
}, {
  timestamps: false, // Don't use mongoose timestamps, we use our own timestamp field
  collection: 'auditlogs'
});

// Compound indexes for efficient queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ quotationId: 1, timestamp: -1 });
auditLogSchema.index({ quotationRequestId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 }); // For time-based queries

// Pre-save hook: Ensure timestamp is set and prevent modifications
auditLogSchema.pre('save', function(next) {
  if (this.isNew) {
    // Ensure timestamp is set
    if (!this.timestamp) {
      this.timestamp = new Date();
    }
  } else {
    // Prevent modifications to existing audit logs
    throw new Error('Audit logs are immutable and cannot be modified after creation');
  }
  next();
});

// Prevent updates and deletes (immutability enforcement)
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'findOneAndDelete', 'deleteMany'], function() {
  throw new Error('Audit logs are immutable and cannot be modified or deleted');
});

// Create model
const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;

