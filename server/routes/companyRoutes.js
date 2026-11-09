import express from "express";
import { z } from "zod";
import { userRateLimit } from "../middleware/featureAccess.js";
import { buildEventChart, InvalidDatetimeError } from "../services/astro/eventChart.js";
import { PlaceNotFoundError, InvalidPlaceError } from "../services/astro/geocode.js";
import {
  CHART_TYPES,
  COMPANY_LIMITATIONS,
  COMPANY_TYPES,
  evaluateCompanyChart,
} from "../services/astro/company.js";

const router = express.Router();

const limitCompany = userRateLimit({
  limit: () => 20,
  windowMs: 60 * 60_000,
  code: "COMPANY_RATE_LIMITED",
});

const schema = z
  .object({
    type: z.enum(CHART_TYPES),
    // Registration date (company) or construction start / griha pravesh date (ghar), at the place.
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must look like 2026-11-20."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Time must look like 14:30 (24-hour, local time at the place)."),
    // Optional display name. It is only echoed back for the page heading: NOT stored or logged.
    name: z.string().trim().max(80).optional(),
    place: z.string().trim().min(2).max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    timeZone: z.string().max(64).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: "Send both lat and lon, or neither.",
  })
  .refine((v) => v.lat !== undefined || v.place, {
    message: "Send a place name, or lat and lon.",
  });

// GET /api/company-chart/types  -> what the form can offer
router.get("/types", (_req, res) => {
  res.json({ success: true, data: { types: Object.values(COMPANY_TYPES), limitations: COMPANY_LIMITATIONS } });
});

// POST /api/company-chart
// { type: "company", date: "2019-04-12", time: "10:30", place: "Raipur, Chhattisgarh, India", name?: "..." }
// { type: "ghar", date: "2026-12-05", time: "07:45", lat: 21.25, lon: 81.63, timeZone: "Asia/Kolkata" }
router.post("/", limitCompany, async (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_COMPANY_CHART",
      message: parsed.error.issues[0]?.message ?? "Invalid details.",
    });
  }
  try {
    const { type, date, time, name, place, lat, lon, timeZone } = parsed.data;
    const chart = await buildEventChart({
      datetime: `${date}T${time}`, // local wall-clock time at the place
      kind: "company",
      label: type,
      lat,
      lon,
      timeZone,
      place,
    });
    const result = evaluateCompanyChart(chart, type);

    res.json({
      success: true,
      data: {
        ...result,
        name: name ?? "",
        place: chart.place,
        event: chart.event,
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