import crypto from "node:crypto";

function getSecret() {
  const secret = process.env.DEMO_PAYMENT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("DEMO_PAYMENT_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function signatureFor(providerOrderId, providerPaymentId) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest("hex");
}

function signaturesMatch(expected, received) {
  if (typeof received !== "string" || !/^[\da-f]{64}$/i.test(received)) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export const demoProvider = {
  async createOrder() {
    return { providerOrderId: `demo_order_${crypto.randomBytes(16).toString("hex")}` };
  },

  createPaymentProof(providerOrderId) {
    const providerPaymentId = `demo_payment_${crypto.randomBytes(16).toString("hex")}`;
    return {
      providerPaymentId,
      signature: signatureFor(providerOrderId, providerPaymentId),
    };
  },

  verifyPayment(payload) {
    if (
      typeof payload?.providerOrderId !== "string" ||
      typeof payload?.providerPaymentId !== "string" ||
      typeof payload?.signature !== "string"
    ) return false;
    return signaturesMatch(
      signatureFor(payload.providerOrderId, payload.providerPaymentId),
      payload.signature,
    );
  },

  verifyWebhook(_rawBody, _headers) {
    return false;
  },
};
