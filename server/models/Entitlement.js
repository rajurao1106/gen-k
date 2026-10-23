import mongoose from "mongoose";

const entitlementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: { type: String, required: true },
    kind: {
      type: String,
      required: true,
      enum: ["subscription", "report", "addon"],
      index: true,
    },
    startsAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, default: null },
    remainingUses: { type: Number, default: null, min: 0 },
    sourceOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true },
);

entitlementSchema.index({ userId: 1, status: 1, kind: 1, expiresAt: 1 });
entitlementSchema.index(
  { sourceOrderId: 1 },
  { unique: true, partialFilterExpression: { sourceOrderId: { $type: "objectId" } } },
);

const Entitlement =
  mongoose.models.Entitlement || mongoose.model("Entitlement", entitlementSchema);

export default Entitlement;
