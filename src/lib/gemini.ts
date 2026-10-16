// ---------------------------------------------------------------------------
// Gemini client (browser side)
//
// All Gemini calls now go through the backend (POST /api/gemini). The API keys
// live only in the server's .env (GEMINI_API_KEYS=key1,key2,...), where key
// rotation, cooldowns and rate limiting are handled. Nothing secret is bundled
// into the frontend any more.
//
// The exports below keep the same names/signatures the pages already use:
// callGemini, extractJson, isQuotaOrRateLimitError, QUOTA_ERROR_MESSAGE_HI.
// ---------------------------------------------------------------------------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");
const REQUEST_TIMEOUT_MS = 90_000;

export class GeminiRequestError extends Error {
  status: number;
  code: string;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    code: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "GeminiRequestError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const QUOTA_CODES = new Set([
  "QUOTA_EXHAUSTED",
  "RATE_LIMITED",
  "CLIENT_RATE_LIMITED",
]);

export function isQuotaOrRateLimitError(err: unknown) {
  if (err instanceof GeminiRequestError) {
    return err.status === 429 || QUOTA_CODES.has(err.code);
  }
  return false;
}

export const QUOTA_ERROR_MESSAGE_HI =
  "AI service ki limit abhi poori ho gayi hai. Kripya thodi der baad dobara koshish karein.";

// Drop-in replacement for the old callGemini(): returns an object with
// `output_text`, which is all the pages read from the response.
export async function callGemini(params: { model: string; input: string }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new GeminiRequestError(
        "AI ka jawab aane mein bahut der lag gayi. Dobara koshish karein.",
        408,
        "TIMEOUT",
      );
    }
    throw new GeminiRequestError(
      "Server se connect nahi ho paya. Internet ya server check karein.",
      0,
      "NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }

  let data: {
    success?: boolean;
    output_text?: string;
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
  } | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new GeminiRequestError(
      data?.message || "AI se jawab nahi mila. Dobara koshish karein.",
      response.status,
      data?.code || "UNKNOWN",
      data?.retryAfterSeconds,
    );
  }

  return { output_text: data.output_text ?? "" };
}

// Extracts the first well-formed JSON object found in a model response,
// tolerating markdown code fences and stray commentary around it.
export function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}