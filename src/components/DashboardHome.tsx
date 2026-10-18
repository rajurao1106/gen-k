"use client";

/**
 * DashboardHome — dynamic daily dashboard (dark navy + gold).
 *
 * Place at: src/components/DashboardHome.tsx
 *
 * Flow:
 *  1. Onboarding mein user ki details localStorage mein save hoti hain (pehle se).
 *  2. Dashboard khulte hi: aaj ki date ka guide localStorage mein hai?
 *       - haan  -> turant dikha do
 *       - nahi  -> loader chalta hai, Gemini se aaj ka guide + upay (remedy) banta hai,
 *                  localStorage mein save hota hai, phir card dikhta hai
 *  3. Agle din date badal jaati hai -> naya guide banta hai (purana overwrite hota hai).
 *
 * Storage key: genk_daily_guide:<profileId>  ->  { date: "YYYY-MM-DD", guide: {...} }
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import { getKundaliProfileId, getUserKundaliProfile } from "../lib/storage";
import type { KundaliProfile } from "../types";
import { NavIcon, type NavIconName } from "./NavIcon";

/* ------------------------------------------------------------------ */
/* Types + constants                                                   */
/* ------------------------------------------------------------------ */

const MODEL = "gemini-3.5-flash-lite"; // server ke GEMINI_ALLOWED_MODELS mein hona chahiye
const STORAGE_PREFIX = "genk_daily_guide:";
const ONBOARDING_KEY = "genk_onboarding";

type Remedy = { title: string; steps: string[]; mantra: string };

type DailyGuide = {
  belief: string;
  power: string;
  caution: string;
  note: string;
  remedy: Remedy;
  luckyNo: number;
  color: string;
  direction: string;
  energy: number;
};

type StoredGuide = { date: string; guide: DailyGuide };
type Status = "loading" | "ready" | "error" | "empty";

type Sign = { en: string; hi: string; dev: string; glyph: string; start: number };

// start = month*100 + day (tropical sun-sign start). Order: Aries -> Pisces.
const SIGNS: Sign[] = [
  { en: "Aries", hi: "Mesh", dev: "मेष", glyph: "♈", start: 321 },
  { en: "Taurus", hi: "Vrishabh", dev: "वृषभ", glyph: "♉", start: 420 },
  { en: "Gemini", hi: "Mithun", dev: "मिथुन", glyph: "♊", start: 521 },
  { en: "Cancer", hi: "Kark", dev: "कर्क", glyph: "♋", start: 621 },
  { en: "Leo", hi: "Singh", dev: "सिंह", glyph: "♌", start: 723 },
  { en: "Virgo", hi: "Kanya", dev: "कन्या", glyph: "♍", start: 823 },
  { en: "Libra", hi: "Tula", dev: "तुला", glyph: "♎", start: 923 },
  { en: "Scorpio", hi: "Vrishchik", dev: "वृश्चिक", glyph: "♏", start: 1023 },
  { en: "Sagittarius", hi: "Dhanu", dev: "धनु", glyph: "♐", start: 1122 },
  { en: "Capricorn", hi: "Makar", dev: "मकर", glyph: "♑", start: 1222 },
  { en: "Aquarius", hi: "Kumbh", dev: "कुंभ", glyph: "♒", start: 120 },
  { en: "Pisces", hi: "Meen", dev: "मीन", glyph: "♓", start: 219 },
];

const LOADING_LINES = [
  "Aapki kundali padh rahe hain…",
  "Aaj ke graho ki chaal dekh rahe hain…",
  "Aapka aaj ka upay taiyar ho raha hai…",
];

const SHORTCUTS: { label: string; desc: string; path: string; icon: NavIconName }[] = [
  { label: "कुंडली", desc: "Birth chart & guidance", path: "/kundali", icon: "kundli" },
  { label: "कुंडली मिलान", desc: "Guna matching", path: "/milan", icon: "rings" },
  { label: "न्यूमरोलॉजी", desc: "Name & number insights", path: "/numerology", icon: "numbers" },
  { label: "महादशा", desc: "Life phases timeline", path: "/mahadasha", icon: "orbit" },
  { label: "AI Friend", desc: "Ask about your chart", path: "/ai-friend", icon: "friend" },
];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

// Local date (user ke timezone ka) — "aaj" isi se tay hota hai.
function localDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function greeting(hour: number) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function signFromDob(dob: string): Sign {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return SIGNS[0];
  const key = Number(m[2]) * 100 + Number(m[3]);
  const sorted = [...SIGNS].sort((a, b) => a.start - b.start);
  let found: Sign | null = null;
  for (const s of sorted) if (s.start <= key) found = s;
  return found ?? SIGNS[9]; // 1 Jan - 19 Jan => Capricorn
}

/* ---------- Chandra rashi + nakshatra (Vedic, Lahiri ayanamsa) ---------- */

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
  "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
  "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
  "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
  "Uttara Bhadrapada", "Revati",
];

type MoonInfo = {
  sign: Sign;
  nakshatra: string;
  pada: number;
  approx: boolean; // janm samay pata nahi => rashi galat ho sakti hai
};

const rad = (d: number) => (d * Math.PI) / 180;
const norm360 = (d: number) => ((d % 360) + 360) % 360;

// IANA timezone ka UTC offset (ms) us moment par
function tzOffsetMs(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const p: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

// Janm ka local samay (us jagah ka) -> UTC. Timezone na mile to India (+5:30).
function birthToUtcMs(dob: string, bot: string, tz?: string) {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  const t = /^(\d{1,2}):(\d{2})/.exec(bot);
  if (!d || !t) return null;
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  if (tz) {
    try {
      const first = guess - tzOffsetMs(guess, tz);
      return guess - tzOffsetMs(first, tz); // DST edge ke liye dobara
    } catch {
      /* invalid timezone => India fallback */
    }
  }
  return guess - 330 * 60_000;
}

// Moon ki tropical longitude (Astronomical Almanac low-precision, ~0.3 degree)
function moonSiderealLongitude(utcMs: number) {
  const jd = utcMs / 86_400_000 + 2_440_587.5;
  const T = (jd - 2_451_545.0) / 36_525;
  const s = (a: number, b: number) => Math.sin(rad(a + b * T));
  const tropical =
    218.32 +
    481_267.881 * T +
    6.29 * s(135.0, 477_198.87) -
    1.27 * s(259.3, -413_335.36) +
    0.66 * s(235.7, 890_534.22) +
    0.21 * s(269.9, 954_397.74) -
    0.19 * s(357.5, 35_999.05) -
    0.11 * s(186.5, 966_404.03);
  const lahiri = 23.853 + (0.013969 * (jd - 2_451_545.0)) / 365.25; // ayanamsa
  return norm360(tropical - lahiri);
}

function computeMoon(profile: KundaliProfile): MoonInfo | null {
  const ob = readOnboarding();
  const utc = birthToUtcMs(profile.dob, profile.bot, ob.timezone);
  if (utc === null) return null;
  const lon = moonSiderealLongitude(utc);
  const span = 360 / 27;
  return {
    sign: SIGNS[Math.floor(lon / 30)],
    nakshatra: NAKSHATRAS[Math.floor(lon / span)],
    pada: Math.floor((lon % span) / (span / 4)) + 1,
    approx: ob.timeUnknown === true,
  };
}

function resolveMoon(profile: KundaliProfile): MoonInfo {
  return (
    computeMoon(profile) ?? {
      sign: signFromDob(profile.dob), // fallback: sun sign
      nakshatra: "",
      pada: 0,
      approx: true,
    }
  );
}

function reduceDigit(n: number) {
  while (n > 9) n = String(n).split("").reduce((a, d) => a + Number(d), 0);
  return n || 9;
}

function readOnboarding(): { status?: string; timezone?: string; timeUnknown?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(ONBOARDING_KEY) || "{}") ?? {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Storage (daily cache)                                               */
/* ------------------------------------------------------------------ */

const storageKey = (p: KundaliProfile) =>
  `${STORAGE_PREFIX}${encodeURIComponent(getKundaliProfileId(p))}`;

function str(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// AI ka JSON validate + clean. Galat shape => null.
function normalize(raw: unknown, profile: KundaliProfile): DailyGuide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const r = (o.remedy ?? {}) as Record<string, unknown>;

  const belief = str(o.belief, 80);
  const power = str(o.power, 90);
  const caution = str(o.caution, 90);
  const note = str(o.note, 320);
  const title = str(r.title, 70);
  const steps = Array.isArray(r.steps)
    ? r.steps.map((s) => str(s, 140)).filter(Boolean).slice(0, 4)
    : [];
  if (!belief || !power || !caution || !note || !title || steps.length === 0) return null;

  const num = Math.round(Number(o.luckyNumber));
  const energy = Math.round(Number(o.energy));
  return {
    belief,
    power,
    caution,
    note,
    remedy: { title, steps, mantra: str(r.mantra, 90) },
    luckyNo: num >= 1 && num <= 9 ? num : reduceDigit(Number(profile.dob.slice(8, 10)) || 1),
    color: str(o.luckyColor, 20) || "White",
    direction: str(o.luckyDirection, 20) || "East",
    energy: Number.isFinite(energy) ? Math.min(100, Math.max(0, energy)) : 70,
  };
}

function readStored(profile: KundaliProfile, today: string): DailyGuide | null {
  try {
    const raw = localStorage.getItem(storageKey(profile));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuide;
    if (parsed?.date !== today) return null; // kal ka hai => naya banega
    return normalize(
      {
        ...parsed.guide,
        luckyNumber: parsed.guide?.luckyNo,
        luckyColor: parsed.guide?.color,
        luckyDirection: parsed.guide?.direction,
      },
      profile,
    );
  } catch {
    return null;
  }
}

function writeStored(profile: KundaliProfile, today: string, guide: DailyGuide) {
  try {
    const value: StoredGuide = { date: today, guide };
    localStorage.setItem(storageKey(profile), JSON.stringify(value)); // purana din overwrite
  } catch {
    /* storage full / blocked — guide phir bhi screen par dikhega */
  }
}

/* ------------------------------------------------------------------ */
/* Gemini request                                                      */
/* ------------------------------------------------------------------ */

function buildPrompt(profile: KundaliProfile, moon: MoonInfo, now: Date) {
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const status = readOnboarding().status;

  return `You are a warm Vedic astrologer writing a short DAILY guide for one person.
Today is ${dateLabel}.
Person: name ${profile.name}, gender ${profile.gender || "not given"}, born ${profile.dob} at ${profile.bot} in ${profile.bop}.${
    status ? ` Relationship status: ${status}.` : ""
  }
Chandra rashi (Moon sign): ${moon.sign.hi} (${moon.sign.en})${
    moon.nakshatra ? `, nakshatra ${moon.nakshatra} pada ${moon.pada}` : ""
  }.

Write in simple Hinglish (Hindi in Roman script), friendly and short.
Return ONLY valid JSON, no markdown, exactly this shape:
{
  "belief": "<max 7 words, positive mindset line>",
  "power": "<max 8 words, about work, learning or spirituality today>",
  "caution": "<max 8 words, one gentle thing to watch today>",
  "note": "<max 2 sentences, 40 words, about today's mood>",
  "remedy": {
    "title": "<max 6 words>",
    "steps": ["<short step>", "<short step>"],
    "mantra": "<short mantra, or empty string>"
  },
  "luckyNumber": <integer 1-9>,
  "luckyColor": "<one color>",
  "luckyDirection": "<one compass direction>",
  "energy": <integer 40-95>
}
Rules: the remedy must be a simple, safe, everyday upay doable at home (for example a mantra, donating food, feeding birds, a colour to wear, a short prayer). No medical, legal, financial or fear-based claims. Make it specific to today's weekday so it differs from day to day.`;
}

// Same din / same profile ke double request (React strict mode) ek hi call banate hain.
const inflight = new Map<string, Promise<DailyGuide>>();

function requestGuide(profile: KundaliProfile, today: string): Promise<DailyGuide> {
  const key = `${storageKey(profile)}|${today}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const moon = resolveMoon(profile);
    const res = await callGemini({ model: MODEL, input: buildPrompt(profile, moon, new Date()) });
    const guide = normalize(extractJson(res.output_text), profile);
    if (!guide) throw new Error("INVALID_GUIDE");
    return guide;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/* ------------------------------------------------------------------ */
/* UI pieces                                                           */
/* ------------------------------------------------------------------ */

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

function Bullet({ icon, tone, text }: { icon: NavIconName; tone: string; text: string }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone} [&_svg]:h-4 [&_svg]:w-4`}>
        <NavIcon name={icon} />
      </span>
      <span className="text-[14px] font-medium leading-snug text-[#f9f3eb]">{text}</span>
    </li>
  );
}

function Stat({ label, value, last }: { label: string; value: string | number; last?: boolean }) {
  return (
    <div className={`px-1 text-center ${last ? "" : "border-r border-[#f2c36b]/25"}`}>
      <p className="text-[11px] text-[#a6bddb]">{label}</p>
      <p className="mt-1 truncate text-[14px] font-medium text-[#f9e6b2]">{value}</p>
    </div>
  );
}

function Bar({ w }: { w: string }) {
  return <div className={`h-3 animate-pulse rounded-full bg-[#f2c36b]/15 ${w}`} />;
}

function LoadingCard({ line }: { line: string }) {
  return (
    <section
      className="rounded-[22px] border border-[#f2c36b]/30 bg-[#10273d] p-4 sm:p-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#f2c36b]/25 border-t-[#f2c36b]"
          aria-hidden="true"
        />
        <p className="text-[14px] font-medium text-[#f9e6b2]">{line}</p>
      </div>
      <div className="mt-5 space-y-4">
        {["w-3/4", "w-2/3", "w-4/5"].map((w) => (
          <div key={w} className="flex items-center gap-3">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[#f2c36b]/15" />
            <Bar w={w} />
          </div>
        ))}
        <div className="space-y-2 pt-1">
          <Bar w="w-full" />
          <Bar w="w-5/6" />
        </div>
        <div className="h-14 animate-pulse rounded-2xl bg-[#f2c36b]/10" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardHome() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [hello, setHello] = useState("Hello");
  const [dateLabel, setDateLabel] = useState("");
  const [name, setName] = useState("");
  const [moon, setMoon] = useState<MoonInfo | null>(null);
  const [guide, setGuide] = useState<DailyGuide | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const shownDate = useRef<string | null>(null);
  const runId = useRef(0);

  const load = useCallback(async () => {
    const id = ++runId.current;
    const now = new Date();
    const today = localDateKey(now);

    setHello(greeting(now.getHours()));
    setDateLabel(
      now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }),
    );
    setError("");

    let profile: KundaliProfile | null = null;
    try {
      profile = getUserKundaliProfile();
    } catch {
      profile = null;
    }
    if (!profile) {
      setStatus("empty");
      return;
    }

    setName(profile.name.trim().split(/\s+/)[0]);
    setMoon(resolveMoon(profile));

    const cached = readStored(profile, today);
    if (cached) {
      setGuide(cached);
      shownDate.current = today;
      setStatus("ready");
      return;
    }

    setStatus("loading");
    try {
      const fresh = await requestGuide(profile, today);
      if (id !== runId.current) return; // naya load shuru ho chuka hai
      writeStored(profile, today, fresh);
      setGuide(fresh);
      shownDate.current = today;
      setStatus("ready");
    } catch (err) {
      if (id !== runId.current) return;
      setError(
        isQuotaOrRateLimitError(err)
          ? QUOTA_ERROR_MESSAGE_HI
          : err instanceof Error && err.message !== "INVALID_GUIDE" && err.message
            ? err.message
            : "Aaj ka guide nahi ban paya. Dobara koshish karein.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
    // App raat ko khula reh gaya ho aur din badal jaye => wapas aate hi naya guide
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        shownDate.current &&
        shownDate.current !== localDateKey(new Date())
      ) {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // loader ki line badalti rahe
  useEffect(() => {
    if (status !== "loading") return;
    const t = setInterval(() => setLineIdx((i) => (i + 1) % LOADING_LINES.length), 2200);
    return () => clearInterval(t);
  }, [status]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      {/* ---------- hero ---------- */}
      <section className="relative pt-1">
        <div className="pr-28">
          <h2
            className="text-[30px] font-medium leading-[1.12] text-[#f9f3eb] sm:text-[34px]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {hello},
            <br />
            {name || "Guest"}
          </h2>
          {moon && (
            <>
              <p className="mt-3 flex items-center gap-1 text-[12px] tracking-[0.08em] text-[#f2c36b]">
                <PinIcon />
                {moon.sign.hi.toUpperCase()}
                {moon.nakshatra ? " RASHI" : ""}
                {moon.approx ? " (APPROX.)" : ""}
              </p>
              {moon.nakshatra && (
                <p className="mt-1 text-[12px] text-[#c9d8ed]">
                  {moon.nakshatra} &middot; pada {moon.pada}
                </p>
              )}
            </>
          )}
          {dateLabel && status !== "empty" && (
            <p className="mt-1 text-[12px] text-[#a6bddb]">{dateLabel}</p>
          )}
        </div>

        <div
          aria-hidden="true"
          className="absolute right-0 top-0 flex h-24 w-24 items-center justify-center rounded-full border border-[#f2c36b]/40 bg-[#10273d] text-[54px] leading-none text-[#f2c36b] sm:h-28 sm:w-28"
        >
          {/* \uFE0E => emoji nahi, text glyph dikhe */}
          {moon ? `${moon.sign.glyph}\uFE0E` : "\u2726\uFE0E"}
        </div>
      </section>

      {/* ---------- loader ---------- */}
      {status === "loading" && <LoadingCard line={LOADING_LINES[lineIdx]} />}

      {/* ---------- error ---------- */}
      {status === "error" && (
        <section className="rounded-[22px] border border-[#ef9f90]/40 bg-[#10273d] p-5 text-center">
          <p className="text-[15px] font-medium text-[#f9f3eb]">Aaj ka guide abhi nahi bana</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] leading-6 text-[#c9d8ed]">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-xl bg-[#f2c36b] px-5 py-2.5 text-[14px] font-semibold text-[#0b1324] active:scale-[0.98]"
          >
            Try again
          </button>
        </section>
      )}

      {/* ---------- no profile ---------- */}
      {status === "empty" && (
        <section className="rounded-[22px] border border-[#f2c36b]/30 bg-[#10273d] p-5 text-center">
          <p className="text-[15px] font-medium text-[#f9f3eb]">Apna profile banao</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] leading-6 text-[#c9d8ed]">
            Naam, janm tithi, samay aur sthan daalo, phir yahan roz ka guide aur upay dikhega.
          </p>
          <button
            type="button"
            onClick={() => router.push("/start")}
            className="mt-4 rounded-xl bg-[#f2c36b] px-5 py-2.5 text-[14px] font-semibold text-[#0b1324] active:scale-[0.98]"
          >
            Get started
          </button>
        </section>
      )}

      {/* ---------- today's guide ---------- */}
      {status === "ready" && guide && (
        <>
          <section className="rounded-[22px] border border-[#f2c36b]/30 bg-[#10273d] p-4 sm:p-5">
            <ul>
              <Bullet icon="sparkles" tone="bg-[#f5a65b]/20 text-[#f5a65b]" text={guide.belief} />
              <Bullet icon="timeline" tone="bg-[#7fd18a]/20 text-[#7fd18a]" text={guide.power} />
              <Bullet icon="clock" tone="bg-[#ef9f90]/20 text-[#ef9f90]" text={guide.caution} />
            </ul>

            <p className="mb-4 mt-3 text-[13px] leading-6 text-[#c9d8ed]">{guide.note}</p>

            <div className="grid grid-cols-4 rounded-2xl border border-[#f2c36b]/30 bg-[#0a1a2e] py-3">
              <Stat label="Lucky no." value={guide.luckyNo} />
              <Stat label="Color" value={guide.color} />
              <Stat label="Energy" value={`${guide.energy}%`} />
              <Stat label="Direction" value={guide.direction} last />
            </div>
          </section>

          <section className="rounded-[22px] border border-[#f2c36b]/30 bg-[#10273d] p-4 sm:p-5">
            <p className="text-[12px] uppercase tracking-[0.18em] text-[#f2c36b]">Aaj ka upay</p>
            <p
              className="mt-2 text-[20px] font-medium leading-snug text-[#f9f3eb]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {guide.remedy.title}
            </p>
            <ol className="mt-3 space-y-2">
              {guide.remedy.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-6 text-[#c9d8ed]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f2c36b]/20 text-[11px] font-medium text-[#f9e6b2]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            {guide.remedy.mantra && (
              <p className="mt-4 rounded-xl border border-[#f2c36b]/25 bg-[#0a1a2e] px-4 py-3 text-center text-[14px] text-[#f9e6b2]">
                {guide.remedy.mantra}
              </p>
            )}
            <p className="mt-3 text-center text-[11px] text-[#a6bddb]/80">
              Indicative daily guide &middot; kal naya banega
            </p>
          </section>
        </>
      )}

      {/* ---------- quick access ---------- */}
      <section>
        <p className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#a6bddb]">Quick access</p>
        <div className="grid grid-cols-2 gap-3">
          {SHORTCUTS.map((s) => (
            <button
              key={s.path}
              type="button"
              onClick={() => router.push(s.path)}
              className="flex flex-col items-start gap-2 rounded-2xl border border-[#f2c36b]/25 bg-[#0d2138]/80 p-4 text-left transition-colors hover:border-[#f2c36b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b] active:scale-[0.98]"
            >
              <span className="text-[#f2c36b]">
                <NavIcon name={s.icon} />
              </span>
              <span className="font-display text-[17px] font-semibold text-[#f8d27a]">{s.label}</span>
              <span className="text-[12px] leading-5 text-[#c9d8ed]">{s.desc}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}