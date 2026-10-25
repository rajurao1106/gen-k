import express from "express";
import { z } from "zod";
import { userRateLimit } from "../middleware/featureAccess.js";
import { computeChart } from "../services/astro/chart.js";
import { geocodePlace, PlaceNotFoundError } from "../services/astro/geocode.js";

const router = express.Router();

const limitChart = userRateLimit({
  limit: () => 30,
  windowMs: 60 * 60_000,
  code: "CHART_RATE_LIMITED",
});

const schema = z.object({
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bot: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  bop: z.string().trim().min(2).max(200),
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
    const { dob, bot, bop } = parsed.data;
    const place = await geocodePlace(bop);
    const chart = computeChart({ dob, bot, ...place });
    chart.place = { ...place };
    res.json({ success: true, data: chart });
  } catch (error) {
    if (error instanceof PlaceNotFoundError) {
      return res.status(422).json({ success: false, code: error.code, message: error.message });
    }
    next(error);
  }
});

export default router;