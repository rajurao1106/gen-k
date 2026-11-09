import crypto from "node:crypto";
import { MONEY_TEST_PLAN_ID, isMoneyTestingEnabled } from "../../config/plans.js";

function getCredentials(planId) {
  const isMoneyTestPlan = planId === MONEY_TEST_PLAN_ID;
  const keyId = isMoneyTestPlan
    ? process.env.RAZORPAY_LIVE_KEY_ID
    : process.env.RAZORPAY_KEY_ID;
  const keySecret = isMoneyTestPlan
    ? process.env.RAZORPAY_LIVE_KEY_SECRET
    : process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const error = new Error(
      isMoneyTestPlan
        ? "Razorpay live payment-test credentials are not configured."
        : "Razorpay test credentials are not configured.",
    );
    error.code = "PAYMENT_PROVIDER_NOT_CONFIGURED";
    throw error;
  }

  if (isMoneyTestPlan && !isMoneyTestingEnabled()) {
    const error = new Error(
      "The ₹1 payment test is not enabled.",
    );
    error.code = "MONEY_TESTING_DISABLED";
    throw error;
  }
  const expectedPrefix = isMoneyTestPlan ? "rzp_live_" : "rzp_test_";
  if (!keyId.startsWith(expectedPrefix)) {
    const error = new Error(
      isMoneyTestPlan
        ? "The ₹1 payment test requires Razorpay live credentials."
        : "This plan only accepts Razorpay test credentials.",
    );
    error.code = isMoneyTestPlan
      ? "RAZORPAY_LIVE_KEYS_REQUIRED"
      : "RAZORPAY_TEST_KEYS_REQUIRED";
    throw error;
  }
  return { keyId, keySecret };
}

export const razorpayProvider = {
  async createOrder({ order }) {
    const { keyId, keySecret } = getCredentials(order.planId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response;
    try {
      response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: order.amountPaise,
          currency: order.currency,
          receipt: crypto.randomUUID(),
          notes: { planId: order.planId },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
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
      typeof signature !== "string" ||
      !/^[\da-f]{64}$/i.test(signature)
    )
      return false;

    const { keyId, keySecret } = getCredentials(planId);
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest();
    const received = Buffer.from(signature, "hex");
    const signatureIsValid =
      expected.length === received.length &&
      crypto.timingSafeEqual(expected, received);
    if (!signatureIsValid) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response;
    try {
      response = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          },
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
    const payment = await response.json().catch(() => null);
    return response.ok &&
      payment?.order_id === providerOrderId &&
      payment?.status === "captured" &&
      payment?.amount === amountPaise &&
      payment?.currency === currency;
  },
};
