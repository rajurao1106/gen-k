import mongoose from "mongoose";
import express from "express";
import { z } from "zod";
import { PLANS } from "../config/plans.js";
import Entitlement from "../models/Entitlement.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { userRateLimit } from "../middleware/featureAccess.js";
import {
  getPaymentMode,
  getPaymentProvider,
  isDemoPaymentMode,
} from "../services/payments/index.js";

const router = express.Router();
const limitPaymentWrites = userRateLimit({
  limit: () => Number(process.env.PAYMENT_RATE_LIMIT_PER_MIN || 20),
  code: "PAYMENT_RATE_LIMITED",
});
const createOrderSchema = z.object({ planId: z.string().min(1).max(80) });
const paymentProofSchema = z.object({
  orderId: z.string().regex(/^[\da-f]{24}$/i),
  providerPaymentId: z.string().min(1).max(160),
  signature: z.string().regex(/^[\da-f]{64}$/i),
});
const demoCompleteSchema = z.object({
  orderId: z.string().regex(/^[\da-f]{24}$/i),
  outcome: z.enum(["success", "failure"]),
});
const demoRefundSchema = z.object({
  orderId: z.string().regex(/^[\da-f]{24}$/i),
});

class PaymentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function validationError(res, result, message) {
  return res.status(400).json({
    success: false,
    code: "BAD_REQUEST",
    message,
    errors: result.error.issues.map(({ path, message: issueMessage }) => ({
      path,
      message: issueMessage,
    })),
  });
}

function paymentModeError(res) {
  return res.status(503).json({
    success: false,
    code: "PAYMENTS_UNAVAILABLE",
    message: "Payments are not available in this environment.",
  });
}

async function grantEntitlement(order, session) {
  const plan = PLANS[order.planId];
  if (
    !plan ||
    plan.type === "free" ||
    (!plan.durationDays && plan.type !== "one-time")
  ) {
    throw new PaymentError(
      400,
      "INVALID_PLAN",
      "This plan cannot grant an entitlement.",
    );
  }

  const now = new Date();
  let kind;
  let startsAt = now;
  let expiresAt = null;
  let remainingUses = null;

  if (plan.type === "subscription") {
    kind = "subscription";
    await User.updateOne(
      { _id: order.userId },
      { $inc: { paymentRevision: 1 } },
      { session },
    );
    const current = await Entitlement.findOne({
      userId: order.userId,
      kind: "subscription",
      status: "active",
    })
      .sort({ expiresAt: -1, startsAt: -1 })
      .session(session)
      .lean();
    if (current?.expiresAt && current.expiresAt > startsAt)
      startsAt = current.expiresAt;
    expiresAt = new Date(
      startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000,
    );
  } else if (plan.type === "add-on") {
    kind = "addon";
    expiresAt = new Date(
      now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000,
    );
  } else {
    kind = "report";
    remainingUses = plan.grants.uses;
  }

  const [entitlement] = await Entitlement.create(
    [
      {
        userId: order.userId,
        planId: plan.planId,
        kind,
        startsAt,
        expiresAt,
        remainingUses,
        sourceOrderId: order._id,
        status: "active",
      },
    ],
    { session },
  );
  return entitlement;
}

async function verifyAndGrant({
  userId,
  orderId,
  providerPaymentId,
  signature,
}) {
  const provider = getPaymentProvider();
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order)
    throw new PaymentError(404, "ORDER_NOT_FOUND", "Payment order not found.");
  if (order.status === "refunded" || order.status === "failed") {
    throw new PaymentError(
      409,
      "ORDER_NOT_PAYABLE",
      "This payment order cannot be verified.",
    );
  }

  const proof = {
    providerOrderId: order.providerOrderId,
    providerPaymentId,
    signature,
  };
  if (!provider.verifyPayment(proof)) {
    throw new PaymentError(
      400,
      "PAYMENT_SIGNATURE_INVALID",
      "Payment verification failed.",
    );
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const currentOrder = await Order.findOne({
        _id: order._id,
        userId,
      }).session(session);
      if (!currentOrder)
        throw new PaymentError(
          404,
          "ORDER_NOT_FOUND",
          "Payment order not found.",
        );
      if (
        currentOrder.status === "refunded" ||
        currentOrder.status === "failed"
      ) {
        throw new PaymentError(
          409,
          "ORDER_NOT_PAYABLE",
          "This payment order cannot be verified.",
        );
      }
      if (currentOrder.status === "paid") {
        const existing = await Entitlement.findOne({
          sourceOrderId: currentOrder._id,
        }).session(session);
        result = {
          order: currentOrder,
          entitlement: existing,
          alreadyPaid: true,
        };
        return;
      }

      const entitlement = await grantEntitlement(currentOrder, session);
      currentOrder.status = "paid";
      currentOrder.providerPaymentId = providerPaymentId;
      currentOrder.signature = signature;
      currentOrder.paidAt = new Date();
      await currentOrder.save({ session });
      result = { order: currentOrder, entitlement, alreadyPaid: false };
    });
  } finally {
    await session.endSession();
  }
  return result;
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
  if (!plan || plan.type === "free" || plan.amountPaise <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PLAN",
      message: "Choose a purchasable plan.",
    });
  }

  try {
    const provider = getPaymentProvider();
    const mode = getPaymentMode();
    const orderDraft = {
      userId: req.user._id,
      planId: plan.planId,
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      provider: mode,
    };
    const providerOrder = await provider.createOrder({ order: orderDraft });
    const order = await Order.create({
      ...orderDraft,
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
    if (error.code === "PAYMENT_PROVIDER_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        code: error.code,
        message: "Razorpay test checkout is not configured.",
      });
    }
    if (
      error.message?.includes("payments are disabled") ||
      error.message?.includes("Unsupported PAYMENT_MODE")
    ) {
      return paymentModeError(res);
    }
    next(error);
  }
});

router.post("/demo/complete", limitPaymentWrites, async (req, res, next) => {
  if (!isDemoPaymentMode()) return paymentModeError(res);
  const parsed = demoCompleteSchema.safeParse(req.body);
  if (!parsed.success)
    return validationError(
      res,
      parsed,
      "A valid orderId and outcome are required.",
    );

  try {
    const order = await Order.findOne({
      _id: parsed.data.orderId,
      userId: req.user._id,
    });
    if (!order) {
      return res
        .status(404)
        .json({
          success: false,
          code: "ORDER_NOT_FOUND",
          message: "Payment order not found.",
        });
    }
    if (parsed.data.outcome === "failure") {
      if (order.status === "paid") {
        return res
          .status(409)
          .json({
            success: false,
            code: "ORDER_ALREADY_PAID",
            message: "This order is already paid.",
          });
      }
      if (order.status === "refunded") {
        return res
          .status(409)
          .json({
            success: false,
            code: "ORDER_NOT_PAYABLE",
            message: "This order cannot be completed.",
          });
      }
      if (order.status === "created") {
        const update = await Order.updateOne(
          { _id: order._id, userId: req.user._id, status: "created" },
          { $set: { status: "failed" } },
        );
        if (update.modifiedCount !== 1) {
          return res.status(409).json({
            success: false,
            code: "ORDER_STATE_CHANGED",
            message:
              "The payment order changed while completing the demo payment.",
          });
        }
      }
      return res.json({
        success: true,
        data: { orderId: order._id.toString(), status: "failed" },
      });
    }

    const proof = getPaymentProvider().createPaymentProof(
      order.providerOrderId,
    );
    const verified = await verifyAndGrant({
      userId: req.user._id,
      orderId: order._id,
      ...proof,
    });
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
    if (error instanceof PaymentError) {
      return res
        .status(error.status)
        .json({ success: false, code: error.code, message: error.message });
    }
    if (
      error.message?.includes("Demo payments are disabled") ||
      error.message?.includes("Unsupported PAYMENT_MODE")
    ) {
      return paymentModeError(res);
    }
    next(error);
  }
});

router.post("/verify", limitPaymentWrites, async (req, res, next) => {
  const parsed = paymentProofSchema.safeParse(req.body);
  if (!parsed.success)
    return validationError(
      res,
      parsed,
      "Payment verification details are invalid.",
    );

  try {
    const result = await verifyAndGrant({
      userId: req.user._id,
      ...parsed.data,
    });
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
    if (error instanceof PaymentError) {
      return res
        .status(error.status)
        .json({ success: false, code: error.code, message: error.message });
    }
    if (
      error.message?.includes("Demo payments are disabled") ||
      error.message?.includes("Unsupported PAYMENT_MODE")
    ) {
      return paymentModeError(res);
    }
    next(error);
  }
});

router.post("/demo/refund", limitPaymentWrites, async (req, res, next) => {
  if (!isDemoPaymentMode()) return paymentModeError(res);
  const parsed = demoRefundSchema.safeParse(req.body);
  if (!parsed.success)
    return validationError(res, parsed, "A valid orderId is required.");

  const session = await mongoose.startSession();
  try {
    let refundedOrder = null;
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: parsed.data.orderId,
        userId: req.user._id,
      }).session(session);
      if (!order)
        throw new PaymentError(
          404,
          "ORDER_NOT_FOUND",
          "Payment order not found.",
        );
      if (order.status === "refunded") {
        refundedOrder = order;
        return;
      }
      if (order.status !== "paid") {
        throw new PaymentError(
          409,
          "ORDER_NOT_REFUNDABLE",
          "Only paid orders can be refunded.",
        );
      }
      order.status = "refunded";
      await order.save({ session });
      await Entitlement.updateOne(
        { sourceOrderId: order._id, userId: req.user._id, status: "active" },
        { $set: { status: "revoked" } },
        { session },
      );
      refundedOrder = order;
    });
    return res.json({
      success: true,
      data: {
        orderId: refundedOrder._id.toString(),
        status: refundedOrder.status,
      },
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return res
        .status(error.status)
        .json({ success: false, code: error.code, message: error.message });
    }
    if (error.message?.includes("Demo payments are disabled"))
      return paymentModeError(res);
    next(error);
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
    return res.json({
      success: true,
      count: orders.length,
      data: orders.map(serializePayment),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
