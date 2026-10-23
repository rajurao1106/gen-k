import crypto from "node:crypto";

function createDevProvider() {
  return {
    async sendOtp(phone, code) {
      if (process.env.DEV_SHOW_OTP === "true") {
        console.info(`[sms:dev] OTP for ${phone}: ${code}`);
      }
    },
  };
}

export function generateOtpCode() {
  const provider = process.env.SMS_PROVIDER?.toLowerCase() || "dev";
  if (process.env.NODE_ENV !== "production" && provider === "dev") {
    return "000000";
  }
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function createUnconfiguredProvider(name) {
  return {
    async sendOtp() {
      throw new Error(`SMS provider "${name}" is not configured.`);
    },
  };
}

export function getSmsProvider() {
  const configuredProvider = process.env.SMS_PROVIDER?.toLowerCase();
  const provider = configuredProvider || (process.env.NODE_ENV === "production" ? "" : "dev");
  if (provider === "dev") {
    if (process.env.NODE_ENV === "production") {
      throw new Error('The "dev" SMS provider cannot be used in production.');
    }
    return createDevProvider();
  }
  if (!provider) throw new Error("SMS_PROVIDER must be configured in production.");
  if (provider === "msg91" || provider === "twilio") {
    return createUnconfiguredProvider(provider);
  }
  throw new Error(`Unsupported SMS_PROVIDER "${provider}".`);
}
