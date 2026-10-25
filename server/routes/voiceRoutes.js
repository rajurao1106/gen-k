import express from "express";
import VoiceProfile from "../models/VoiceProfile.js";
import { requireFeature, userRateLimit } from "../middleware/featureAccess.js";
import { consumeUsage, refundUsage } from "../services/entitlements.js";
import {
  getPresetVoice,
  synthesize,
  synthesizeWithClone,
} from "../services/voiceProvider.js";

const router = express.Router();
const CONSENT_VERSION = "voice-consent-v1";
const MAX_SAMPLE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 1200;
const dailyCharacterLimit = () => Number(process.env.VOICE_CHARACTERS_PER_DAY || 10_000);
const limitSpeakPerUser = userRateLimit({
  limit: () => Number(process.env.VOICE_RATE_LIMIT_PER_MIN || 10),
  code: "USER_RATE_LIMITED",
});
const limitDeletePerUser = userRateLimit({
  limit: () => Number(process.env.VOICE_DELETE_RATE_LIMIT_PER_MIN || 10),
  code: "USER_RATE_LIMITED",
});

function requireBosonKey(_req, res, next) {
  if (!process.env.BOSON_API_KEY) {
    return res.status(503).json({
      success: false,
      message: "Voice generation is not configured on the server. Please try again later.",
    });
  }
  next();
}

function publicVoice(profile) {
  return {
    id: profile._id.toString(),
    label: profile.label,
    language: profile.language,
    createdAt: profile.createdAt,
  };
}

function referenceTypeFor(type) {
  const normalized = type.toLowerCase();
  if (["audio/mpeg", "audio/mp3"].includes(normalized)) return "audio/mpeg";
  if (["audio/wav", "audio/x-wav", "audio/wave"].includes(normalized)) return "audio/wav";
  if (normalized === "audio/flac") return "audio/flac";
  if (["audio/opus", "audio/ogg"].includes(normalized)) return "audio/opus";
  if (["audio/mp4", "audio/x-m4a", "audio/m4a"].includes(normalized)) return "audio/mp4";
  if (["audio/3gpp", "video/3gpp"].includes(normalized)) return "audio/3gpp";
  if (normalized === "audio/amr") return "audio/amr";
  return "";
}

router.get("/", async (req, res, next) => {
  try {
    const profiles = await VoiceProfile.find({ userId: req.user._id })
      .where("referenceAudio").exists(true)
      .select("_id label language createdAt")
      .sort({ createdAt: 1 })
      .lean();
    res.json({ success: true, voices: profiles.map(publicVoice) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/clone",
  requireFeature("voice_reply"),
  requireBosonKey,
  express.raw({ type: () => true, limit: MAX_SAMPLE_BYTES }),
  async (req, res) => {
    const audio = req.body;
    if (!Buffer.isBuffer(audio) || audio.length < 10_000) {
      return res.status(400).json({
        success: false,
        message: "Send a voice sample of at least ~10 seconds.",
      });
    }

    if (req.get("x-voice-consent") !== "true") {
      return res.status(400).json({
        success: false,
        code: "VOICE_CONSENT_REQUIRED",
        message: "Confirm that you own this voice or have clear permission before uploading.",
      });
    }
    const consentConfirmedBy = req.get("x-voice-consent-confirmed-by");
    if (!["self", "has_permission"].includes(consentConfirmedBy)) {
      return res.status(400).json({
        success: false,
        code: "VOICE_CONSENT_REQUIRED",
        message: "Confirm whether this is your voice or you have permission to use it.",
      });
    }
    const language = req.get("x-voice-language");
    if (!["en", "hi"].includes(language)) {
      return res.status(400).json({
        success: false,
        message: "Choose Hindi or English for this voice profile.",
      });
    }

    const contentType = (req.headers["content-type"] || "audio/mpeg").split(";")[0].trim();
    const referenceAudioType = referenceTypeFor(contentType);
    if (!referenceAudioType) {
      return res.status(400).json({
        success: false,
        message: "Use an MP3, WAV, FLAC, OPUS, M4A, 3GP, or AMR voice recording.",
      });
    }
    const label = String(req.query.label || "My voice").slice(0, 40).trim() || "My voice";

    try {
      const profile = await VoiceProfile.create({
        userId: req.user._id,
        referenceAudio: audio,
        referenceAudioType,
        label,
        language,
        consentAt: new Date(),
        consentVersion: CONSENT_VERSION,
        consentConfirmedBy,
      });
      return res.status(201).json({ success: true, voice: publicVoice(profile) });
    } catch (error) {
      console.error("Voice sample save failed:", error?.message ?? error);
      return res.status(500).json({
        success: false,
        message: "Could not save this voice sample. Please try again.",
      });
    }
  },
);

router.post(
  "/speak",
  requireFeature("voice_reply"),
  limitSpeakPerUser,
  requireBosonKey,
  async (req, res) => {
    const { voiceProfileId, text } = req.body || {};
    const clean = typeof text === "string" ? text.trim() : "";
    const characterCount = Array.from(clean).length;
    if (typeof voiceProfileId !== "string" || !/^[a-f\d]{24}$/i.test(voiceProfileId)) {
      return res.status(400).json({ success: false, message: "Invalid voice profile." });
    }
    if (!clean || characterCount > MAX_TEXT_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Text must be 1–${MAX_TEXT_CHARS} characters.`,
      });
    }

    let usageAt;
    let usageConsumed = false;
    try {
      const profile = await VoiceProfile.findOne({
        _id: voiceProfileId,
        userId: req.user._id,
        referenceAudio: { $exists: true },
      }).select("referenceAudio referenceAudioType");
      if (!profile) {
        return res.status(404).json({
          success: false,
          code: "VOICE_NOT_FOUND",
          message: "This voice is not available on your account.",
        });
      }

      usageAt = new Date();
      const usage = await consumeUsage(
        req.user._id,
        "voice_characters",
        characterCount,
        dailyCharacterLimit(),
        usageAt,
      );
      if (!usage.allowed) {
        return res.status(402).json({
          success: false,
          code: "QUOTA_EXCEEDED",
          message: "Today's voice character limit has been reached.",
          upgrade: true,
          usage: { used: usage.count, limit: usage.limit, remaining: usage.remaining },
        });
      }
      usageConsumed = true;

      let audio;
      let fallbackMessage = "";
      try {
        audio = await synthesizeWithClone(
          clean,
          profile.referenceAudio,
          profile._id.toString(),
          profile.referenceAudioType,
        );
      } catch (cloneError) {
        console.warn("Saved voice generation failed; trying a preset voice:", cloneError?.message);
        try {
          audio = await synthesize(clean, getPresetVoice());
          fallbackMessage =
            "Your saved voice could not be used, so this reply was spoken with a preset voice.";
        } catch (presetError) {
          const message = presetError?.code === "BAD_API_KEY"
            ? "Voice generation is temporarily unavailable. Please contact support."
            : "Voice generation failed, including the preset voice fallback. Please try again later.";
          console.error("Preset voice fallback failed:", presetError?.message ?? presetError);
          await refundUsage(req.user._id, "voice_characters", characterCount, usageAt);
          usageConsumed = false;
          return res.status(presetError?.code === "BAD_API_KEY" ? 503 : 502).json({
            success: false,
            code: presetError?.code || "VOICE_GENERATION_FAILED",
            message,
          });
        }
      }

      res.set({
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        ...(fallbackMessage
          ? { "X-Voice-Fallback": "preset", "X-Voice-Message": fallbackMessage }
          : {}),
      });
      return res.send(audio);
    } catch (error) {
      if (usageConsumed) {
        await refundUsage(req.user._id, "voice_characters", characterCount, usageAt);
      }
      console.error("Voice speak error:", error?.message ?? error);
      return res.status(error?.code === "BAD_API_KEY" ? 503 : 502).json({
        success: false,
        code: error?.code || "VOICE_GENERATION_FAILED",
        message: error?.code === "BAD_API_KEY"
          ? "Voice generation is temporarily unavailable. Please contact support."
          : error?.code === "TIMEOUT"
            ? "Voice generation timed out. Please try again."
            : error?.code === "RATE_LIMITED"
              ? "Voice generation is busy right now. Please try again shortly."
              : "Could not complete this voice reply. Please try again.",
      });
    }
  },
);

router.delete("/:voiceProfileId", limitDeletePerUser, async (req, res) => {
  const { voiceProfileId } = req.params;
  if (!/^[a-f\d]{24}$/i.test(voiceProfileId)) {
    return res.status(400).json({ success: false, message: "Invalid voice profile." });
  }

  try {
    const profile = await VoiceProfile.findOne({
      _id: voiceProfileId,
      userId: req.user._id,
    });
    if (!profile) {
      return res.status(404).json({
        success: false,
        code: "VOICE_NOT_FOUND",
        message: "This voice is not available on your account.",
      });
    }
    await VoiceProfile.deleteOne({ _id: profile._id, userId: req.user._id });
    return res.json({ success: true });
  } catch (error) {
    console.error("Voice delete error:", error?.message ?? error);
    return res.status(500).json({
      success: false,
      message: "Could not delete this voice profile. Please try again.",
    });
  }
});

export default router;
