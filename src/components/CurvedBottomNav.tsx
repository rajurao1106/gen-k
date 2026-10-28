"use client";

/**
 * CurvedBottomNav — mobile-only "animated notch" bottom bar.
 *
 * - Active tab ke upar gold bubble float karta hai, bar mein uske neeche
 *   gol notch (curve) kat-ta hai.
 * - Tab badalne par bubble + notch dono smoothly slide karte hain.
 * - Same props as purana BottomNav, to App.tsx mein sirf import badalna hai.
 * - Milan / Mahadasha / Numerology "Explore" page ke andar khulte hain,
 *   isliye un pages par notch "Explore" tab par rehta hai.
 *
 * Place at: src/components/CurvedBottomNav.tsx
 */

import { EXPLORE_PAGES, type PageKey } from "../types";
import { NavIcon, type NavIconName } from "./NavIcon";

type Slot = { key: PageKey; label: string; icon: NavIconName };

const SLOTS: Slot[] = [
  { key: "explore", label: "Explore", icon: "explore" },
  { key: "kundali", label: "Kundli", icon: "kundli" },
  { key: "home", label: "Home", icon: "home" },
  { key: "ai-friend", label: "AI Friend", icon: "friend" },
  { key: "profile", label: "Profile", icon: "user" },
];

// ---- design tokens (App.tsx ke navy + gold palette se match) ----
const BAR_BG = "#0d2138";
const GOLD_SOFT = "#f9e6b2";
const IDLE = "#cbd9ee";

const COUNT = SLOTS.length;
const SLOT_PCT = 100 / COUNT;
const BAR_H = 64; // bar ki height (safe-area alag se judti hai)
const NOTCH_W = 72; // notch SVG ki width
const BUBBLE = 44; // floating circle ka diameter
const BUBBLE_TOP = -16; // bubble kitna bar ke upar nikla hai

// Notch ka outline: smooth shoulders + semicircle (radius 27).
const NOTCH_EDGE =
  "M0 0 H2 C6 0 8 2 9 6 A27 27 0 0 0 63 6 C64 2 66 0 70 0 H72";

const CSS = `
.cnav { --cnav-dur: 520ms; --cnav-ease: cubic-bezier(0.22, 1, 0.36, 1); }
.cnav-piece {
  background: ${BAR_BG};
  border-top: 1px solid rgba(242,195,107,0.28);
  transition: left var(--cnav-dur) var(--cnav-ease), right var(--cnav-dur) var(--cnav-ease);
}
.cnav-notch { transition: left var(--cnav-dur) var(--cnav-ease); }
.cnav-bubble {
  transition: left var(--cnav-dur) var(--cnav-ease);
  background: linear-gradient(145deg, #f8e6b6 0%, #f2c36b 55%, #d69b3c 100%);
  box-shadow: 0 8px 18px rgba(242,195,107,0.35), inset 0 1px 0 rgba(255,255,255,0.55);
}
.cnav-pop { animation: cnav-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes cnav-pop {
  from { transform: scale(0.4) rotate(-90deg); opacity: 0; }
  to   { transform: scale(1) rotate(0); opacity: 1; }
}
.cnav-icon  { transition: transform 320ms var(--cnav-ease), opacity 220ms ease; }
.cnav-label { transition: color 250ms ease, transform 320ms var(--cnav-ease); }
@media (prefers-reduced-motion: reduce) {
  .cnav-piece, .cnav-notch, .cnav-bubble, .cnav-icon, .cnav-label { transition: none; }
  .cnav-pop { animation: none; }
}
`;

export function CurvedBottomNav({
  activePage,
  onNavigate,
  onOpenProfile,
}: {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  onOpenProfile: () => void;
}) {
  // Milan / Mahadasha / Numerology open from the Explore hub, so Explore stays active on them.
  const navKey: PageKey = EXPLORE_PAGES.includes(activePage) ? "explore" : activePage;
  const found = SLOTS.findIndex((s) => s.key === navKey);
  const activeIndex = found === -1 ? COUNT - 1 : found; // bottom bar mein nahi => Profile
  const centerPct = activeIndex * SLOT_PCT + SLOT_PCT / 2;
  const half = NOTCH_W / 2;

  return (
    <nav
      aria-label="Primary"
      className="cnav fixed inset-x-0 bottom-0 z-30 no-print lg:hidden"
    >
      <style>{CSS}</style>

      <div className="relative" style={{ height: BAR_H }}>
        {/* ---------- bar background: left piece + notch + right piece ---------- */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ filter: "drop-shadow(0 -6px 14px rgba(0,0,0,0.45))" }}
        >
          <div
            className="cnav-piece absolute inset-y-0 left-0"
            style={{ right: `calc(100% - ${centerPct}% + ${half}px)` }}
          />
          <svg
            className="cnav-notch absolute top-0"
            width={NOTCH_W}
            height={BAR_H}
            viewBox={`0 0 ${NOTCH_W} ${BAR_H}`}
            style={{ left: `calc(${centerPct}% - ${half}px)`, overflow: "visible" }}
          >
            <path d={`${NOTCH_EDGE} V${BAR_H} H0 Z`} fill={BAR_BG} />
            <path
              d={NOTCH_EDGE}
              fill="none"
              stroke="rgba(242,195,107,0.28)"
              strokeWidth={1}
              transform="translate(0 0.5)"
            />
          </svg>
          <div
            className="cnav-piece absolute inset-y-0 right-0"
            style={{ left: `calc(${centerPct}% + ${half}px)` }}
          />
        </div>

        {/* ---------- floating active bubble ---------- */}
        <span
          aria-hidden="true"
          className="cnav-bubble pointer-events-none absolute z-10 grid place-items-center rounded-full text-[#0b1324]"
          style={{
            left: `${centerPct}%`,
            top: BUBBLE_TOP,
            width: BUBBLE,
            height: BUBBLE,
            marginLeft: -BUBBLE / 2,
          }}
        >
          {/* key badalne se pop animation dobara chalta hai */}
          <span key={activeIndex} className="cnav-pop grid place-items-center">
            <NavIcon name={SLOTS[activeIndex].icon} />
          </span>
        </span>

        {/* ---------- tap targets ---------- */}
        <ul className="relative z-20 flex h-full">
          {SLOTS.map((slot, i) => {
            const active = i === activeIndex;
            const isProfile = slot.key === "profile";
            return (
              <li key={slot.key} className="flex-1">
                <button
                  type="button"
                  onClick={() => (isProfile ? onOpenProfile() : onNavigate(slot.key as PageKey))}
                  aria-current={!isProfile && active ? "page" : undefined}
                  className="flex h-full w-full flex-col items-center justify-end gap-1 pb-2 outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <span
                    className="cnav-icon"
                    style={{
                      color: IDLE,
                      opacity: active ? 0 : 1,
                      transform: active ? "translateY(-10px) scale(0.5)" : "none",
                    }}
                  >
                    <NavIcon name={slot.icon} />
                  </span>
                  <span
                    className="cnav-label text-[11px] font-medium leading-none"
                    style={{ color: active ? GOLD_SOFT : IDLE }}
                  >
                    {slot.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* iPhone home-indicator area bhi bar ke colour mein */}
      <div aria-hidden="true" style={{ height: "env(safe-area-inset-bottom)", background: BAR_BG }} />
    </nav>
  );
}

export default CurvedBottomNav;