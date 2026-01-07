import mongoose from "mongoose";

const quotationItemSchema = new mongoose.Schema(
  {
    stone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "stones",
      required: true,
    },
    stoneName: { type: String, required: true },
    priceSnapshot: { type: Number, required: true },
    priceUnit: { type: String, required: true },
    requestedQuantity: { type: Number, required: true, min: 1 },
    availabilityAtRequest: { type: String },
    image: { type: String },
    dimensions: { type: String },

    finalUnitPrice: { type: Number }, 
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    referenceNumber: { type: String, required: true, unique: true },
    

    orderNumber: { type: String }, 

    quotationRequestId: { type: String, unique: true, sparse: true }, 
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },

    status: {
      type: String,
      enum: ["draft", "submitted", "adjustment_required", "revision_requested", "issued", "approved", "rejected"],
      default: "draft",
    },
    notes: { type: String, trim: true }, 
    adminNotes: { type: String, trim: true }, 
    items: {
      type: [quotationItemSchema],
      validate: [(items) => items.length > 0, "At least one item required"],
    },

    totalEstimatedCost: { type: Number, default: 0 },

    financials: {
      subtotal: { type: Number, default: 0 },
      taxPercentage: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      shippingCost: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },
    
    validity: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    adjustments: [
      {
        stoneId: String,
        stoneName: String,
        reason: String,
        availableQuantity: Number,
        type: { type: String, enum: ["removed", "adjusted"] },
      },
    ],
    buyerDecision: {
      decision: { type: String, enum: ["approved", "rejected"], default: null },
      comment: { type: String, trim: true },
      decisionDate: { type: Date },
    },
  },
  { timestamps: true }
);

const quotationModel = mongoose.models.quotation || mongoose.model("quotation", quotationSchema);

export default quotationModel;