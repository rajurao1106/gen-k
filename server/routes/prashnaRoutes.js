import express from "express";
import { z } from "zod";
import { userRateLimit } from "../middleware/featureAccess.js";
import { buildEventChart, InvalidDatetimeError } from "../services/astro/eventChart.js";
import { PlaceNotFoundError, InvalidPlaceError } from "../services/astro/geocode.js";
import { CATEGORY_KEYS, detectCategory, evaluatePrashna } from "../services/astro/prashna.js";

const router = express.Router();

const limitPrashna = userRateLimit({
  limit: () => 20,
  windowMs: 60 * 60_000,
  code: "PRASHNA_RATE_LIMITED",
});

const schema = z
  .object({
    // Only used to pick a category when the user did not choose one. It is NOT stored or logged.
    question: z.string().trim().min(3).max(500),
    category: z.enum(CATEGORY_KEYS).optional(),
    // The chart is always cast for "now" (server clock). Place = browser location or a typed place name.
    place: z.string().trim().min(2).max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    timeZone: z.string().max(64).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: "Send both lat and lon, or neither.",
  })
  .refine((v) => v.lat !== undefined || v.place, {
    message: "Send your location, or type a place name.",
  });

// POST /api/prashna
// { question: "Meri chabi kahan hai?", category?: "lost", lat: 21.25, lon: 81.63, timeZone: "Asia/Kolkata" }
router.post("/", limitPrashna, async (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PRASHNA",
      message: parsed.error.issues[0]?.message ?? "Invalid prashna details.",
    });
  }
  try {
    const { question, category: chosen, place, lat, lon, timeZone } = parsed.data;
    const category = chosen ?? detectCategory(question);

    const chart = await buildEventChart({
      datetime: new Date().toISOString(),
      kind: "prashna",
      label: category,
      lat,
      lon,
      timeZone,
      place,
    });
    const result = evaluatePrashna(chart, category);

    res.json({
      success: true,
      data: {
        ...result,
        categorySource: chosen ? "user" : "detected",
        askedAt: chart.event.utc,
        place: chart.place,
        panchang: chart.panchang,
        chart, // for drawing the kundali
        chartSummary: chart.summary, // calculated facts for the AI prompt
      },
    });
  } catch (error) {
    if (error instanceof PlaceNotFoundError || error instanceof InvalidPlaceError || error instanceof InvalidDatetimeError) {
      return res.status(error instanceof InvalidDatetimeError ? 400 : 422).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    next(error);
  }
});

export default router;