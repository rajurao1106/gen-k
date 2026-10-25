// Real Vedic (sidereal, Lahiri) birth-chart calculation.
// Planet positions come from the `astronomy-engine` ephemeris, NOT from an LLM.
//
//   npm install astronomy-engine
//
// Pipeline: place -> lat/lon/timezone -> local birth time -> UTC -> planets
// + ascendant (tropical) -> subtract Lahiri ayanamsa -> rashi / house / nakshatra.

import * as Astronomy from "astronomy-engine";

const DEG = Math.PI / 180;
const norm360 = (x) => ((x % 360) + 360) % 360;

export const RASHIS = [
  ["Aries", "मेष"], ["Taurus", "वृषभ"], ["Gemini", "मिथुन"], ["Cancer", "कर्क"],
  ["Leo", "सिंह"], ["Virgo", "कन्या"], ["Libra", "तुला"], ["Scorpio", "वृश्चिक"],
  ["Sagittarius", "धनु"], ["Capricorn", "मकर"], ["Aquarius", "कुंभ"], ["Pisces", "मीन"],
];

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
  "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
  "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
  "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
  "Uttara Bhadrapada", "Revati",
];

const PLANETS = [
  { code: "Su", name: "Sun", body: "Sun" },
  { code: "Mo", name: "Moon", body: "Moon" },
  { code: "Ma", name: "Mars", body: "Mars" },
  { code: "Me", name: "Mercury", body: "Mercury" },
  { code: "Ju", name: "Jupiter", body: "Jupiter" },
  { code: "Ve", name: "Venus", body: "Venus" },
  { code: "Sa", name: "Saturn", body: "Saturn" },
];

// ---------------------------------------------------------------- time ----

function tzOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Local wall-clock time in an IANA zone -> real UTC Date (historic offsets handled by tzdata). */
export function localToUtc(dob, bot, timeZone) {
  const [y, m, d] = dob.split("-").map(Number);
  const [hh, mm] = bot.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm, 0);
  let utc = wall - tzOffsetMs(wall, timeZone);
  utc = wall - tzOffsetMs(utc, timeZone); // second pass fixes DST/offset edges
  return new Date(utc);
}

// ----------------------------------------------------------- astronomy ----

const julianDay = (date) => date.getTime() / 86400000 + 2440587.5;
const centuries = (date) => (julianDay(date) - 2451545.0) / 36525;

// General precession in longitude (arcsec) since J2000.
const precession = (T) => 5028.796195 * T + 1.1054348 * T * T;

// Lahiri (Chitrapaksha) ayanamsa, Swiss-Ephemeris definition:
// 23.245524743 deg on 1956-09-22 (JD 2435553.5), then advanced by precession.
const LAHIRI_T0 = (2435553.5 - 2451545.0) / 36525;
export function lahiriAyanamsa(date) {
  const T = centuries(date);
  return 23.245524743 + (precession(T) - precession(LAHIRI_T0)) / 3600;
}

const OBLIQUITY_J2000 = 23.4392911 * DEG;

/** Geocentric ecliptic longitude (deg) in the J2000 frame, with light-time/aberration. */
function eclipticLongitudeJ2000(bodyName, date) {
  const v = Astronomy.GeoVector(Astronomy.Body[bodyName], date, true); // EQJ, AU
  const y = v.y * Math.cos(OBLIQUITY_J2000) + v.z * Math.sin(OBLIQUITY_J2000);
  return norm360(Math.atan2(y, v.x) / DEG);
}

/** Sidereal longitude of a body = J2000 longitude + precession since J2000 - ayanamsa. */
function siderealLongitude(bodyName, date) {
  const T = centuries(date);
  return norm360(eclipticLongitudeJ2000(bodyName, date) + precession(T) / 3600 - lahiriAyanamsa(date));
}

function isRetrograde(bodyName, date) {
  const before = new Date(date.getTime() - 12 * 3600_000);
  const after = new Date(date.getTime() + 12 * 3600_000);
  const diff = norm360(eclipticLongitudeJ2000(bodyName, after) - eclipticLongitudeJ2000(bodyName, before));
  return diff > 180; // moved backwards
}

/** Mean lunar node (Rahu), tropical -> sidereal. Ketu is 180 deg opposite. */
function meanNodeSidereal(date) {
  const T = centuries(date);
  const omega = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441;
  return norm360(omega - lahiriAyanamsa(date));
}

function greenwichSiderealDeg(date) {
  const T = centuries(date);
  const d = julianDay(date) - 2451545.0;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Sidereal ascendant (lagna) in degrees. */
export function siderealAscendant(date, latDeg, lonDeg) {
  const T = centuries(date);
  const eps = (23.4392911 - 0.0130042 * T) * DEG;
  const ramc = norm360(greenwichSiderealDeg(date) + lonDeg) * DEG;
  const phi = latDeg * DEG;
  const asc = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)),
  ) / DEG;
  return norm360(asc - lahiriAyanamsa(date));
}

// -------------------------------------------------------------- helpers ----

const rashiIndex = (lon) => Math.floor(norm360(lon) / 30);

function describe(code, name, lon, lagnaIdx, extra = {}) {
  const idx = rashiIndex(lon);
  const nakIdx = Math.floor(norm360(lon) / (360 / 27));
  const pada = Math.floor((norm360(lon) % (360 / 27)) / (360 / 108)) + 1;
  return {
    code,
    name,
    rashi: RASHIS[idx][0],
    rashiHi: RASHIS[idx][1],
    rashiIndex: idx,
    degree: Math.round((norm360(lon) % 30) * 100) / 100,
    house: ((idx - lagnaIdx + 12) % 12) + 1, // whole-sign houses
    nakshatra: NAKSHATRAS[nakIdx],
    pada,
    ...extra,
  };
}

/**
 * Compute the full chart.
 * @param {{dob:string, bot:string, lat:number, lon:number, timeZone:string}} p
 */
export function computeChart({ dob, bot, lat, lon, timeZone }) {
  const date = localToUtc(dob, bot, timeZone);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid birth date or time.");

  const lagnaLon = siderealAscendant(date, lat, lon);
  const lagnaIdx = rashiIndex(lagnaLon);

  const planets = PLANETS.map(({ code, name, body }) =>
    describe(code, name, siderealLongitude(body, date), lagnaIdx, {
      retrograde: ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"].includes(body)
        ? isRetrograde(body, date)
        : false,
    }),
  );
  const rahuLon = meanNodeSidereal(date);
  planets.push(describe("Ra", "Rahu", rahuLon, lagnaIdx, { retrograde: true }));
  planets.push(describe("Ke", "Ketu", rahuLon + 180, lagnaIdx, { retrograde: true }));

  const houses = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), []]));
  for (const p of planets) houses[String(p.house)].push(p.code);

  const moon = planets.find((p) => p.code === "Mo");
  const sun = planets.find((p) => p.code === "Su");

  const chart = {
    lagna: RASHIS[lagnaIdx][0],
    lagnaHi: RASHIS[lagnaIdx][1],
    lagnaDegree: Math.round((lagnaLon % 30) * 100) / 100,
    ayanamsa: "Lahiri",
    ayanamsaValue: Math.round(lahiriAyanamsa(date) * 10000) / 10000,
    houseSystem: "Whole sign",
    moonSign: moon.rashi,
    moonSignHi: moon.rashiHi,
    moonNakshatra: moon.nakshatra,
    moonNakshatraPada: moon.pada,
    sunSign: sun.rashi,
    houses,
    planets,
    place: { lat, lon, timeZone },
    utc: date.toISOString(),
    engine: "astronomy-engine",
  };
  chart.summary = buildSummary(chart);
  return chart;
}

/** Plain-text chart facts that are injected into the AI prompt. */
export function buildSummary(c) {
  const lines = [
    `Calculated Vedic birth chart (sidereal, ${c.ayanamsa} ayanamsa, ${c.houseSystem} houses):`,
    `- Lagna (Ascendant): ${c.lagna} (${c.lagnaHi}) ${c.lagnaDegree} deg`,
    `- Moon sign (Chandra Rashi): ${c.moonSign} (${c.moonSignHi}), Nakshatra ${c.moonNakshatra} pada ${c.moonNakshatraPada}`,
    `- Sun sign (Surya Rashi): ${c.sunSign}`,
    "- Planet placements:",
  ];
  for (const p of c.planets) {
    lines.push(
      `  ${p.name}: ${p.rashi} ${p.degree} deg, house ${p.house}, ${p.nakshatra} pada ${p.pada}${p.retrograde && !["Rahu", "Ketu"].includes(p.name) ? ", retrograde" : ""}`,
    );
  }
  return lines.join("\n");
}