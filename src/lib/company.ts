// ---------------------------------------------------------------------------
// Company / Griha Kundali: types, API call, prompt + parsing helpers.
// The SERVER builds the chart for the registration / construction moment, applies the fixed rules
// (see server/services/astro/company.js + company-rules.json) and gives a soft signal per theme.
// The AI only explains that result in simple words; it never calculates, scores or re-ranks anything.
// Vastu (direction, room layout) is NOT part of this version: it does not come from a chart.
// ---------------------------------------------------------------------------

import { ApiError } from "./api";
import type { ChartData } from "../types";

export type CompanyChartType = "company" | "ghar";
export type CompanySignal = "anukool" | "mishrit" | "dhyaan";

export const TYPE_OPTIONS: {
  key: CompanyChartType;
  label: string;
  hint: string;
  dateLabel: string;
  timeLabel: string;
  placeLabel: string;
}[] = [
  {
    key: "company",
    label: "Company / Business",
    hint: "Registration ya business shuru hone ka samay",
    dateLabel: "Registration ki tarikh",
    timeLabel: "Registration ka samay",
    placeLabel: "Registration ki jagah (shehar)",
  },
  {
    key: "ghar",
    label: "Ghar / Nirman",
    hint: "Nirman shuru hone ya griha pravesh ka samay",
    dateLabel: "Nirman shuru / griha pravesh ki tarikh",
    timeLabel: "Samay",
    placeLabel: "Ghar ki jagah (shehar)",
  },
];

export type CompanyFactor = { key: string; points: number; effect: "+" | "-"; text: string };

export type CompanyTheme = {
  key: string;
  label: string;
  score: number;
  signal: CompanySignal;
  factors: CompanyFactor[];
  notes: string[];
};

export type DashaPeriod = { code: string; name: string; start: string; end: string };

export type CompanyDasha =
  | { status: "unavailable" | "future" }
  | {
      status: "ok";
      mahadasha: DashaPeriod;
      antardasha: DashaPeriod | null;
      nextMahadasha: { code: string; name: string; start: string };
    };

export type CompanyResult = {
  version: number;
  type: CompanyChartType;
  typeLabel: string;
  verdict: CompanySignal;
  score: number;
  themes: CompanyTheme[];
  dasha: CompanyDasha;
  facts: {
    lagna: string;
    houses: {
      house: number;
      theme: string;
      rashi: string;
      lord: { code: string; name: string; house: number; rashi: string };
      occupants: { code: string; name: string }[];
    }[];
    planets: { theme: string; code: string; name: string; house: number; rashi: string; strongSign: boolean }[];
  };
  limitations: string[];
  name: string;
  place: { label?: string; lat: number; lon: number; timeZone: string };
  event: { kind: string; label: string; localDate: string; localTime: string; utc: string };
  chart: ChartData;
  chartSummary: string;
};

export const SIGNAL_META: Record<CompanySignal, { title: string; line: string; box: string; text: string; chip: string }> = {
  anukool: {
    title: "Anukool",
    line: "Chart is pehlu ke liye madadgaar dikhta hai.",
    box: "border-[#8fd3a8]/40 bg-[#8fd3a8]/5",
    text: "text-[#8fd3a8]",
    chip: "border-[#8fd3a8]/50 bg-[#8fd3a8]/10 text-[#b9ecca]",
  },
  mishrit: {
    title: "Mishrit",
    line: "Kuch baatein madadgaar hain, kuch mein dhyaan chahiye.",
    box: "border-[#f2c36b]/40 bg-[#f2c36b]/5",
    text: "text-[#f2c36b]",
    chip: "border-[#f2c36b]/50 bg-[#f2c36b]/10 text-[#f9e6b2]",
  },
  dhyaan: {
    title: "Dhyaan dene wala",
    line: "Is pehlu mein dheeraj aur planning se chalna behtar dikhta hai.",
    box: "border-[#9fb6e6]/40 bg-[#9fb6e6]/5",
    text: "text-[#b8c9ee]",
    chip: "border-[#9fb6e6]/50 bg-[#9fb6e6]/10 text-[#c9d8ed]",
  },
};

export const DISCLAIMER_HI =
  "Ye jyotishiy sanket hai, pakki bhavishyavani nahi. Business, paise, kanooni ya nirman ke faisle apne salahkar, CA, vakeel ya engineer se poochh kar hi lein. Vastu (disha, kamre ka naksha) is kundali ka hissa nahi hai.";

// ----------------------------------------------------------------- API ----

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")
).replace(/\/+$/, "");

export type CompanyRequest = {
  type: CompanyChartType;
  date: string; // YYYY-MM-DD at the place
  time: string; // HH:MM at the place
  name?: string;
  lat?: number;
  lon?: number;
  timeZone?: string;
  place?: string;
};

export async function fetchCompanyChart(payload: CompanyRequest): Promise<CompanyResult> {
  const response = await fetch(`${API_BASE_URL}/api/company-chart`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let body: { success?: boolean; message?: string; code?: string; data?: CompanyResult } | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || !body?.success || !body.data) {
    throw new ApiError(
      body?.message || "Kundali abhi nahi ban paayi. Dobara try karein.",
      response.status,
      body?.code,
    );
  }
  return body.data;
}

/** "2026-11-20" -> "20 Nov 2026" (no timezone maths: the date is already the place's date). */
export function formatDateHi(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
}

// ------------------------------------------------------------- AI prompt ----

export type CompanyExplanation = {
  summary: string;
  themes: { key: string; why: string }[];
  note: string;
};

export function buildCompanyPrompt(result: CompanyResult): string {
  const isCompany = result.type === "company";
  const themeBlocks = result.themes
    .map((t) => {
      const reasons = t.factors.map((f) => `  ${f.effect} ${f.text}`).join("\n") || "  (koi khaas sanket nahi mila)";
      const notes = t.notes.map((n) => `  note: ${n}`).join("\n");
      return `THEME key=${t.key}: ${t.label}
- Result from code: ${SIGNAL_META[t.signal].title}
- Reasons found by the rules:
${reasons}${notes ? `\n${notes}` : ""}`;
    })
    .join("\n\n");

  const dasha =
    result.dasha.status === "ok"
      ? `Running Mahadasha: ${result.dasha.mahadasha.name} (${result.dasha.mahadasha.start} to ${result.dasha.mahadasha.end})` +
        (result.dasha.antardasha
          ? `; Antardasha: ${result.dasha.antardasha.name} (${result.dasha.antardasha.start} to ${result.dasha.antardasha.end})`
          : "") +
        `; next Mahadasha: ${result.dasha.nextMahadasha.name} from ${result.dasha.nextMahadasha.start}`
      : result.dasha.status === "future"
        ? "Dasha: not applicable yet (the chart is for a moment in the future)."
        : "Dasha: not available.";

  return `You are a calm, grounded Vedic-astrology guide. You are only EXPLAINING a ${isCompany ? "Company" : "Griha (house)"} Kundali result that was ALREADY calculated and scored by fixed rules in code.
Write in simple Hinglish (Hindi in Roman script), respectful, addressing the person as "aap".

CHART TYPE: ${isCompany ? "Company / business (registration or start moment)" : "House (construction start or griha pravesh moment)"}
MOMENT: ${formatDateHi(result.event.localDate)}, ${result.event.localTime} (${result.place.timeZone})
PLACE: ${(result.place.label ?? "").slice(0, 120).replace(/"""/g, "'")}

CALCULATED CHART FACTS (FINAL, do not change them):
${result.chartSummary}

${dasha}

OVERALL RESULT FROM CODE (FINAL): ${SIGNAL_META[result.verdict].title}

${themeBlocks}

TASK: For each theme, explain in 2-3 simple sentences WHAT the reasons mean for ${isCompany ? "the business" : "the home"} (use the 2-3 strongest reasons), then give a short overall summary.

RULES:
- Never change a signal. Never add a theme that is not listed. Never recalculate any rashi, bhav, planet position or dasha date. Use ONLY the facts above.
- Use tendency language ("sanket", "aksar", "maana jaata hai", "ho sakta hai"). Never say "pakka", "guarantee", "zaroor", and never promise profit, loss, success, failure or any result.
- Do NOT frighten the person. No dosha scare, no talk of ruin, death, illness, accidents or bad luck. No paid remedies, no gemstones, no pujas or services to buy.
- ${isCompany ? "Do not give business, investment, legal, tax or financial advice, and never say whether to start, close, invest or hire." : "Do not give construction, engineering, legal or financial advice, and never say whether to buy, build or move."}
- Do NOT talk about Vastu, directions, plot shape or room layout: they are not part of this chart. If a theme is "Dhyaan dene wala", say gently that patience and planning help, in a calm tone.
- "note" must be 1 sentence reminding the person that ${isCompany ? "their CA, lawyer or business advisor" : "their engineer, architect or family priest"} should be consulted for real decisions.
- Keep it short: "summary" 1-2 sentences, each "why" 2-3 sentences.

Return ONLY valid JSON, no markdown:
{
  "summary": "1-2 sentence overview",
  "themes": [ { "key": "<the exact THEME key>", "why": "2-3 sentences" } ],
  "note": "1 sentence reminder"
}`;
}

const asText = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function normalizeCompanyExplanation(raw: unknown, validKeys: string[]): CompanyExplanation | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const summary = asText(d.summary);
  const themes = Array.isArray(d.themes)
    ? d.themes
        .map((t) => {
          const o = (t ?? {}) as Record<string, unknown>;
          return { key: asText(o.key), why: asText(o.why) };
        })
        .filter((t) => t.why && validKeys.includes(t.key))
    : [];
  if (!summary && themes.length === 0) return null;
  return { summary, themes, note: asText(d.note) };
}