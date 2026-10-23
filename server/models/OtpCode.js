import mongoose from "mongoose";

const otpCodeSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  attempts: { type: Number, required: true, default: 0 },
});

const OtpCode = mongoose.models.OtpCode || mongoose.model("OtpCode", otpCodeSchema);

export default OtpCode;
