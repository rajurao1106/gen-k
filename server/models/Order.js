import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    planId: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "INR" },
    provider: {
      type: String,
      required: true,
      enum: ["demo", "razorpay"],
      default: "demo",
    },
    providerOrderId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
      index: true,
    },
    providerPaymentId: { type: String, default: "" },
    signature: { type: String, default: "" },
    anonymizedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;
