import express from "express";
import {
  generateWithPool,
  GeminiPoolError,
  poolStatus,
} from "../services/geminiKeyPool.js";

const router = express.Router();

// ---- config ---------------------------------------------------------------
// Read lazily: dotenv.config() runs after ES imports are evaluated.
const allowedModels = () =>
  new Set(
    (process.env.GEMINI_ALLOWED_MODELS || "gemini-3.5-flash-lite")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
  );
const rateLimitPerMin = () =>
  Number(process.env.GEMINI_RATE_LIMIT_PER_MIN || 20);
const MAX_INPUT_CHARS = 20_000;
const CACHE_TTL_MS = 2 * 60_000;

// ---- tiny per-IP rate limiter (no extra dependency) -------------------------
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || "unknown";
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= rateLimitPerMin()) {
    res.set("Retry-After", "30");
    return res.status(429).json({
      success: false,
      code: "CLIENT_RATE_LIMITED",
      message: "Bahut zyada requests. Thodi der baad try karein.",
      retryAfterSeconds: 30,
    });
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    if (!list.some((t) => now - t < 60_000)) hits.delete(ip);
  }
}, 5 * 60_000).unref();

// ---- cache + in-flight de-duplication ---------------------------------------
// Double clicks / React re-renders / identical retries cost one Gemini call.
const cache = new Map(); // key -> { text, expires }
const inflight = new Map(); // key -> Promise<string>

function cacheKey(model, input) {
  return `${model}\n${input}`;
}

router.post("/", rateLimit, async (req, res) => {
  const { model, input } = req.body || {};

  if (typeof input !== "string" || !input.trim()) {
    return res
      .status(400)
      .json({ success: false, code: "BAD_REQUEST", message: "input required" });
  }
  if (input.length > MAX_INPUT_CHARS) {
    return res.status(413).json({
      success: false,
      code: "INPUT_TOO_LARGE",
      message: "Input bahut bada hai.",
    });
  }
  if (!allowedModels().has(model)) {
    return res.status(400).json({
      success: false,
      code: "BAD_MODEL",
      message: "Model allowed nahi hai.",
    });
  }

  const key = cacheKey(model, input);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return res.json({ success: true, output_text: cached.text, cached: true });
  }

  try {
    let promise = inflight.get(key);
    if (!promise) {
      promise = generateWithPool({ model, input })
        .then((r) => String(r.output_text ?? ""))
        .finally(() => inflight.delete(key));
      inflight.set(key, promise);
    }
    const text = await promise;
    if (text) cache.set(key, { text, expires: Date.now() + CACHE_TTL_MS });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return res.json({ success: true, output_text: text });
  } catch (err) {
    if (err instanceof GeminiPoolError) {
      if (err.retryAfterSeconds) res.set("Retry-After", String(err.retryAfterSeconds));
      return res.status(err.status).json({
        success: false,
        code: err.code,
        message: err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    }
    console.error("[gemini] request failed:", err?.message ?? err);
    const status = Number(err?.status) >= 400 && Number(err?.status) < 500 ? 400 : 502;
    return res.status(status).json({
      success: false,
      code: "GEMINI_ERROR",
      message: "AI se jawab nahi mila. Dobara koshish karein.",
    });
  }
});

// Key health (last 4 chars only). Disabled in production unless enabled.
router.get("/status", (req, res) => {
  if (process.env.NODE_ENV === "production" && !process.env.GEMINI_STATUS_ENABLED) {
    return res.status(404).end();
  }
  res.json({ success: true, keys: poolStatus() });
});

export default router;