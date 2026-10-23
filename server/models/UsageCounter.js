import mongoose from "mongoose";

const usageCounterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    key: { type: String, required: true },
    dayKey: { type: String, required: true },
    count: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

usageCounterSchema.index({ userId: 1, key: 1, dayKey: 1 }, { unique: true });

const UsageCounter =
  mongoose.models.UsageCounter || mongoose.model("UsageCounter", usageCounterSchema);

export default UsageCounter;
