import express from "express";
import { z } from "zod";
import { userRateLimit } from "../middleware/featureAccess.js";
import UserDetail from "../models/UserDetail.js";
import { computeChart } from "../services/astro/chart.js";
import {
  geocodePlace,
  searchPlaces,
  resolveCoordinates,
  PlaceNotFoundError,
  InvalidPlaceError,
} from "../services/astro/geocode.js";

const router = express.Router();

const limitChart = userRateLimit({
  limit: () => 30,
  windowMs: 60 * 60_000,
  code: "CHART_RATE_LIMITED",
});

const schema = z
  .object({
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    bot: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    bop: z.string().trim().min(2).max(200),
    // Optional: coordinates the user confirmed (from /places or typed in). Skips guessing.
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    timeZone: z.string().max(64).optional(),
    // "mean" (classical default) or "true" (osculating) Rahu/Ketu.
    nodeType: z.enum(["mean", "true"]).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: "Send both lat and lon, or neither.",
  });

/**
 * Coordinates the user already confirmed for this exact place text (set during onboarding /
 * profile edit, or typed in under "Advanced"). Using them avoids re-guessing the village.
 */
async function savedPlaceFor(userId, bop) {
  const record = await UserDetail.findOne({
    userId,
    placeOfBirth: bop.trim(),
    birthLatitude: { $ne: null },
    birthLongitude: { $ne: null },
  })
    .collation({ locale: "en", strength: 2 }) // case-insensitive exact match
    .sort({ createdAt: -1 })
    .select("placeOfBirth birthLatitude birthLongitude birthTimezone")
    .lean();
  if (!record) return null;
  return {
    lat: record.birthLatitude,
    lon: record.birthLongitude,
    timeZone: record.birthTimezone || undefined,
    label: record.placeOfBirth,
  };
}

// GET /api/chart/places?q=Panibandh, Odisha  -> candidates so the UI can ask "did you mean ...?"
router.get("/places", limitChart, async (req, res, next) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2 || q.length > 200) {
    return res.status(400).json({ success: false, code: "INVALID_QUERY", message: "Type at least 2 characters." });
  }
  try {
    const { candidates } = await searchPlaces(q, { limit: 8 });
    res.json({
      success: true,
      data: candidates.map(({ lat, lon, timeZone, label }) => ({ lat, lon, timeZone, label })),
    });
  } catch (error) {
    if (error instanceof PlaceNotFoundError) {
      return res.status(422).json({ success: false, code: error.code, message: error.message });
    }
    next(error);
  }
});

// POST /api/chart  { dob: "2003-05-14", bot: "06:14", bop: "Panibandh, Odisha, India" }
router.post("/", limitChart, async (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_BIRTH_DETAILS",
      message: "Date (YYYY-MM-DD), time (HH:MM) and place of birth are required.",
    });
  }
  try {
    const { dob, bot, bop, lat, lon, timeZone, nodeType } = parsed.data;
    // Priority: coordinates sent with the request > coordinates the user saved for this
    // place name > geocoding the name (least certain; reports confidence + alternatives).
    let place;
    if (lat !== undefined) {
      place = { ...(await resolveCoordinates({ lat, lon, timeZone, label: bop })), source: "request" };
    } else {
      const saved = await savedPlaceFor(req.user._id, bop);
      place = saved
        ? { ...(await resolveCoordinates(saved)), source: "saved-profile" }
        : { ...(await geocodePlace(bop)), source: "geocoded" };
    }
    const chart = computeChart({ dob, bot, lat: place.lat, lon: place.lon, timeZone: place.timeZone, nodeType });
    chart.place = { ...place }; // includes label, confidence, source and alternatives for the UI
    res.json({ success: true, data: chart });
  } catch (error) {
    if (error instanceof PlaceNotFoundError || error instanceof InvalidPlaceError) {
      return res.status(422).json({ success: false, code: error.code, message: error.message });
    }
    next(error);
  }
});

export default router;