// ---------------------------------------------------------------------------
// Muhurat Kundali: types, API call, prompt + parsing helpers.
// The SERVER finds the slots, scores them with fixed rules (see
// server/services/astro/muhurat.js + muhurat-rules.json) and ranks them.
// The AI only explains each slot's "kyun" in simple words; it never
// calculates, scores, re-ranks or adds a slot.
// ---------------------------------------------------------------------------

import { ApiError } from "./api";
import type { ChartData } from "../types";

export type MuhuratActivity = "griha_pravesh" | "vivah" | "vahan" | "business";
export type MuhuratGrade = "anukool" | "mishrit";

export const ACTIVITY_OPTIONS: { key: MuhuratActivity; label: string; hint: string }[] = [
  { key: "griha_pravesh", label: "Griha pravesh", hint: "Naye ghar mein pravesh" },
  { key: "vivah", label: "Vivah", hint: "Shaadi ka muhurat" },
  { key: "vahan", label: "Vaahan", hint: "Gaadi ya vaahan lena" },
  { key: "business", label: "Business", hint: "Dukaan ya kaam ki shuruaat" },
];

export const MAX_RANGE_DAYS = 31;

// English names go to the server; Hindi names are what the person sees.
export const RASHI_OPTIONS: { en: string; hi: string }[] = [
  { en: "Aries", hi: "Mesh" },
  { en: "Taurus", hi: "Vrishabh" },
  { en: "Gemini", hi: "Mithun" },
  { en: "Cancer", hi: "Kark" },
  { en: "Leo", hi: "Singh" },
  { en: "Virgo", hi: "Kanya" },
  { en: "Libra", hi: "Tula" },
  { en: "Scorpio", hi: "Vrishchik" },
  { en: "Sagittarius", hi: "Dhanu" },
  { en: "Capricorn", hi: "Makar" },
  { en: "Aquarius", hi: "Kumbh" },
  { en: "Pisces", hi: "Meen" },
];

export type MuhuratFactor = { key: string; points: number; effect: "+" | "-"; text: string };
export type TimeWindow = { start: string; end: string };

export type MuhuratSlot = {
  id: string;
  rank: number;
  date: string; // YYYY-MM-DD at the place
  weekday: string;
  startLocal: string; // HH:MM
  endLocal: string;
  bestLocal: string;
  startUtc: string;
  endUtc: string;
  score: number;
  maxScore: number;
  percent: number;
  grade: MuhuratGrade;
  factors: MuhuratFactor[];
  panchang: {
    tithi: { paksha: string; name: string };
    vara: { name: string; sanskrit: string };
    nakshatra: { name: string; pada: number };
    yoga: { name: string };
    karana: { name: string };
  };
  lagna: string;
  moonHouse: number;
  day: { sunrise: string; sunset: string; rahukaal: TimeWindow; gulika: TimeWindow; yamaganda: TimeWindow };
  chart: ChartData;
};

export type MuhuratResult = {
  version: number;
  activity: MuhuratActivity;
  activityLabel: string;
  range: { fromDate: string; toDate: string; days: number };
  place: { lat: number; lon: number; timeZone: string; label?: string };
  usedChandraBala: boolean;
  natalMoonSign: string | null;
  slotsChecked: number;
  slotsBlocked: number;
  mainBlockers: string[];
  polarDays: number;
  slots: MuhuratSlot[];
  limitations: string[];
};

export const GRADE_META: Record<MuhuratGrade, { title: string; box: string; text: string }> = {
  anukool: { title: "Anukool", box: "border-[#8fd3a8]/50 bg-[#8fd3a8]/10", text: "text-[#b9ecca]" },
  mishrit: { title: "Mishrit", box: "border-[#f2c36b]/50 bg-[#f2c36b]/10", text: "text-[#f8d98f]" },
};

export const DISCLAIMER_HI =
  "Ye muhurat paramparaagat jyotish niyamon par aadharit sanket hai, pakki guarantee nahi. Bade samaroh (jaise vivah ya griha pravesh) ke liye apne purohit ya pandit se final confirmation zaroor lein.";

// ----------------------------------------------------------------- API ----

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")
).replace(/\/+$/, "");

export type MuhuratRequest = {
  activity: MuhuratActivity;
  fromDate: string;
  toDate: string;
  natalMoonSign?: string;
  lat?: number;
  lon?: number;
  timeZone?: string;
  place?: string;
};

export async function fetchMuhurat(payload: MuhuratRequest): Promise<MuhuratResult> {
  const response = await fetch(`${API_BASE_URL}/api/muhurat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let body: { success?: boolean; message?: string; code?: string; data?: MuhuratResult } | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || !body?.success || !body.data) {
    throw new ApiError(
      body?.message || "Muhurat abhi nahi nikal paaya. Dobara try karein.",
      response.status,
      body?.code,
    );
  }
  return body.data;
}

/** "2026-11-20" + "09:30" -> "20 Nov 2026" (no timezone maths: the date is already the place's date). */
export function formatDateHi(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
}

export const todayLocalISO = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ------------------------------------------------------------- AI prompt ----

export type MuhuratExplanation = {
  summary: string;
  slots: { id: string; why: string }[];
  note: string;
};

export function buildMuhuratPrompt(result: MuhuratResult): string {
  const slotBlocks = result.slots
    .map((s) => {
      const reasons = s.factors.map((f) => `  ${f.effect} ${f.text}`).join("\n");
      return `SLOT id=${s.id} (rank ${s.rank})
- Date/time: ${formatDateHi(s.date)} (${s.weekday}), ${s.startLocal} to ${s.endLocal}
- Result from code: ${GRADE_META[s.grade].title} (${s.percent}% of the rules matched)
- Panchang: ${s.panchang.tithi.paksha} ${s.panchang.tithi.name}, ${s.panchang.nakshatra.name} nakshatra, ${s.panchang.yoga.name} yoga, lagna ${s.lagna}
- Rahukaal that day: ${s.day.rahukaal.start}-${s.day.rahukaal.end} (this slot is outside it)
- Reasons found by the rules:
${reasons}`;
    })
    .join("\n\n");

  return `You are a calm, grounded Vedic-astrology guide. You are only EXPLAINING a Muhurat (auspicious time) result that was ALREADY found, scored and ranked by fixed rules in code.
Write in simple Hinglish (Hindi in Roman script), respectful, addressing the person as "aap".

ACTIVITY: ${result.activityLabel}
DATE RANGE CHECKED: ${formatDateHi(result.range.fromDate)} to ${formatDateHi(result.range.toDate)}
PLACE: ${(result.place.label ?? "").slice(0, 120).replace(/"""/g, "'")}
CHANDRA BALA USED: ${result.usedChandraBala ? `yes (birth Moon sign ${result.natalMoonSign})` : "no (birth Moon sign not given)"}

RESULT FROM CODE (FINAL, do not change it):
${slotBlocks || "(no slot found)"}

TASK: For each slot, explain in 2-3 simple sentences WHY it was picked (use the 2-3 strongest reasons), then give a short overall summary.

RULES:
- Never change the ranking, the percentages or the grade. Never add a slot that is not listed. Never recalculate any tithi, nakshatra, lagna or time. Use ONLY the facts above.
- Use tendency language ("sanket", "aksar", "maana jaata hai"). Never say "pakka", "guarantee" or promise a result of the activity itself (marriage, business, vehicle luck).
- Do NOT frighten the person. No dosha scare, no talk of misfortune, death or ruin. No paid remedies, no gemstones, no pujas to buy.
- If a slot is "Mishrit", say gently that it is workable but some points are less favourable.
- If Chandra bala was not used, add one sentence in "note" that giving the birth Moon sign (rashi) makes the result more personal.
- Do not give legal, medical or financial advice. For a big event, "note" must remind the person to confirm with their family priest or pandit.
- Keep it short: "summary" 1-2 sentences, each "why" 2-3 sentences.

Return ONLY valid JSON, no markdown:
{
  "summary": "1-2 sentence overview",
  "slots": [ { "id": "<the exact SLOT id>", "why": "2-3 sentences" } ],
  "note": "1 sentence reminder"
}`;
}

const asText = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function normalizeMuhuratExplanation(raw: unknown, validIds: string[]): MuhuratExplanation | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const summary = asText(d.summary);
  const slots = Array.isArray(d.slots)
    ? d.slots
        .map((s) => {
          const o = (s ?? {}) as Record<string, unknown>;
          return { id: asText(o.id), why: asText(o.why) };
        })
        .filter((s) => s.why && validIds.includes(s.id))
    : [];
  if (!summary && slots.length === 0) return null;
  return { summary, slots, note: asText(d.note) };
}