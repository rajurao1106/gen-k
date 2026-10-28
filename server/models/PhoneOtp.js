import mongoose from "mongoose";

const phoneOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: false },
);

// MongoDB removes the document automatically once expiresAt has passed.
phoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PhoneOtp = mongoose.models.PhoneOtp || mongoose.model("PhoneOtp", phoneOtpSchema);

export default PhoneOtp;