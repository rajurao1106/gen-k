import crypto from "node:crypto";

function createDevProvider() {
  return {
    demoMode: true,
    async sendOtp(phone, code) {
      if (process.env.DEV_SHOW_OTP === "true") {
        console.info(`[sms:dev] OTP for ${phone}: ${code}`);
      }
    },
  };
}

function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function isDemoPhoneAllowed(phone) {
  const provider = process.env.SMS_PROVIDER?.toLowerCase()
    || (process.env.NODE_ENV === "production" ? "" : "dev");
  if (provider !== "demo") return true;

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return false;

  const demoPhones = new Set(
    (process.env.DEMO_OTP_PHONES || "")
      .split(",")
      .map(normalizePhone)
      .filter(Boolean),
  );
  const adminPhones = new Set(
    (process.env.ADMIN_PHONES || "")
      .split(",")
      .map(normalizePhone)
      .filter(Boolean),
  );
  return demoPhones.has(normalizedPhone) && !adminPhones.has(normalizedPhone);
}

// TEMPORARY PRODUCTION DEMO: keep fixed-code access restricted to test phones.
export function generateOtpCode(phone) {
  const provider = process.env.SMS_PROVIDER?.toLowerCase() || "dev";
  if (process.env.NODE_ENV !== "production" && provider === "dev") {
    return "000000";
  }
  if (provider === "demo" && isDemoPhoneAllowed(phone)) return "000000";
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function createProductionDemoProvider() {
  return {
    demoMode: true,
    async sendOtp() {},
  };
}

function createUnconfiguredProvider(name) {
  return {
    demoMode: false,
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
  if (provider === "demo") {
    if (process.env.NODE_ENV !== "production") {
      throw new Error('The "demo" SMS provider is reserved for explicitly configured production demos.');
    }
    return createProductionDemoProvider();
  }
  if (!provider) throw new Error("SMS_PROVIDER must be configured in production.");
  if (provider === "msg91" || provider === "twilio") {
    return createUnconfiguredProvider(provider);
  }
  throw new Error(`Unsupported SMS_PROVIDER "${provider}".`);
}
