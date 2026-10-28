// ---------------------------------------------------------------------------
// Calculated chart facts for AI prompts.
//
// The AI must NEVER work out a Rashi / Nakshatra / Dasha by itself. This file
// gets the real chart from the server (/api/chart, astronomy-engine + Lahiri)
// and turns it into text that is put into the prompt as FINAL facts.
// ---------------------------------------------------------------------------

import { fetchBirthChart } from "./api";
import type { ChartData, ChartPlanet } from "../types";

type BirthInput = { dob: string; bot: string; bop: string };

const chartCache = new Map<string, Promise<ChartData | null>>();

/** Server-calculated chart (cached per birth details). Resolves to null if it cannot be calculated. */
export function getBirthChart(birth: BirthInput): Promise<ChartData | null> {
  const key = [birth.dob, birth.bot, birth.bop].map((v) => (v || "").trim().toLowerCase()).join("|");
  const cached = chartCache.get(key);
  if (cached) return cached;

  const promise = fetchBirthChart({
    dob: birth.dob,
    bot: birth.bot,
    bop: birth.bop,
  })
    .then((chart) => chart)
    .catch((error) => {
      console.error("Could not calculate the birth chart:", error);
      chartCache.delete(key); // do not cache failures
      return null;
    });
  chartCache.set(key, promise);
  return promise;
}

/** Prompt block: calculated facts, or an instruction not to guess when there is no chart. */
export function chartFactsBlock(chart: ChartData | null): string {
  if (chart?.summary) {
    return `\n${chart.summary}\n\nThese chart facts were calculated with an astronomical ephemeris and are FINAL. Use ONLY these placements. Never recalculate them, never contradict them, and never state a different Lagna, Moon sign (Rashi), Nakshatra or planet position.\n`;
  }
  return `\nThe calculated birth chart is not available right now. Do NOT state or guess any specific Lagna, Rashi, Nakshatra or planet placement; say it cannot be determined at the moment.\n`;
}

// ------------------------------------------------------ Vimshottari dasha ----

const DASHA_ORDER = [
  ["Ketu", 7],
  ["Shukra (Venus)", 20],
  ["Surya (Sun)", 6],
  ["Chandra (Moon)", 10],
  ["Mangal (Mars)", 7],
  ["Rahu", 18],
  ["Guru (Jupiter)", 16],
  ["Shani (Saturn)", 19],
  ["Budh (Mercury)", 17],
] as const;

const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Vimshottari Mahadasha / Antardasha computed from the Moon's sidereal longitude.
 * Returns "" when the Moon position is not available.
 */
export function vimshottariFacts(chart: ChartData | null, dob: string, now = new Date()): string {
  const moon = chart?.planets?.find((p) => p.code === "Mo") as
    | (ChartPlanet & { rashiIndex?: number })
    | undefined;
  if (!moon || typeof moon.rashiIndex !== "number") return "";

  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return "";
  const birth = Date.UTC(y, m - 1, d);

  const lon = moon.rashiIndex * 30 + moon.degree;
  const span = 360 / 27;
  const nakshatraIndex = Math.floor(lon / span);
  const elapsed = (lon % span) / span;
  const startIdx = nakshatraIndex % 9;

  let cursor = birth - elapsed * DASHA_ORDER[startIdx][1] * YEAR_MS;
  const periods: { idx: number; lord: string; years: number; start: number; end: number }[] = [];
  const horizon = now.getTime() + 30 * YEAR_MS;
  for (let i = 0; cursor < horizon && i < 18; i += 1) {
    const idx = (startIdx + i) % 9;
    const [lord, years] = DASHA_ORDER[idx];
    const end = cursor + years * YEAR_MS;
    periods.push({ idx, lord, years, start: cursor, end });
    cursor = end;
  }

  const nowMs = now.getTime();
  const current = periods.find((p) => p.start <= nowMs && nowMs < p.end);

  const lines = [
    `Calculated Vimshottari Dasha (Moon ${moon.rashi} ${moon.degree} deg, Nakshatra ${moon.nakshatra} pada ${moon.pada}, Lahiri):`,
    "Mahadasha sequence (dates are exact; the first period began before birth, so only its balance was left at birth):",
    ...periods.map((p) => `- ${p.lord}: ${iso(p.start)} to ${iso(p.end)}${p === current ? " (CURRENT)" : ""}`),
  ];

  if (current) {
    lines.push(`Currently running Mahadasha: ${current.lord} (${iso(current.start)} to ${iso(current.end)}).`);
    lines.push("Antardashas inside the current Mahadasha:");
    let sub = current.start;
    for (let j = 0; j < 9; j += 1) {
      const [subLord, subYears] = DASHA_ORDER[(current.idx + j) % 9];
      const subEnd = sub + (current.years * subYears * YEAR_MS) / 120;
      const isCurrent = sub <= nowMs && nowMs < subEnd;
      lines.push(`- ${current.lord} / ${subLord}: ${iso(sub)} to ${iso(subEnd)}${isCurrent ? " (CURRENT)" : ""}`);
      sub = subEnd;
    }
  }
  return lines.join("\n");
}