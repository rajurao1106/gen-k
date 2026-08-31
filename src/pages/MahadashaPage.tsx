import { useEffect, useState } from "react";
import { callGemini, extractJson, isQuotaOrRateLimitError, QUOTA_ERROR_MESSAGE_HI } from "../lib/gemini";
import { getSavedKundalis } from "../lib/storage";
import { BIRTH_FIELDS } from "../types";
import type { KundaliRecord } from "../types";

type DashaPeriod = { planet: string; start: string; end: string };
type YearlyOutlook = { year: string; focus: string; summary: string };

type MahadashaResult = {
  currentMahadasha: DashaPeriod;
  currentAntardasha: DashaPeriod;
  timeline: DashaPeriod[];
  yearlyOutlook: YearlyOutlook[];
};

export default function MahadashaPage() {
  const [saved, setSaved] = useState<KundaliRecord[]>([]);
  const [input, setInput] = useState({ name: "", dob: "", bot: "", bop: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MahadashaResult | null>(null);

  useEffect(() => {
    setSaved(getSavedKundalis());
  }, []);

  const applySaved = (index: number) => {
    if (index < 0) return;
    const r = saved[index];
    setInput({ name: r.name, dob: r.dob, bot: r.bot, bop: r.bop });
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput({ ...input, [e.target.name]: e.target.value });
  };

  const isComplete = Boolean(input.name && input.dob && input.bot && input.bop);

  const runMahadasha = async () => {
    if (!isComplete) {
      setError("Naam, DOB, birth time aur birth place bharein.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const currentYear = new Date().getFullYear();

      const response = await callGemini({
        model: "gemini-3.5-flash",
        input: `You are a Vedic astrology expert computing a Vimshottari Mahadasha timeline.

Name: ${input.name}
Date of Birth: ${input.dob}
Time of Birth: ${input.bot}
Place of Birth: ${input.bop}
Current year: ${currentYear}

Respond with ONLY a raw JSON object, no markdown fences, no explanation outside the JSON. Use exactly this shape:

{
  "currentMahadasha": {"planet": "Shukra (Venus)", "start": "2019", "end": "2039"},
  "currentAntardasha": {"planet": "Budh (Mercury)", "start": "2024", "end": "2027"},
  "timeline": [
    {"planet": "Ketu", "start": "2001", "end": "2008"},
    {"planet": "Shukra (Venus)", "start": "2008", "end": "2028"}
  ],
  "yearlyOutlook": [
    {"year": "${currentYear}", "focus": "करियर व वित्त", "summary": "2-3 sentence Hindi outlook for this year, grounded in the current dasha/antardasha, phrased as tendencies not certainties"},
    {"year": "${currentYear + 1}", "focus": "...", "summary": "..."},
    {"year": "${currentYear + 2}", "focus": "...", "summary": "..."}
  ]
}

Rules:
- Compute the full Vimshottari Mahadasha sequence (all 9 planets: Ketu, Shukra, Surya, Chandra, Mangal, Rahu, Guru, Shani, Budh) starting from birth based on Moon's Nakshatra, with realistic start/end years for each period, covering from birth through at least 20 years past the current year.
- currentMahadasha and currentAntardasha must be the ones active in ${currentYear}, matching an entry in "timeline".
- yearlyOutlook must cover exactly ${currentYear}, ${currentYear + 1}, ${currentYear + 2}, ${currentYear + 3}, ${currentYear + 4} (5 entries), each grounded in whichever dasha/antardasha is active that year.
- Use phrases like "यह अवधि...की संभावना दर्शाती है" rather than definite claims. Never guarantee events, and never make medical/death predictions.
- If birth time is uncertain, still give best estimates — do not omit fields.
- Do not include any text outside the JSON object.`,
      });

      const text = response.output_text ?? "";
      const parsed = extractJson(text);
      if (parsed && parsed.currentMahadasha && Array.isArray(parsed.timeline)) {
        setResult(parsed as MahadashaResult);
      } else {
        setError("Mahadasha result parse nahi ho paya. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError(isQuotaOrRateLimitError(err) ? QUOTA_ERROR_MESSAGE_HI : "Mahadasha calculate karte waqt kuch gadbad ho gayi. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
        <h2 className="font-display text-xl font-semibold text-[#fbe9d0] mb-1">महादशा</h2>
        <p className="text-xs text-[#c99a6b] mb-5">
          Vimshottari Mahadasha timeline aur aane wale saalon ka outlook dekhein।
        </p>

        {saved.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#f2b25c] mb-1.5">Saved reading se bharein (optional)</label>
            <select
              defaultValue=""
              onChange={(e) => applySaved(Number(e.target.value))}
              className="w-full rounded-lg bg-[#1c0e05] border border-[#e8a13a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] outline-none focus:border-[#e8a13a]/60"
            >
              <option value="" disabled>
                Choose karein…
              </option>
              {saved.map((r, i) => (
                <option key={i} value={i}>
                  {r.name || "Untitled"} · {r.dob}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BIRTH_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-[#f2b25c] mb-1.5">{field.label}</label>
              <input
                type={field.type}
                name={field.key}
                placeholder={field.placeholder}
                value={input[field.key as keyof typeof input]}
                onChange={onChange}
                className="w-full rounded-lg bg-[#1c0e05] border border-[#e8a13a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] placeholder:text-[#7a5c40] outline-none focus:border-[#e8a13a]/70 focus:ring-1 focus:ring-[#e8a13a]/40"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={runMahadasha}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-[#e8a13a] hover:bg-[#d68f28] disabled:bg-[#7a5c2c] disabled:cursor-not-allowed text-[#20100a] font-display font-semibold text-sm py-2.5 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[#20100a]/40 border-t-[#20100a] animate-spin" />
              महादशा गणना हो रही है…
            </>
          ) : (
            "महादशा निकालें"
          )}
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/60 backdrop-blur p-10 text-center">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-[#e8a13a]/30 border-t-[#e8a13a] animate-spin mb-4" />
          <p className="text-sm text-[#c99a6b]">दशा क्रम तैयार किया जा रहा है…</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          {/* Current dasha highlight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e8a13a]/50 bg-[#e8a13a]/10 p-4">
              <p className="text-[10px] uppercase tracking-wide text-[#e8a13a] mb-1">वर्तमान महादशा</p>
              <p className="font-display text-lg font-semibold text-[#fbe9d0]">{result.currentMahadasha.planet}</p>
              <p className="text-xs text-[#c99a6b] mt-1">
                {result.currentMahadasha.start} – {result.currentMahadasha.end}
              </p>
            </div>
            <div className="rounded-xl border border-[#e8a13a]/20 bg-[#1c0e05]/70 p-4">
              <p className="text-[10px] uppercase tracking-wide text-[#a9835f] mb-1">वर्तमान अंतर्दशा</p>
              <p className="font-display text-lg font-semibold text-[#fbe9d0]">{result.currentAntardasha.planet}</p>
              <p className="text-xs text-[#c99a6b] mt-1">
                {result.currentAntardasha.start} – {result.currentAntardasha.end}
              </p>
            </div>
          </div>

          {/* Dasha timeline */}
          <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/60 backdrop-blur p-6 shadow-xl shadow-black/30">
            <h3 className="font-display text-lg font-semibold text-[#e8a13a] mb-4">दशा क्रम (Timeline)</h3>
            <div className="space-y-0">
              {result.timeline.map((p, i) => {
                const isCurrent = p.planet === result.currentMahadasha.planet && p.start === result.currentMahadasha.start;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`h-3 w-3 rounded-full shrink-0 mt-1 ${
                          isCurrent ? "bg-[#e8a13a]" : "bg-[#7a5c40]"
                        }`}
                      />
                      {i < result.timeline.length - 1 && <span className="w-px flex-1 bg-[#e8a13a]/20 my-1" />}
                    </div>
                    <div className={`pb-4 ${isCurrent ? "text-[#e8a13a]" : "text-[#e3cbb0]"}`}>
                      <p className="text-sm font-semibold">{p.planet}</p>
                      <p className="text-xs text-[#a9835f]">
                        {p.start} – {p.end}
                        {isCurrent ? " · अभी चल रही है" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Yearly outlook */}
          <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/60 backdrop-blur p-6 shadow-xl shadow-black/30">
            <h3 className="font-display text-lg font-semibold text-[#e8a13a] mb-4">आने वाले वर्षों का दृष्टिकोण</h3>
            <div className="space-y-3">
              {result.yearlyOutlook.map((y, i) => (
                <div key={i} className="rounded-lg border border-[#e8a13a]/15 bg-[#1c0e05]/60 p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-display text-base font-semibold text-[#fbe9d0]">{y.year}</p>
                    <span className="text-[10px] uppercase tracking-wide text-[#e8a13a] bg-[#e8a13a]/10 border border-[#e8a13a]/25 rounded-full px-2 py-0.5">
                      {y.focus}
                    </span>
                  </div>
                  <p className="text-sm text-[#e3cbb0] leading-relaxed">{y.summary}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#7a5c40] mt-4 text-center">
              AI-computed astrological estimate — koi bhi bada faisla lene se pehle certified astrologer se salah lein।
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
