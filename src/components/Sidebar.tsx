"use client";

import { useEffect, useRef, useState } from "react";
import type { PageKey } from "../types";
import { getUserKundaliProfile } from "../lib/storage";
import { NavIcon, type NavIconName } from "./NavIcon";

type MenuItem = {
  key: PageKey;
  label: string;
  icon: NavIconName;
};

const MENU_ITEMS: MenuItem[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "kundali", label: "Kundli", icon: "kundli" },
  { key: "ai-friend", label: "AI Friend", icon: "friend" },
  { key: "milan", label: "Kundli Milan", icon: "rings" },
  { key: "numerology", label: "Numerology", icon: "numbers" },
  { key: "mahadasha", label: "Mahadasha", icon: "orbit" },
];

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
const ACCENT = "#f2c36b";

export function Sidebar({
  open,
  onClose,
  activePage,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}) {
  // `collapsed` only affects desktop (lg+). On mobile the drawer is always full.
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [userName, setUserName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
    try {
      setUserName(getUserKundaliProfile()?.name ?? "");
    } catch {
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

  const q = query.trim().toLowerCase();
  const items = q
    ? MENU_ITEMS.filter((i) => i.label.toLowerCase().includes(q))
    : MENU_ITEMS;

  // Class helpers: "c" variants apply only on desktop when collapsed.
  const hideWhenCollapsed = collapsed ? "lg:hidden" : "";
  const centerWhenCollapsed = collapsed ? "lg:justify-center lg:px-0" : "";

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
        } lg:shrink-0 p-0 transition-[transform,width] duration-300 ease-out no-print lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
      >
        <div
          className={`flex h-full flex-col overflow-hidden  border border-[#f2c36b]/25 brass-header shadow-[0_18px_40px_rgba(0,0,0,0.45)] ${INK}`}
        >
          {/* ---- header ---- */}
          <div className={`flex items-center gap-3 border-b ${LINE} px-4 py-4 ${centerWhenCollapsed}`}>
            <button
              type="button"
              onClick={() => collapsed && toggle(false)}
              aria-label={collapsed ? "Expand sidebar" : "Gen-K"}
              className={`h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[#f2c36b] ${collapsed ? "lg:cursor-e-resize" : "cursor-default"}`}
            >
              <img src="/logo.png" alt="" className="h-full w-full object-contain" />
            </button>
            <span className={`text-lg font-semibold tracking-tight ${hideWhenCollapsed}`}>Gen-K</span>
            <button
              type="button"
              onClick={() => toggle(true)}
              aria-label="Collapse sidebar"
              className={`ml-auto hidden h-8 w-8 items-center justify-center rounded-lg ${DIM} hover:bg-[#f2c36b]/10 hover:text-[#f9e6b2] ${
                collapsed ? "" : "lg:flex"
              }`}
            >
              <NavIcon name="panel" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className={`ml-auto flex h-8 w-8 items-center justify-center rounded-lg ${DIM} hover:bg-[#f2c36b]/10 lg:hidden`}
            >
              ✕
            </button>
          </div>

          {/* ---- search ---- */}
          {/* <div className={`border-b ${LINE} px-3 py-3`}>
            {collapsed && (
              <button
                type="button"
                aria-label="Search menu"
                onClick={() => {
                  toggle(false);
                  setTimeout(() => searchRef.current?.focus(), 320);
                }}
                className={`hidden h-10 w-full items-center justify-center rounded-xl ${DIM} hover:bg-[#f2c36b]/10 lg:flex`}
              >
                <NavIcon name="search" />
              </button>
            )}
            <label
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${DIM} focus-within:bg-[#f2c36b]/10 focus-within:shadow-[0_0_0_1px_rgba(242,195,107,0.3)] ${hideWhenCollapsed}`}
            >
              <NavIcon name="search" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Quick search"
                aria-label="Search menu"
                className="w-full bg-transparent text-[15px] text-[#edf2fb] outline-none placeholder:text-[#cbd9ee]/80"
              />
            </label>
          </div> */}

          {/* ---- menu ---- */}
          <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Pages">
            <p className={`px-3 pb-2 pt-1 text-[15px] ${DIM} ${hideWhenCollapsed}`}>Menu</p>
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const active = item.key === activePage;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => go(item.key)}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-center gap-3.5 rounded-xl border px-3 py-3 text-left text-[15px] transition-colors ${centerWhenCollapsed} ${
                        active
                          ? "border-[#f2c36b]/35 bg-[#f2c36b]/12 font-medium text-[#f9e6b2] shadow-[inset_0_0_0_1px_rgba(242,195,107,0.12)]"
                          : `border-transparent ${DIM} hover:bg-[#f2c36b]/8 hover:text-[#f9e6b2]`
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      <span className={hideWhenCollapsed}>{item.label}</span>
                    </button>
                  </li>
                );
              })}
              {items.length === 0 && (
                <li className={`px-3 py-2 text-sm ${DIM} ${hideWhenCollapsed}`}>No match</li>
              )}
            </ul>
          </nav>

          {/* ---- AI Friend call-to-action ---- */}
          {/* {activePage !== "ai-friend" && (
            <div className="px-3 pb-3">
              {collapsed && (
                <button
                  type="button"
                  onClick={() => go("ai-friend")}
                  aria-label="Open AI Friend"
                  title="AI Friend"
                  className="mx-auto hidden h-12 w-12 items-center justify-center rounded-full border bg-[#f2c36b]/10 lg:flex"
                  style={{ color: ACCENT, borderColor: "rgba(242,195,107,0.4)" }}
                >
                  <NavIcon name="friend" />
                </button>
              )}
              <div
                className={`rounded-xl border border-[#f2c36b]/25 bg-gradient-to-b from-[#f2c36b]/15 to-transparent p-3 ${hideWhenCollapsed}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f2c36b]/30 bg-[#f2c36b]/10"
                    style={{ color: ACCENT }}
                  >
                    <NavIcon name="friend" />
                  </span>
                  <div className="leading-tight">
                    <p className={`text-[13px] ${DIM}`}>Voice companion</p>
                    <p className="text-[15px] font-semibold">AI Friend</p>
                  </div>
                </div>
                <p className={`mt-2 text-[13px] leading-snug ${DIM}`}>
                  Add your friend&apos;s voice and talk with AI in it.
                </p>
                <button
                  type="button"
                  onClick={() => go("ai-friend")}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#f2c36b]/40 bg-[#f2c36b]/10 py-2 text-[15px] font-medium text-[#f9e6b2] hover:bg-[#f2c36b]/20"
                >
                  <span style={{ color: ACCENT }}>
                    <NavIcon name="bolt" />
                  </span>
                  Try AI Friend
                </button>
              </div>
            </div>
          )} */}

          {/* ---- profile ---- */}
          <button
            type="button"
            onClick={() => go("kundali")}
            title={userName || "Create profile"}
            className={`flex items-center gap-3 border-t ${LINE} px-4 py-3.5 text-left hover:bg-[#f2c36b]/8 ${centerWhenCollapsed}`}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-[#0b1324]"
              style={{ background: ACCENT }}
            >
              {(userName.trim()[0] || "G").toUpperCase()}
            </span>
            <span className={`min-w-0 leading-tight ${hideWhenCollapsed}`}>
              <span className="block truncate text-[15px] font-medium">{userName || "Guest"}</span>
              <span className={`block truncate text-[13px] ${DIM}`}>
                {userName ? "Kundali profile" : "Create your profile"}
              </span>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}