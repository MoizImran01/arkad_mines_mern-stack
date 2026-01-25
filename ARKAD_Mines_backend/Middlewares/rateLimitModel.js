import mongoose from "mongoose";

const rateLimitTrackingSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['user', 'ip'],
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  requestCount: {
    type: Number,
    default: 0
  },
  captchaAttempts: {
    type: Number,
    default: 0
  },
  lastRequest: {
    type: Date,
    default: Date.now
  },
  windowStart: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

rateLimitTrackingSchema.index({ identifier: 1, type: 1, endpoint: 1 });
rateLimitTrackingSchema.index({ windowStart: 1 }, { expireAfterSeconds: 3600 });

export const RateLimitTracking = mongoose.models.RateLimitTracking || 
  mongoose.model("RateLimitTracking", rateLimitTrackingSchema);
