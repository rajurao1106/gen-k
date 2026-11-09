import express from "express";
import { z } from "zod";
import { userRateLimit } from "../middleware/featureAccess.js";
import {
  buildEventChart,
  EVENT_KINDS,
  InvalidDatetimeError,
  isValidEventDatetime,
} from "../services/astro/eventChart.js";
import { PlaceNotFoundError, InvalidPlaceError } from "../services/astro/geocode.js";

const router = express.Router();

const limitEventChart = userRateLimit({
  limit: () => 60,
  windowMs: 60 * 60_000,
  code: "EVENT_CHART_RATE_LIMITED",
});

const schema = z
  .object({
    datetime: z.string().trim().refine(isValidEventDatetime, {
      message: "datetime must look like 2026-11-07T14:30 (place's local time) or an ISO time with Z/offset.",
    }),
    place: z.string().trim().min(2).max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    timeZone: z.string().max(64).optional(),
    kind: z.enum(EVENT_KINDS),
    label: z.string().trim().max(120).optional(),
    nodeType: z.enum(["mean", "true"]).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: "Send both lat and lon, or neither.",
  })
  .refine((v) => v.lat !== undefined || v.place, {
    message: "Send a place name, or lat and lon.",
  });

// POST /api/event-chart
// { datetime: "2026-11-07T14:30", place: "Raipur, Chhattisgarh, India", kind: "muhurat", label: "Griha pravesh" }
// { datetime: new Date().toISOString(), lat: 21.25, lon: 81.63, timeZone: "Asia/Kolkata", kind: "prashna" }
router.post("/", limitEventChart, async (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_EVENT_DETAILS",
      message: parsed.error.issues[0]?.message ?? "Invalid event details.",
    });
  }
  try {
    const chart = await buildEventChart(parsed.data);
    res.json({ success: true, data: chart });
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