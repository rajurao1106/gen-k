export type NavIconName =
  | "grid"
  | "calendar"
  | "flag"
  | "user"
  | "sparkles"
  | "diamond"
  | "heart"
  | "book"
  | "clock"
  | "hash"
  | "timeline"
  | "friend"
  | "search"
  | "panel"
  | "bolt"
  | "home"
  | "kundli"
  | "rings"
  | "numbers"
  | "orbit";

export function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "flag":
      return (
        <svg {...common}>
          <path d="M5 3v18M5 4h11l-2 4 2 4H5" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.6-4 5-6 8-6s6.4 2 8 6" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" />
          <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M3 9l9-6 9 6-9 12-9-12z" />
          <path d="M3 9h18" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-7.5-4.7-9.6-9.1C1 7.6 2.6 4.5 5.8 4c2-.3 3.7.7 4.9 2.2C11.8 4.7 13.6 3.7 15.6 4c3.2.5 4.8 3.6 3.4 6.9C16.9 15.3 12 20 12 20z" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5v-18z" />
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "hash":
      return (
        <svg {...common}>
          <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
        </svg>
      );
    case "timeline":
      return (
        <svg {...common}>
          <path d="M3 12h4l3-7 4 14 3-7h4" />
        </svg>
      );
    case "friend":
      // two people = a friend / companion (replaces the generic "AI sparkles")
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
          <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
          <path d="M18 14.9c1.9.7 3.1 2.4 3.5 5.1" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "panel":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M9 4v16" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common} fill="currentColor" strokeWidth={1.2}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v10h13V10" />
          <path d="M10 20v-5.5h4V20" />
        </svg>
      );
    case "kundli":
      // North-Indian birth chart: square + diamond + corner lines
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 3l9 9-9 9-9-9 9-9z" />
          <path d="M3 3l4.5 4.5M21 3l-4.5 4.5M3 21l4.5-4.5M21 21l-4.5-4.5" />
        </svg>
      );
    case "rings":
      return (
        <svg {...common}>
          <circle cx="8.5" cy="12" r="5.5" />
          <circle cx="15.5" cy="12" r="5.5" />
        </svg>
      );
    case "numbers":
      return (
        <svg {...common}>
          <path d="M3.5 9.5 5.5 8v9" />
          <path d="M9.5 9.2a2.2 2.2 0 1 1 3.8 1.5L9.5 17h4" />
          <path d="M16.5 8h4l-2.4 3.2a2.3 2.3 0 1 1-1.9 3.7" />
        </svg>
      );
    case "orbit":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-30 12 12)" />
          <circle cx="12" cy="12" r="2.6" />
          <circle cx="5.2" cy="16" r="1" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}