export type ChartData = {
  lagna?: string;
  ayanamsa?: string;
  houses: Record<string, string[]>;
};

export type KundaliRecord = {
  name: string;
  dob: string;
  bot: string;
  bop: string;
  gender: string;
  content: string;
  chart?: ChartData | null;
};

export type PageKey = "kundali" | "milan" | "numerology" | "mahadasha";

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
