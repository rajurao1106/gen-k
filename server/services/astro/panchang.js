// Panchang (tithi, vara, nakshatra, yoga, karana) for any moment and place.
// Pure calculation from the Sun/Moon sidereal (Lahiri) longitudes - no AI involved.
//
//   tithi     = Moon-Sun elongation / 12 deg          (30 per lunar month)
//   nakshatra = Moon longitude / 13deg20'             (27)
//   yoga      = (Sun + Moon longitude) / 13deg20'     (27)
//   karana    = half a tithi (6 deg)                  (60 per month, 11 names)
//   vara      = weekday of the LAST SUNRISE (Vedic day starts at sunrise, not midnight)

import { createRequire } from "node:module";
import { siderealLongitude } from "./chart.js";

const require = createRequire(import.meta.url);
const Astronomy = require("astronomy-engine");

const norm360 = (x) => ((x % 360) + 360) % 360;
const NAK_SPAN = 360 / 27;

export const TITHI_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami",
  "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi",
];

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
  "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
  "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
  "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
  "Uttara Bhadrapada", "Revati",
];

export const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma",
  "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha",
  "Shukla", "Brahma", "Indra", "Vaidhriti",
];

// 7 repeating (movable) karanas + 4 fixed ones.
const MOVABLE_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];

// Index 0 = Sunday (same as JS getDay()).
export const VARAS = [
  { name: "Sunday", sanskrit: "Ravivara", lord: "Sun" },
  { name: "Monday", sanskrit: "Somavara", lord: "Moon" },
  { name: "Tuesday", sanskrit: "Mangalavara", lord: "Mars" },
  { name: "Wednesday", sanskrit: "Budhavara", lord: "Mercury" },
  { name: "Thursday", sanskrit: "Guruvara", lord: "Jupiter" },
  { name: "Friday", sanskrit: "Shukravara", lord: "Venus" },
  { name: "Saturday", sanskrit: "Shanivara", lord: "Saturn" },
];
const WEEKDAY_INDEX = Object.fromEntries(VARAS.map((v, i) => [v.name, i]));

// ------------------------------------------------------------ pieces ----

/** Tithi 1..30 (1-15 Shukla, 16-30 Krishna) from the sidereal Sun and Moon longitudes. */
export function tithiFromLongitudes(sunLon, moonLon) {
  const elongation = norm360(moonLon - sunLon);
  const number = Math.floor(elongation / 12) + 1; // 1..30
  const paksha = number <= 15 ? "Shukla" : "Krishna";
  const inPaksha = number <= 15 ? number : number - 15; // 1..15
  const name = inPaksha === 15 ? (paksha === "Shukla" ? "Purnima" : "Amavasya") : TITHI_NAMES[inPaksha - 1];
  return {
    number,
    paksha,
    numberInPaksha: inPaksha,
    name,
    fractionElapsed: Math.round(((elongation % 12) / 12) * 1000) / 1000,
    elongation: Math.round(elongation * 1000) / 1000,
  };
}

export function nakshatraFromLongitude(moonLon) {
  const lon = norm360(moonLon);
  const index = Math.floor(lon / NAK_SPAN);
  return {
    index,
    number: index + 1,
    name: NAKSHATRAS[index],
    pada: Math.floor((lon % NAK_SPAN) / (NAK_SPAN / 4)) + 1,
  };
}

export function yogaFromLongitudes(sunLon, moonLon) {
  const index = Math.floor(norm360(sunLon + moonLon) / NAK_SPAN);
  return { index, number: index + 1, name: YOGA_NAMES[index] };
}

/** Karana from the elongation: 60 half-tithis per month. */
export function karanaFromElongation(elongation) {
  const k = Math.floor(norm360(elongation) / 6); // 0..59
  let name;
  if (k === 0) name = "Kimstughna";
  else if (k === 57) name = "Shakuni";
  else if (k === 58) name = "Chatushpada";
  else if (k === 59) name = "Naga";
  else name = MOVABLE_KARANAS[(k - 1) % 7];
  return { index: k, name, isVishti: name === "Vishti" }; // Vishti (Bhadra) is avoided for auspicious work
}

function localWeekdayIndex(date, timeZone) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date);
  return WEEKDAY_INDEX[name];
}

/** Most recent sunrise before `date` at the place, or null (polar day/night, or search failure). */
export function lastSunrise(date, lat, lon) {
  try {
    const observer = new Astronomy.Observer(lat, lon, 0);
    const t = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, date, -1.5);
    return t ? t.date : null;
  } catch {
    return null;
  }
}

/**
 * Vara (weekday). If lat/lon are known, the Vedic day is counted from the last sunrise
 * (so 02:00 on Tuesday is still Monday's vara). Otherwise the civil weekday is used.
 */
export function varaFor(date, timeZone, lat, lon) {
  const civilIdx = localWeekdayIndex(date, timeZone);
  let idx = civilIdx;
  let basis = "civil-day";
  let sunrise = null;
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    sunrise = lastSunrise(date, lat, lon);
    if (sunrise) {
      idx = localWeekdayIndex(sunrise, timeZone);
      basis = "sunrise";
    }
  }
  return { ...VARAS[idx], index: idx, basis, civilWeekday: VARAS[civilIdx].name, sunrise: sunrise?.toISOString() ?? null };
}

// ------------------------------------------------------------- main ----

/**
 * Full panchang for one moment.
 * @param {{date: Date, lat?: number, lon?: number, timeZone: string}} p
 */
export function computePanchang({ date, lat, lon, timeZone }) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error("Invalid date for panchang.");
  const sun = siderealLongitude("Sun", date);
  const moon = siderealLongitude("Moon", date);
  const tithi = tithiFromLongitudes(sun, moon);
  return {
    tithi,
    vara: varaFor(date, timeZone, lat, lon),
    nakshatra: nakshatraFromLongitude(moon),
    yoga: yogaFromLongitudes(sun, moon),
    karana: karanaFromElongation(tithi.elongation),
    sunLongitude: Math.round(sun * 10000) / 10000,
    moonLongitude: Math.round(moon * 10000) / 10000,
    ayanamsa: "Lahiri",
  };
}

/** Plain-text facts for the AI prompt (the AI only explains these, it never computes them). */
export function panchangSummary(p) {
  return [
    "Panchang at this moment (calculated):",
    `- Tithi: ${p.tithi.paksha} ${p.tithi.name} (${p.tithi.number}/30), ${Math.round(p.tithi.fractionElapsed * 100)}% elapsed`,
    `- Vara: ${p.vara.name} (${p.vara.sanskrit}), lord ${p.vara.lord}${p.vara.basis === "sunrise" ? ", counted from sunrise" : ""}`,
    `- Nakshatra: ${p.nakshatra.name} pada ${p.nakshatra.pada}`,
    `- Yoga: ${p.yoga.name}`,
    `- Karana: ${p.karana.name}${p.karana.isVishti ? " (Vishti/Bhadra)" : ""}`,
  ].join("\n");
}