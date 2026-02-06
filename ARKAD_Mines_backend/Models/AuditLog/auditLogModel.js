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
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
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
  
  clientIp: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false,
    maxlength: 500
  },
  
  requestPayload: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  
  details: {
    type: String,
    required: false
  }
}, {
  timestamps: false,
  collection: 'auditlogs'
});

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ quotationId: 1, timestamp: -1 });
auditLogSchema.index({ quotationRequestId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

auditLogSchema.pre('save', function(next) {
  if (this.isNew) {
    if (!this.timestamp) {
      this.timestamp = new Date();
    }
  } else {
    throw new Error('Audit logs are immutable and cannot be modified after creation');
  }
  next();
});

auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'findOneAndDelete', 'deleteMany'], function() {
  throw new Error('Audit logs are immutable and cannot be modified or deleted');
});

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;

