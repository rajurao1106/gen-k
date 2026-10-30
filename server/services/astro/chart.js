// Real Vedic (sidereal, Lahiri) birth-chart calculation.
// Planet positions come from the `astronomy-engine` ephemeris, NOT from an LLM.
//
//   npm install astronomy-engine
//
// Pipeline: place -> lat/lon/timezone -> local birth time -> UTC -> planets
// + ascendant -> subtract Lahiri ayanamsa -> rashi / house / nakshatra.
//
// Accuracy notes
//  * Planets: sidereal longitude = mean-equinox-of-date longitude - mean Lahiri ayanamsa.
//    Nutation moves the *true* equinox, not the stars, so it cancels out for sidereal
//    planet longitudes and must NOT be added there (same convention as Swiss Ephemeris).
//  * Ascendant: depends on the real horizon, so it uses apparent sidereal time and the
//    true obliquity (both need nutation), and subtracts the *true* ayanamsa (mean + dpsi).
//  * Rahu/Ketu: "mean" node (default, classical) or "true" (osculating) node.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Astronomy = require("astronomy-engine");

const DEG = Math.PI / 180;
const norm360 = (x) => ((x % 360) + 360) % 360;
/** Smallest signed difference a-b in (-180, 180]. */
const angDiff = (a, b) => ((a - b + 540) % 360) - 180;

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

/**
 * Local wall-clock time in an IANA zone -> real UTC Date (historic offsets handled by tzdata).
 * `bot` is "HH:MM" or "HH:MM:SS".
 */
export function localToUtc(dob, bot, timeZone) {
  const [y, m, d] = dob.split("-").map(Number);
  const [hh, mm, ss = 0] = bot.split(":").map(Number);
  if ([y, m, d, hh, mm, ss].some((n) => !Number.isFinite(n))) throw new Error("Invalid birth date or time.");
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59 || ss > 59) throw new Error("Invalid birth date or time.");
  const wall = Date.UTC(y, m - 1, d, hh, mm, ss);
  let utc = wall - tzOffsetMs(wall, timeZone);
  utc = wall - tzOffsetMs(utc, timeZone); // second pass fixes DST/offset edges
  return new Date(utc);
}

// ----------------------------------------------------------- astronomy ----

const julianDay = (date) => date.getTime() / 86400000 + 2440587.5;
const centuries = (date) => (julianDay(date) - 2451545.0) / 36525;

// General precession in longitude (arcsec) since J2000.
const precession = (T) => 5028.796195 * T + 1.1054348 * T * T;

// Lahiri (Chitrapaksha) mean ayanamsa, Swiss-Ephemeris definition:
// 23.245524743 deg on 1956-09-22 (JD 2435553.5), then advanced by precession.
const LAHIRI_T0 = (2435553.5 - 2451545.0) / 36525;
export function lahiriAyanamsa(date) {
  const T = centuries(date);
  return 23.245524743 + (precession(T) - precession(LAHIRI_T0)) / 3600;
}

// ---- nutation (IAU 1980, 15 largest terms, error < 0.02 arcsec) -----------
// [D, M, M', F, Omega, dpsi0, dpsi1*T, deps0, deps1*T]  (units of 0.0001 arcsec)
const NUT = [
  [0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9],
  [-2, 0, 0, 2, 2, -13187, -1.6, 5736, -3.1],
  [0, 0, 0, 2, 2, -2274, -0.2, 977, -0.5],
  [0, 0, 0, 0, 2, 2062, 0.2, -895, 0.5],
  [0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1],
  [0, 0, 1, 0, 0, 712, 0.1, -7, 0],
  [-2, 1, 0, 2, 2, -517, 1.2, 224, -0.6],
  [0, 0, 0, 2, 1, -386, -0.4, 200, 0],
  [0, 0, 1, 2, 2, -301, 0, 129, -0.1],
  [-2, -1, 0, 2, 2, 217, -0.5, -95, 0.3],
  [-2, 0, 1, 0, 0, -158, 0, 0, 0],
  [-2, 0, 0, 2, 1, 129, 0.1, -70, 0],
  [0, 0, -1, 2, 2, 123, 0, -53, 0],
  [2, 0, 0, 0, 0, 63, 0, 0, 0],
  [0, 0, 1, 0, 1, 63, 0.1, -33, 0],
];

/** Nutation in longitude (dpsi) and obliquity (deps), both in degrees. */
export function nutation(T) {
  const D = (297.85036 + 445267.11148 * T - 0.0019142 * T * T + (T * T * T) / 189474) * DEG;
  const M = (357.52772 + 35999.05034 * T - 0.0001603 * T * T - (T * T * T) / 300000) * DEG;
  const Mp = (134.96298 + 477198.867398 * T + 0.0086972 * T * T + (T * T * T) / 56250) * DEG;
  const F = (93.27191 + 483202.017538 * T - 0.0036825 * T * T + (T * T * T) / 327270) * DEG;
  const Om = (125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000) * DEG;
  let dpsi = 0;
  let deps = 0;
  for (const [d, m, mp, f, om, p0, p1, e0, e1] of NUT) {
    const arg = d * D + m * M + mp * Mp + f * F + om * Om;
    dpsi += (p0 + p1 * T) * Math.sin(arg);
    deps += (e0 + e1 * T) * Math.cos(arg);
  }
  return { dpsi: (dpsi * 1e-4) / 3600, deps: (deps * 1e-4) / 3600 };
}

/** Mean obliquity of the ecliptic (IAU 2006), degrees. */
export const meanObliquity = (T) =>
  (84381.406 - 46.836769 * T - 0.0001831 * T * T + 0.0020034 * T * T * T) / 3600;

const OBLIQUITY_J2000 = 23.4392911 * DEG;

/** Rotate an equatorial (J2000) vector into the J2000 ecliptic frame. */
function eqjToEcliptic(v) {
  const c = Math.cos(OBLIQUITY_J2000);
  const s = Math.sin(OBLIQUITY_J2000);
  return { x: v.x, y: v.y * c + v.z * s, z: -v.y * s + v.z * c };
}

/** Geocentric ecliptic longitude (deg) in the J2000 frame, with light-time/aberration. */
function eclipticLongitudeJ2000(bodyName, date) {
  const v = eqjToEcliptic(Astronomy.GeoVector(Astronomy.Body[bodyName], date, true)); // EQJ, AU
  return norm360(Math.atan2(v.y, v.x) / DEG);
}

/** Sidereal longitude of a body = J2000 longitude + precession since J2000 - mean ayanamsa. */
function siderealLongitude(bodyName, date) {
  const T = centuries(date);
  return norm360(eclipticLongitudeJ2000(bodyName, date) + precession(T) / 3600 - lahiriAyanamsa(date));
}

function isRetrograde(bodyName, date) {
  const before = new Date(date.getTime() - 12 * 3600_000);
  const after = new Date(date.getTime() + 12 * 3600_000);
  return angDiff(eclipticLongitudeJ2000(bodyName, after), eclipticLongitudeJ2000(bodyName, before)) < 0;
}

// ---- lunar nodes -----------------------------------------------------------

/** Mean lunar node (Rahu), tropical -> sidereal. Ketu is 180 deg opposite. */
function meanNodeSidereal(date) {
  const T = centuries(date);
  const omega = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441;
  return norm360(omega - lahiriAyanamsa(date));
}

/**
 * Longitude (deg, J2000 ecliptic frame) of the ascending node of an osculating orbit,
 * from position r and velocity v given in the J2000 *equatorial* frame (any consistent units).
 */
export function osculatingNodeLongitudeJ2000(r, v) {
  const re = eqjToEcliptic(r);
  const ve = eqjToEcliptic(v);
  const hx = re.y * ve.z - re.z * ve.y;
  const hy = re.z * ve.x - re.x * ve.z;
  return norm360(Math.atan2(hx, -hy) / DEG);
}

function trueNodeLongitudeJ2000(date) {
  const dt = 20 * 60_000; // 20 min central difference
  const r = Astronomy.GeoMoon(date);
  const a = Astronomy.GeoMoon(new Date(date.getTime() - dt));
  const b = Astronomy.GeoMoon(new Date(date.getTime() + dt));
  const k = 1 / (2 * dt);
  const v = { x: (b.x - a.x) * k, y: (b.y - a.y) * k, z: (b.z - a.z) * k };
  return osculatingNodeLongitudeJ2000(r, v);
}

/** True (osculating) lunar node, tropical -> sidereal. */
function trueNodeSidereal(date) {
  const T = centuries(date);
  return norm360(trueNodeLongitudeJ2000(date) + precession(T) / 3600 - lahiriAyanamsa(date));
}

function nodeSidereal(date, nodeType) {
  return nodeType === "true" ? trueNodeSidereal(date) : meanNodeSidereal(date);
}

function nodeIsRetrograde(date, nodeType) {
  if (nodeType !== "true") return true; // the mean node always moves backwards
  const before = new Date(date.getTime() - 12 * 3600_000);
  const after = new Date(date.getTime() + 12 * 3600_000);
  return angDiff(nodeSidereal(after, "true"), nodeSidereal(before, "true")) < 0;
}

// ---- ascendant -------------------------------------------------------------

function greenwichMeanSiderealDeg(date) {
  const T = centuries(date);
  const d = julianDay(date) - 2451545.0;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Sidereal ascendant (lagna) in degrees, using apparent sidereal time and true obliquity. */
export function siderealAscendant(date, latDeg, lonDeg) {
  const T = centuries(date);
  const { dpsi, deps } = nutation(T);
  const eps = (meanObliquity(T) + deps) * DEG; // true obliquity
  const gast = greenwichMeanSiderealDeg(date) + dpsi * Math.cos(eps); // apparent sidereal time
  const ramc = norm360(gast + lonDeg) * DEG;
  const phi = latDeg * DEG;
  const asc =
    Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) / DEG;
  // asc is on the true equinox of date: remove nutation to get mean-equinox longitude, then ayanamsa.
  return norm360(asc - dpsi - lahiriAyanamsa(date));
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
 * How many minutes of birth-time error would move `lonAt(date)` into the next/previous rashi?
 * Returns null if it is further away than `withinMinutes`.
 */
function boundaryInfo(label, lonAt, date, withinMinutes) {
  const step = 5 * 60_000;
  const lon = lonAt(date);
  const speed = angDiff(lonAt(new Date(date.getTime() + step)), lonAt(new Date(date.getTime() - step))) / 10; // deg/min
  if (Math.abs(speed) < 1e-9) return null;
  const inSign = norm360(lon) % 30;
  const dist = speed > 0 ? 30 - inSign : inSign;
  const minutes = dist / Math.abs(speed);
  if (minutes > withinMinutes) return null;
  const idx = rashiIndex(lon);
  const next = RASHIS[(idx + (speed > 0 ? 1 : 11)) % 12][0];
  return {
    body: label,
    rashi: RASHIS[idx][0],
    minutes: Math.round(minutes * 10) / 10,
    changesTo: next,
    ifBirthTime: speed > 0 ? "later" : "earlier",
  };
}

/**
 * Compute the full chart.
 * @param {{dob:string, bot:string, lat:number, lon:number, timeZone:string, nodeType?: "mean"|"true"}} p
 */
export function computeChart({ dob, bot, lat, lon, timeZone, nodeType = "mean" }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error("Invalid birth place coordinates.");
  }
  const node = nodeType === "true" ? "true" : "mean";
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
  const rahuLon = nodeSidereal(date, node);
  const nodeRetro = nodeIsRetrograde(date, node);
  planets.push(describe("Ra", "Rahu", rahuLon, lagnaIdx, { retrograde: nodeRetro }));
  planets.push(describe("Ke", "Ketu", rahuLon + 180, lagnaIdx, { retrograde: nodeRetro }));

  const houses = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), []]));
  for (const p of planets) houses[String(p.house)].push(p.code);

  const moon = planets.find((p) => p.code === "Mo");
  const sun = planets.find((p) => p.code === "Su");

  // Sign changes that a small birth-time error could cause (lagna moves ~1 deg / 4 min, Moon ~0.5 deg / h).
  const boundaryAlerts = [
    boundaryInfo("Lagna", (d) => siderealAscendant(d, lat, lon), date, 15),
    boundaryInfo("Moon", (d) => siderealLongitude("Moon", d), date, 120),
  ].filter(Boolean);

  const chart = {
    lagna: RASHIS[lagnaIdx][0],
    lagnaHi: RASHIS[lagnaIdx][1],
    lagnaDegree: Math.round((lagnaLon % 30) * 100) / 100,
    ayanamsa: "Lahiri",
    ayanamsaValue: Math.round(lahiriAyanamsa(date) * 10000) / 10000,
    houseSystem: "Whole sign",
    nodeType: node,
    moonSign: moon.rashi,
    moonSignHi: moon.rashiHi,
    moonNakshatra: moon.nakshatra,
    moonNakshatraPada: moon.pada,
    sunSign: sun.rashi,
    houses,
    planets,
    boundaryAlerts,
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
    `Calculated Vedic birth chart (sidereal, ${c.ayanamsa} ayanamsa, ${c.houseSystem} houses, ${c.nodeType} node):`,
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
  for (const a of c.boundaryAlerts ?? []) {
    lines.push(
      `- Note: ${a.body} is only ${a.minutes} min of birth time away from changing to ${a.changesTo} (if the real birth time were ${a.ifBirthTime}).`,
    );
  }
  return lines.join("\n");
}