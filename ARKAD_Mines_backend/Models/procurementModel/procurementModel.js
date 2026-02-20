import mongoose from "mongoose";

const procurementSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true }, // e.g., PO-2026-001
    supplierName: { type: String, required: true }, // Name of the quarry/mine
    // Support both single stone (legacy) and multiple stones
    stoneDetails: {
      stoneId: { type: mongoose.Schema.Types.ObjectId, ref: "stones" },
      stoneName: { type: String, required: false },
      category: { type: String, required: false },
      subcategory: { type: String, required: false }
    },
    // New: array of stones for multi-stone POs
    stones: [{
      stoneId: { type: mongoose.Schema.Types.ObjectId, ref: "stones" },
      stoneName: { type: String, required: true },
      category: { type: String, required: true },
      subcategory: { type: String, required: true },
      quantityOrdered: { type: Number, required: true },
      pricePerTon: { type: Number, required: true },
      suggestedQuantity: { type: Number } // From reorder point
    }],
    // Legacy fields (for backward compatibility)
    quantityOrdered: { type: Number, required: false },
    pricePerTon: { type: Number, required: false },
    totalCost: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date },
    actualDeliveryDate: { type: Date }, // Used to calculate REAL lead time!
    status: {
      type: String,
      enum: ["draft", "sent_to_supplier", "in_transit", "received", "cancelled"],
      default: "draft"
    },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

const procurementModel = mongoose.models.procurement || mongoose.model("procurement", procurementSchema);

export default procurementModel;