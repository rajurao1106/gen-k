import { hasAccess } from "../services/entitlements.js";

export function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      if (await hasAccess(req.user._id, feature)) return next();
      return res.status(402).json({
        success: false,
        code: "UPGRADE_REQUIRED",
        message: "This feature is not included in your current plan.",
        upgrade: true,
        feature,
      });
    } catch (error) {
      next(error);
    }
  };
}

export function userRateLimit({ limit, windowMs = 60_000, code = "USER_RATE_LIMITED" }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [userId, list] of hits) {
      if (!list.some((time) => now - time < windowMs)) hits.delete(userId);
    }
  }, 5 * 60_000).unref();

  return (req, res, next) => {
    const userId = String(req.user?._id || "");
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please log in and try again.",
      });
    }
    const now = Date.now();
    const maxHits = Math.max(1, Number(limit()) || 1);
    const recent = (hits.get(userId) || []).filter((time) => now - time < windowMs);
    if (recent.length >= maxHits) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowMs - (now - recent[0])) / 1000),
      );
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        code,
        message: "Bahut zyada requests. Thodi der baad try karein.",
        retryAfterSeconds,
      });
    }
    recent.push(now);
    hits.set(userId, recent);
    next();
  };
}
