import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// Gemini API key pool (server-side only)
//
// Keys are read from .env (never exposed to the browser). Any of these work,
// and they can be mixed (duplicates are removed automatically):
//
//   GEMINI_API_KEYS=key1,key2,key3        (comma / space / newline separated)
//   GEMINI_API_KEY=key1
//   GEMINI_API_KEY_2=key2                 (_2, _3, _4 ... no upper limit)
//
// Old VITE_API_KEY* names are still read for backwards compatibility, but
// rename them: VITE_* variables can leak into the browser bundle.
//
// IMPORTANT: Gemini quota is per Google Cloud PROJECT, not per key. Keys that
// belong to the same project share one quota, so rotating between them does
// not help. Create every key in a different project.
//
// How rotation works:
//   * Round-robin across healthy keys.
//   * A key that fails is put on cooldown and skipped; the SAME request is
//     immediately retried on the next healthy key.
//   * Per-minute limits (short cooldown) are told apart from daily quota
//     (cooldown until midnight Pacific), "limit: 0" (no quota for this
//     model/project) and invalid/expired keys (long cooldown).
//   * If every key is cooling down, we answer immediately with the REAL
//     reason (minute / daily / invalid) and a retry-after value, without
//     hitting Google with doomed requests.
//   * There is no global lock any more: requests no longer queue behind each
//     other, and one resting key never blocks the others.
// ---------------------------------------------------------------------------

const DEFAULT_MINUTE_COOLDOWN_MS = 60_000;
const MAX_MINUTE_COOLDOWN_MS = 10 * 60_000;
const SERVER_ERROR_COOLDOWN_MS = 10_000;
const NETWORK_ERROR_COOLDOWN_MS = 5_000;
const NO_QUOTA_COOLDOWN_MS = 30 * 60_000;
const INVALID_KEY_COOLDOWN_MS = 60 * 60_000;

let pool = null; // lazily built so dotenv has already run
let rr = 0; // round-robin pointer

// ---- loading keys ----------------------------------------------------------

function cleanKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function splitList(value) {
  return String(value ?? "")
    .split(/[\s,;]+/)
    .map(cleanKey)
    .filter(Boolean);
}

// GEMINI_API_KEY -> 1, GEMINI_API_KEY_2 -> 2 ...; VITE_* come after GEMINI_*.
function envRank(name) {
  const n = Number(name.match(/_(\d+)$/)?.[1]) || 1;
  return (name.startsWith("GEMINI") ? 0 : 1000) + n;
}

function loadKeys() {
  const numbered = Object.keys(process.env)
    .filter((n) => /^(GEMINI|VITE)_API_KEY(_\d+)?$/.test(n))
    .sort((a, b) => envRank(a) - envRank(b))
    .map((n) => cleanKey(process.env[n]));

  const raw = [
    ...splitList(process.env.GEMINI_API_KEYS),
    ...numbered,
    ...splitList(process.env.VITE_API_KEYS),
  ];

  const keys = [...new Set(raw.filter(Boolean))];
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
    served: 0,
  }));
}

function getPool() {
  if (!pool) {
    pool = loadKeys();
    console.log(`[gemini] ${pool.length} API key(s) loaded`);
    if (pool.length === 1) {
      console.warn(
        "[gemini] only 1 key loaded - rotation is impossible. Add more keys (GEMINI_API_KEYS=k1,k2,k3), each from a different Google Cloud project.",
      );
    }
    if (process.env.VITE_API_KEY || process.env.VITE_API_KEYS) {
      console.warn(
        "[gemini] VITE_API_KEY* found in .env. Rename to GEMINI_API_KEY* so keys are never bundled into the frontend.",
      );
    }
  }
  return pool;
}

function mask(entry) {
  return `#${entry.id} ...${entry.key.slice(-4)}`;
}

// ---- errors ----------------------------------------------------------------

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

function durationToMs(m) {
  if (!m) return null;
  const [, h, min, s] = m;
  if (h === undefined && min === undefined && s === undefined) return null;
  const seconds = (Number(h || 0) * 60 + Number(min || 0)) * 60 + parseFloat(s || 0);
  return Math.ceil(seconds * 1000);
}

// Google's own wait hint, e.g. "Please retry in 34.2s", "retry in 9h37m14s"
// or "retryDelay":"34s". Returns milliseconds, or null if there is none.
function parseRetryDelayMs(text) {
  return (
    durationToMs(
      text.match(/retry in\s+(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?!s))?\s*(?:([\d.]+)\s*s)?/i),
    ) ??
    durationToMs(
      text.match(/retryDelay"?\s*[:=]\s*"?(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/i),
    )
  );
}

function isNetworkError(err, lower) {
  const code = String(err?.code ?? err?.cause?.code ?? "").toUpperCase();
  return (
    [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "UND_ERR_CONNECT_TIMEOUT",
    ].includes(code) ||
    lower.includes("fetch failed") ||
    lower.includes("network error") ||
    lower.includes("timed out")
  );
}

// Decide what kind of failure this is and how long the key should rest.
// type "other" = the request itself is bad (not the key's fault): not retried.
export function classifyError(err) {
  const status = Number(errStatus(err));
  const text = errText(err);
  const lower = text.toLowerCase();

  // Invalid / expired / revoked key. Google often reports a bad key as HTTP
  // 400 "API key not valid", so check the text before the status code.
  if (
    status === 401 ||
    status === 403 ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key expired") ||
    lower.includes("permission_denied")
  ) {
    return { type: "invalid", cooldownMs: INVALID_KEY_COOLDOWN_MS };
  }

  if (status === 429 || lower.includes("resource_exhausted")) {
    // "limit: 0" = this key's project has NO quota for the model at all.
    if (/limit:\s*0\b/.test(lower)) {
      return { type: "noquota", cooldownMs: NO_QUOTA_COOLDOWN_MS };
    }

    const perMinute = /per[\s_]?minute/.test(lower);
    const perDay = /per[\s_]?day|daily/.test(lower);

    // Only call it "daily" when the error talks about the daily quota and NOT
    // about a per-minute one. Google sometimes lists both metrics in a plain
    // per-minute 429; treating that as daily would bench a healthy key for
    // hours.
    if (perDay && !perMinute) {
      const google = parseRetryDelayMs(text);
      const cooldownMs = google
        ? Math.min(Math.max(google, 60_000), 26 * 3_600_000)
        : msUntilPacificMidnight();
      return { type: "daily", cooldownMs };
    }

    const wait = parseRetryDelayMs(text) ?? DEFAULT_MINUTE_COOLDOWN_MS;
    return {
      type: "minute",
      cooldownMs: Math.min(Math.max(wait, 1_000), MAX_MINUTE_COOLDOWN_MS),
    };
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { type: "server", cooldownMs: SERVER_ERROR_COOLDOWN_MS };
  }

  if (isNetworkError(err, lower)) {
    return { type: "network", cooldownMs: NETWORK_ERROR_COOLDOWN_MS };
  }

  return { type: "other", cooldownMs: 0 }; // bad request etc. - not the key's fault
}

// ---- pool helpers ----------------------------------------------------------

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

// Seconds until the first of the given keys comes back. Only keys that are
// STILL blocked count (expired cooldowns used to be included).
function soonestRetrySeconds(list = getPool()) {
  const now = Date.now();
  const future = list.map((k) => k.blockedUntil).filter((t) => t > now);
  if (future.length === 0) return 1;
  return Math.max(1, Math.ceil((Math.min(...future) - now) / 1000));
}

function formatWait(seconds) {
  if (seconds >= 3600) return `lagbhag ${Math.round(seconds / 3600)} ghante`;
  if (seconds >= 90) return `lagbhag ${Math.round(seconds / 60)} minute`;
  return `${seconds} second`;
}

// Build the error to return when no key can serve the request. The code,
// message and retry time reflect the REAL reason the keys are resting.
//
// Invalid keys are ignored for the decision and for the retry time: waiting
// does not fix them (they need a new key in .env), so one bad key must not
// turn "daily quota finished" into a vague "too many requests" or show a
// misleading 1-hour retry time.
function exhaustedError() {
  const usable = getPool().filter((k) => k.reason !== "invalid");

  if (usable.length === 0) {
    return new GeminiPoolError(
      "KEYS_INVALID",
      "Server ki Gemini API keys invalid ya expired hain. Admin se sampark karein.",
      500,
    );
  }

  const retryAfter = soonestRetrySeconds(usable);

  if (usable.every((k) => k.reason === "daily" || k.reason === "noquota")) {
    return new GeminiPoolError(
      "QUOTA_EXHAUSTED",
      `AI ki free daily limit khatam ho gayi hai. ${formatWait(retryAfter)} baad try karein.`,
      429,
      retryAfter,
    );
  }
  return new GeminiPoolError(
    "RATE_LIMITED",
    "Abhi bahut zyada requests hain. Thodi der baad try karein.",
    429,
    retryAfter,
  );
}

export function poolStatus() {
  const now = Date.now();
  return getPool().map((k) => {
    const blocked = k.blockedUntil > now;
    return {
      key: mask(k),
      available: !blocked,
      retryInSeconds: blocked ? Math.ceil((k.blockedUntil - now) / 1000) : 0,
      reason: blocked ? k.reason : "",
      served: k.served,
    };
  });
}

// ---- main entry ------------------------------------------------------------

export async function generateWithPool({ model, input }) {
  const keys = getPool();
  if (keys.length === 0) {
    throw new GeminiPoolError(
      "NO_KEYS",
      "Server par koi Gemini API key configure nahi hai (.env me GEMINI_API_KEYS set karein).",
      500,
    );
  }

  // Every key is resting: answer right away with the real reason instead of
  // sending requests that are certain to fail.
  const now = Date.now();
  if (keys.every((k) => k.blockedUntil > now)) {
    throw exhaustedError();
  }

  const tried = new Set();

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
      entry.served += 1;
      if (process.env.GEMINI_LOG_KEY_USE !== "0") {
        console.log(`[gemini] ${mask(entry)} ok (${tried.size} key(s) tried)`);
      }
      return response;
    } catch (err) {
      const { type, cooldownMs } = classifyError(err);

      if (type === "other") throw err; // genuine request problem, don't burn keys

      entry.blockedUntil = Date.now() + cooldownMs;
      entry.reason = type;
      console.warn(
        `[gemini] key ${mask(entry)} -> ${type}, resting ${Math.round(cooldownMs / 1000)}s | Google said: ${errText(err).slice(0, 400)}`,
      );
      // loop continues with the next healthy key
    }
  }

  // Every key failed this round (or was already resting).
  const summary = getPool()
    .map((k) => `#${k.id}:${k.reason || "ok"}`)
    .join(" ");
  const finalError = exhaustedError();
  console.warn(
    `[gemini] all ${keys.length} key(s) unavailable -> ${summary} | returning ${finalError.code}` +
      (finalError.retryAfterSeconds ? ` (retry in ${finalError.retryAfterSeconds}s)` : ""),
  );
  throw finalError;
}