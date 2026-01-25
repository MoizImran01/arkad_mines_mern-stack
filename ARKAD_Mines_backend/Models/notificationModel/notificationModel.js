import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ["admin", "user"],
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: function () {
        return this.recipientType === "user";
      },
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "payment_submitted",
        "payment_approved",
        "payment_rejected",
        "payment_status_updated",
      ],
      required: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "order" },
    orderNumber: { type: String, trim: true },
    paymentStatus: { type: String, trim: true },
    amount: { type: Number },
    readAt: { type: Date },
    clearedAt: { type: Date },
  },
  { timestamps: true }
);

const notificationModel =
  mongoose.models.notification || mongoose.model("notification", notificationSchema);

export default notificationModel;

