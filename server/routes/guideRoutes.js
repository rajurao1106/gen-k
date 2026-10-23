import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import DailyGuide from "../models/DailyGuide.js";
import UserDetail from "../models/UserDetail.js";
import { userRateLimit as createUserRateLimit } from "../middleware/featureAccess.js";
import { GeminiPoolError, generateWithPool } from "../services/geminiKeyPool.js";
import { getDayKey, hasAccess } from "../services/entitlements.js";

const router = express.Router();
const MODEL = "gemini-3.5-flash-lite";
const LOCK_MS = 150_000;
const FAILED_RETRY_MS = 5_000;
const REQUEST_WAIT_MS = 110_000;
const POLL_INTERVAL_MS = 400;
const limitPerUser = createUserRateLimit({
  limit: () => Number(process.env.GUIDE_RATE_LIMIT_PER_MIN || 10),
  code: "USER_RATE_LIMITED",
});
const profileSchema = z.object({ profileId: z.string().regex(/^[\da-f]{24}$/i) });

const SIGNS = [
  "Mesh (Aries)", "Vrishabh (Taurus)", "Mithun (Gemini)", "Kark (Cancer)",
  "Singh (Leo)", "Kanya (Virgo)", "Tula (Libra)", "Vrishchik (Scorpio)",
  "Dhanu (Sagittarius)", "Makar (Capricorn)", "Kumbh (Aquarius)", "Meen (Pisces)",
];
const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
  "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
  "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
  "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
  "Uttara Bhadrapada", "Revati",
];

class GuideError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeLongitude = (value) => ((value % 360) + 360) % 360;
const radians = (degrees) => (degrees * Math.PI) / 180;

function timezoneOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]),
  );
  return Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  ) - utcMs;
}

function moonAtBirth(profile) {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(profile.dateOfBirth);
  const timeParts = /^(\d{1,2}):(\d{2})/.exec(
    profile.birthTimeUnknown ? "12:00" : profile.timeOfBirth,
  );
  if (!dateParts || !timeParts) return null;

  const [, year, month, day] = dateParts;
  const [, hour, minute] = timeParts;
  const guess = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  let utcMs = guess - 330 * 60_000;
  const timeZone = profile.birthTimezone || "Asia/Kolkata";
  try {
    const first = guess - timezoneOffsetMs(guess, timeZone);
    utcMs = guess - timezoneOffsetMs(first, timeZone);
  } catch {
    // Invalid saved timezone falls back to India Standard Time.
  }

  const julianDay = utcMs / 86_400_000 + 2_440_587.5;
  const centuries = (julianDay - 2_451_545.0) / 36_525;
  const sine = (offset, rate) => Math.sin(radians(offset + rate * centuries));
  const tropical =
    218.32 +
    481_267.881 * centuries +
    6.29 * sine(135.0, 477_198.87) -
    1.27 * sine(259.3, -413_335.36) +
    0.66 * sine(235.7, 890_534.22) +
    0.21 * sine(269.9, 954_397.74) -
    0.19 * sine(357.5, 35_999.05) -
    0.11 * sine(186.5, 966_404.03);
  const ayanamsa = 23.853 + (0.013969 * (julianDay - 2_451_545.0)) / 365.25;
  const longitude = normalizeLongitude(tropical - ayanamsa);
  const nakshatraSpan = 360 / 27;
  const nakshatraIndex = Math.floor(longitude / nakshatraSpan);
  return {
    rashi: SIGNS[Math.floor(longitude / 30)],
    nakshatra: NAKSHATRAS[nakshatraIndex],
    pada: Math.floor((longitude % nakshatraSpan) / (nakshatraSpan / 4)) + 1,
    approximate: profile.birthTimeUnknown === true,
  };
}

function buildPrompt(profile, dayKey) {
  const moon = moonAtBirth(profile);
  const dateLabel = new Date(`${dayKey}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `You are a warm Vedic astrologer writing a short DAILY guide for one person.
Today is ${dateLabel} (Asia/Kolkata).
Person: name ${profile.fullName}, gender ${profile.gender || "not given"}, born ${profile.dateOfBirth} at ${profile.timeOfBirth || "unknown"} in ${profile.placeOfBirth || "not given"}.
${profile.relationshipStatus ? `Relationship status: ${profile.relationshipStatus}.` : ""}
${moon ? `Chandra rashi (Moon sign): ${moon.rashi}, nakshatra ${moon.nakshatra} pada ${moon.pada}${moon.approximate ? " (approximate because birth time is unknown)" : ""}.` : "Birth time details are incomplete; avoid making specific chart claims."}

Write in simple Hinglish (Hindi in Roman script), friendly and short.
Return ONLY valid JSON, no markdown, exactly this shape:
{
  "belief": "<max 7 words, positive mindset line>",
  "power": "<max 8 words, about work, learning or spirituality today>",
  "caution": "<max 8 words, one gentle thing to watch today>",
  "note": "<max 2 sentences, 40 words, about today's mood>",
  "remedy": {"title": "<max 6 words>", "steps": ["<short step>", "<short step>"], "mantra": "<short mantra, or empty string>"},
  "luckyNumber": <integer 1-9>,
  "luckyColor": "<one color>",
  "luckyDirection": "<one compass direction>",
  "energy": <integer 40-95>
}
Rules: remedy must be simple, safe and doable at home. No medical, legal, financial or fear-based claims. Make it specific to today's weekday.`;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseGuide(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || !parsed.remedy || typeof parsed.remedy !== "object") {
      return null;
    }
    const content = {
      belief: cleanText(parsed.belief, 80),
      power: cleanText(parsed.power, 90),
      caution: cleanText(parsed.caution, 90),
      note: cleanText(parsed.note, 320),
      luckyNo: Math.min(9, Math.max(1, Math.round(Number(parsed.luckyNumber) || 1))),
      color: cleanText(parsed.luckyColor, 20) || "White",
      direction: cleanText(parsed.luckyDirection, 20) || "East",
      energy: Math.min(100, Math.max(0, Math.round(Number(parsed.energy) || 70))),
    };
    const remedy = {
      title: cleanText(parsed.remedy.title, 70),
      steps: Array.isArray(parsed.remedy.steps)
        ? parsed.remedy.steps.map((step) => cleanText(step, 140)).filter(Boolean).slice(0, 4)
        : [],
      mantra: cleanText(parsed.remedy.mantra, 90),
    };
    if (
      !content.belief || !content.power || !content.caution || !content.note ||
      !remedy.title || !remedy.steps.length
    ) return null;
    return { content, remedy };
  } catch {
    return null;
  }
}

async function reserveGuide(userId, profileId, dayKey) {
  const deadline = Date.now() + REQUEST_WAIT_MS;
  const generationToken = crypto.randomUUID();

  while (Date.now() < deadline) {
    const now = new Date();
    const existing = await DailyGuide.findOne({ userId, profileId, dayKey });
    if (existing?.status === "ready") return { record: existing, owner: false };
    if (existing?.status === "failed" && now - existing.failedAt < FAILED_RETRY_MS) {
      throw new GuideError("Today's guide could not be generated. Please try again shortly.", 502, existing.errorCode || "GUIDE_GENERATION_FAILED");
    }
    if (existing) {
      const claimable = {
        _id: existing._id,
        $or: [
          { status: "failed", failedAt: { $lte: new Date(now.getTime() - FAILED_RETRY_MS) } },
          { status: "generating", lockExpiresAt: { $lte: now } },
        ],
      };
      const record = await DailyGuide.findOneAndUpdate(
        claimable,
        {
          $set: {
            status: "generating",
            generationToken,
            lockExpiresAt: new Date(now.getTime() + LOCK_MS),
          },
          $unset: { content: 1, remedy: 1, failedAt: 1, errorCode: 1 },
        },
        { new: true },
      );
      if (record) return { record, owner: true };
      if (existing.status === "generating" && existing.lockExpiresAt > now) {
        await pause(POLL_INTERVAL_MS);
      }
      continue;
    }

    try {
      const record = await DailyGuide.create({
        userId,
        profileId,
        dayKey,
        status: "generating",
        generationToken,
        lockExpiresAt: new Date(now.getTime() + LOCK_MS),
      });
      return { record, owner: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new GuideError("The daily guide is still being prepared. Please retry shortly.", 503, "GUIDE_IN_PROGRESS");
}

async function getOrGenerateGuide(userId, profile, dayKey) {
  const reservation = await reserveGuide(userId, profile._id, dayKey);
  if (!reservation.owner) return { record: reservation.record, cached: true };

  try {
    const response = await generateWithPool({
      model: MODEL,
      input: buildPrompt(profile, dayKey),
    });
    const parsed = parseGuide(String(response.output_text ?? ""));
    if (!parsed) throw new GuideError("The daily guide response was invalid.", 502, "INVALID_GUIDE");

    const saved = await DailyGuide.findOneAndUpdate(
      { _id: reservation.record._id, generationToken: reservation.record.generationToken },
      {
        $set: { content: parsed.content, remedy: parsed.remedy, status: "ready" },
        $unset: { generationToken: 1, lockExpiresAt: 1, failedAt: 1, errorCode: 1 },
      },
      { new: true },
    );
    if (saved) return { record: saved, cached: false };
    const current = await DailyGuide.findOne({ userId, profileId: profile._id, dayKey });
    if (current?.status === "ready") return { record: current, cached: true };
    throw new GuideError("Today's guide could not be saved. Please retry.", 503, "GUIDE_SAVE_FAILED");
  } catch (error) {
    const code = error instanceof GeminiPoolError ? error.code : error?.code || "GUIDE_GENERATION_FAILED";
    await DailyGuide.findOneAndUpdate(
      { _id: reservation.record._id, generationToken: reservation.record.generationToken },
      {
        $set: { status: "failed", failedAt: new Date(), errorCode: code },
        $unset: { generationToken: 1, lockExpiresAt: 1 },
      },
    );
    throw error;
  }
}

router.post("/today", limitPerUser, async (req, res, next) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "A valid profileId is required.",
      errors: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    });
  }

  try {
    const profile = await UserDetail.findOne({
      _id: parsed.data.profileId,
      userId: req.user._id,
    }).lean();
    if (!profile) {
      return res.status(404).json({
        success: false,
        code: "PROFILE_NOT_FOUND",
        message: "Profile not found.",
      });
    }
    const dayKey = getDayKey();
    const { record: guide, cached } = await getOrGenerateGuide(req.user._id, profile, dayKey);
    const fullAccess = await hasAccess(req.user._id, "daily_guide_full");
    const preview = {
      belief: guide.content.belief,
      power: guide.content.power,
      caution: guide.content.caution,
      luckyNo: guide.content.luckyNo,
      color: guide.content.color,
      full: false,
    };
    return res.json({
      success: true,
      data: fullAccess
        ? { ...guide.content, remedy: guide.remedy, full: true }
        : preview,
      dayKey,
      cached,
    });
  } catch (error) {
    if (error instanceof GeminiPoolError) {
      if (error.retryAfterSeconds) res.set("Retry-After", String(error.retryAfterSeconds));
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.status >= 500
          ? "Today's guide is temporarily unavailable. Please try again."
          : error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }
    if (error instanceof GuideError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    next(error);
  }
});

export default router;
