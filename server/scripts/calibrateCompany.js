// Calibrates the cut-offs in company-rules.json.
//
//   node server/scripts/calibrateCompany.js            # print the suggested cut-offs
//   node server/scripts/calibrateCompany.js --write    # also write them into company-rules.json
//
// It scores N random charts (dates 1990..today, places spread over India) for every chart type and picks,
// for the overall score and for each theme, the cut-offs that make roughly 30% "dhyaan", 35% "mishrit"
// and 35% "anukool". Scores move in steps of 0.5, so the split is only approximate. For a single theme a
// neutral score (0) always reads "mishrit": "dhyaan" needs something negative, "anukool" something positive.
// Re-run whenever company-rules.json or company.js changes (and bump "version").

import fs from "node:fs";
import { computeChart } from "../services/astro/chart.js";
import { CHART_TYPES, evaluateCompanyChart } from "../services/astro/company.js";

const N = Number(process.env.N ?? 2400);
const NOW = new Date(); // dasha is judged "as of today", like the live route
const RULES_URL = new URL("../services/astro/company-rules.json", import.meta.url);

// small deterministic random generator so two runs give the same suggestion
let seed = 20261108;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pad = (n) => String(n).padStart(2, "0");

const startMs = Date.UTC(1990, 0, 1);
const endMs = NOW.getTime();

const scores = Object.fromEntries(CHART_TYPES.map((t) => [t, { overall: [], themes: {} }]));

for (let i = 0; i < N; i += 1) {
  const d = new Date(startMs + rand() * (endMs - startMs));
  const chart = computeChart({
    dob: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    bot: `${pad(Math.floor(rand() * 24))}:${pad(Math.floor(rand() * 60))}`,
    lat: 8 + rand() * 27,
    lon: 68 + rand() * 29,
    timeZone: "Asia/Kolkata",
  });
  for (const type of CHART_TYPES) {
    const r = evaluateCompanyChart(chart, type, NOW);
    scores[type].overall.push(r.score);
    for (const t of r.themes) (scores[type].themes[t.key] ??= []).push(t.score);
  }
}

/** low/high so that ~lowShare of charts are <= low and ~highShare are >= high. */
function pickCuts(values, { lowShare = 0.3, highShare = 0.35, themeLevel = false } = {}) {
  const n = values.length;
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  const shareLE = (v) => values.filter((x) => x <= v).length / n;
  const shareGE = (v) => values.filter((x) => x >= v).length / n;
  const closest = (list, share, fn) => list.reduce((best, v) => (Math.abs(fn(v) - share) < Math.abs(fn(best) - share) ? v : best), list[0]);
  let low = closest(distinct, lowShare, shareLE);
  let high = closest(distinct, highShare, shareGE);
  // A single theme with nothing negative in it (score 0) must never read "dhyaan", and one with nothing
  // positive in it must never read "anukool": cap the cut-offs so a neutral 0 always lands in "mishrit".
  if (themeLevel) {
    low = Math.min(low, -0.5);
    high = Math.max(high, 0.5);
  }
  if (high <= low) high = distinct.find((v) => v > low) ?? low + 0.5; // keep a "mishrit" band
  return { low, high };
}

const shares = (values, cut) => {
  const n = values.length;
  const d = values.filter((v) => v <= cut.low).length / n;
  const a = values.filter((v) => v >= cut.high).length / n;
  return `dhyaan ${Math.round(d * 100)}% / mishrit ${Math.round((1 - d - a) * 100)}% / anukool ${Math.round(a * 100)}%`;
};

const rules = JSON.parse(fs.readFileSync(RULES_URL, "utf8"));
for (const type of CHART_TYPES) {
  const overall = pickCuts(scores[type].overall);
  console.log(`\n[${type}] overall  low<=${overall.low}  high>=${overall.high}   ${shares(scores[type].overall, overall)}`);
  rules.types[type].thresholds.overall = overall;
  for (const [key, values] of Object.entries(scores[type].themes)) {
    const cut = pickCuts(values, { themeLevel: true });
    console.log(`[${type}] ${key.padEnd(8)} low<=${cut.low}  high>=${cut.high}   ${shares(values, cut)}`);
    rules.types[type].thresholds.themes[key] = cut;
  }
}

if (process.argv.includes("--write")) {
  fs.writeFileSync(RULES_URL, `${JSON.stringify(rules, null, 2)}\n`);
  console.log("\nWrote the new cut-offs to company-rules.json (remember to bump 'version' if the rules changed).");
} else {
  console.log("\nDry run. Add --write to save these cut-offs.");
}