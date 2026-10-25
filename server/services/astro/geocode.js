// Place name -> { lat, lon, timeZone, label } using the free Open-Meteo geocoding API
// (no API key needed; returns the IANA timezone too).

const cache = new Map();

const stripDiacritics = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export class PlaceNotFoundError extends Error {
  constructor(place) {
    super(`Could not find "${place}". Try the nearest big town, e.g. "Bhubaneswar, Odisha, India".`);
    this.code = "PLACE_NOT_FOUND";
  }
}

async function search(name) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=" +
    encodeURIComponent(name);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoding service error (${res.status}).`);
  const data = await res.json();
  return data.results ?? [];
}

export async function geocodePlace(place) {
  const key = place.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const parts = stripDiacritics(place)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new PlaceNotFoundError(place);

  const hints = parts.slice(1).map((p) => p.toLowerCase());
  const tries = [parts[0], parts.slice(0, 2).join(" ")];
  for (const q of [...new Set(tries)]) {
    const results = await search(q);
    if (results.length === 0) continue;
    // Prefer the result whose state/country matches the rest of the text.
    const score = (r) =>
      hints.filter((h) =>
        [r.admin1, r.admin2, r.country, r.country_code]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(h) || h.includes(v.toLowerCase())),
      ).length;
    results.sort((a, b) => score(b) - score(a));
    const best = results[0];
    if (!best.timezone) continue;
    const found = {
      lat: best.latitude,
      lon: best.longitude,
      timeZone: best.timezone,
      label: [best.name, best.admin1, best.country].filter(Boolean).join(", "),
    };
    cache.set(key, found);
    return found;
  }
  throw new PlaceNotFoundError(place);
}