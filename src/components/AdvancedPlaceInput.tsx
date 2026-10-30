"use client";

import { useState } from "react";

export type AdvancedPlace = { label: string; lat: number; lng: number; tz: string };

/**
 * "21.6012", "21.6012 N", "-85.5", "85.5 W"  ->  number, or null if invalid / out of range.
 * (Decimal degrees, the format Google Maps and most map apps show.)
 */
export function parseCoordinate(raw: string, kind: "lat" | "lng"): number | null {
  const m = raw.trim().replace(/°/g, "").match(/^([+-]?\d+(?:\.\d+)?)\s*([NSEW])?$/i);
  if (!m) return null;
  let value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  const hemisphere = m[2]?.toUpperCase();
  if (hemisphere) {
    if (kind === "lat" && hemisphere !== "N" && hemisphere !== "S") return null;
    if (kind === "lng" && hemisphere !== "E" && hemisphere !== "W") return null;
    value = hemisphere === "S" || hemisphere === "W" ? -Math.abs(value) : Math.abs(value);
  }
  return Math.abs(value) <= (kind === "lat" ? 90 : 180) ? value : null;
}

const field =
  "mt-1 w-full rounded-lg border border-white/15 bg-[#10273d] px-3 py-2.5 text-sm text-[#f9f3eb] outline-none focus:border-[#f2c36b]";

/**
 * Optional "Advanced" box for people who know their exact birth-place coordinates.
 * Coordinates are personal data: they are saved with the profile (rounded to ~1 km on the
 * server), are NOT sent to the AI, and can be removed from Profile at any time.
 */
export default function AdvancedPlaceInput({ onUse }: { onUse: (place: AdvancedPlace) => void }) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState("");

  // Pasting "21.6012, 85.5521" (as copied from Google Maps) into the first box fills both.
  const onLatChange = (value: string) => {
    const parts = value.split(",");
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      setLat(parts[0].trim());
      setLng(parts[1].trim());
    } else {
      setLat(value);
    }
    setError("");
  };

  const apply = () => {
    const label = name.trim();
    const latitude = parseCoordinate(lat, "lat");
    const longitude = parseCoordinate(lng, "lng");
    if (label.length < 2) {
      setError("Enter the place name (e.g. village or town) - it is shown on your profile.");
    } else if (latitude === null) {
      setError("Latitude must be a number between -90 and 90, e.g. 21.60 or 21.60 N.");
    } else if (longitude === null) {
      setError("Longitude must be a number between -180 and 180, e.g. 85.55 or 85.55 E.");
    } else {
      setError("");
      // tz is left empty on purpose: the server works it out from the coordinates.
      onUse({ label, lat: latitude, lng: longitude, tz: "" });
    }
  };

  const onEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault(); // this box can sit inside a form
      apply();
    }
  };

  return (
    <details className="mt-4 rounded-xl border border-[#f2c36b]/20 bg-[#10273d]/60 p-3 text-sm text-[#d5d9e2]">
      <summary className="cursor-pointer text-xs font-semibold text-[#f2c36b]">
        Advanced: enter exact coordinates
      </summary>
      <p className="mt-2 text-[11px] leading-4 text-[#a6bddb]">
        Optional. Use this only if search picks the wrong place or you know your exact birth-place
        coordinates (in Google Maps, long-press the spot and copy the two numbers). A wrong place can
        shift your Lagna and houses; your Moon sign and nakshatra do not depend on it.
      </p>
      <label className="mt-3 block text-xs font-medium text-[#f9e6b2]">
        Place name
        <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} onKeyDown={onEnter}
          placeholder="e.g. Panibandha, Odisha" className={field} />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-[#f9e6b2]">
          Latitude
          <input value={lat} onChange={(e) => onLatChange(e.target.value)} onKeyDown={onEnter}
            inputMode="decimal" placeholder="21.60" className={field} />
        </label>
        <label className="block text-xs font-medium text-[#f9e6b2]">
          Longitude
          <input value={lng} onChange={(e) => { setLng(e.target.value); setError(""); }} onKeyDown={onEnter}
            inputMode="decimal" placeholder="85.55" className={field} />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-[#ffd1c9]">{error}</p>}
      <button type="button" onClick={apply}
        className="mt-3 w-full rounded-lg border border-[#f2c36b]/40 py-2.5 text-xs font-semibold text-[#f2c36b] hover:bg-[#f2c36b]/10">
        Use these coordinates
      </button>
      <p className="mt-2 text-[11px] leading-4 text-[#858e9d]">
        Saved with your profile, rounded to about 1 km, never sent to the AI. You can remove them anytime
        from Profile.
      </p>
    </details>
  );
}