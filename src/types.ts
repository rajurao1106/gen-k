export type ChartPlanet = {
  code: string;
  name: string;
  rashi: string;
  rashiHi: string;
  degree: number;
  house: number;
  nakshatra: string;
  pada: number;
  retrograde?: boolean;
};

export type ChartPlaceInfo = {
  lat: number;
  lon: number;
  timeZone: string;
  label?: string;
  /** "low" = the place name was ambiguous: ask the user to confirm (see alternatives). */
  confidence?: "high" | "medium" | "low";
  source?: "request" | "saved-profile" | "geocoded";
  alternatives?: { lat: number; lon: number; timeZone: string | null; label: string }[];
};

export type ChartBoundaryAlert = {
  body: string;
  rashi: string;
  minutes: number;
  changesTo: string;
  ifBirthTime: "earlier" | "later";
};

export type ChartData = {
  lagna?: string;
  lagnaHi?: string;
  lagnaDegree?: number;
  ayanamsa?: string;
  moonSign?: string;
  moonSignHi?: string;
  moonNakshatra?: string;
  moonNakshatraPada?: number;
  sunSign?: string;
  nodeType?: "mean" | "true";
  boundaryAlerts?: ChartBoundaryAlert[];
  place?: ChartPlaceInfo;
  houses: Record<string, string[]>;
  planets?: ChartPlanet[];
  /** Plain-text chart facts that are given to the AI so it never guesses. */
  summary?: string;
};

export type KundaliRecord = {
  _id?: string;
  name: string;
  dob: string;
  bot: string;
  bop: string;
  gender: string;
  content: string;
  chart?: ChartData | null;
};

export type KundaliProfile = Pick<
  KundaliRecord,
  "name" | "dob" | "bot" | "bop" | "gender"
> & { recordId?: string };

export type PageKey =
  | "home"
  | "kundali"
  | "ai-friend"
  | "milan"
  | "numerology"
  | "mahadasha"
  | "explore"
  | "profile"
  | "plans";

/** Pages that live under the "Explore" hub (shown as one nav item). */
export const EXPLORE_PAGES: PageKey[] = ["milan", "mahadasha", "numerology"];

export type FieldKey = "name" | "dob" | "bot" | "bop" | "gender";

export const BIRTH_FIELDS: {
  key: FieldKey;
  label: string;
  placeholder: string;
  type: string;
}[] = [
  { key: "name", label: "Full name", placeholder: "e.g. Ananya Sharma", type: "text" },
  { key: "dob", label: "Date of birth", placeholder: "DD/MM/YYYY", type: "date" },
  { key: "bot", label: "Time of birth", placeholder: "e.g. 06:45 AM", type: "time" },
  { key: "bop", label: "Place of birth", placeholder: "City, State, Country", type: "text" },
];