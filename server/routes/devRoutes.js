import express from "express";
import { z } from "zod";
import { PLANS } from "../config/plans.js";
import Entitlement from "../models/Entitlement.js";
import Order from "../models/Order.js";
import UsageCounter from "../models/UsageCounter.js";
import User from "../models/User.js";
import { getDayKey } from "../services/entitlements.js";

const router = express.Router();
const userIdSchema = z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) });
const grantSchema = userIdSchema.extend({ planId: z.string().min(1).max(80) });
const revokeSchema = z.object({ entitlementId: z.string().regex(/^[a-f\d]{24}$/i) });
const productionDisabled = (_req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Not found." });
  }
  next();
};
router.use(productionDisabled);

function invalidBody(res, parsed) {
  return res.status(400).json({
    success: false,
    code: "BAD_REQUEST",
    message: "The request is invalid.",
    errors: parsed.error.issues.map(({ path, message }) => ({ path, message })),
  });
}

router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find().select("_id phone role").sort({ createdAt: -1 }).limit(200).lean();
    return res.json({
      success: true,
      data: users.map((user) => ({
        id: user._id.toString(),
        phone: user.phone,
        role: user.role,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/entitlements", async (req, res, next) => {
  const parsed = userIdSchema.safeParse({ userId: req.query.userId });
  if (!parsed.success) return invalidBody(res, parsed);
  try {
    const entitlements = await Entitlement.find({ userId: parsed.data.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({
      success: true,
      data: entitlements.map((item) => ({
        id: item._id.toString(),
        planId: item.planId,
        kind: item.kind,
        status: item.status,
        startsAt: item.startsAt,
        expiresAt: item.expiresAt,
        remainingUses: item.remainingUses,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/entitlements/grant", async (req, res, next) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, parsed);
  const plan = PLANS[parsed.data.planId];
  if (!plan || plan.type === "free") {
    return res.status(400).json({ success: false, code: "INVALID_PLAN", message: "Choose a grantable plan." });
  }
  try {
    const user = await User.findById(parsed.data.userId).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const now = new Date();
    const kind = plan.type === "subscription" ? "subscription" : plan.type === "add-on" ? "addon" : "report";
    const entitlement = await Entitlement.create({
      userId: user._id,
      planId: plan.planId,
      kind,
      startsAt: now,
      expiresAt: plan.durationDays ? new Date(now.getTime() + plan.durationDays * 86_400_000) : null,
      remainingUses: kind === "report" ? plan.grants.uses : null,
      status: "active",
    });
    return res.status(201).json({ success: true, data: entitlement });
  } catch (error) {
    next(error);
  }
});

router.post("/entitlements/revoke", async (req, res, next) => {
  const parsed = revokeSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, parsed);
  try {
    const entitlement = await Entitlement.findOneAndUpdate(
      { _id: parsed.data.entitlementId, status: "active" },
      { $set: { status: "revoked", expiresAt: new Date() } },
      { new: true },
    );
    if (!entitlement) return res.status(404).json({ success: false, message: "Active entitlement not found." });
    return res.json({ success: true, data: entitlement });
  } catch (error) {
    next(error);
  }
});

router.post("/usage/reset", async (req, res, next) => {
  const parsed = userIdSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, parsed);
  try {
    const user = await User.findById(parsed.data.userId).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const result = await UsageCounter.deleteMany({
      userId: user._id,
      dayKey: getDayKey(),
    });
    return res.json({ success: true, data: { deletedCounters: result.deletedCount } });
  } catch (error) {
    next(error);
  }
});

router.post("/subscriptions/expire", async (req, res, next) => {
  const parsed = userIdSchema.safeParse(req.body);
  if (!parsed.success) return invalidBody(res, parsed);
  try {
    const now = new Date();
    const result = await Entitlement.updateMany(
      { userId: parsed.data.userId, kind: "subscription", status: "active" },
      { $set: { status: "expired", expiresAt: now } },
    );
    return res.json({ success: true, data: { expiredSubscriptions: result.modifiedCount } });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", async (_req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("userId", "phone")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json({
      success: true,
      data: orders.map((order) => ({
        id: order._id.toString(),
        userPhone: order.userId?.phone ?? "Deleted account",
        planId: order.planId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
