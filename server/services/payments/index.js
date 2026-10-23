import { demoProvider } from "./demoProvider.js";
import { razorpayProvider } from "./razorpayProvider.js";

export function getPaymentMode() {
  return (process.env.PAYMENT_MODE || "demo").toLowerCase();
}

export function getPaymentProvider() {
  const mode = getPaymentMode();
  if (mode === "demo") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Demo payments are disabled in production.");
    }
    return demoProvider;
  }
  if (mode === "razorpay" && process.env.NODE_ENV !== "production")
    return razorpayProvider;
  throw new Error(`Unsupported PAYMENT_MODE "${mode}".`);
}

export function isDemoPaymentMode() {
  return process.env.NODE_ENV !== "production" && getPaymentMode() === "demo";
}
