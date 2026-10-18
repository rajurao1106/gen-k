import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// Gemini API key pool (server-side only)
//
// Keys are read from .env (never exposed to the browser):
//   GEMINI_API_KEYS=key1,key2,key3          (comma separated)
//   GEMINI_API_KEY=key1  GEMINI_API_KEY_2=key2 ...  (or numbered)
// For backwards compatibility the old VITE_API_KEY* names are read too,
// but rename them: VITE_* variables can leak into the browser bundle.
//
// Improvements over the old browser-side rotation:
//   * a key that hits a limit is put on COOLDOWN and skipped, instead of
//     being retried on every request
//   * per-minute limits (short cooldown) are told apart from daily quota
//     (cooldown until midnight Pacific time, when Google resets it)
//   * invalid/revoked keys are disabled
//   * load is spread round-robin across healthy keys
//   * when every key is cooling down we answer immediately with a
//     retry-after value instead of hammering Google with doomed requests
// ---------------------------------------------------------------------------

const ENV_NAMES = [
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
  "GEMINI_API_KEY_4",
  "GEMINI_API_KEY_5",
  "VITE_API_KEY",
  "VITE_API_KEY_2",
  "VITE_API_KEY_3",
  "VITE_API_KEY_4",
  "VITE_API_KEY_5",
];

const DEFAULT_MINUTE_COOLDOWN_MS = 60_000;
const SERVER_ERROR_COOLDOWN_MS = 10_000;
const INVALID_KEY_COOLDOWN_MS = 60 * 60_000;

let pool = null; // lazily built so dotenv has already run

function loadKeys() {
  const raw = [
    ...ENV_NAMES.map((n) => process.env[n]),
    ...(process.env.GEMINI_API_KEYS || "").split(","),
    ...(process.env.VITE_API_KEYS || "").split(","),
  ];
  const keys = [...new Set(raw.map((k) => (k || "").trim()).filter(Boolean))];
  return keys.map((key, i) => ({
    id: i + 1,
    key,
    // attempts: 1 -> no hidden SDK retries. The SDK would otherwise re-send a
    // 429'd request several times on the same key, burning even more quota.
    // Retrying / rotating is handled by this pool instead.
    client: new GoogleGenAI({
      apiKey: key,
      httpOptions: { retryOptions: { attempts: 1 } },
    }),
    blockedUntil: 0,
    reason: "",
  }));
}

function getPool() {
  if (!pool) {
    pool = loadKeys();
    console.log(`[gemini] ${pool.length} API key(s) loaded`);
    if (process.env.VITE_API_KEY || process.env.VITE_API_KEYS) {
      console.warn(
        "[gemini] VITE_API_KEY* found in .env. Rename to GEMINI_API_KEY* so keys are never bundled into the frontend.",
      );
    }
  }
  return pool;
}

let rr = 0;
let requestGate = Promise.resolve();
let globalCooldownUntil = 0;

export class GeminiPoolError extends Error {
  constructor(code, message, status, retryAfterSeconds) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function errStatus(err) {
  return err?.status ?? err?.code ?? err?.error?.code;
}

function errText(err) {
  return String(err?.message ?? err ?? "");
}

// Milliseconds until the next midnight in Pacific time (Gemini daily reset).
function msUntilPacificMidnight() {
  const now = new Date();
  const la = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
  );
  const next = new Date(la);
  next.setHours(24, 0, 0, 0);
  return Math.max(60_000, next - la);
}

function parseRetryDelayMs(text) {
  // e.g. "Please retry in 34.2s" or "retryDelay":"34s"
  const m =
    text.match(/retry in ([\d.]+)\s*s/i) ||
    text.match(/retryDelay"?\s*[:=]\s*"?([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : null;
}

// Decide what kind of failure this is and how long the key should rest.
export function classifyError(err) {
  const status = Number(errStatus(err));
  const text = errText(err);
  const lower = text.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("permission_denied")
  ) {
    return { type: "invalid", cooldownMs: INVALID_KEY_COOLDOWN_MS };
  }

  if (status === 429 || lower.includes("resource_exhausted")) {
    const daily =
      lower.includes("perday") ||
      lower.includes("per_day") ||
      lower.includes("per day") ||
      lower.includes("daily");
    if (daily) {
      return { type: "daily", cooldownMs: msUntilPacificMidnight() };
    }
    return {
      type: "minute",
      cooldownMs: parseRetryDelayMs(text) ?? DEFAULT_MINUTE_COOLDOWN_MS,
    };
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { type: "server", cooldownMs: SERVER_ERROR_COOLDOWN_MS };
  }

  return { type: "other", cooldownMs: 0 }; // bad request etc. - not the key's fault
}

function pickKey(tried) {
  const keys = getPool();
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[(rr + i) % keys.length];
    if (k.blockedUntil <= now && !tried.has(k.id)) {
      rr = (rr + i + 1) % keys.length;
      return k;
    }
  }
  return null;
}

function soonestRetrySeconds() {
  const now = Date.now();
  const blockedTimes = getPool().map((k) => k.blockedUntil).filter((time) => time > 0);
  if (blockedTimes.length === 0) return 0;
  const soonest = Math.min(...blockedTimes);
  return Math.max(1, Math.ceil((soonest - now) / 1000));
}

function setGlobalCooldownUntil(untilMs) {
  globalCooldownUntil = Math.max(globalCooldownUntil, untilMs);
}

export function poolStatus() {
  const now = Date.now();
  return getPool().map((k) => ({
    key: `#${k.id} ...${k.key.slice(-4)}`,
    available: k.blockedUntil <= now,
    retryInSeconds:
      k.blockedUntil > now ? Math.ceil((k.blockedUntil - now) / 1000) : 0,
    reason: k.reason,
  }));
}

export async function generateWithPool({ model, input }) {
  const previous = requestGate;
  let release;
  requestGate = new Promise((resolve) => {
    release = resolve;
  });

  try {
    await previous;

    const now = Date.now();
    const activeCooldownMs = Math.max(0, globalCooldownUntil - now);
    if (activeCooldownMs > 0) {
      throw new GeminiPoolError(
        "RATE_LIMITED",
        "Abhi bahut zyada requests hain. Thodi der baad try karein.",
        429,
        Math.ceil(activeCooldownMs / 1000),
      );
    }

    const keys = getPool();
    if (keys.length === 0) {
      throw new GeminiPoolError(
        "NO_KEYS",
        "Server par koi Gemini API key configure nahi hai (.env me GEMINI_API_KEYS set karein).",
        500,
      );
    }

    const tried = new Set();
    let lastQuotaError = null;

    for (;;) {
      const entry = pickKey(tried);
      if (!entry) break;
      tried.add(entry.id);

      try {
        // maxRetries: 0 -> the SDK must not silently re-send a 429'd request;
        // rotation to the next key is done by this pool.
        const response = await entry.client.interactions.create(
          { model, input },
          { maxRetries: 0 },
        );
        entry.reason = "";
        return response;
      } catch (err) {
        const { type, cooldownMs } = classifyError(err);

        if (type === "other") throw err; // genuine request problem, don't burn keys

        entry.blockedUntil = Date.now() + cooldownMs;
        entry.reason = type;
        console.warn(
          `[gemini] key #${entry.id} (...${entry.key.slice(-4)}) -> ${type}, resting ${Math.round(cooldownMs / 1000)}s | Google said: ${errText(err).slice(0, 400)}`,
        );
        if (type === "daily" || type === "minute") {
          lastQuotaError = type;
          // NOTE: do not set the global cooldown here. One resting key must
          // not block the others; the global cooldown is set below, only
          // when every key has failed.
        }
        // loop continues with the next healthy key
      }
    }

    // Every key is resting or failed this round.
    const retryAfter = soonestRetrySeconds();
    const globalCooldownMs = Math.max(1000, retryAfter * 1000);
    setGlobalCooldownUntil(Date.now() + globalCooldownMs);

    if (getPool().every((k) => k.reason === "daily")) {
      throw new GeminiPoolError(
        "QUOTA_EXHAUSTED",
        "Saari API keys ki daily limit khatam ho gayi hai.",
        429,
        retryAfter,
      );
    }
    throw new GeminiPoolError(
      "RATE_LIMITED",
      "Abhi bahut zyada requests hain. Thodi der baad try karein.",
      429,
      retryAfter,
    );
  } finally {
    release();
  }
}