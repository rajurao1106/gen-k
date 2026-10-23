import mongoose from "mongoose";

const referralRewardSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    referredPhoneHash: { type: String, required: true, unique: true },
    rewardedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ReferralReward =
  mongoose.models.ReferralReward || mongoose.model("ReferralReward", referralRewardSchema);

export default ReferralReward;
