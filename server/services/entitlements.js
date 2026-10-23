import { PLANS } from "../config/plans.js";
import Entitlement from "../models/Entitlement.js";
import UsageCounter from "../models/UsageCounter.js";

const DAY_TIME_ZONE = "Asia/Kolkata";

export function getDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function activeAt(now = new Date()) {
  return {
    status: "active",
    startsAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
}

export async function getActivePlan(userId, now = new Date()) {
  const entitlement = await Entitlement.findOne({
    userId,
    kind: "subscription",
    ...activeAt(now),
  })
    .sort({ expiresAt: -1, startsAt: -1 })
    .lean();

  return entitlement ? PLANS[entitlement.planId] ?? PLANS.free : PLANS.free;
}

export async function hasAccess(userId, feature, now = new Date()) {
  const plan = await getActivePlan(userId, now);
  const premium = plan.planId === "premium_monthly" || plan.planId === "premium_yearly";
  if (feature === "ai_chat_extended" || feature === "mahadasha" || feature === "daily_guide_full") {
    return premium;
  }
  if (feature === "voice_reply") {
    return Boolean(await Entitlement.exists({
      userId,
      planId: "voice_addon",
      kind: "addon",
      ...activeAt(now),
    }));
  }
  const reportPlanId = {
    milan_full_report: "report_milan",
    kundali_full_report: "report_kundali",
  }[feature];
  if (!reportPlanId) return false;
  if (premium) return true;

  return Boolean(await Entitlement.exists({
    userId,
    planId: reportPlanId,
    kind: "report",
    remainingUses: { $gt: 0 },
    ...activeAt(now),
  }));
}

export async function consumeReport(userId, planId, now = new Date()) {
  const expectedKind = {
    report_milan: "milan_full_report",
    report_kundali: "kundali_full_report",
  }[planId];
  if (!expectedKind) return false;
  if (await hasAccess(userId, "ai_chat_extended", now)) return true;

  const consumed = await Entitlement.findOneAndUpdate(
    {
      userId,
      planId,
      kind: "report",
      remainingUses: { $gt: 0 },
      ...activeAt(now),
    },
    { $inc: { remainingUses: -1 } },
    { new: true },
  );
  return Boolean(consumed);
}

export async function consumeReportCredit(userId, planId, now = new Date()) {
  const expectedFeature = {
    report_milan: "milan_full_report",
    report_kundali: "kundali_full_report",
  }[planId];
  if (!expectedFeature) return { allowed: false, entitlementId: null };
  if (await hasAccess(userId, "ai_chat_extended", now)) {
    return { allowed: true, entitlementId: null };
  }
  const consumed = await Entitlement.findOneAndUpdate(
    {
      userId,
      planId,
      kind: "report",
      remainingUses: { $gt: 0 },
      ...activeAt(now),
    },
    { $inc: { remainingUses: -1 } },
    { new: true },
  );
  return {
    allowed: Boolean(consumed),
    entitlementId: consumed?._id ?? null,
  };
}

export async function restoreReportCredit(entitlementId) {
  if (!entitlementId) return;
  await Entitlement.updateOne(
    { _id: entitlementId, kind: "report", ...activeAt() },
    { $inc: { remainingUses: 1 } },
  );
}

export async function refundUsage(userId, key, amount, now = new Date()) {
  const dayKey = getDayKey(now);
  const units = Math.max(1, Math.floor(Number(amount) || 1));
  await UsageCounter.updateOne(
    { userId, key, dayKey, count: { $gte: units } },
    { $inc: { count: -units } },
  );
}

export async function incrementUsage(userId, key, limitPerDay, now = new Date()) {
  return consumeUsage(userId, key, 1, limitPerDay, now);
}

export async function consumeUsage(userId, key, amount, limitPerDay, now = new Date()) {
  const dayKey = getDayKey(now);
  const units = Math.max(1, Math.floor(Number(amount) || 1));
  const limit = Math.max(0, Math.floor(Number(limitPerDay) || 0));
  if (!limit || units > limit) {
    const current = await UsageCounter.findOne({ userId, key, dayKey }).lean();
    return { allowed: false, count: current?.count ?? 0, remaining: 0, limit, dayKey };
  }

  const filter = {
    userId,
    key,
    dayKey,
    count: { $lte: limit - units },
  };
  const update = {
    $inc: { count: units },
    $setOnInsert: { userId, key, dayKey },
  };
  const result = (counter, allowed = Boolean(counter)) => ({
    allowed,
    count: counter?.count ?? 0,
    remaining: Math.max(0, limit - (counter?.count ?? 0)),
    limit,
    dayKey,
  });

  try {
    const counter = await UsageCounter.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true, setDefaultsOnInsert: false },
    );
    return result(counter);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const counter = await UsageCounter.findOneAndUpdate(filter, update, {
      new: true,
    });
    if (counter) return result(counter);
    const current = await UsageCounter.findOne({ userId, key, dayKey }).lean();
    return result(current, false);
  }
}

export async function getDailyUsage(userId, now = new Date()) {
  const dayKey = getDayKey(now);
  const [plan, counters] = await Promise.all([
    getActivePlan(userId, now),
    UsageCounter.find({ userId, dayKey }).select("key count -_id").lean(),
  ]);
  const used = counters.find(({ key }) => key === "ai_chat")?.count ?? 0;
  const limit = plan.grants.aiMessagesPerDay;
  return {
    dayKey,
    ai_chat: { used, limit, remaining: Math.max(0, limit - used) },
    other: counters.filter(({ key }) => key !== "ai_chat"),
  };
}

export async function getActiveEntitlements(userId, now = new Date()) {
  return Entitlement.find({ userId, ...activeAt(now) })
    .select("planId kind startsAt expiresAt remainingUses status sourceOrderId")
    .sort({ startsAt: -1 })
    .lean();
}
