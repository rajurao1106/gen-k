import { demoProvider } from "./demoProvider.js";
import { razorpayProvider } from "./razorpayProvider.js";

export function getPaymentMode() {
  return (process.env.PAYMENT_MODE || "demo").toLowerCase();
}

export function isDemoPaymentMode() {
  return getPaymentMode() === "demo" && (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_PRODUCTION_DEMO_PAYMENTS === "true"
  );
}

export function getPaymentProvider() {
  const mode = getPaymentMode();
  if (mode === "demo") {
    if (!isDemoPaymentMode()) {
      throw new Error("Demo payments are disabled in production.");
    }
    return demoProvider;
  }
  if (mode === "razorpay" && process.env.NODE_ENV !== "production")
    return razorpayProvider;
  throw new Error(`Unsupported PAYMENT_MODE "${mode}".`);
}
