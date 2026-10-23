const LOCAL_DEMO_OTP_SECRET =
  "gen-k-local-demo-otp-secret-not-for-production";
const LOCAL_DEMO_JWT_SECRET =
  "gen-k-local-demo-jwt-secret-not-for-production";

function isLocalDemoMode() {
  const provider = (process.env.SMS_PROVIDER || "dev").toLowerCase();
  return process.env.NODE_ENV !== "production" && provider === "dev";
}

function resolveSecret(value, name, localDemoSecret) {
  if (!value) {
    if (isLocalDemoMode()) return localDemoSecret;
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  if (value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return value;
}

export function getOtpSecret() {
  return resolveSecret(
    process.env.OTP_SECRET || process.env.OTP_HMAC_SECRET,
    "OTP_SECRET",
    LOCAL_DEMO_OTP_SECRET,
  );
}

export function getJwtSecret() {
  return resolveSecret(
    process.env.JWT_SECRET,
    "JWT_SECRET",
    LOCAL_DEMO_JWT_SECRET,
  );
}
