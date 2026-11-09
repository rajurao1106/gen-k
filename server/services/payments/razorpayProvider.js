import crypto from "node:crypto";
import { MONEY_TEST_PLAN_ID, isMoneyTestingEnabled } from "../../config/plans.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function configError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Which Razorpay keys a plan uses:
 *  - ₹1 money-test plan  -> RAZORPAY_LIVE_KEY_ID / SECRET (always live, needs MONEY_TESTING=true)
 *  - every other plan    -> RAZORPAY_KEY_ID / SECRET
 *      production  : must be rzp_live_  (real money)
 *      development : must be rzp_test_  (so you never charge real money by accident)
 *
 * Escape hatches (optional env flags):
 *   RAZORPAY_ALLOW_TEST_KEYS_IN_PRODUCTION=true  -> staging server using test keys
 *   RAZORPAY_ALLOW_LIVE_KEYS_IN_DEV=true         -> try live keys on localhost
 */
function getCredentials(planId) {
  const isMoneyTestPlan = planId === MONEY_TEST_PLAN_ID;

  const keyId = isMoneyTestPlan
    ? process.env.RAZORPAY_LIVE_KEY_ID
    : process.env.RAZORPAY_KEY_ID;
  const keySecret = isMoneyTestPlan
    ? process.env.RAZORPAY_LIVE_KEY_SECRET
    : process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw configError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      isMoneyTestPlan
        ? "Razorpay live payment-test credentials are not configured."
        : "Razorpay credentials are not configured.",
    );
  }

  if (isMoneyTestPlan && !isMoneyTestingEnabled()) {
    throw configError("MONEY_TESTING_DISABLED", "The ₹1 payment test is not enabled.");
  }

  let expectedPrefix;
  if (isMoneyTestPlan) {
    expectedPrefix = "rzp_live_";
  } else if (IS_PRODUCTION) {
    expectedPrefix =
      process.env.RAZORPAY_ALLOW_TEST_KEYS_IN_PRODUCTION === "true"
        ? "rzp_"
        : "rzp_live_";
  } else {
    expectedPrefix =
      process.env.RAZORPAY_ALLOW_LIVE_KEYS_IN_DEV === "true" ? "rzp_" : "rzp_test_";
  }

  if (!keyId.startsWith(expectedPrefix)) {
    const needsLive = expectedPrefix === "rzp_live_";
    throw configError(
      needsLive ? "RAZORPAY_LIVE_KEYS_REQUIRED" : "RAZORPAY_TEST_KEYS_REQUIRED",
      needsLive
        ? "This environment requires Razorpay live keys (rzp_live_...)."
        : "This environment requires Razorpay test keys (rzp_test_...).",
    );
  }
  return { keyId, keySecret };
}

function basicAuth(keyId, keySecret) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function razorpayFetch(url, options, keyId, keySecret) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, {
      ...options,
      headers: {
        Authorization: basicAuth(keyId, keySecret),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function safeHexEqual(expectedBuffer, receivedHex) {
  if (typeof receivedHex !== "string" || !/^[\da-f]{64}$/i.test(receivedHex))
    return false;
  const received = Buffer.from(receivedHex, "hex");
  return (
    expectedBuffer.length === received.length &&
    crypto.timingSafeEqual(expectedBuffer, received)
  );
}

export const razorpayProvider = {
  async createOrder({ order }) {
    const { keyId, keySecret } = getCredentials(order.planId);
    const response = await razorpayFetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: order.amountPaise,
          currency: order.currency,
          // Our own Order _id -> easy to match in the Razorpay dashboard
          receipt: order.receipt || crypto.randomUUID(),
          notes: {
            planId: order.planId,
            userId: order.userId ? String(order.userId) : "",
          },
        }),
      },
      keyId,
      keySecret,
    );
    const result = await response.json().catch(() => null);
    if (!response.ok || typeof result?.id !== "string") {
      throw new Error(
        result?.error?.description ||
          `Razorpay order creation failed (${response.status}).`,
      );
    }
    return { providerOrderId: result.id, keyId };
  },

  async verifyPayment({
    planId,
    providerOrderId,
    providerPaymentId,
    signature,
    amountPaise,
    currency,
  }) {
    if (
      typeof providerOrderId !== "string" ||
      typeof providerPaymentId !== "string" ||
      typeof signature !== "string"
    )
      return false;

    const { keyId, keySecret } = getCredentials(planId);
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest();
    if (!safeHexEqual(expected, signature)) return false;

    // Double-check with Razorpay itself: captured, same order, same amount.
    const response = await razorpayFetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}`,
      {},
      keyId,
      keySecret,
    );
    const payment = await response.json().catch(() => null);
    return (
      response.ok &&
      payment?.order_id === providerOrderId &&
      payment?.status === "captured" &&
      payment?.amount === amountPaise &&
      payment?.currency === currency
    );
  },

  /**
   * Verifies the X-Razorpay-Signature header of a webhook.
   * rawBody MUST be the untouched request body (Buffer), not parsed JSON.
   */
  verifyWebhookSignature(rawBody, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw configError(
        "WEBHOOK_NOT_CONFIGURED",
        "RAZORPAY_WEBHOOK_SECRET is not configured.",
      );
    }
    if (!Buffer.isBuffer(rawBody)) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
    return safeHexEqual(expected, signature);
  },
};