"use client";

import { useEffect, useState } from "react";
import { EXPLORE_PAGES, type PageKey } from "../types";
import { getUserKundaliProfile } from "../lib/storage";
import { NavIcon, type NavIconName } from "./NavIcon";
import CrittersAvatar from "./CrittersAvatar";

type MenuItem = {
  key: PageKey;
  label: string;
  icon: NavIconName;
};

const MENU_ITEMS: MenuItem[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "kundali", label: "Kundli", icon: "kundli" },
  { key: "ai-friend", label: "AI Friend", icon: "friend" },
  { key: "explore", label: "Explore", icon: "explore" },
  { key: "plans", label: "Plans & billing", icon: "sparkles" },
  { key: "profile", label: "Profile", icon: "user" },
];

// Mobile-only bottom bar: Home, Explore, Kundli, AI Friend, Menu (opens the drawer).
const BOTTOM_ITEMS: { key: PageKey; label: string; icon: NavIconName }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "explore", label: "Explore", icon: "explore" },
  { key: "kundali", label: "Kundli", icon: "kundli" },
  { key: "ai-friend", label: "AI Friend", icon: "friend" },
];

// Milan / Mahadasha / Numerology belong to the "Explore" hub, so Explore stays highlighted on them.
function isNavActive(itemKey: PageKey, activePage: PageKey) {
  return itemKey === activePage || (itemKey === "explore" && EXPLORE_PAGES.includes(activePage));
}

export function BottomNav({
  activePage,
  onNavigate,
  onOpenMenu,
}: {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  onOpenMenu: () => void;
}) {
  const base =
    "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors";
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#f2c36b]/25 brass-header px-2 pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] no-print lg:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch gap-1">
        {BOTTOM_ITEMS.map((item) => {
          const active = isNavActive(item.key, activePage);
          return (
            <li key={item.key} className="flex flex-1">
              <button
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={active ? "page" : undefined}
                className={`${base} ${
                  active
                    ? "bg-[#f2c36b]/12 text-[#f9e6b2] shadow-[inset_0_0_0_1px_rgba(242,195,107,0.3)]"
                    : "text-[#cbd9ee] active:bg-[#f2c36b]/10"
                }`}
              >
                <NavIcon name={item.icon} />
                <span className="leading-none">{item.label}</span>
              </button>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-haspopup="dialog"
            className={`${base} text-[#cbd9ee] active:bg-[#f2c36b]/10`}
          >
            <NavIcon name="menu" />
            <span className="leading-none">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

const COLLAPSE_KEY = "gen_k_sidebar_collapsed";

export function HamburgerButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      className={`h-9 w-9 rounded-lg border border-[#f2c36b]/30 flex items-center justify-center text-[#f9e6b2] hover:bg-[#f2c36b]/12 transition-colors shrink-0 ${className}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

// Original dark navy + gold palette (same as .brass-header), reference layout.
const INK = "text-[#edf2fb]";
const DIM = "text-[#cbd9ee]";
const LINE = "border-[#f2c36b]/20";

export function Sidebar({
  open,
  onClose,
  activePage,
  onNavigate,
  lightTheme = false,
}: {
  open: boolean;
  onClose: () => void;
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  lightTheme?: boolean;
}) {
  // `collapsed` only affects desktop (lg+). On mobile the drawer is always full.
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("");

  // Hydrate persisted sidebar preferences and the account's local profile name.
  useEffect(() => {
    try {
      // oxlint-disable-next-line react/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
    try {
      // oxlint-disable-next-line react/set-state-in-effect
      const profile = getUserKundaliProfile();
      setUserName(profile?.name ?? "");
      setAvatarSeed(profile?.avatarSeed ?? "");
    } catch {
      // oxlint-disable-next-line react/set-state-in-effect
      setUserName("");
    }
  }, []);

  const toggle = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const go = (page: PageKey) => {
    onNavigate(page);
    onClose();
  };

  // Class helpers: "c" variants apply only on desktop when collapsed.
  const hideWhenCollapsed = collapsed ? "lg:hidden" : "";
  const centerWhenCollapsed = collapsed ? "lg:justify-center lg:px-0" : "";
  const ink = lightTheme ? "text-[#171717]" : INK;
  const dim = lightTheme ? "text-[#625C56]" : DIM;
  const line = lightTheme ? "border-[#E8D9CC]" : LINE;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 no-print lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-full lg:h-screen lg:self-start w-80 max-w-[88vw] ${
          collapsed ? "lg:w-[92px]" : "lg:w-[290px]"
        } lg:shrink-0 transition-[transform,width] duration-300 ease-out no-print lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
      >
        <div
          className={`flex h-full flex-col overflow-hidden border ${
            lightTheme
              ? "border-[#E8D9CC] bg-white shadow-[0_18px_40px_rgba(80,54,32,0.14)]"
              : "border-[#f2c36b]/25 brass-header shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          } ${ink}`}
        >
          {/* ---- header ---- */}
          <div className={`flex items-center gap-3 border-b ${line} px-4 py-4 ${centerWhenCollapsed}`}>
            <button
              type="button"
              onClick={() => collapsed && toggle(false)}
              aria-label={collapsed ? "Expand sidebar" : "Gen-K"}
              className={`h-9 w-9 shrink-0 overflow-hidden rounded-xl ${lightTheme ? "bg-[#F8E8D8]" : "bg-[#f2c36b]"} ${collapsed ? "lg:cursor-e-resize" : "cursor-default"}`}
            >
              <img src="/logo.png" alt="" className="h-full w-full object-contain" />
            </button>
            <span className={`text-lg font-semibold tracking-tight ${hideWhenCollapsed}`}>Gen-K</span>
            <button
              type="button"
              onClick={() => toggle(true)}
              aria-label="Collapse sidebar"
              className={`ml-auto hidden h-8 w-8 items-center justify-center rounded-lg ${dim} ${
                lightTheme ? "hover:bg-[#FAF8F6] hover:text-[#A95F35]" : "hover:bg-[#f2c36b]/10 hover:text-[#f9e6b2]"
              } ${
                collapsed ? "" : "lg:flex"
              }`}
            >
              <NavIcon name="panel" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className={`ml-auto flex h-8 w-8 items-center justify-center rounded-lg ${dim} ${
                lightTheme ? "hover:bg-[#FAF8F6]" : "hover:bg-[#f2c36b]/10"
              } lg:hidden`}
            >
              ✕
            </button>
          </div>

      

          {/* ---- menu ---- */}
          <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Pages">
            <p className={`px-3 pb-2 pt-1 text-[15px] ${dim} ${hideWhenCollapsed}`}>Menu</p>
            <ul className="flex flex-col gap-1">
              {MENU_ITEMS.map((item) => {
                const active = isNavActive(item.key, activePage);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => go(item.key)}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-center gap-3.5 rounded-xl border px-3 py-3 text-left text-[15px] transition-colors ${centerWhenCollapsed} ${
                        active
                          ? lightTheme
                            ? "border-[#D9A441]/50 bg-[#F8E8D8] font-medium text-[#A95F35]"
                            : "border-[#f2c36b]/35 bg-[#f2c36b]/12 font-medium text-[#f9e6b2] shadow-[inset_0_0_0_1px_rgba(242,195,107,0.12)]"
                          : lightTheme
                            ? "border-transparent text-[#625C56] hover:bg-[#FAF8F6] hover:text-[#A95F35]"
                            : `border-transparent ${dim} hover:bg-[#f2c36b]/8 hover:text-[#f9e6b2]`
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      <span className={hideWhenCollapsed}>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

       

          {/* ---- profile ---- */}
          <button
            type="button"
            onClick={() => go("profile")}
            title={userName || "Create profile"}
            className={`flex items-center gap-3 border-t ${line} px-4 py-3.5 text-left ${
              lightTheme ? "hover:bg-[#FAF8F6]" : "hover:bg-[#f2c36b]/8"
            } ${centerWhenCollapsed}`}
          >
            <CrittersAvatar seed={avatarSeed} name={userName || "Guest"} className="h-10 w-10 text-[15px]" />
            <span className={`min-w-0 leading-tight ${hideWhenCollapsed}`}>
              <span className="block truncate text-[15px] font-medium">{userName || "Guest"}</span>
              <span className={`block truncate text-[13px] ${dim}`}>
                {userName ? "Kundali profile" : "Create your profile"}
              </span>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}