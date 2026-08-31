import type { PageKey } from "../types";
import { NavIcon, type NavIconName } from "./NavIcon";

type MenuItem = {
  key: PageKey | "stub";
  label: string;
  icon: NavIconName;
  page?: PageKey;
};

// Full menu list, mirroring the reference app's hamburger drawer. Items
// without a `page` are presentational stubs (kept for the familiar layout);
// wire them up to real pages as the app grows.
const MENU_ITEMS: MenuItem[] = [
  // { key: "stub", label: "मासिक", icon: "grid" },
  // { key: "stub", label: "पंचांग", icon: "calendar" },
  // { key: "stub", label: "त्यौहार", icon: "flag" },
  // { key: "stub", label: "मेरी तिथि", icon: "user" },
  { key: "kundali", label: "कुंडली", icon: "diamond", page: "kundali" },
  { key: "milan", label: "कुंडली मिलान", icon: "heart", page: "milan" },
  { key: "numerology", label: "न्यूमरोलॉजी", icon: "hash", page: "numerology" },
  { key: "mahadasha", label: "महादशा", icon: "timeline", page: "mahadasha" },
  // { key: "stub", label: "ज्योतिष", icon: "book" },
  // { key: "stub", label: "हिन्दू समय", icon: "clock" },
];

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
  return (
    <>
      {/* Dim overlay — mobile-only; desktop keeps the sidebar permanently
          visible so there's nothing to dim behind */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 no-print lg:hidden ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile: fixed slide-in drawer, toggled by the hamburger button.
          Desktop (lg+): a permanent in-flow sidebar column, always visible. */}
      <aside
        className={`fixed lg:static top-0 left-0 z-50 h-full lg:h-screen lg:sticky 5xl:sticky lg:top-0 lg:self-start w-72 max-w-[85vw] lg:max-w-none lg:w-64 lg:shrink-0 brass-header border-r border-[#f2c36b]/25 shadow-[0_18px_40px_rgba(0,0,0,0.45)] lg:shadow-none transition-transform duration-300 ease-out no-print lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#f2c36b]/20">
          <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#f2c36b] shadow-[0_0_16px_rgba(242,195,107,0.35)] flex items-center justify-center text-[#0b1324] font-display font-bold text-lg shrink-0">
            <img src="/public/logo.png" alt="" />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-[#f9f3eb]">
              Gen-K
            </p>
            <p className="text-[10px] text-[#cbd9ee]">
              हिन्दू पंचांग &amp; ज्योतिष
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-[#cbd9ee] hover:text-[#f2c36b] hover:bg-[#f2c36b]/10 transition-colors lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="py-2 overflow-y-auto h-[calc(100%-76px)]">
          {MENU_ITEMS.map((item, i) => {
            const isActive = item.page && item.page === activePage;
            const isStub = !item.page;
            return (
              <button
                key={`${item.label}-${i}`}
                type="button"
                disabled={isStub}
                onClick={() => {
                  if (item.page) {
                    onNavigate(item.page);
                    onClose();
                  }
                }}
                className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors border-l-4 ${
                  isActive
                    ? "border-[#f2c36b] bg-[#f2c36b]/12 text-[#f9e6b2] shadow-[inset_0_0_0_1px_rgba(242,195,107,0.12)]"
                    : isStub
                      ? "border-transparent text-[#a7b9d6] cursor-default"
                      : "border-transparent text-[#edf2fb] hover:bg-[#f2c36b]/8 hover:text-[#f9e6b2]"
                }`}
              >
                <NavIcon name={item.icon} />
                <span className="text-sm font-medium">{item.label}</span>
                {isStub && (
                  <span className="ml-auto text-[9px] uppercase tracking-wide text-[#5c4530]">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
