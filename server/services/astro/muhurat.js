// Muhurat (auspicious time) rules engine.
// Everything here is plain, deterministic rule-checking: panchang + lagna shuddhi + Chandra bala +
// rahukaal/gulika. The rules live in muhurat-rules.json (per activity), so they are easy to change.
// The AI never sees raw rules or does any scoring: it only explains the ranked result in simple words.
//
// How it works
//   1. For every day in the range, find sunrise/sunset and the day's Rahukaal, Gulika, Yamaganda.
//   2. Walk through the day in 15/30-minute slots. For each slot compute the sky (Sun, Moon, planets, lagna).
//   3. "Block" rules throw a slot out completely (Rahukaal, Gulika, Vishti, Amavasya, Rikta tithi, bad yoga ...).
//   4. The remaining slots get points (tithi, nakshatra, vara, yoga, lagna shuddhi, Chandra bala ...).
//   5. Best slots are picked (spread over different days/times), and each is widened to its good window.

import fs from "node:fs";
import { createRequire } from "node:module";
import { computeChart, localToUtc, RASHIS, siderealAscendant, siderealLongitude } from "./chart.js";
import {
  karanaFromElongation,
  nakshatraFromLongitude,
  tithiFromLongitudes,
  VARAS,
  yogaFromLongitudes,
} from "./panchang.js";
import { instantToLocal } from "./eventChart.js";

const require = createRequire(import.meta.url);
const Astronomy = require("astronomy-engine");

const RULES = JSON.parse(fs.readFileSync(new URL("./muhurat-rules.json", import.meta.url), "utf8"));
export const MUHURAT_RULES_VERSION = RULES.version;
export const MUHURAT_ACTIVITIES = Object.fromEntries(
  Object.entries(RULES.activities).map(([key, a]) => [key, { key, label: a.label, hi: a.hi, hint: a.hint }]),
);
export const ACTIVITY_KEYS = Object.keys(RULES.activities);
export const MUHURAT_LIMITATIONS = RULES.limitations;
export const RASHI_NAMES = RASHIS.map((r) => r[0]);

export class MuhuratInputError extends Error {
  constructor(message) {
    super(message);
    this.code = "INVALID_MUHURAT";
  }
}

// ------------------------------------------------------------- constants ----

const SIGN_LORD = ["Ma", "Ve", "Me", "Mo", "Su", "Me", "Ve", "Ma", "Ju", "Sa", "Sa", "Ju"];
const SIGN_TYPE = ["movable", "fixed", "dual"]; // sign index % 3
const TYPE_HI = { movable: "chara (chal)", fixed: "sthira", dual: "dwiswabhava" };
const PLANET_BODY = { Su: "Sun", Mo: "Moon", Ma: "Mars", Me: "Mercury", Ju: "Jupiter", Ve: "Venus", Sa: "Saturn" };
const PLANET_HI = { Su: "Surya", Mo: "Chandra", Ma: "Mangal", Me: "Budh", Ju: "Guru", Ve: "Shukra", Sa: "Shani" };
const MALEFICS = ["Su", "Ma", "Sa"];
const BAD_HOUSES = new Set([6, 8, 12]);
const KENDRA_TRIKONA = new Set([1, 4, 5, 7, 9, 10]);

// Day split into 8 equal parts (sunrise -> sunset); the n-th part is the inauspicious one.
// Index 0 = Sunday.
const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1];
const YAMA_PART = [4, 3, 2, 1, 7, 6, 5];

const ordinal = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const bhav = (n) => `${ordinal(n)} bhav`;
const norm360 = (x) => ((x % 360) + 360) % 360;
const angularGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const round1 = (x) => Math.round(x * 10) / 10;
const hhmm = (date, timeZone) => instantToLocal(date, timeZone).bot.slice(0, 5);

// ------------------------------------------------------------- day facts ----

function weekdayIndex(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // civil weekday of that calendar date
}

/** Sunrise/sunset of a local calendar date, plus Rahukaal / Gulika / Yamaganda windows. Null in polar day/night. */
function dayInfo(dateStr, lat, lon, timeZone) {
  const midnight = localToUtc(dateStr, "00:00", timeZone);
  const nextMidnight = new Date(midnight.getTime() + 36 * 3600_000); // covers 23/25 hour DST days
  const observer = new Astronomy.Observer(lat, lon, 0);
  let rise;
  let set;
  try {
    rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, midnight, 1);
    set = rise ? Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, rise.date, 1) : null;
  } catch {
    return null;
  }
  if (!rise || !set || rise.date >= nextMidnight) return null;
  const sunrise = rise.date;
  const sunset = set.date;
  const wd = weekdayIndex(dateStr);
  const part = (sunset - sunrise) / 8;
  const windowOf = (n) => ({
    start: new Date(sunrise.getTime() + (n - 1) * part),
    end: new Date(sunrise.getTime() + n * part),
  });
  const withLocal = (w) => ({ ...w, startLocal: hhmm(w.start, timeZone), endLocal: hhmm(w.end, timeZone) });
  const dayMs = sunset - sunrise;
  return {
    dateStr,
    weekdayIndex: wd,
    vara: VARAS[wd],
    sunrise,
    sunset,
    sunriseLocal: hhmm(sunrise, timeZone),
    sunsetLocal: hhmm(sunset, timeZone),
    rahukaal: withLocal(windowOf(RAHU_PART[wd])),
    gulika: withLocal(windowOf(GULIKA_PART[wd])),
    yamaganda: withLocal(windowOf(YAMA_PART[wd])),
    // Abhijit = 8th of the 15 muhurtas of the day (around local noon)
    abhijit: {
      start: new Date(sunrise.getTime() + (dayMs * 7) / 15),
      end: new Date(sunrise.getTime() + (dayMs * 8) / 15),
    },
  };
}

const within = (t, w) => t >= w.start && t < w.end;

// ---------------------------------------------------------- slot scoring ----

/**
 * Score one moment. Returns { blocks:[{key,label}], factors:[...], total, max }.
 * `max` is the best total this activity could reach at this moment (used for the percentage).
 */
function evaluateSlot({ t, day, rules, lat, lon, natalMoonIdx }) {
  const blocks = [];
  const factors = [];
  let max = 0;
  const block = (key, label) => blocks.push({ key, label });
  const add = (key, points, text) => {
    if (points !== 0) factors.push({ key, points, effect: points > 0 ? "+" : "-", text });
  };

  const lon_ = {};
  for (const code of Object.keys(PLANET_BODY)) lon_[code] = siderealLongitude(PLANET_BODY[code], t);
  const lagnaLon = siderealAscendant(t, lat, lon);
  const lagnaIdx = Math.floor(norm360(lagnaLon) / 30);
  const signOf = (code) => Math.floor(norm360(lon_[code]) / 30);
  const houseOf = (code) => ((signOf(code) - lagnaIdx + 12) % 12) + 1;

  const tithi = tithiFromLongitudes(lon_.Su, lon_.Mo);
  const nak = nakshatraFromLongitude(lon_.Mo);
  const yoga = yogaFromLongitudes(lon_.Su, lon_.Mo);
  const karana = karanaFromElongation(tithi.elongation);
  const G = RULES.global;
  const paksha = tithi.paksha;
  const tn = tithi.numberInPaksha;

  // ----------------------------------------------------------- blockers ----
  if (G.blockRahukaal && within(t, day.rahukaal)) block("rahukaal", "Rahukaal");
  if (G.blockGulika && within(t, day.gulika)) block("gulika", "Gulika kaal");
  if (G.blockVishti && karana.isVishti) block("vishti", "Vishti (Bhadra) karana");
  if (G.blockAmavasya && tithi.number === 30) block("amavasya", "Amavasya");
  if (G.blockTithisInPaksha.includes(tn) && tn !== 15) block("rikta", "Rikta tithi (Chaturthi / Navami / Chaturdashi)");
  if (G.blockYogas.includes(yoga.name)) block("yoga", `Ashubh yoga (${yoga.name})`);
  const sunSign = RASHI_NAMES[signOf("Su")];
  if (rules.blockSunSigns.includes(sunSign)) block("kharmas", "Kharmas (Surya Dhanu/Meena mein)");
  for (const code of rules.blockAsta) {
    const orb = G.astaOrbDegrees[code];
    if (orb && angularGap(lon_[code], lon_.Su) < orb) block(`asta-${code}`, `${PLANET_HI[code]} asta (Surya ke bahut paas)`);
  }

  // ---------------------------------------------------- panchang points ----
  max += 2;
  if (rules.goodTithis.includes(tn)) add("tithi", 2, `Tithi ${paksha} ${tithi.name}: is kaam ke liye shubh maani jaati hai.`);
  else if (rules.avoidTithis.includes(tn)) add("tithi", -2, `Tithi ${paksha} ${tithi.name}: is kaam ke liye kam anukool maani jaati hai.`);

  max += 2;
  if (rules.goodNakshatras.includes(nak.name)) add("nakshatra", 2, `Chandra ${nak.name} nakshatra mein hai: is kaam ke liye shubh nakshatra.`);
  else if (rules.avoidNakshatras.includes(nak.name)) add("nakshatra", -2, `Chandra ${nak.name} nakshatra mein hai: is kaam ke liye kam anukool nakshatra.`);

  max += 1.5;
  if (rules.goodVaras.includes(day.vara.name)) add("vara", 1.5, `${day.vara.sanskrit} (${day.vara.name}): is kaam ke liye achha din.`);
  else if (rules.avoidVaras.includes(day.vara.name)) add("vara", -2, `${day.vara.sanskrit} (${day.vara.name}): is kaam ke liye kam anukool din.`);

  if (rules.shuklaBonus) {
    max += rules.shuklaBonus;
    if (paksha === "Shukla") add("paksha", rules.shuklaBonus, "Shukla paksha (Chandra badh raha hai): shuruaat ke kaam ke liye achha samay.");
  }

  max += 1;
  if (G.goodYogas.includes(yoga.name)) add("yoga", 1, `${yoga.name} yoga: sahayak yoga.`);
  else if (G.badYogas.includes(yoga.name)) add("yoga", -1.5, `${yoga.name} yoga: kam anukool yoga.`);

  if (!karana.isVishti && ["Kimstughna", "Shakuni", "Chatushpada", "Naga"].includes(karana.name)) {
    add("karana", -G.fixedKaranaPenalty, `${karana.name} karana: shubh kaam ke liye kam anukool.`);
  }

  // ------------------------------------------------------ lagna shuddhi ----
  const lagnaType = SIGN_TYPE[lagnaIdx % 3];
  const typePoints = rules.lagnaTypePoints[lagnaType] ?? 0;
  max += Math.max(...Object.values(rules.lagnaTypePoints));
  if (typePoints > 0) {
    add("lagna-type", typePoints, `Lagna ${RASHI_NAMES[lagnaIdx]} (${TYPE_HI[lagnaType]} rashi): is kaam ke liye upyukt lagna.`);
  }

  max += 1;
  const eighth = Object.keys(PLANET_BODY).filter((c) => houseOf(c) === 8);
  if (eighth.length === 0) add("lagna-8th", 1, "Lagna se 8th bhav khaali hai: lagna shuddhi ka achha sanket.");
  else add("lagna-8th", -2, `8th bhav mein ${eighth.map((c) => PLANET_HI[c]).join(", ")} hai: lagna shuddhi kamzor.`);

  for (const code of MALEFICS) {
    if (houseOf(code) === 1) add(`lagna-${code}`, -1, `Lagna mein ${PLANET_HI[code]} hai: thoda dabaav ya jaldbaazi ka sanket.`);
  }

  max += 1;
  const lagnaLord = SIGN_LORD[lagnaIdx];
  const lordHouse = houseOf(lagnaLord);
  if (BAD_HOUSES.has(lordHouse)) add("lagnesh", -1.5, `Lagnesh ${PLANET_HI[lagnaLord]} ${bhav(lordHouse)} mein hai (mushkil sthaan).`);
  else add("lagnesh", 1, `Lagnesh ${PLANET_HI[lagnaLord]} ${bhav(lordHouse)} mein hai: lagna ko sahara.`);

  max += 1;
  const moonHouse = houseOf("Mo");
  if (BAD_HOUSES.has(moonHouse)) add("moon-house", -2, `Chandra lagna se ${bhav(moonHouse)} mein hai: Chandra shuddhi kamzor.`);
  else add("moon-house", 1, `Chandra lagna se ${bhav(moonHouse)} mein hai: Chandra shuddhi theek.`);

  max += 1.5;
  if (KENDRA_TRIKONA.has(houseOf("Ju"))) add("guru-kendra", 1, `Guru ${bhav(houseOf("Ju"))} mein hai (kendra/trikon): margdarshan aur sahara.`);
  if (KENDRA_TRIKONA.has(houseOf("Ve"))) add("shukra-kendra", 0.5, `Shukra ${bhav(houseOf("Ve"))} mein hai (kendra/trikon): shubh sahara.`);

  for (const h of rules.clearHouses) {
    max += 0.5;
    const bad = MALEFICS.filter((c) => houseOf(c) === h);
    if (bad.length) add(`house-${h}`, -1.5, `${bhav(h)} mein ${bad.map((c) => PLANET_HI[c]).join(", ")} hai: is kaam ke bhav par dabaav.`);
    else add(`house-${h}`, 0.5, `${bhav(h)} saaf hai (koi paap graha nahi): is kaam ke bhav ko sahara.`);
  }

  // ---------------------------------------------------------- Chandra bala ----
  if (natalMoonIdx !== null) {
    max += 2;
    const fromNatal = ((signOf("Mo") - natalMoonIdx + 12) % 12) + 1;
    if ([1, 3, 6, 7, 10, 11].includes(fromNatal)) {
      add("chandra-bala", 2, `Chandra aapki janm rashi se ${bhav(fromNatal)} mein hai: Chandra bala anukool.`);
    } else if ([4, 8, 12].includes(fromNatal)) {
      add("chandra-bala", -2, `Chandra aapki janm rashi se ${bhav(fromNatal)} mein hai: Chandra bala kamzor.`);
    }
  }

  // ------------------------------------------------- time-of-day extras ----
  if (G.abhijitBonus) {
    max += G.abhijitBonus;
    if (within(t, day.abhijit)) add("abhijit", G.abhijitBonus, "Abhijit muhurat (din ka madhya): aam taur par shubh samay.");
  }
  if (within(t, day.yamaganda)) add("yamaganda", -G.penaltyYamaganda, "Yamaganda kaal: shubh kaam ke liye ise bachaya jaata hai.");

  const total = round1(factors.reduce((s, f) => s + f.points, 0));
  return {
    blocks,
    factors,
    total,
    max: round1(max),
    sky: { lagnaIdx, moonHouse, tithi, nak, yoga, karana },
  };
}

// ---------------------------------------------------------------- search ----

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const MAX_RANGE_DAYS = 31;

/**
 * Find the best muhurat windows.
 * @param {{
 *   activity: string, fromDate: string, toDate: string,          // local dates at the place, YYYY-MM-DD
 *   lat: number, lon: number, timeZone: string,
 *   stepMinutes?: 15|30, count?: number, natalMoonSign?: string,  // natalMoonSign = English rashi name
 *   now?: Date
 * }} p
 */
export function findMuhurat({ activity, fromDate, toDate, lat, lon, timeZone, stepMinutes = 30, count = 5, natalMoonSign, now = new Date() }) {
  const rules = RULES.activities[activity];
  if (!rules) throw new MuhuratInputError(`Unknown activity "${activity}".`);
  if (!isRealDate(fromDate) || !isRealDate(toDate)) throw new MuhuratInputError("Dates must look like 2026-11-20.");
  if (toDate < fromDate) throw new MuhuratInputError("Last date cannot be before the first date.");
  const days = Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) throw new MuhuratInputError(`Please pick at most ${MAX_RANGE_DAYS} days at a time.`);
  if (![15, 30].includes(stepMinutes)) throw new MuhuratInputError("stepMinutes must be 15 or 30.");
  const natalMoonIdx = natalMoonSign ? RASHI_NAMES.indexOf(natalMoonSign) : null;
  if (natalMoonSign && natalMoonIdx < 0) throw new MuhuratInputError("Unknown rashi.");

  const today = instantToLocal(now, timeZone).dob;
  if (toDate < today) throw new MuhuratInputError("Ye tarikhein beet chuki hain. Aaj ya aage ki tarikh chunein.");

  const stepMs = stepMinutes * 60_000;
  const all = []; // every evaluated slot, in time order
  const blockedCounts = {};
  const daysInfo = {};
  let polarDays = 0;

  for (let i = 0; i < days; i++) {
    const dateStr = addDays(fromDate, i);
    if (dateStr < today) continue;
    const day = dayInfo(dateStr, lat, lon, timeZone);
    if (!day) {
      polarDays++;
      continue;
    }
    daysInfo[dateStr] = day;
    const lastMinute = rules.allowNight ? 23 * 60 : Infinity; // night weddings run until 23:00 local
    for (let m = 0; m < 24 * 60; m += stepMinutes) {
      const t = localToUtc(dateStr, `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, timeZone);
      if (t < day.sunrise || t < now) continue;
      if (rules.allowNight ? m > lastMinute : t >= day.sunset) break;
      const ev = evaluateSlot({ t, day, rules, lat, lon, natalMoonIdx });
      for (const b of ev.blocks) blockedCounts[b.label] = (blockedCounts[b.label] ?? 0) + 1;
      all.push({
        t,
        dateStr,
        ...ev,
        blocked: ev.blocks.length > 0,
        percent: ev.max > 0 ? Math.max(0, Math.min(100, Math.round((ev.total / ev.max) * 100))) : 0,
      });
    }
  }

  // A slot that trips an "avoid" rule on tithi, nakshatra or vara can never read "anukool", whatever its total.
  const gradeOf = (slot) =>
    slot.percent >= RULES.thresholds.anukool &&
    !slot.factors.some((f) => ["tithi", "nakshatra", "vara"].includes(f.key) && f.points < 0)
      ? "anukool"
      : "mishrit";
  const candidates = all
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => !s.blocked && s.percent >= RULES.thresholds.mishrit)
    .sort((a, b) => b.s.total - a.s.total || a.s.t - b.s.t);

  // Spread the picks: first at most N per day, then fill up without that limit.
  const perDayCap = Math.max(1, Math.ceil(count / Math.max(1, Object.keys(daysInfo).length)));
  const picked = [];
  const perDay = {};
  const farEnough = (c) => picked.every((p) => Math.abs(p.s.t - c.s.t) >= 120 * 60_000);
  for (const pass of [1, 2]) {
    for (const c of candidates) {
      if (picked.length >= count) break;
      if (picked.includes(c) || !farEnough(c)) continue;
      if (pass === 1 && (perDay[c.s.dateStr] ?? 0) >= perDayCap) continue;
      picked.push(c);
      perDay[c.s.dateStr] = (perDay[c.s.dateStr] ?? 0) + 1;
    }
  }
  picked.sort((a, b) => b.s.total - a.s.total || a.s.t - b.s.t);

  const slots = picked.map(({ s: best, idx }, rank) => {
    // Widen to the neighbouring slots that stay unblocked and almost as good.
    const joins = (from, to) =>
      all[to] && all[to].dateStr === best.dateStr && !all[to].blocked && all[to].total >= best.total - 1 &&
      Math.abs(all[to].t - all[from].t) === stepMs &&
      Math.abs(all[to].t - best.t) <= 90 * 60_000; // keep each window short (lagna keeps moving)
    let lo = idx;
    let hi = idx;
    while (joins(lo, lo - 1)) lo--;
    while (joins(hi, hi + 1)) hi++;
    const start = all[lo].t;
    const end = new Date(all[hi].t.getTime() + stepMs);
    const day = daysInfo[best.dateStr];
    const { tithi, nak, yoga, karana, lagnaIdx, moonHouse } = best.sky;

    const full = (() => {
      const local = instantToLocal(best.t, timeZone);
      const chart = computeChart({ dob: local.dob, bot: local.bot, lat, lon, timeZone });
      chart.place = { lat, lon, timeZone };
      return chart;
    })();

    const factors = [...best.factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 9);
    return {
      id: `${best.dateStr}T${hhmm(start, timeZone)}`,
      rank: rank + 1,
      date: best.dateStr,
      weekday: day.vara.name,
      startLocal: hhmm(start, timeZone),
      endLocal: hhmm(end, timeZone),
      bestLocal: hhmm(best.t, timeZone),
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      score: best.total,
      maxScore: best.max,
      percent: best.percent,
      grade: gradeOf(best),
      factors,
      panchang: {
        tithi: { paksha: tithi.paksha, name: tithi.name },
        vara: { name: day.vara.name, sanskrit: day.vara.sanskrit },
        nakshatra: { name: nak.name, pada: nak.pada },
        yoga: { name: yoga.name },
        karana: { name: karana.name },
      },
      lagna: RASHI_NAMES[lagnaIdx],
      moonHouse,
      day: {
        sunrise: day.sunriseLocal,
        sunset: day.sunsetLocal,
        rahukaal: { start: day.rahukaal.startLocal, end: day.rahukaal.endLocal },
        gulika: { start: day.gulika.startLocal, end: day.gulika.endLocal },
        yamaganda: { start: day.yamaganda.startLocal, end: day.yamaganda.endLocal },
      },
      chart: full,
    };
  });

  const topReasons = Object.entries(blockedCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label);

  return {
    version: MUHURAT_RULES_VERSION,
    activity,
    activityLabel: rules.label,
    range: { fromDate, toDate, days },
    place: { lat, lon, timeZone },
    stepMinutes,
    usedChandraBala: natalMoonIdx !== null,
    natalMoonSign: natalMoonIdx !== null ? natalMoonSign : null,
    slotsChecked: all.length,
    slotsBlocked: all.filter((s) => s.blocked).length,
    mainBlockers: topReasons,
    polarDays,
    slots,
    limitations: MUHURAT_LIMITATIONS,
  };
}