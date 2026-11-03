const LOCAL_DEMO_JWT_SECRET =
  "gen-k-local-demo-jwt-secret-not-for-production";

function resolveSecret(value, name, localDemoSecret, allowLocalFallback = false) {
  if (!value) {
    if (allowLocalFallback && process.env.NODE_ENV !== "production") return localDemoSecret;
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  if (value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return value;
}

export function getJwtSecret() {
  return resolveSecret(
    process.env.JWT_SECRET,
    "JWT_SECRET",
    LOCAL_DEMO_JWT_SECRET,
    true,
  );
}

export function getReferralHashSecret() {
  const secret =
    process.env.REFERRAL_PHONE_HMAC_SECRET ||
    process.env.OTP_SECRET ||
    process.env.OTP_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    LOCAL_DEMO_JWT_SECRET;

  // Referral hashing is optional for now; if a dedicated secret is not configured,
  // fall back to the main JWT secret instead of failing auth requests.
  return resolveSecret(secret, "REFERRAL_PHONE_HMAC_SECRET", LOCAL_DEMO_JWT_SECRET, true);
}
