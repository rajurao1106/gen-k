export type NavIconName =
  | "grid"
  | "calendar"
  | "flag"
  | "user"
  | "diamond"
  | "heart"
  | "book"
  | "clock"
  | "hash"
  | "timeline";

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
    default:
      return null;
  }
}
