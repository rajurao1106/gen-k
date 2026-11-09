import mongoose from "mongoose";
import { MONEY_TEST_PLAN_ID, PLANS } from "../config/plans.js";
import Entitlement from "../models/Entitlement.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

/** Plans that can currently be bought through Razorpay. */
export const PURCHASABLE_PLAN_IDS = ["ai_chat_unlimited", MONEY_TEST_PLAN_ID];

export class PaymentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function grantEntitlement(order, session) {
  const plan = PLANS[order.planId];
  if (
    !plan ||
    plan.type === "free" ||
    (!plan.durationDays && plan.type !== "one-time")
  ) {
    throw new PaymentError(400, "INVALID_PLAN", "This plan cannot grant an entitlement.");
  }
  if (!PURCHASABLE_PLAN_IDS.includes(order.planId)) {
    throw new PaymentError(
      409,
      "PLAN_NO_LONGER_AVAILABLE",
      "This plan is no longer available for purchase.",
    );
  }
  if (order.provider !== "razorpay") {
    throw new PaymentError(
      409,
      "RAZORPAY_PAYMENT_REQUIRED",
      "Unlimited access can only be activated by a verified Razorpay payment.",
    );
  }

  const now = new Date();
  let kind;
  let startsAt = now;
  let expiresAt = null;
  let remainingUses = null;

  if (plan.type === "subscription") {
    kind = "subscription";
    await User.updateOne({ _id: order.userId }, { $inc: { paymentRevision: 1 } }, { session });
    const current = await Entitlement.findOne({
      userId: order.userId,
      kind: "subscription",
      status: "active",
    })
      .sort({ expiresAt: -1, startsAt: -1 })
      .session(session)
      .lean();
    if (current?.expiresAt && current.expiresAt > startsAt) startsAt = current.expiresAt;
    expiresAt = new Date(startsAt.getTime() + plan.durationDays * DAY_MS);
  } else if (plan.type === "add-on") {
    kind = "addon";
    expiresAt = new Date(now.getTime() + plan.durationDays * DAY_MS);
  } else if (typeof plan.grants.uses === "number") {
    kind = "report";
    remainingUses = plan.grants.uses;
  } else {
    kind = "addon";
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

/**
 * Marks an order paid and grants the entitlement, exactly once.
 * Safe to call from BOTH /verify (browser) and the webhook (Razorpay server):
 * whichever arrives second just gets { alreadyPaid: true }.
 *
 * `filter` is a Mongo filter, e.g. { _id, userId } or { providerOrderId }.
 * Caller must already have verified the payment with Razorpay.
 */
export async function fulfillOrder(filter, { providerPaymentId, signature = "" }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne(filter).session(session);
      if (!order) throw new PaymentError(404, "ORDER_NOT_FOUND", "Payment order not found.");
      if (order.status === "refunded" || order.status === "failed") {
        throw new PaymentError(409, "ORDER_NOT_PAYABLE", "This payment order cannot be verified.");
      }
      if (order.status === "paid") {
        const existing = await Entitlement.findOne({ sourceOrderId: order._id }).session(session);
        result = { order, entitlement: existing, alreadyPaid: true };
        return;
      }

      const entitlement = await grantEntitlement(order, session);
      order.status = "paid";
      order.providerPaymentId = providerPaymentId;
      order.signature = signature;
      order.paidAt = new Date();
      await order.save({ session });
      result = { order, entitlement, alreadyPaid: false };
    });
  } finally {
    await session.endSession();
  }
  return result;
}