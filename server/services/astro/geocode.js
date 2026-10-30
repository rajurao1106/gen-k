// Place name -> { lat, lon, timeZone, label, confidence, alternatives }
// Uses the free Open-Meteo geocoding API (no API key; returns the IANA timezone too).
//
// Why this matters: lagna moves ~1 deg every 4 minutes, and 1 deg of longitude = 4 minutes of
// local time. Picking the wrong village (or the wrong state) can therefore change the lagna.
// So we (1) score candidates carefully, (2) report how sure we are, (3) return alternatives
// so the UI can ask the user to confirm, and (4) accept explicit, user-confirmed coordinates.

const CACHE_MAX = 500;
const CACHE_TTL_MS = 24 * 3600_000;
const cache = new Map();

const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};
const cacheSet = (key, value) => {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
};

const stripDiacritics = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalize = (s) =>
  stripDiacritics(String(s)).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// Old / alternate names people commonly type.
const ALIASES = {
  orissa: "odisha",
  uttaranchal: "uttarakhand",
  pondicherry: "puducherry",
  bombay: "mumbai",
  calcutta: "kolkata",
  madras: "chennai",
  bangalore: "bengaluru",
  banaras: "varanasi",
  benares: "varanasi",
  "up": "uttar pradesh",
  "mp": "madhya pradesh",
};
const applyAlias = (s) => ALIASES[s] ?? s;

export class PlaceNotFoundError extends Error {
  constructor(place) {
    super(`Could not find "${place}". Try the nearest big town, e.g. "Bhubaneswar, Odisha, India".`);
    this.code = "PLACE_NOT_FOUND";
  }
}

export class InvalidPlaceError extends Error {
  constructor(message) {
    super(message);
    this.code = "INVALID_PLACE";
  }
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoding service error (${res.status}).`);
  return res.json();
}

async function search(name, count = 20) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=" +
    count +
    "&language=en&format=json&name=" +
    encodeURIComponent(name);
  const data = await fetchJson(url);
  return data.results ?? [];
}

/** IANA timezone for a coordinate (used when the geocoder row has none, or for manual coordinates). */
export async function timezoneFor(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&timezone=auto&forecast_days=1&current=temperature_2m";
  const data = await fetchJson(url);
  if (!data.timezone) throw new Error("Could not determine the timezone for this place.");
  return data.timezone;
}

export function assertValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new InvalidPlaceError(`Unknown timezone "${timeZone}".`);
  }
}

/** Spelling variants for common Indian transliteration differences (Panibandha / Panibandh ...). */
function nameVariants(name) {
  const n = normalize(name);
  const set = new Set([n]);
  if (/[ah]$/.test(n)) set.add(n.slice(0, -1));
  set.add(n.replace(/aa/g, "a").replace(/ee/g, "i").replace(/oo/g, "u"));
  set.add(n.replace(/v/g, "w"));
  set.add(n.replace(/w/g, "v"));
  return [...set].filter((v) => v.length >= 2);
}

const hasWord = (haystack, needle) => ` ${haystack} `.includes(` ${needle} `);

function hintHits(r, hints) {
  const fields = [r.admin1, r.admin2, r.admin3, r.admin4, r.country, r.country_code]
    .filter(Boolean)
    .map(normalize);
  return hints.filter((h) => fields.some((f) => f === h || hasWord(f, h) || hasWord(h, f))).length;
}

function scoreResult(r, nameVars, hints) {
  const rn = normalize(r.name);
  let score = 0;
  if (nameVars.includes(rn)) score += 4;
  else if (nameVars.some((v) => rn.startsWith(v) || v.startsWith(rn))) score += 2;
  const hits = hintHits(r, hints);
  score += hits * 3;
  if (typeof r.feature_code === "string") {
    if (r.feature_code.startsWith("PPL")) score += 1; // populated place
    else if (r.feature_code.startsWith("ADM")) score += 0.5;
  }
  if (r.population) score += Math.min(1, Math.log10(r.population + 1) / 8);
  return { score, hits };
}

const toCandidate = (r, score = 0, hits = 0) => ({
  lat: Math.round(r.latitude * 10000) / 10000,
  lon: Math.round(r.longitude * 10000) / 10000,
  timeZone: r.timezone ?? null,
  label: [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(", "),
  score,
  hits,
});

/**
 * All plausible matches for a place text, best first.
 * Lets the UI show "Did you mean ...?" so the user confirms the exact village/town.
 */
export async function searchPlaces(place, { limit = 8 } = {}) {
  const parts = stripDiacritics(String(place))
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new PlaceNotFoundError(place);

  const nameVars = nameVariants(parts[0]);
  const hints = parts.slice(1).map((p) => applyAlias(normalize(p))).filter(Boolean);

  const queries = new Set(nameVars);
  if (parts.length > 1) queries.add(parts.slice(0, 2).join(" "));

  const seen = new Map();
  for (const q of [...queries].slice(0, 5)) {
    let rows = [];
    try {
      rows = await search(q);
    } catch (err) {
      if (seen.size === 0 && q === [...queries][0]) throw err; // first query failing = service problem
      continue;
    }
    for (const r of rows) {
      const key = r.id ?? `${r.latitude},${r.longitude}`;
      if (seen.has(key)) continue;
      const { score, hits } = scoreResult(r, nameVars, hints);
      seen.set(key, toCandidate(r, score, hits));
    }
  }

  const list = [...seen.values()].sort((a, b) => b.score - a.score);
  if (list.length === 0) throw new PlaceNotFoundError(place);
  return { candidates: list.slice(0, limit), hintCount: hints.length };
}

/**
 * Resolve a place text to coordinates.
 * confidence: "high"   - one clear match
 *             "medium" - several similar places, but all close together (< 25 km)
 *             "low"    - state/country hints didn't match, or equally good places far apart
 *                        -> the UI should ask the user to confirm (see `alternatives`)
 */
export async function geocodePlace(place) {
  const key = normalize(place);
  const cached = cacheGet(key);
  if (cached) return cached;

  const { candidates, hintCount } = await searchPlaces(place);
  const top = candidates[0];
  const second = candidates[1];

  let confidence = "high";
  if (hintCount > 0 && top.hits === 0) {
    confidence = "low";
  } else if (second) {
    const gap = top.score - second.score;
    const apartKm = haversineKm(top, second);
    if (gap < 2 && apartKm > 25) confidence = "low";
    else if (gap < 2) confidence = "medium";
  }

  const timeZone = top.timeZone ?? (await timezoneFor(top.lat, top.lon));
  const found = {
    lat: top.lat,
    lon: top.lon,
    timeZone,
    label: top.label,
    confidence,
    alternatives:
      confidence === "high"
        ? []
        : candidates.slice(1, 5).map(({ lat, lon, timeZone: tz, label }) => ({ lat, lon, timeZone: tz, label })),
  };
  cacheSet(key, found);
  return found;
}

/** Use coordinates the user confirmed (e.g. picked from alternatives or typed in). */
export async function resolveCoordinates({ lat, lon, timeZone, label }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new InvalidPlaceError("Latitude must be -90..90 and longitude -180..180.");
  }
  let tz = timeZone;
  if (tz) assertValidTimeZone(tz);
  else tz = await timezoneFor(lat, lon);
  return {
    lat: Math.round(lat * 10000) / 10000,
    lon: Math.round(lon * 10000) / 10000,
    timeZone: tz,
    label: label ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    confidence: "high",
    alternatives: [],
  };
}