import express from "express";
import { z } from "zod";
import { userRateLimit } from "../middleware/featureAccess.js";
import { geocodePlace, resolveCoordinates, PlaceNotFoundError, InvalidPlaceError } from "../services/astro/geocode.js";
import {
  ACTIVITY_KEYS,
  findMuhurat,
  MAX_RANGE_DAYS,
  MUHURAT_ACTIVITIES,
  MuhuratInputError,
  RASHI_NAMES,
} from "../services/astro/muhurat.js";

const router = express.Router();

const limitMuhurat = userRateLimit({
  limit: () => 20,
  windowMs: 60 * 60_000,
  code: "MUHURAT_RATE_LIMITED",
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must look like 2026-11-20.");

const schema = z
  .object({
    activity: z.enum(ACTIVITY_KEYS),
    fromDate: date,
    toDate: date,
    place: z.string().trim().min(2).max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    timeZone: z.string().max(64).optional(),
    // Optional: the person's birth Moon sign (English rashi name) switches Chandra bala on.
    natalMoonSign: z.enum(RASHI_NAMES).optional(),
    stepMinutes: z.union([z.literal(15), z.literal(30)]).optional(),
    count: z.number().int().min(3).max(5).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: "Send both lat and lon, or neither.",
  })
  .refine((v) => v.lat !== undefined || v.place, {
    message: "Send a place name, or lat and lon.",
  });

// GET /api/muhurat/activities  -> what the dropdown can offer
router.get("/activities", (_req, res) => {
  res.json({ success: true, data: { activities: Object.values(MUHURAT_ACTIVITIES), maxRangeDays: MAX_RANGE_DAYS } });
});

// POST /api/muhurat
// { activity: "griha_pravesh", fromDate: "2026-11-20", toDate: "2026-12-05", place: "Raipur, Chhattisgarh, India", natalMoonSign?: "Taurus" }
router.post("/", limitMuhurat, async (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_MUHURAT",
      message: parsed.error.issues[0]?.message ?? "Invalid muhurat details.",
    });
  }
  try {
    const { place: placeText, lat, lon, timeZone, ...rest } = parsed.data;
    const place =
      lat !== undefined && lon !== undefined
        ? await resolveCoordinates({ lat, lon, timeZone, label: placeText })
        : await geocodePlace(placeText);

    const result = findMuhurat({ ...rest, lat: place.lat, lon: place.lon, timeZone: place.timeZone });
    res.json({ success: true, data: { ...result, place: { ...place } } });
  } catch (error) {
    if (error instanceof PlaceNotFoundError || error instanceof InvalidPlaceError || error instanceof MuhuratInputError) {
      return res.status(error instanceof MuhuratInputError ? 400 : 422).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    next(error);
  }
});

export default router;