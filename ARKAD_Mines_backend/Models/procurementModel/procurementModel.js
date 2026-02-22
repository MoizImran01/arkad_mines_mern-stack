import mongoose from "mongoose";

const procurementSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true }, 
    supplierName: { type: String, required: true },
    stoneDetails: {
      stoneId: { type: mongoose.Schema.Types.ObjectId, ref: "stones" },
      stoneName: { type: String, required: false },
      category: { type: String, required: false },
      subcategory: { type: String, required: false }
    },
    stones: [{
      stoneId: { type: mongoose.Schema.Types.ObjectId, ref: "stones" },
      stoneName: { type: String, required: true },
      category: { type: String, required: true },
      subcategory: { type: String, required: true },
      quantityOrdered: { type: Number, required: true },
      pricePerTon: { type: Number, required: true },
      suggestedQuantity: { type: Number } 
    }],
    quantityOrdered: { type: Number, required: false },
    pricePerTon: { type: Number, required: false },
    totalCost: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date },
    actualDeliveryDate: { type: Date },
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