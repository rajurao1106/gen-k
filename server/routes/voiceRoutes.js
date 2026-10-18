import express from "express";

// Hosted voice cloning + text-to-speech. Two providers, picked by .env:
//   Fish Audio  (FISH_API_KEY)        -> has a FREE API tier  (default if set)
//   ElevenLabs  (ELEVENLABS_API_KEY)  -> paid plan needed for cloning
// The API key stays on the server; the browser only ever sees a voice id.
//
//   POST   /api/voice/clone        raw audio body  -> { success, voiceId }
//   POST   /api/voice/speak        { voiceId, text } -> audio/mpeg
//   DELETE /api/voice/:voiceId     removes the cloned voice
//
// .env:
//   VOICE_PROVIDER=fish|elevenlabs    (optional; auto-detected from the keys)
//   FISH_API_KEY=...  FISH_MODEL=s2.1-pro-free
//   ELEVENLABS_API_KEY=...  ELEVENLABS_MODEL=eleven_multilingual_v2

const router = express.Router();

const API = "https://api.elevenlabs.io/v1";
const VOICE_NAME_PREFIX = "genk-";
const MAX_SAMPLE_BYTES = 10 * 1024 * 1024; // ElevenLabs limit per file
const MAX_TEXT_CHARS = 1200;
const VOICE_ID_RE = /^[A-Za-z0-9]{10,40}$/;

const FISH = "https://api.fish.audio";
const provider = () =>
  process.env.VOICE_PROVIDER ||
  (process.env.FISH_API_KEY ? "fish" : process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "");
const apiKey = () =>
  provider() === "fish" ? process.env.FISH_API_KEY || "" : process.env.ELEVENLABS_API_KEY || "";
const modelId = () => process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const fishModel = () => process.env.FISH_MODEL || "s2.1-pro-free";

function requireKey(req, res, next) {
  if (!apiKey()) {
    return res.status(503).json({
      success: false,
      message: "Voice service is not configured on the server.",
    });
  }
  next();
}

const extFor = (type) =>
  ({
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/flac": "flac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
  })[type] || "mp3";

// ---- clone ------------------------------------------------------------------
router.post(
  "/clone",
  requireKey,
  express.raw({ type: () => true, limit: MAX_SAMPLE_BYTES }),
  async (req, res) => {
    const audio = req.body;
    if (!Buffer.isBuffer(audio) || audio.length < 10_000) {
      return res.status(400).json({
        success: false,
        message: "Send a voice sample of at least ~10 seconds.",
      });
    }

    const contentType = (req.headers["content-type"] || "audio/mpeg").split(";")[0].trim();
    const label = String(req.query.label || "friend").replace(/[^\w .-]/g, "").slice(0, 40) || "friend";

    try {
      const form = new FormData();
      const blob = new Blob([audio], { type: contentType });
      const fileName = `sample.${extFor(contentType)}`;
      const title = `${VOICE_NAME_PREFIX}${label}-${Date.now()}`;
      let upstream;

      if (provider() === "fish") {
        form.append("type", "tts");
        form.append("title", title);
        form.append("train_mode", "fast");
        form.append("visibility", "private");
        form.append("enhance_audio_quality", "true");
        form.append("voices", blob, fileName);
        upstream = await fetch(`${FISH}/model`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey()}` },
          body: form,
        });
      } else {
        form.append("name", title);
        form.append("remove_background_noise", "true");
        form.append("files", blob, fileName);
        upstream = await fetch(`${API}/voices/add`, {
          method: "POST",
          headers: { "xi-api-key": apiKey() },
          body: form,
        });
      }
      const data = await upstream.json().catch(() => null);
      const voiceId = provider() === "fish" ? data?._id : data?.voice_id;

      if (!upstream.ok || !voiceId) {
        console.error("Voice clone failed:", provider(), upstream.status, JSON.stringify(data));
        const status = upstream.status === 401 || upstream.status === 402 ? 503 : 502;
        return res.status(status).json({
          success: false,
          message:
            upstream.status === 402
              ? "Voice cloning needs a paid plan or more credits on the server."
              : "Could not create a voice from this sample. Try a clearer 30–60 second recording.",
        });
      }
      res.status(201).json({ success: true, voiceId });
    } catch (error) {
      console.error("Voice clone error:", error);
      res.status(502).json({ success: false, message: "Voice service is unreachable." });
    }
  },
);

// ---- speak ------------------------------------------------------------------
router.post("/speak", requireKey, async (req, res) => {
  const { voiceId, text } = req.body || {};
  const clean = typeof text === "string" ? text.trim() : "";

  if (typeof voiceId !== "string" || !VOICE_ID_RE.test(voiceId)) {
    return res.status(400).json({ success: false, message: "Invalid voice." });
  }
  if (!clean || clean.length > MAX_TEXT_CHARS) {
    return res.status(400).json({
      success: false,
      message: `Text must be 1–${MAX_TEXT_CHARS} characters.`,
    });
  }

  try {
    const upstream =
      provider() === "fish"
        ? await fetch(`${FISH}/v1/tts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey()}`,
              "Content-Type": "application/json",
              model: fishModel(),
            },
            body: JSON.stringify({ text: clean, reference_id: voiceId, format: "mp3" }),
          })
        : await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: "POST",
            headers: {
              "xi-api-key": apiKey(),
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: clean,
              model_id: modelId(),
              voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true },
            }),
          });

    if (!upstream.ok) {
      console.error("TTS failed:", provider(), upstream.status, await upstream.text().catch(() => ""));
      return res.status(upstream.status === 404 ? 404 : 502).json({
        success: false,
        message:
          upstream.status === 404
            ? "This voice no longer exists. Please add it again."
            : "Could not generate speech right now.",
      });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "no-store" });
    res.send(buffer);
  } catch (error) {
    console.error("Voice speak error:", error);
    res.status(502).json({ success: false, message: "Voice service is unreachable." });
  }
});

// ---- delete -----------------------------------------------------------------
router.delete("/:voiceId", requireKey, async (req, res) => {
  const { voiceId } = req.params;
  if (!VOICE_ID_RE.test(voiceId)) {
    return res.status(400).json({ success: false, message: "Invalid voice." });
  }

  try {
    const fish = provider() === "fish";
    const url = fish ? `${FISH}/model/${voiceId}` : `${API}/voices/${voiceId}`;
    const headers = fish ? { Authorization: `Bearer ${apiKey()}` } : { "xi-api-key": apiKey() };

    // Only ever delete voices this app created.
    const info = await fetch(url, { headers });
    if (info.status === 404) return res.json({ success: true });
    const meta = await info.json().catch(() => null);
    const name = fish ? meta?.title : meta?.name;
    if (!info.ok || !String(name || "").startsWith(VOICE_NAME_PREFIX)) {
      return res.status(403).json({ success: false, message: "Not allowed." });
    }

    const del = await fetch(url, { method: "DELETE", headers });
    if (!del.ok && del.status !== 404) {
      return res.status(502).json({ success: false, message: "Could not remove the voice." });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Voice delete error:", error);
    res.status(502).json({ success: false, message: "Voice service is unreachable." });
  }
});

export default router;