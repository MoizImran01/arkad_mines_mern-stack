import mongoose from "mongoose";

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
    totalPrice: { type: Number, required: true },
    image: { type: String },
    dimensions: { type: String },
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
      enum: ["draft", "confirmed", "processing", "shipped", "delivered", "cancelled"],
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
    deliveryAddress: { type: String, trim: true },
    deliveryNotes: { type: String, trim: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "refunded"],
      default: "pending",
    },
    paymentMethod: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;

