import mongoose from "mongoose";

const dailyGuideSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserDetail",
      required: true,
    },
    dayKey: { type: String, required: true },
    content: { type: mongoose.Schema.Types.Mixed, default: null },
    remedy: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["generating", "ready", "failed"],
      default: "generating",
    },
    lockExpiresAt: { type: Date, default: null },
    generationToken: { type: String, default: "" },
    failedAt: { type: Date, default: null },
    errorCode: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

dailyGuideSchema.index(
  { userId: 1, profileId: 1, dayKey: 1 },
  { unique: true },
);
dailyGuideSchema.index({ userId: 1, dayKey: 1 });

const DailyGuide =
  mongoose.models.DailyGuide || mongoose.model("DailyGuide", dailyGuideSchema);

export default DailyGuide;
