import express from "express";
import mongoose from "mongoose";
import DailyGuide from "../models/DailyGuide.js";
import Entitlement from "../models/Entitlement.js";
import GeneratedReport from "../models/GeneratedReport.js";
import Order from "../models/Order.js";
import ReferralReward from "../models/ReferralReward.js";
import UsageCounter from "../models/UsageCounter.js";
import User from "../models/User.js";
import UserDetail from "../models/UserDetail.js";
import VoiceProfile from "../models/VoiceProfile.js";
import { AUTH_COOKIE_NAME } from "../middleware/auth.js";
import { userRateLimit } from "../middleware/featureAccess.js";
import {
  getActiveEntitlements,
  getActivePlan,
  getDailyUsage,
} from "../services/entitlements.js";

const router = express.Router();
const limitAccountDeletion = userRateLimit({
  limit: () => 3,
  windowMs: 60 * 60_000,
  code: "ACCOUNT_DELETE_RATE_LIMITED",
});

router.get("/entitlements", async (req, res, next) => {
  try {
    const [plan, entitlements, usage] = await Promise.all([
      getActivePlan(req.user._id),
      getActiveEntitlements(req.user._id),
      getDailyUsage(req.user._id),
    ]);
    return res.json({
      success: true,
      data: { plan, entitlements, usage },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/", limitAccountDeletion, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const orders = await Order.find({ userId: req.user._id }).session(session);
      for (const order of orders) {
        order.userId = null;
        order.providerOrderId = `deleted-${order._id.toString()}`;
        order.providerPaymentId = "";
        order.signature = "";
        order.anonymizedAt = now;
        await order.save({ session });
      }

      await UserDetail.deleteMany({ userId: req.user._id }, { session });
      await DailyGuide.deleteMany({ userId: req.user._id }, { session });
      await GeneratedReport.deleteMany({ userId: req.user._id }, { session });
      await VoiceProfile.deleteMany({ userId: req.user._id }, { session });
      await Entitlement.deleteMany({ userId: req.user._id }, { session });
      await UsageCounter.deleteMany({ userId: req.user._id }, { session });
      await ReferralReward.updateMany(
        { referrerId: req.user._id },
        { $set: { referrerId: null } },
        { session },
      );
      await ReferralReward.updateMany(
        { referredUserId: req.user._id },
        { $set: { referredUserId: null } },
        { session },
      );
      await User.deleteOne({ _id: req.user._id }, { session });
    });
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

export default router;
