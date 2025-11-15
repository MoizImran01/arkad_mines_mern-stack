import mongoose from "mongoose";

const quotationItemSchema = new mongoose.Schema(
  {
    stone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "stones",
      required: true,
    },
    stoneName: {
      type: String,
      required: true,
    },
    priceSnapshot: {
      type: Number,
      required: true,
    },
    priceUnit: {
      type: String,
      required: true,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    availabilityAtRequest: {
      type: String,
    },
    image: {
      type: String,
    },
    dimensions: {
      type: String,
    },
    category: {
      type: String,
    },
    subcategory: {
      type: String,
    },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "adjustment_required"],
      default: "draft",
    },
    notes: {
      type: String,
      trim: true,
    },
    items: {
      type: [quotationItemSchema],
      validate: [(items) => items.length > 0, "At least one item required"],
    },
    totalEstimatedCost: {
      type: Number,
      default: 0,
    },
    validity: {
      start: {
        type: Date,
        required: true,
      },
      end: {
        type: Date,
        required: true,
      },
    },
    adjustments: [
      {
        stoneId: String,
        stoneName: String,
        reason: String,
        availableQuantity: Number,
        type: {
          type: String,
          enum: ["removed", "adjusted"],
        },
      },
    ],
  },
  { timestamps: true }
);

const quotationModel =
  mongoose.models.quotation || mongoose.model("quotation", quotationSchema);

export default quotationModel;

