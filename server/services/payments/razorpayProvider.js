import crypto from "node:crypto";

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const error = new Error("Razorpay test credentials are not configured.");
    error.code = "PAYMENT_PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  if (!keyId.startsWith("rzp_test_")) {
    throw new Error(
      "Razorpay test checkout requires a test key ID beginning with rzp_test_.",
    );
  }
  return { keyId, keySecret };
}

export const razorpayProvider = {
  async createOrder({ order }) {
    const { keyId, keySecret } = getCredentials();
    const response = await fetch("https://api.razorpay.com/v1/orders", {
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
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || typeof result?.id !== "string") {
      throw new Error(
        result?.error?.description ||
          `Razorpay order creation failed (${response.status}).`,
      );
    }
    return { providerOrderId: result.id, keyId };
  },

  verifyPayment({ providerOrderId, providerPaymentId, signature }) {
    if (
      typeof providerOrderId !== "string" ||
      typeof providerPaymentId !== "string" ||
      typeof signature !== "string" ||
      !/^[\da-f]{64}$/i.test(signature)
    )
      return false;

    const { keySecret } = getCredentials();
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest();
    const received = Buffer.from(signature, "hex");
    return (
      expected.length === received.length &&
      crypto.timingSafeEqual(expected, received)
    );
  },
};
