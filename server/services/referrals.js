import crypto from "node:crypto";
import User from "../models/User.js";
import Entitlement from "../models/Entitlement.js";
import ReferralReward from "../models/ReferralReward.js";
import { getReferralHashSecret } from "../config/authSecrets.js";

export function hashReferralPhone(phone) {
  return crypto
    .createHmac("sha256", getReferralHashSecret())
    .update(phone)
    .digest("hex");
}

export async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const referralCode = crypto.randomBytes(5).toString("hex").toUpperCase();
    try {
      const updated = await User.findOneAndUpdate(
        { _id: user._id, $or: [{ referralCode: null }, { referralCode: { $exists: false } }] },
        { $set: { referralCode } },
        { new: true },
      ).select("referralCode");
      if (updated?.referralCode) return updated.referralCode;
      const current = await User.findById(user._id).select("referralCode").lean();
      if (current?.referralCode) return current.referralCode;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error("Could not allocate a referral code.");
}

export async function applyReferralReward({ referredUser, referralCode, session }) {
  const normalizedCode =
    typeof referralCode === "string" ? referralCode.trim().toUpperCase() : "";
  if (!normalizedCode) return false;

  const referrer = await User.findOne({ referralCode: normalizedCode }).session(session);
  if (!referrer) {
    const error = new Error("This referral code is not valid.");
    error.status = 400;
    error.code = "REFERRAL_INVALID";
    throw error;
  }
  if (referrer._id.equals(referredUser._id)) {
    const error = new Error("You cannot use your own referral code.");
    error.status = 400;
    error.code = "REFERRAL_SELF";
    throw error;
  }

  const referredPhoneHash = hashReferralPhone(referredUser.phone);
  if (await ReferralReward.exists({ referredPhoneHash }).session(session)) {
    const error = new Error("This phone number has already received a referral reward.");
    error.status = 409;
    error.code = "REFERRAL_ALREADY_REWARDED";
    throw error;
  }

  const rewardedAt = new Date();
  await ReferralReward.create(
    [{
      referrerId: referrer._id,
      referredUserId: referredUser._id,
      referredPhoneHash,
      rewardedAt,
    }],
    { session },
  );
  await Entitlement.create(
    [referrer._id, referredUser._id].map((userId) => ({
      userId,
      planId: "report_kundali",
      kind: "report",
      startsAt: rewardedAt,
      expiresAt: null,
      remainingUses: 1,
      status: "active",
    })),
    { session },
  );
  return true;
}
