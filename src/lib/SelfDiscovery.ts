// ---------------------------------------------------------------------------
// Self Discovery (Swa-Bodh): prompt + parsing helpers.
// The AI only INTERPRETS chart facts that were calculated on the server
// (see chartFacts.ts). It never calculates Rashi / Nakshatra / Dasha itself.
// ---------------------------------------------------------------------------

import { chartFactsBlock } from "./chartFacts";
import type { ChartData } from "../types";

export type SectionKey = "swabhav" | "mann" | "soch" | "rishte" | "kaam" | "daur";

export type DiscoverySection = {
  key: SectionKey;
  title: string;
  basedOn: string;
  insight: string;
  strengths: string[];
  challenges: string[];
  habits: string[];
  questions: string[];
};

export type DiscoveryResult = {
  intro: string;
  sections: DiscoverySection[];
  closing: string;
};

export const SECTION_META: Record<SectionKey, { title: string; focus: string }> = {
  swabhav: {
    title: "Mera Swabhav",
    focus: "Lagna and Lagna lord: first impression, core nature, how the person meets the world.",
  },
  mann: {
    title: "Mera Mann",
    focus: "Moon sign and nakshatra: emotional needs, what feels safe, how stress shows up.",
  },
  soch: {
    title: "Meri Soch aur Baat-cheet",
    focus: "Mercury: how the person learns, decides and expresses themselves.",
  },
  rishte: {
    title: "Rishte aur Pyaar",
    focus: "Venus and the 7th house: how the person loves, what they need, recurring relationship patterns.",
  },
  kaam: {
    title: "Kaam aur Purpose",
    focus: "10th house, Sun and Saturn: work style, discipline, what gives a sense of purpose.",
  },
  daur: {
    title: "Abhi ka Daur",
    focus: "Current Mahadasha / Antardasha: what this phase of life is asking the person to focus on.",
  },
};

export const DISCLAIMER_HI =
  "Ye reflection ka ek zariya hai, koi pakki bhavishyavani nahi. Ye professional psychologist, doctor ya counsellor ki salah ki jagah nahi leta.";

export const MAX_ANSWER_CHARS = 1500;
const SECTION_KEYS = Object.keys(SECTION_META) as SectionKey[];

export function buildSelfDiscoveryPrompt(args: {
  name: string;
  gender: string;
  chart: ChartData | null;
  dashaFacts: string;
}): string {
  const { name, gender, chart, dashaFacts } = args;
  const sectionList = SECTION_KEYS.map(
    (key) => `- "${key}" (${SECTION_META[key].title}): ${SECTION_META[key].focus}`,
  ).join("\n");

  return `You are a warm, grounded Vedic-astrology guide helping a person understand THEMSELVES better.
Write in simple Hinglish (Hindi in Roman script), friendly and respectful, addressing the person as "aap".

PERSON: ${name || "User"}${gender ? `, ${gender}` : ""}
${chartFactsBlock(chart)}
${dashaFacts ? `\nDASHA FACTS (final, calculated):\n${dashaFacts}\n` : ""}
TASK: Give a self-understanding reflection with exactly these sections, in this order:
${sectionList}

RULES:
- Treat the chart as a mirror for self-reflection, not as fate. Use language like "tendency", "aksar", "ho sakta hai".
- Use ONLY the chart facts above. Never recalculate or contradict a Lagna, Rashi, Nakshatra, planet or Dasha.
- If a placement needed for a section is missing, say so in that section instead of guessing.
- Do NOT predict death, illness, accidents, divorce, financial ruin or any fear-based outcome. No dosha scare, no remedies that cost money.
- Do NOT diagnose any mental-health condition and do not give medical, legal or financial advice.
- Be honest and balanced: every section needs real strengths AND real challenges, framed kindly and constructively.
- Habits must be small, practical, free and doable this week.
- Questions must be open reflection questions the person can answer about their own life.

Return ONLY valid JSON, no markdown, in exactly this shape:
{
  "intro": "2-3 warm sentences",
  "sections": [
    {
      "key": "swabhav",
      "basedOn": "the exact chart placements used, e.g. 'Simha lagna, Surya house 1'",
      "insight": "3-5 sentences",
      "strengths": ["2-3 short points"],
      "challenges": ["2-3 short points"],
      "habits": ["2-3 short practical habits"],
      "questions": ["2-3 reflection questions"]
    }
  ],
  "closing": "1-2 encouraging sentences reminding the person that they decide their path"
}`;
}

const asStrings = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim())
        .slice(0, max)
    : [];

const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function normalizeDiscovery(raw: unknown): DiscoveryResult | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.sections)) return null;

  const byKey = new Map<SectionKey, DiscoverySection>();
  for (const item of data.sections) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const key = s.key as SectionKey;
    if (!SECTION_KEYS.includes(key) || byKey.has(key)) continue;
    const insight = asText(s.insight);
    if (!insight) continue;
    byKey.set(key, {
      key,
      title: SECTION_META[key].title,
      basedOn: asText(s.basedOn),
      insight,
      strengths: asStrings(s.strengths, 3),
      challenges: asStrings(s.challenges, 3),
      habits: asStrings(s.habits, 3),
      questions: asStrings(s.questions, 3),
    });
  }
  if (byKey.size === 0) return null;

  return {
    intro: asText(data.intro),
    sections: SECTION_KEYS.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!),
    closing: asText(data.closing),
  };
}

// ----------------------------------------------------- private journal ----
// Journal answers stay on this device (localStorage). Nothing is sent to the
// server unless you later add an API for it.

export type JournalEntries = Record<string, { answer: string; updatedAt: string }>;

const journalKey = (profileId: string) => `genk_selfdiscovery_journal_${profileId}`;

export function loadJournal(profileId: string): JournalEntries {
  try {
    const raw = localStorage.getItem(journalKey(profileId));
    return raw ? (JSON.parse(raw) as JournalEntries) : {};
  } catch {
    return {};
  }
}

export function saveJournalAnswer(profileId: string, question: string, answer: string): JournalEntries {
  const entries = loadJournal(profileId);
  if (answer.trim()) {
    entries[question] = { answer: answer.slice(0, MAX_ANSWER_CHARS), updatedAt: new Date().toISOString() };
  } else {
    delete entries[question];
  }
  try {
    localStorage.setItem(journalKey(profileId), JSON.stringify(entries));
  } catch {
    // storage full or blocked: keep working in memory
  }
  return entries;
}

/** One question per day, stable for the whole day, picked from the user's own result. */
export function questionOfTheDay(result: DiscoveryResult | null, date = new Date()): string | null {
  const all = result?.sections.flatMap((s) => s.questions) ?? [];
  if (all.length === 0) return null;
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  return all[dayNumber % all.length];
}