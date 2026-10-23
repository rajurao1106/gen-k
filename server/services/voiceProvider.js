import { createHash } from "node:crypto";

const API_BASE_URL = (process.env.VOICE_PROVIDER_BASE_URL || "https://api.boson.ai/v1")
  .replace(/\/+$/, "");
const MODEL = "higgs-tts-3";
const PRESET_VOICE = process.env.VOICE_PRESET || "oliver";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const MAX_PARALLEL_REQUESTS = 3;
const CACHE_TTL_MS = 30 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const audioCache = new Map();
const queue = [];
let activeRequests = 0;

export class VoiceProviderError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "VoiceProviderError";
    this.code = code;
    this.status = status;
  }
}

function cacheKey(text, voiceId) {
  return createHash("sha256").update(`${text}\0${voiceId}`).digest("hex");
}

function getCachedAudio(key) {
  const entry = audioCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    audioCache.delete(key);
    return null;
  }
  audioCache.delete(key);
  audioCache.set(key, entry);
  return entry.audio;
}

function cacheAudio(key, audio) {
  while (audioCache.size >= MAX_CACHE_ENTRIES) {
    audioCache.delete(audioCache.keys().next().value);
  }
  audioCache.set(key, { audio, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function withConcurrencyLimit(task) {
  if (activeRequests >= MAX_PARALLEL_REQUESTS) {
    await new Promise((resolve) => queue.push(resolve));
  } else {
    activeRequests += 1;
  }
  try {
    return await task();
  } finally {
    const next = queue.shift();
    if (next) next();
    else activeRequests -= 1;
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestSpeech(input, id) {
  const key = cacheKey(input.input, id);
  const cached = getCachedAudio(key);
  if (cached) return cached;

  const audio = await withConcurrencyLimit(async () => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${API_BASE_URL}/audio/speech`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.BOSON_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            input: input.input,
            response_format: "mp3",
            ...input.options,
          }),
          signal: controller.signal,
        });
        if (response.status === 429 && attempt < MAX_ATTEMPTS) {
          await wait(250 * (2 ** (attempt - 1)));
          continue;
        }
        if (response.status === 401 || response.status === 403) {
          throw new VoiceProviderError("BAD_API_KEY", "The speech provider rejected its API key.", response.status);
        }
        if (response.status === 429) {
          throw new VoiceProviderError("RATE_LIMITED", "The speech provider is rate-limited.", response.status);
        }
        if (!response.ok) {
          throw new VoiceProviderError("PROVIDER_ERROR", "The speech provider could not generate audio.", response.status);
        }

        const body = Buffer.from(await response.arrayBuffer());
        if (body.length === 0) {
          throw new VoiceProviderError("EMPTY_AUDIO", "The speech provider returned empty audio.");
        }
        cacheAudio(key, body);
        return body;
      } catch (error) {
        if (error instanceof VoiceProviderError) throw error;
        if (error?.name === "AbortError") {
          throw new VoiceProviderError("TIMEOUT", "The speech request timed out.");
        }
        throw new VoiceProviderError("NETWORK_ERROR", "Could not reach the speech provider.");
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new VoiceProviderError("RATE_LIMITED", "The speech provider is rate-limited.", 429);
  });
  return audio;
}

export function synthesize(text, voice = PRESET_VOICE) {
  return requestSpeech({ input: text, options: { voice } }, `preset:${voice}`);
}

export function synthesizeWithClone(
  text,
  referenceAudio,
  voiceId = createHash("sha256").update(referenceAudio).digest("hex"),
  referenceAudioType = "audio/mpeg",
) {
  const encodedAudio = Buffer.from(referenceAudio).toString("base64");
  return requestSpeech(
    {
      input: text,
      options: {
        ref_audio: `data:${referenceAudioType};base64,${encodedAudio}`,
      },
    },
    `clone:${voiceId}`,
  );
}

export function getPresetVoice() {
  return PRESET_VOICE;
}
