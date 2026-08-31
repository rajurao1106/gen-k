import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// API key pool + auto-rotation
//
// Add as many keys as you have in your .env file:
//   VITE_API_KEY=key1
//   VITE_API_KEY_2=key2
//   VITE_API_KEY_3=key3
// ...or as one comma-separated list:
//   VITE_API_KEYS=key1,key2,key3
//
// Whenever a call hits that key's quota/rate limit, callGemini() automatically
// rotates to the next key in the pool and retries — no manual key-swapping
// needed. The current key index is remembered in localStorage so rotation
// persists across page reloads too.
// ---------------------------------------------------------------------------

const RAW_KEYS = [
  import.meta.env.VITE_API_KEY,
  import.meta.env.VITE_API_KEY_2,
  import.meta.env.VITE_API_KEY_3,
  import.meta.env.VITE_API_KEY_4,
  import.meta.env.VITE_API_KEY_5,
  ...(import.meta.env.VITE_API_KEYS
    ? String(import.meta.env.VITE_API_KEYS).split(",")
    : []),
];

export const API_KEYS: string[] = Array.from(
  new Set(RAW_KEYS.filter(Boolean).map((k: string) => k.trim())),
);

const KEY_INDEX_STORAGE = "gemini_active_key_index";

let currentKeyIndex = (() => {
  const stored = Number(localStorage.getItem(KEY_INDEX_STORAGE));
  return Number.isFinite(stored) && stored >= 0 && stored < API_KEYS.length
    ? stored
    : 0;
})();

function rotateToNextKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  localStorage.setItem(KEY_INDEX_STORAGE, String(currentKeyIndex));
}

export function isQuotaOrRateLimitError(err: unknown) {
  const anyErr = err as { status?: number; code?: number; message?: string };
  const status = anyErr?.status ?? anyErr?.code;
  const message = String(anyErr?.message ?? err ?? "").toLowerCase();
  return (
    status === 429 ||
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("rate_limit") ||
    message.includes("429")
  );
}

export const QUOTA_ERROR_MESSAGE_HI =
  "Saari configured API keys ki daily/rate limit khatam ho chuki hai. Kripya .env me ek nayi API key add karke app restart karein.";

// Drop-in replacement for `ai.interactions.create(...)` that automatically
// rotates through API_KEYS whenever the active key's limit is reached.
export async function callGemini(params: { model: string; input: string }) {
  if (API_KEYS.length === 0) {
    throw new Error(
      "Koi API key configure nahi hai. .env me VITE_API_KEY set karein.",
    );
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const key = API_KEYS[currentKeyIndex];
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.interactions.create(params);
      return response;
    } catch (err) {
      lastError = err;
      if (isQuotaOrRateLimitError(err) && API_KEYS.length > 1) {
        console.warn(
          `API key #${currentKeyIndex + 1} ki limit khatam ho gayi, agli key try ki jaa rahi hai...`,
        );
        rotateToNextKey();
        continue;
      }
      throw err;
    }
  }

  throw (
    lastError ??
    new Error("Saari configured API keys ki limit khatam ho chuki hai.")
  );
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
