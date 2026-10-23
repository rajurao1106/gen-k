import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import GeneratedReport from "../models/GeneratedReport.js";
import { requireAdmin } from "../middleware/auth.js";
import { userRateLimit as createUserRateLimit } from "../middleware/featureAccess.js";
import {
  consumeReportCredit,
  consumeUsage,
  getActivePlan,
  hasAccess,
  refundUsage,
  restoreReportCredit,
} from "../services/entitlements.js";
import {
  generateWithPool,
  GeminiPoolError,
  poolStatus,
} from "../services/geminiKeyPool.js";

const router = express.Router();

const allowedModels = () =>
  new Set(
    (process.env.GEMINI_ALLOWED_MODELS || "gemini-3.5-flash-lite")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean),
  );
const rateLimitPerMin = () => Number(process.env.GEMINI_RATE_LIMIT_PER_MIN || 20);
const userLimitPerMin = () => Number(process.env.GEMINI_USER_RATE_LIMIT_PER_MIN || 12);
const MAX_INPUT_CHARS = 20_000;
const CACHE_TTL_MS = 2 * 60_000;
const purposes = ["chat", "kundali", "milan", "mahadasha", "guide"];
const purposeSchema = z.enum(purposes);
const reportSchema = z.object({
  type: z.enum(["kundali", "milan"]),
  fullName: z.string().trim().min(1).max(240),
  dateOfBirth: z.string().trim().min(1).max(40),
  timeOfBirth: z.string().trim().max(80).default(""),
  placeOfBirth: z.string().trim().max(320).default(""),
  gender: z.string().trim().max(40).default(""),
});

const ipHits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || "unknown";
  const recent = (ipHits.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= rateLimitPerMin()) {
    res.set("Retry-After", "30");
    return res.status(429).json({
      success: false,
      code: "CLIENT_RATE_LIMITED",
      message: "Bahut zyada requests. Thodi der baad try karein.",
      retryAfterSeconds: 30,
    });
  }
  recent.push(now);
  ipHits.set(ip, recent);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of ipHits) {
    if (!list.some((time) => now - time < 60_000)) ipHits.delete(ip);
  }
}, 5 * 60_000).unref();

const cache = new Map();
const inflight = new Map();

function cacheKey(userId, purpose, model, input) {
  return `${userId}\n${purpose}\n${model}\n${input}`;
}

function reportKey(userId, report) {
  const identity = JSON.stringify({
    userId: String(userId),
    type: report.type,
    fullName: report.fullName.toLocaleLowerCase(),
    dateOfBirth: report.dateOfBirth,
    timeOfBirth: report.timeOfBirth,
    placeOfBirth: report.placeOfBirth.toLocaleLowerCase(),
    gender: report.gender.toLocaleLowerCase(),
  });
  return crypto.createHash("sha256").update(identity).digest("hex");
}

function sendUpgradeRequired(res, feature) {
  return res.status(402).json({
    success: false,
    code: "UPGRADE_REQUIRED",
    message: "This feature is not included in your current plan.",
    upgrade: true,
    feature,
  });
}

async function reserveReport(userId, report) {
  const key = reportKey(userId, report);
  const existing = await GeneratedReport.findOne({ userId, reportKey: key });
  if (existing?.status === "ready") return { cached: existing.content };
  const now = new Date();
  const staleGeneration =
    existing?.status === "generating" &&
    (!existing.lockExpiresAt || existing.lockExpiresAt <= now);
  if (existing?.status === "generating" && !staleGeneration) {
    return { conflict: true };
  }

  const entitlement = staleGeneration
    ? { allowed: true, entitlementId: existing.creditEntitlementId }
    : await consumeReportCredit(
        userId,
        report.type === "milan" ? "report_milan" : "report_kundali",
      );
  if (!entitlement.allowed) return { upgrade: true };

  const generationToken = crypto.randomUUID();
  try {
    if (existing) {
      const claimed = await GeneratedReport.findOneAndUpdate(
        {
          _id: existing._id,
          $or: [
            { status: "failed" },
            {
              status: "generating",
              $or: [
                { lockExpiresAt: null },
                { lockExpiresAt: { $lte: now } },
                { lockExpiresAt: { $exists: false } },
              ],
            },
          ],
        },
        {
          $set: {
            status: "generating",
            generationToken,
            lockExpiresAt: new Date(now.getTime() + 150_000),
            creditEntitlementId: entitlement.entitlementId,
            errorCode: "",
            content: "",
          },
        },
        { new: true },
      );
      if (!claimed) {
        await restoreReportCredit(entitlement.entitlementId);
        const latest = await GeneratedReport.findOne({ userId, reportKey: key }).lean();
        return latest?.status === "ready"
          ? { cached: latest.content }
          : { conflict: true };
      }
      return { record: claimed, generationToken, entitlementId: entitlement.entitlementId };
    }

    const record = await GeneratedReport.create({
      userId,
      reportKey: key,
      reportType: report.type,
      status: "generating",
      generationToken,
      lockExpiresAt: new Date(now.getTime() + 150_000),
      creditEntitlementId: entitlement.entitlementId,
    });
    return { record, generationToken, entitlementId: entitlement.entitlementId };
  } catch (error) {
    await restoreReportCredit(entitlement.entitlementId);
    if (error?.code !== 11000) throw error;
    const latest = await GeneratedReport.findOne({ userId, reportKey: key }).lean();
    return latest?.status === "ready"
      ? { cached: latest.content }
      : { conflict: true };
  }
}

const limitPerUser = createUserRateLimit({
  limit: userLimitPerMin,
  code: "USER_RATE_LIMITED",
});

router.post("/", rateLimit, limitPerUser, async (req, res) => {
  const { model, input, purpose, report: rawReport } = req.body || {};
  const parsedPurpose = purposeSchema.safeParse(purpose);

  if (!parsedPurpose.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PURPOSE",
      message: `purpose must be one of: ${purposes.join(", ")}.`,
    });
  }
  if (typeof input !== "string" || !input.trim()) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "input required",
    });
  }
  if (input.length > MAX_INPUT_CHARS) {
    return res.status(413).json({
      success: false,
      code: "INPUT_TOO_LARGE",
      message: "Input bahut bada hai.",
    });
  }
  if (!allowedModels().has(model)) {
    return res.status(400).json({
      success: false,
      code: "BAD_MODEL",
      message: "Model allowed nahi hai.",
    });
  }

  const currentPurpose = parsedPurpose.data;
  let report;
  if (rawReport !== undefined) {
    const parsedReport = reportSchema.safeParse(rawReport);
    if (!parsedReport.success || parsedReport.data.type !== currentPurpose) {
      return res.status(400).json({
        success: false,
        code: "INVALID_REPORT",
        message: "Report details must match the requested purpose.",
      });
    }
    report = parsedReport.data;
  }

  if (currentPurpose === "milan" && !report) {
    return res.status(400).json({
      success: false,
      code: "REPORT_REQUIRED",
      message: "Report identity details are required for a Milan report.",
    });
  }
  if (currentPurpose === "mahadasha" || currentPurpose === "guide") {
    const feature = currentPurpose === "mahadasha" ? "mahadasha" : "daily_guide_full";
    if (!(await hasAccess(req.user._id, feature))) return sendUpgradeRequired(res, feature);
  }
  let usageCharged = false;
  let usageDay = new Date();
  if (currentPurpose === "chat") {
    const plan = await getActivePlan(req.user._id);
    const usage = await consumeUsage(
      req.user._id,
      "ai_chat",
      1,
      plan.grants.aiMessagesPerDay,
      usageDay,
    );
    if (!usage.allowed) {
      return res.status(402).json({
        success: false,
        code: "QUOTA_EXCEEDED",
        message: "Aaj ke AI messages ki limit poori ho gayi.",
        upgrade: true,
        usage: { used: usage.count, limit: usage.limit, remaining: 0 },
      });
    }
    usageCharged = true;
  }

  let reservation;
  try {
    if (report) {
      reservation = await reserveReport(req.user._id, report);
      if (reservation.upgrade) {
        if (usageCharged) await refundUsage(req.user._id, "ai_chat", 1, usageDay);
        return sendUpgradeRequired(
          res,
          report.type === "milan" ? "milan_full_report" : "kundali_full_report",
        );
      }
      if (reservation.conflict) {
        if (usageCharged) await refundUsage(req.user._id, "ai_chat", 1, usageDay);
        return res.status(409).json({
          success: false,
          code: "REPORT_IN_PROGRESS",
          message: "This report is already being generated. Please retry shortly.",
        });
      }
      if (reservation.cached !== undefined) {
        if (usageCharged) await refundUsage(req.user._id, "ai_chat", 1, usageDay);
        return res.json({
          success: true,
          output_text: reservation.cached,
          cached: true,
          reportSaved: true,
        });
      }
    }

    const key = cacheKey(req.user._id, currentPurpose, model, input);
    let text;
    if (report) {
      const generated = await generateWithPool({ model, input });
      text = String(generated.output_text ?? "");
    } else {
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) {
        return res.json({ success: true, output_text: cached.text, cached: true });
      }
      let promise = inflight.get(key);
      if (!promise) {
        promise = generateWithPool({ model, input })
          .then((result) => String(result.output_text ?? ""))
          .finally(() => inflight.delete(key));
        inflight.set(key, promise);
      }
      text = await promise;
    }
    if (!text.trim()) {
      throw Object.assign(new Error("Gemini returned an empty response."), {
        code: "EMPTY_GEMINI_RESPONSE",
      });
    }
    if (!report) {
      cache.set(key, { text, expires: Date.now() + CACHE_TTL_MS });
      if (cache.size > 200) cache.delete(cache.keys().next().value);
    }

    if (reservation?.record) {
      const saved = await GeneratedReport.findOneAndUpdate(
        {
          _id: reservation.record._id,
          generationToken: reservation.generationToken,
          status: "generating",
        },
        {
          $set: { content: text, status: "ready" },
          $unset: { generationToken: 1, lockExpiresAt: 1, errorCode: 1 },
        },
        { new: true },
      );
      if (!saved) {
        throw Object.assign(new Error("Generated report could not be saved."), {
          code: "REPORT_SAVE_FAILED",
        });
      }
    }
    return res.json({
      success: true,
      output_text: text,
      reportSaved: Boolean(reservation?.record),
    });
  } catch (error) {
    if (usageCharged) await refundUsage(req.user._id, "ai_chat", 1, usageDay);
    if (reservation?.record) {
      await GeneratedReport.updateOne(
        {
          _id: reservation.record._id,
          generationToken: reservation.generationToken,
          status: "generating",
        },
        {
          $set: {
            status: "failed",
            errorCode: error?.code || "REPORT_GENERATION_FAILED",
          },
          $unset: { generationToken: 1 },
        },
      );
      await restoreReportCredit(reservation.entitlementId);
    }

    if (error instanceof GeminiPoolError) {
      if (error.retryAfterSeconds) res.set("Retry-After", String(error.retryAfterSeconds));
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }
    console.error("[gemini] request failed:", error?.message ?? error);
    return res.status(502).json({
      success: false,
      code: error?.code || "GEMINI_ERROR",
      message: "AI se jawab nahi mila. Dobara koshish karein.",
    });
  }
});

router.get("/status", requireAdmin, (req, res) => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.GEMINI_STATUS_ENABLED !== "true"
  ) {
    return res.status(404).end();
  }
  const keys = poolStatus().map(({ available, retryInSeconds, served }) => ({
    available,
    retryInSeconds,
    served,
  }));
  res.json({ success: true, keys });
});

export default router;
