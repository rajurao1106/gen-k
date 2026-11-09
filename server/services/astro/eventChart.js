// Shared by every "event chart" feature (Prashna, Muhurat, Company, ...):
// a chart for ANY moment and place, plus its panchang, built with the same engine as the birth chart.

import { computeChart, localToUtc } from "./chart.js";
import { computePanchang, panchangSummary } from "./panchang.js";
import { geocodePlace, resolveCoordinates } from "./geocode.js";

export const EVENT_KINDS = ["prashna", "muhurat", "company", "place", "animal", "mundane"];

export class InvalidDatetimeError extends Error {
  constructor(message = "Invalid datetime.") {
    super(message);
    this.code = "INVALID_DATETIME";
  }
}

// "2026-11-07T14:30" or "2026-11-07T14:30:15"  -> local wall-clock time AT THE PLACE
// "2026-11-07T09:00:00Z" / "...+05:30"         -> an exact instant (e.g. the browser's "now")
const LOCAL_DT = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/;
const INSTANT_DT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export const isValidEventDatetime = (v) => typeof v === "string" && (LOCAL_DT.test(v) || INSTANT_DT.test(v));

/** An exact instant -> { dob, bot } in the place's local time (what computeChart expects). */
export function instantToLocal(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return {
    dob: `${get("year")}-${get("month")}-${get("day")}`,
    bot: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

/**
 * Build the chart for an event.
 * @param {{
 *   datetime: string,            // local time at the place, or an ISO instant with Z/offset
 *   kind: string,                // one of EVENT_KINDS
 *   label?: string,
 *   place?: string,              // place name (geocoded) ...
 *   lat?: number, lon?: number, timeZone?: string,   // ... or coordinates (win over the name)
 *   nodeType?: "mean"|"true",
 * }} p
 */
export async function buildEventChart({ datetime, kind, label = "", place: placeText, lat, lon, timeZone, nodeType }) {
  if (!isValidEventDatetime(datetime)) throw new InvalidDatetimeError();
  if (!EVENT_KINDS.includes(kind)) throw new Error(`Unknown event kind "${kind}".`);

  // 1) place: coordinates win; otherwise geocode the name.
  const place =
    lat !== undefined && lon !== undefined
      ? { ...(await resolveCoordinates({ lat, lon, timeZone, label: placeText ?? label })), source: "request" }
      : { ...(await geocodePlace(placeText)), source: "geocoded" };

  // 2) moment: local wall time at the place, or an exact instant converted to the place's local time.
  let dob;
  let bot;
  const local = LOCAL_DT.exec(datetime);
  if (local) {
    [, dob, bot] = local;
  } else {
    const instant = new Date(datetime.replace(" ", "T"));
    if (Number.isNaN(instant.getTime())) throw new InvalidDatetimeError();
    ({ dob, bot } = instantToLocal(instant, place.timeZone));
  }

  // 3) chart (same engine as the birth chart) + panchang for the same instant.
  const chart = computeChart({ dob, bot, lat: place.lat, lon: place.lon, timeZone: place.timeZone, nodeType });
  const when = localToUtc(dob, bot, place.timeZone);
  const panchang = computePanchang({ date: when, lat: place.lat, lon: place.lon, timeZone: place.timeZone });

  chart.place = { ...place }; // label, confidence, source and alternatives for the UI
  chart.event = { kind, label, localDate: dob, localTime: bot, utc: when.toISOString() };
  chart.panchang = panchang;
  // Replace the "birth chart" wording so the AI never treats an event as a person's birth.
  chart.summary =
    chart.summary.replace(
      /^Calculated Vedic birth chart/,
      `Calculated Vedic ${kind} chart for ${dob} ${bot} (${place.timeZone})`,
    ) +
    "\n" +
    panchangSummary(panchang);
  return chart;
}