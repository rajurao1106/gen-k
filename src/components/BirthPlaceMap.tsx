"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from "leaflet";

type Point = { lat: number; lng: number };

type Props = {
  /** Current pin (e.g. from the typed fields). null = no pin yet. */
  lat: number | null;
  lng: number | null;
  /** Where to open the map when there is no pin (e.g. the first search result). */
  center?: Point;
  /** Called when the user taps the map or finishes dragging the pin. */
  onPick: (lat: number, lng: number) => void;
};

const PIN_HTML =
  '<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 1C6.7 1 1 6.9 1 13.8 1 23.6 14 35 14 35s13-11.4 13-21.2C27 6.9 21.3 1 14 1z" fill="#f2c36b" stroke="#17130c" stroke-width="1.5"/><circle cx="14" cy="14" r="4.5" fill="#17130c"/></svg>';

const INDIA: Point = { lat: 22.5, lng: 82.5 };

export default function BirthPlaceMap({ lat, lng, center, onPick }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const placePinRef = useRef<((point: Point) => void) | null>(null);
  const onPickRef = useRef(onPick);
  const centerLat = center?.lat;
  const centerLng = center?.lng;

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    const pin: Point | null = lat !== null && lng !== null ? { lat, lng } : null;

    void import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !elRef.current || mapRef.current) return;

      const start = pin ?? center ?? INDIA;
      const zoom = pin ? 12 : center ? 9 : 4;
      const map = L.map(elRef.current, {
        center: [start.lat, start.lng],
        zoom,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: PIN_HTML,
        iconSize: [28, 36],
        iconAnchor: [14, 35],
      });

      const placePin = (point: Point) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([point.lat, point.lng]);
          return;
        }

        const marker = L.marker([point.lat, point.lng], {
          icon,
          draggable: true,
          keyboard: false,
        }).addTo(map);
        marker.on("dragend", () => {
          const location = marker.getLatLng().wrap();
          onPickRef.current(location.lat, location.lng);
        });
        markerRef.current = marker;
      };

      map.on("click", (event: LeafletMouseEvent) => {
        const location = event.latlng.wrap();
        placePin({ lat: location.lat, lng: location.lng });
        onPickRef.current(location.lat, location.lng);
      });

      if (pin) placePin(pin);
      mapRef.current = map;
      placePinRef.current = placePin;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      placePinRef.current = null;
    };
    // The map is created once; coordinate changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const placePin = placePinRef.current;
    if (!map || !placePin || lat === null || lng === null) return;

    const current = markerRef.current?.getLatLng();
    if (
      current &&
      Math.abs(current.lat - lat) < 1e-6 &&
      Math.abs(current.lng - lng) < 1e-6
    ) {
      return;
    }

    placePin({ lat, lng });
    if (!map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), 10));
    }
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || centerLat === undefined || centerLng === undefined || (lat !== null && lng !== null)) return;
    map.setView([centerLat, centerLng], Math.max(map.getZoom(), 9));
  }, [centerLat, centerLng, lat, lng]);

  return (
    <div
      ref={elRef}
      role="application"
      aria-label="Map: tap or drag the pin to choose your birth place"
      className="isolate z-0 mt-3 h-56 w-full overflow-hidden rounded-lg border border-white/15 bg-[#10273d]"
    />
  );
}
