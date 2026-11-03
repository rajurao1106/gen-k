import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Phone is now optional: email/Google users do not have one.
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    firebaseUid: { type: String, unique: true, sparse: true },
    name: { type: String, trim: true, default: "" },
    authProvider: { type: String, default: "" },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastLoginAt: { type: Date, default: null },
    paymentRevision: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;