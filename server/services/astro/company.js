// Company / Griha kundali rules engine.
// Plain, deterministic rule-checking on the calculated chart. The rules live in company-rules.json.
// The AI never sees raw rules or does any scoring: it only explains the result in simple words.
//
//   type "company": 10th, 2nd and 11th bhav + the running Dasha
//   type "ghar":    4th bhav + Mangal / Shani placement + the running Dasha
//
// Vastu (direction, room layout) is NOT part of this: it does not come from a chart.
// Houses are whole-sign (same as chart.js). The result is always a SOFT signal per theme:
//   anukool / mishrit / dhyaan  - never a guarantee.

import fs from "node:fs";

const RULES = JSON.parse(fs.readFileSync(new URL("./company-rules.json", import.meta.url), "utf8"));

export const COMPANY_RULES_VERSION = RULES.version;
export const CHART_TYPES = Object.keys(RULES.types);
export const COMPANY_TYPES = Object.fromEntries(
  CHART_TYPES.map((key) => [key, { key, label: RULES.types[key].label, hi: RULES.types[key].hi, hint: RULES.types[key].hint }]),
);
export const COMPANY_LIMITATIONS = RULES.limitations;

// ----------------------------------------------------------------- basics ----

const RASHI_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
// Lord of each sign, Aries..Pisces (same table as prashna.js).
const SIGN_LORD = ["Ma", "Ve", "Me", "Mo", "Su", "Me", "Ve", "Ma", "Ju", "Sa", "Sa", "Ju"];
const PLANET_HI = {
  Su: "Surya", Mo: "Chandra", Ma: "Mangal", Me: "Budh", Ju: "Guru",
  Ve: "Shukra", Sa: "Shani", Ra: "Rahu", Ke: "Ketu",
};
const BENEFICS = new Set(["Ju", "Ve", "Me"]);
const MALEFICS = new Set(["Su", "Ma", "Sa", "Ra", "Ke"]);
// Whole-sign aspects as "n-th house from the planet". Nodes: conjunction only.
const ASPECTS = { Su: [7], Mo: [7], Me: [7], Ve: [7], Ma: [4, 7, 8], Ju: [5, 7, 9], Sa: [3, 7, 10] };

const GOOD_HOUSES = new Set(RULES.goodHouses);
const BAD_HOUSES = new Set(RULES.badHouses);
const UPACHAYA = new Set(RULES.upachayaHouses);
const P = RULES.points;

const ordinal = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const bhav = (n) => `${ordinal(n)} bhav`;
const housePoints = (h) => (GOOD_HOUSES.has(h) ? 1 : BAD_HOUSES.has(h) ? -1 : 0);

function chartIndex(chart) {
  const byCode = new Map(chart.planets.map((p) => [p.code, p]));
  const lagnaIdx = RASHI_NAMES.indexOf(chart.lagna);
  if (lagnaIdx < 0) throw new Error("Chart has no lagna.");
  const rashiOfHouse = (h) => (lagnaIdx + h - 1) % 12;
  const lordOfHouse = (h) => byCode.get(SIGN_LORD[rashiOfHouse(h)]);
  const occupants = (h) => chart.planets.filter((p) => p.house === h);
  const aspectedHouses = (p) => (ASPECTS[p.code] ?? []).map((n) => ((p.house - 1 + (n - 1)) % 12) + 1);
  const aspectorsOf = (h) => chart.planets.filter((p) => aspectedHouses(p).includes(h));
  return { byCode, rashiOfHouse, lordOfHouse, occupants, aspectorsOf };
}

// ------------------------------------------------------ Vimshottari dasha ----
// Same table and maths as src/lib/chartFacts.ts (vimshottariFacts), but computed on the server so the
// rules can use it. Order of lords: Ketu, Shukra, Surya, Chandra, Mangal, Rahu, Guru, Shani, Budh.

const DASHA_ORDER = [
  ["Ke", 7], ["Ve", 20], ["Su", 6], ["Mo", 10], ["Ma", 7], ["Ra", 18], ["Ju", 16], ["Sa", 19], ["Me", 17],
];
const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Mahadasha / Antardasha running at `now` for a chart cast at chart.utc. */
export function vimshottariAt(chart, now = new Date()) {
  const moon = chart.planets.find((p) => p.code === "Mo");
  const birth = Date.parse(chart.utc);
  const nowMs = now.getTime();
  if (!moon || !Number.isFinite(birth)) return { status: "unavailable" };
  // A chart for a moment that has not happened yet has no "running" dasha.
  if (nowMs < birth) return { status: "future" };

  const lon = moon.rashiIndex * 30 + moon.degree;
  const span = 360 / 27;
  const startIdx = Math.floor(lon / span) % 9;
  const elapsed = (lon % span) / span;

  let cursor = birth - elapsed * DASHA_ORDER[startIdx][1] * YEAR_MS;
  let current = null;
  let next = null;
  for (let i = 0; i < 40; i += 1) {
    const idx = (startIdx + i) % 9;
    const [code, years] = DASHA_ORDER[idx];
    const end = cursor + years * YEAR_MS;
    if (cursor <= nowMs && nowMs < end) {
      current = { idx, code, years, start: cursor, end };
      const [nextCode] = DASHA_ORDER[(idx + 1) % 9];
      next = { code: nextCode, start: end };
      break;
    }
    cursor = end;
  }
  if (!current) return { status: "unavailable" };

  let sub = current.start;
  let antar = null;
  for (let j = 0; j < 9; j += 1) {
    const [subCode, subYears] = DASHA_ORDER[(current.idx + j) % 9];
    const subEnd = sub + (current.years * subYears * YEAR_MS) / 120;
    if (sub <= nowMs && nowMs < subEnd) {
      antar = { code: subCode, start: sub, end: subEnd };
      break;
    }
    sub = subEnd;
  }

  const view = (d) => ({ code: d.code, name: PLANET_HI[d.code], start: isoDay(d.start), end: isoDay(d.end) });
  return {
    status: "ok",
    mahadasha: view(current),
    antardasha: antar ? view(antar) : null,
    nextMahadasha: { code: next.code, name: PLANET_HI[next.code], start: isoDay(next.start) },
  };
}

// ------------------------------------------------------------- evaluation ----

const signalFor = (score, cut) => (score >= cut.high ? "anukool" : score <= cut.low ? "dhyaan" : "mishrit");
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Evaluate a chart for a company or a house.
 * @param {object} chart  result of buildEventChart() (needs planets, lagna, utc)
 * @param {"company"|"ghar"} type
 * @param {Date} [now]    "today" for the dasha (injectable for tests)
 */
export function evaluateCompanyChart(chart, type, now = new Date()) {
  const rule = RULES.types[type];
  if (!rule) throw new Error(`Unknown chart type "${type}".`);

  const ix = chartIndex(chart);
  const factors = [];
  const add = (theme, key, points, text) => {
    if (points !== 0) factors.push({ theme, key, points, effect: points > 0 ? "+" : "-", text });
  };
  const planetRuleCodes = new Set(Object.keys(rule.planetRules));

  // --- 1) House themes: the lord, the occupants and the aspects ---------------------------
  const houseFacts = [];
  for (const theme of rule.themes.filter((t) => t.house)) {
    const h = theme.house;
    const lord = ix.lordOfHouse(h);
    const occ = ix.occupants(h);
    houseFacts.push({
      house: h,
      theme: theme.key,
      rashi: RASHI_NAMES[ix.rashiOfHouse(h)],
      lord: { code: lord.code, name: PLANET_HI[lord.code], house: lord.house, rashi: lord.rashi },
      occupants: occ.map((p) => ({ code: p.code, name: PLANET_HI[p.code] })),
    });

    const lq = housePoints(lord.house);
    add(
      theme.key,
      `lord-${h}`,
      lq > 0 ? P.lordInGoodHouse : lq < 0 ? P.lordInBadHouse : 0,
      lq > 0
        ? `${bhav(h)} ke swami ${PLANET_HI[lord.code]} ${bhav(lord.house)} mein hain (madadgaar sthaan): is pehlu ko sahara milta dikhta hai.`
        : `${bhav(h)} ke swami ${PLANET_HI[lord.code]} ${bhav(lord.house)} mein hain (mushkil wala sthaan): is pehlu mein dheeraj aur planning ki zarurat dikhti hai.`,
    );

    for (const p of occ) {
      if (planetRuleCodes.has(p.code)) continue; // Mangal/Shani placement is judged in its own theme
      if (BENEFICS.has(p.code)) {
        add(theme.key, `occ-${h}-${p.code}`, P.beneficInHouse, `${bhav(h)} mein ${PLANET_HI[p.code]} hai: shubh sahara.`);
      } else if (MALEFICS.has(p.code) && !UPACHAYA.has(h)) {
        add(theme.key, `occ-${h}-${p.code}`, P.maleficInHouse, `${bhav(h)} mein ${PLANET_HI[p.code]} hai: yahan ye rukawat ya tanav ka sanket deta hai.`);
      }
    }

    for (const p of ix.aspectorsOf(h)) {
      if (p.code === "Ju") {
        add(theme.key, `asp-${h}-Ju`, P.jupiterAspect, `Guru ki drishti ${bhav(h)} par hai: margdarshan aur sahara.`);
      } else if ((p.code === "Sa" || p.code === "Ma") && !UPACHAYA.has(h)) {
        add(theme.key, `asp-${h}-${p.code}`, P.maleficAspect, `${PLANET_HI[p.code]} ki drishti ${bhav(h)} par hai: thodi rukawat ya deri ka sanket.`);
      }
    }
  }

  // --- 2) Natural significators and lord links (company) ----------------------------------
  for (const k of rule.karakas) {
    const p = ix.byCode.get(k.code);
    const q = housePoints(p.house);
    add(
      k.theme,
      `karaka-${k.code}`,
      q * P.karakaWeight,
      q > 0
        ? `${PLANET_HI[k.code]} (${k.why}) ${bhav(p.house)} mein hai: sahayak sthiti.`
        : `${PLANET_HI[k.code]} (${k.why}) ${bhav(p.house)} mein hai: kamzor sthiti.`,
    );
  }
  for (const link of rule.links) {
    const [a, b] = link.houses;
    const la = ix.lordOfHouse(a);
    const lb = ix.lordOfHouse(b);
    if (la.code === lb.code) continue;
    const together = la.house === lb.house;
    const facing = Math.abs(la.house - lb.house) === 6;
    if (together || facing) {
      add(
        link.theme,
        `link-${a}-${b}`,
        P.lordsLinked,
        `${bhav(a)} aur ${bhav(b)} ke swami ${together ? "ek hi bhav mein hain" : "ek-doosre ke saamne hain"}: ${link.what} ke beech jodd bana hua hai.`,
      );
    }
  }

  // --- 3) Mangal / Shani placement (ghar) -------------------------------------------------
  const planetFacts = [];
  for (const theme of rule.themes.filter((t) => t.planet)) {
    const pr = rule.planetRules[theme.planet];
    const p = ix.byCode.get(theme.planet);
    const strong = pr.strongSigns.includes(p.rashi);
    planetFacts.push({
      theme: theme.key,
      code: p.code,
      name: PLANET_HI[p.code],
      house: p.house,
      rashi: p.rashi,
      strongSign: strong,
    });
    const name = PLANET_HI[p.code];
    if (pr.good.includes(p.house)) {
      add(theme.key, `planet-${p.code}-house`, 1, `${name} ${bhav(p.house)} mein hai: ${pr.goodText}.`);
    } else if (pr.watch[String(p.house)] !== undefined) {
      add(theme.key, `planet-${p.code}-house`, pr.watch[String(p.house)], `${name} ${bhav(p.house)} mein hai: ${pr.watchText}.`);
    }
    if (strong) add(theme.key, `planet-${p.code}-sign`, 1, `${name} ${p.rashi} mein hai, jo ${pr.strongText}.`);
  }

  // --- 4) Running Dasha --------------------------------------------------------------------
  const dasha = vimshottariAt(chart, now);
  const focus = new Set(rule.dashaFocusHouses);
  const connected = (code) => {
    const owns = [...focus].filter((h) => ix.lordOfHouse(h).code === code);
    const sits = [...focus].filter((h) => ix.byCode.get(code).house === h);
    return { owns, sits, any: owns.length + sits.length > 0 };
  };
  const dashaLine = (label, d) => {
    const link = connected(d.code);
    const planet = ix.byCode.get(d.code);
    if (link.any) {
      const parts = [
        ...(link.owns.length ? [`${link.owns.map(bhav).join(" aur ")} ke swami hain`] : []),
        ...(link.sits.length ? [`${link.sits.map(bhav).join(" aur ")} mein baithe ${link.owns.length ? "bhi " : ""}hain`] : []),
      ];
      add("dasha", `dasha-${label}`, P.dashaConnected, `Chal rahi ${label} ${d.name} ki hai, jo ${parts.join(" aur ")}: chal rahe samay ka is maamle se seedha rishta hai.`);
    } else if (BAD_HOUSES.has(planet.house)) {
      add("dasha", `dasha-${label}`, P.dashaStrained, `Chal rahi ${label} ${d.name} ki hai, jo ${bhav(planet.house)} mein baithe hain: ye samay dheeraj aur planning se chalne ka sanket deta hai.`);
    }
  };
  if (dasha.status === "ok") {
    dashaLine("Mahadasha", dasha.mahadasha);
    if (dasha.antardasha) dashaLine("Antardasha", dasha.antardasha);
  }

  // --- 5) Add it up ------------------------------------------------------------------------
  const themes = rule.themes.map((t) => {
    const own = factors.filter((f) => f.theme === t.key);
    const score = round1(own.reduce((s, f) => s + f.points, 0));
    const notes = [];
    if (t.dasha && dasha.status === "future") notes.push("Ye chart aane wale samay ka hai, isliye abhi koi dasha chal rahi nahi maani jaati.");
    if (t.dasha && dasha.status === "ok" && own.length === 0) notes.push("Chal rahi dasha ka is maamle se koi khaas sambandh nahi dikha.");
    return {
      key: t.key,
      label: t.label,
      score,
      signal: signalFor(score, rule.thresholds.themes[t.key]),
      factors: own
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
        .map((f) => ({ key: f.key, points: f.points, effect: f.effect, text: f.text })),
      notes,
    };
  });

  const total = round1(factors.reduce((s, f) => s + f.points, 0));
  return {
    version: COMPANY_RULES_VERSION,
    type,
    typeLabel: rule.label,
    verdict: signalFor(total, rule.thresholds.overall),
    score: total,
    themes,
    dasha,
    facts: { lagna: chart.lagna, houses: houseFacts, planets: planetFacts },
    limitations: RULES.limitations,
  };
}