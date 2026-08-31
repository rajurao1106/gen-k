import { useEffect, useState } from "react";
import { callGemini, extractJson, isQuotaOrRateLimitError, QUOTA_ERROR_MESSAGE_HI } from "../lib/gemini";
import { getSavedKundalis } from "../lib/storage";
import type { KundaliRecord } from "../types";

type NumberCard = { label: string; number: string; description: string };

type NumerologyResult = {
  cards: NumberCard[];
  luckyColors: string[];
  luckyDays: string[];
  luckyNumbers: string[];
  summary: string;
};

export default function NumerologyPage() {
  const [saved, setSaved] = useState<KundaliRecord[]>([]);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NumerologyResult | null>(null);

  useEffect(() => {
    setSaved(getSavedKundalis());
  }, []);

  const applySaved = (index: number) => {
    if (index < 0) return;
    const r = saved[index];
    setName(r.name);
    setDob(r.dob);
  };

  const runNumerology = async () => {
    if (!name || !dob) {
      setError("Naam aur date of birth dono zaroori hain.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await callGemini({
        model: "gemini-3.5-flash",
        input: `You are a numerology expert. Compute a Pythagorean-style numerology reading for this person.

Name: ${name}
Date of Birth: ${dob}

Respond with ONLY a raw JSON object, no markdown fences, no explanation outside the JSON. Use exactly this shape:

{
  "cards": [
    {"label": "Life Path Number", "number": "7", "description": "1-2 sentence meaning, in Hindi"},
    {"label": "Destiny / Expression Number", "number": "3", "description": "..."},
    {"label": "Soul Urge Number", "number": "9", "description": "..."},
    {"label": "Personality Number", "number": "5", "description": "..."},
    {"label": "Birthday Number", "number": "4", "description": "..."}
  ],
  "luckyColors": ["सुनहरा", "हरा"],
  "luckyDays": ["गुरुवार", "सोमवार"],
  "luckyNumbers": ["3", "7"],
  "summary": "3-5 sentence overall personality and life-tendency summary tying the numbers together, in Hindi, balanced and non-deterministic in tone"
}

Rules:
- Compute each number using standard Pythagorean numerology reduction (reduce to a single digit, except keep master numbers 11, 22, 33 unreduced where they occur).
- Descriptions and summary in Hindi (Devanagari script), concise, warm, and grounded in the actual computed numbers — not generic.
- Never guarantee future events or make medical/financial guarantees; frame as tendencies only.
- Do not include any text outside the JSON object.`,
      });

      const text = response.output_text ?? "";
      const parsed = extractJson(text);
      if (parsed && Array.isArray(parsed.cards)) {
        setResult(parsed as NumerologyResult);
      } else {
        setError("Numerology result parse nahi ho paya. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError(isQuotaOrRateLimitError(err) ? QUOTA_ERROR_MESSAGE_HI : "Numerology calculate karte waqt kuch gadbad ho gayi. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
        <h2 className="font-display text-xl font-semibold text-[#f5efe6] mb-1">न्यूमरोलॉजी</h2>
        <p className="text-xs text-[#afbdd7] mb-5">Naam aur date of birth se aapke ank (numbers) nikalte hain।</p>

        {saved.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#f4d7a7] mb-1.5">Saved reading se bharein (optional)</label>
            <select
              defaultValue=""
              onChange={(e) => applySaved(Number(e.target.value))}
              className="w-full rounded-lg bg-[#111d31] border border-[#d8b36a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] outline-none focus:border-[#d8b36a]/60"
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
          <div>
            <label className="block text-xs font-medium text-[#f4d7a7] mb-1.5">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Sharma"
              className="w-full rounded-lg bg-[#111d31] border border-[#d8b36a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] placeholder:text-[#8ea1c2] outline-none focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#f4d7a7] mb-1.5">Date of birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-lg bg-[#111d31] border border-[#d8b36a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] outline-none focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={runNumerology}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-[#d8b36a] hover:bg-[#c99a58] disabled:bg-[#7a5c2c] disabled:cursor-not-allowed text-[#0b1324] font-display font-semibold text-sm py-2.5 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[#0b1324]/40 border-t-[#0b1324] animate-spin" />
              अंक गणना हो रही है…
            </>
          ) : (
            "अंक निकालें"
          )}
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/60 backdrop-blur p-10 text-center">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-[#d8b36a]/30 border-t-[#d8b36a] animate-spin mb-4" />
          <p className="text-sm text-[#afbdd7]">आपके अंक निकाले जा रहे हैं…</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {result.cards.map((card, i) => (
              <div key={i} className="rounded-xl border border-[#d8b36a]/20 bg-[#111d31]/70 p-4 text-center">
                <p className="font-display text-3xl font-bold text-[#d8b36a] mb-1">{card.number}</p>
                <p className="text-xs font-medium text-[#f4d7a7] mb-1">{card.label}</p>
                <p className="text-[11px] text-[#afbdd7] leading-snug">{card.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/60 backdrop-blur p-6 shadow-xl shadow-black/30">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#afbdd7] mb-1">Lucky Colors</p>
                <p className="text-[#e3cbb0]">{result.luckyColors.join(", ")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#afbdd7] mb-1">Lucky Days</p>
                <p className="text-[#e3cbb0]">{result.luckyDays.join(", ")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#afbdd7] mb-1">Lucky Numbers</p>
                <p className="text-[#e3cbb0]">{result.luckyNumbers.join(", ")}</p>
              </div>
            </div>
            <p className="text-sm text-[#e3cbb0] leading-relaxed">{result.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
