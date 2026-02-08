import mongoose from "mongoose";

// Order item and order schemas: buyer, items, financials, payment proofs, timeline, courier.
const orderItemSchema = new mongoose.Schema(
  {
    stone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "stones",
      required: true,
    },
    stoneName: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    priceUnit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    quantityDispatched: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    image: { type: String },
    dimensions: { type: String },
    dispatchedBlocks: [{
      blockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "stones"
      },
      quantityFromBlock: Number,
      qrCode: String
    }]
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    quotation: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "quotation", 
      required: true 
    },
    buyer: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "user", 
      required: true 
    },
    status: {
      type: String,
      enum: ["draft", "confirmed", "dispatched", "delivered", "cancelled"],
      default: "draft",
    },
    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, "At least one item required"],
    },
    financials: {
      subtotal: { type: Number, default: 0 },
      taxPercentage: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      shippingCost: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phone: String
    },
    deliveryNotes: { type: String, trim: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "payment_in_progress", "fully_paid", "refunded"],
      default: "pending",
    },
    paymentMethod: { type: String, trim: true },
    totalPaid: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    paymentProofs: [
      {
        proofFile: { type: String },
        amountPaid: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
        approvedAt: { type: Date },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "admin" },
        status: { 
          type: String, 
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        },
        notes: { type: String, trim: true }
      }
    ],
    paymentTimeline: [
      {
        action: { 
          type: String, 
          enum: ["payment_submitted", "payment_approved", "payment_rejected"],
          required: true 
        },
        timestamp: { type: Date, default: Date.now },
        amountPaid: { type: Number },
        proofFile: { type: String, trim: true },
        notes: { type: String, trim: true }
      }
    ],
    courierTracking: {
      isDispatched: { type: Boolean, default: false },
      courierService: { type: String, trim: true },
      trackingNumber: { type: String, trim: true },
      dispatchedAt: { type: Date },
      courierLink: { type: String, trim: true },
    },
    timeline: [
      {
        status: { 
          type: String, 
          enum: ["draft", "confirmed", "dispatched", "delivered", "cancelled"],
          required: true 
        },
        timestamp: { type: Date, default: Date.now },
        notes: { type: String, trim: true },
      }
    ],
  },
  { timestamps: true }
);

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;

