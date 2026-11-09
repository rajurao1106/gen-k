import express from "express";
import Order from "../models/Order.js";
import { fulfillOrder, PaymentError } from "../services/paymentFulfillment.js";
import { razorpayProvider } from "../services/payments/razorpayProvider.js";

/**
 * Razorpay webhook.  Mounted in app.js BEFORE express.json() with express.raw(),
 * because the signature is calculated on the exact raw bytes.
 *
 * Dashboard setup: Settings -> Webhooks -> Add
 *   URL    : https://YOUR-DOMAIN/api/payments/webhook
 *   Secret : same value as RAZORPAY_WEBHOOK_SECRET
 *   Events : payment.captured, order.paid
 */
const router = express.Router();
const HANDLED_EVENTS = new Set(["payment.captured", "order.paid"]);

router.post("/", async (req, res) => {
  let signatureOk;
  try {
    signatureOk = razorpayProvider.verifyWebhookSignature(
      req.body,
      req.get("x-razorpay-signature"),
    );
  } catch (error) {
    console.error("[webhook] not configured:", error.message);
    return res.status(503).json({ success: false, code: error.code || "WEBHOOK_ERROR" });
  }
  if (!signatureOk) {
    return res.status(400).json({ success: false, code: "INVALID_SIGNATURE" });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, code: "BAD_JSON" });
  }

  // Events we don't care about: acknowledge so Razorpay doesn't retry.
  if (!HANDLED_EVENTS.has(event?.event)) {
    return res.json({ success: true, ignored: true });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment?.order_id) {
    return res.json({ success: true, ignored: true });
  }

  try {
    const order = await Order.findOne({
      providerOrderId: payment.order_id,
      provider: "razorpay",
    }).lean();

    if (!order) {
      console.warn("[webhook] unknown order", payment.order_id);
      return res.json({ success: true, ignored: true });
    }

    const matches =
      payment.status === "captured" &&
      payment.amount === order.amountPaise &&
      payment.currency === order.currency;
    if (!matches) {
      console.error("[webhook] payment/order mismatch", {
        orderId: String(order._id),
        paymentId: payment.id,
        status: payment.status,
      });
      return res.json({ success: true, ignored: true });
    }

    const result = await fulfillOrder(
      { _id: order._id },
      { providerPaymentId: payment.id, signature: "webhook" },
    );
    return res.json({ success: true, alreadyPaid: result.alreadyPaid });
  } catch (error) {
    if (error instanceof PaymentError) {
      // Business-rule problem (refunded/failed order etc.): retrying won't help.
      console.error("[webhook] not fulfilled:", error.code, error.message);
      return res.json({ success: true, ignored: true });
    }
    // Unexpected (DB down...). 500 => Razorpay retries automatically.
    console.error("[webhook] failed:", error?.message ?? error);
    return res.status(500).json({ success: false, code: "INTERNAL_ERROR" });
  }
});

export default router;