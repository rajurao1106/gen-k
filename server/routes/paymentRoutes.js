import mongoose from "mongoose";
import express from "express";
import { z } from "zod";
import {
  MONEY_TEST_PLAN_ID,
  PLANS,
  isMoneyTestingEnabled,
} from "../config/plans.js";
import Entitlement from "../models/Entitlement.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { userRateLimit } from "../middleware/featureAccess.js";
import {
  getPaymentMode,
  getPaymentProvider,
  isDemoPaymentMode,
} from "../services/payments/index.js";
import {
  PURCHASABLE_PLAN_IDS,
  PaymentError,
  fulfillOrder,
} from "../services/paymentFulfillment.js";

const router = express.Router();
const limitPaymentWrites = userRateLimit({
  limit: () => Number(process.env.PAYMENT_RATE_LIMIT_PER_MIN || 20),
  code: "PAYMENT_RATE_LIMITED",
});
const objectId = z.string().regex(/^[\da-f]{24}$/i);
const createOrderSchema = z.object({ planId: z.string().min(1).max(80) });
const paymentProofSchema = z.object({
  orderId: objectId,
  providerPaymentId: z.string().min(1).max(160),
  signature: z.string().regex(/^[\da-f]{64}$/i),
});
const demoCompleteSchema = z.object({
  orderId: objectId,
  outcome: z.enum(["success", "failure"]),
});
const demoRefundSchema = z.object({ orderId: objectId });
const cancelPlanSchema = z.object({ planId: z.string().min(1).max(80) });

function validationError(res, result, message) {
  return res.status(400).json({
    success: false,
    code: "BAD_REQUEST",
    message,
    errors: result.error.issues.map(({ path, message: m }) => ({ path, message: m })),
  });
}

/**
 * Turns known configuration / payment errors into clean JSON responses.
 * Returns true if it handled the error, false if the caller should call next(error).
 */
function sendKnownError(res, error) {
  if (error instanceof PaymentError) {
    res.status(error.status).json({ success: false, code: error.code, message: error.message });
    return true;
  }
  const configCodes = [
    "PAYMENT_PROVIDER_NOT_CONFIGURED",
    "RAZORPAY_TEST_KEYS_REQUIRED",
    "RAZORPAY_LIVE_KEYS_REQUIRED",
    "MONEY_TESTING_DISABLED",
  ];
  if (configCodes.includes(error.code)) {
    res.status(503).json({ success: false, code: error.code, message: error.message });
    return true;
  }
  if (
    error.message?.includes("isabled in production") ||
    error.message?.includes("Unsupported PAYMENT_MODE")
  ) {
    res.status(503).json({
      success: false,
      code: "PAYMENTS_UNAVAILABLE",
      message: "Payments are not available in this environment.",
    });
    return true;
  }
  return false;
}

async function verifyAndGrant({ userId, orderId, providerPaymentId, signature }) {
  const provider = getPaymentProvider();
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new PaymentError(404, "ORDER_NOT_FOUND", "Payment order not found.");
  if (order.provider !== getPaymentMode()) {
    throw new PaymentError(
      409,
      "PAYMENT_PROVIDER_MISMATCH",
      "This order was created with a different payment provider.",
    );
  }
  if (order.status === "refunded" || order.status === "failed") {
    throw new PaymentError(409, "ORDER_NOT_PAYABLE", "This payment order cannot be verified.");
  }

  // Already activated (e.g. by the webhook) -> nothing more to verify.
  if (order.status === "paid") {
    return fulfillOrder({ _id: order._id, userId }, { providerPaymentId, signature });
  }

  const ok = await provider.verifyPayment({
    planId: order.planId,
    providerOrderId: order.providerOrderId,
    providerPaymentId,
    signature,
    amountPaise: order.amountPaise,
    currency: order.currency,
  });
  if (!ok) {
    throw new PaymentError(400, "PAYMENT_SIGNATURE_INVALID", "Payment verification failed.");
  }
  return fulfillOrder({ _id: order._id, userId }, { providerPaymentId, signature });
}

function serializePayment(order) {
  const plan = PLANS[order.planId];
  return {
    id: order._id.toString(),
    planId: order.planId,
    planName: plan?.name || order.planId,
    amountPaise: order.amountPaise,
    currency: order.currency,
    provider: order.provider,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}

router.post("/create-order", limitPaymentWrites, async (req, res, next) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success)
    return validationError(res, parsed, "A valid planId is required.");

  const plan = PLANS[parsed.data.planId];
  if (
    !PURCHASABLE_PLAN_IDS.includes(parsed.data.planId) ||
    !plan ||
    plan.type === "free" ||
    plan.amountPaise <= 0
  ) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PLAN",
      message: "Choose a purchasable plan.",
    });
  }

  if (parsed.data.planId === MONEY_TEST_PLAN_ID && !isMoneyTestingEnabled()) {
    return res.status(404).json({
      success: false,
      code: "PLAN_NOT_AVAILABLE",
      message: "This payment test plan is not available.",
    });
  }

  if (getPaymentMode() !== "razorpay") {
    return res.status(503).json({
      success: false,
      code: "RAZORPAY_PAYMENT_REQUIRED",
      message: "This plan must be purchased through Razorpay; demo payments are disabled.",
    });
  }

  try {
    const alreadyOwned = await Entitlement.exists({
      userId: req.user._id,
      planId: plan.planId,
      kind: "addon",
      status: "active",
      startsAt: { $lte: new Date() },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });
    if (alreadyOwned) {
      return res.status(409).json({
        success: false,
        code: "PLAN_ALREADY_ACTIVE",
        message: "Unlimited Kundali and AI Friend access is already active.",
      });
    }

    const provider = getPaymentProvider();
    const mode = getPaymentMode();
    const orderId = new mongoose.Types.ObjectId();
    const orderDraft = {
      userId: req.user._id,
      planId: plan.planId,
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      provider: mode,
      receipt: orderId.toString(), // shows up as "Receipt" in the Razorpay dashboard
    };
    const providerOrder = await provider.createOrder({ order: orderDraft });
    const order = await Order.create({
      _id: orderId,
      userId: orderDraft.userId,
      planId: orderDraft.planId,
      amountPaise: orderDraft.amountPaise,
      currency: orderDraft.currency,
      provider: mode,
      providerOrderId: providerOrder.providerOrderId,
      status: "created",
    });
    return res.status(201).json({
      success: true,
      data: {
        orderId: order._id.toString(),
        providerOrderId: order.providerOrderId,
        amount: order.amountPaise,
        currency: order.currency,
        mode,
        keyId: providerOrder.keyId,
      },
    });
  } catch (error) {
    if (!sendKnownError(res, error)) next(error);
  }
});

router.post("/verify", limitPaymentWrites, async (req, res, next) => {
  const parsed = paymentProofSchema.safeParse(req.body);
  if (!parsed.success)
    return validationError(res, parsed, "Payment verification details are invalid.");

  try {
    const result = await verifyAndGrant({ userId: req.user._id, ...parsed.data });
    return res.json({
      success: true,
      data: {
        orderId: result.order._id.toString(),
        status: result.order.status,
        alreadyPaid: result.alreadyPaid,
        entitlement: result.entitlement,
      },
    });
  } catch (error) {
    if (!sendKnownError(res, error)) next(error);
  }
});

// Lets the frontend check whether an order got activated (e.g. by the webhook).
router.get("/order-status/:orderId", async (req, res, next) => {
  if (!objectId.safeParse(req.params.orderId).success) {
    return res.status(400).json({ success: false, code: "BAD_REQUEST", message: "Invalid order id." });
  }
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id }).lean();
    if (!order)
      return res.status(404).json({ success: false, code: "ORDER_NOT_FOUND", message: "Payment order not found." });
    return res.json({ success: true, data: serializePayment(order) });
  } catch (error) {
    next(error);
  }
});

router.post("/cancel-plan", limitPaymentWrites, async (req, res, next) => {
  const parsed = cancelPlanSchema.safeParse(req.body);
  if (!parsed.success)
    return validationError(res, parsed, "A valid planId is required.");

  const plan = PLANS[parsed.data.planId];
  const kind =
    plan?.type === "subscription"
      ? "subscription"
      : PURCHASABLE_PLAN_IDS.includes(parsed.data.planId) && plan?.type === "one-time"
        ? "addon"
        : null;
  if (!kind) {
    return res.status(400).json({
      success: false,
      code: "PLAN_NOT_CANCELLABLE",
      message: "This plan cannot be cancelled.",
    });
  }

  const session = await mongoose.startSession();
  try {
    let cancelled = null;
    const now = new Date();
    await session.withTransaction(async () => {
      cancelled = await Entitlement.findOneAndUpdate(
        {
          userId: req.user._id,
          planId: parsed.data.planId,
          kind,
          status: "active",
          startsAt: { $lte: now },
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        },
        { $set: { status: "revoked" } },
        { new: true, sort: { startsAt: -1 } },
      ).session(session);

      if (!cancelled) {
        throw new PaymentError(409, "NO_ACTIVE_PLAN", "There is no active entitlement for this plan to cancel.");
      }
      await User.updateOne({ _id: req.user._id }, { $inc: { paymentRevision: 1 } }, { session });
    });
    return res.json({ success: true, data: { planId: cancelled.planId, status: "revoked" } });
  } catch (error) {
    if (!sendKnownError(res, error)) next(error);
  } finally {
    await session.endSession();
  }
});

/* ---------- Demo-only endpoints (disabled in production) ---------- */

router.post("/demo/complete", limitPaymentWrites, async (req, res, next) => {
  if (!isDemoPaymentMode())
    return res.status(503).json({ success: false, code: "PAYMENTS_UNAVAILABLE", message: "Payments are not available in this environment." });
  const parsed = demoCompleteSchema.safeParse(req.body);
  if (!parsed.success)
    return validationError(res, parsed, "A valid orderId and outcome are required.");

  try {
    const order = await Order.findOne({ _id: parsed.data.orderId, userId: req.user._id });
    if (!order)
      return res.status(404).json({ success: false, code: "ORDER_NOT_FOUND", message: "Payment order not found." });

    if (parsed.data.outcome === "failure") {
      if (order.status === "paid")
        return res.status(409).json({ success: false, code: "ORDER_ALREADY_PAID", message: "This order is already paid." });
      if (order.status === "refunded")
        return res.status(409).json({ success: false, code: "ORDER_NOT_PAYABLE", message: "This order cannot be completed." });
      if (order.status === "created") {
        const update = await Order.updateOne(
          { _id: order._id, userId: req.user._id, status: "created" },
          { $set: { status: "failed" } },
        );
        if (update.modifiedCount !== 1) {
          return res.status(409).json({
            success: false,
            code: "ORDER_STATE_CHANGED",
            message: "The payment order changed while completing the demo payment.",
          });
        }
      }
      return res.json({ success: true, data: { orderId: order._id.toString(), status: "failed" } });
    }

    const proof = getPaymentProvider().createPaymentProof(order.providerOrderId);
    const verified = await verifyAndGrant({ userId: req.user._id, orderId: order._id, ...proof });
    return res.json({
      success: true,
      data: {
        orderId: verified.order._id.toString(),
        status: verified.order.status,
        alreadyPaid: verified.alreadyPaid,
        providerPaymentId: proof.providerPaymentId,
        signature: proof.signature,
      },
    });
  } catch (error) {
    if (!sendKnownError(res, error)) next(error);
  }
});

router.post("/demo/refund", limitPaymentWrites, async (req, res, next) => {
  const parsed = demoRefundSchema.safeParse(req.body);
  if (!parsed.success)
    return validationError(res, parsed, "A valid orderId is required.");

  const session = await mongoose.startSession();
  try {
    let refunded = null;
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: parsed.data.orderId, userId: req.user._id }).session(session);
      if (!order) throw new PaymentError(404, "ORDER_NOT_FOUND", "Payment order not found.");
      if (order.provider !== "demo") {
        throw new PaymentError(409, "ORDER_PROVIDER_MISMATCH", "Only demo payment orders can be revoked through this endpoint.");
      }
      if (order.status === "refunded") {
        refunded = order;
        return;
      }
      if (order.status !== "paid") {
        throw new PaymentError(409, "ORDER_NOT_REFUNDABLE", "Only paid orders can be refunded.");
      }
      order.status = "refunded";
      await order.save({ session });
      await Entitlement.updateOne(
        { sourceOrderId: order._id, userId: req.user._id, status: "active" },
        { $set: { status: "revoked" } },
        { session },
      );
      refunded = order;
    });
    return res.json({ success: true, data: { orderId: refunded._id.toString(), status: refunded.status } });
  } catch (error) {
    if (!sendKnownError(res, error)) next(error);
  } finally {
    await session.endSession();
  }
});

router.get("/history", async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, count: orders.length, data: orders.map(serializePayment) });
  } catch (error) {
    next(error);
  }
});

export default router;