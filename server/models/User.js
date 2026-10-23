import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastLoginAt: { type: Date, default: null },
    paymentRevision: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
