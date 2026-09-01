import { useEffect, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import { getSavedKundalis, saveKundaliRecord } from "../lib/storage";
import type { KundaliRecord } from "../types";

type NumberCard = { label: string; number: string; description: string };

type NumerologyResult = {
  cards: NumberCard[];
  luckyColors: string[];
  luckyDays: string[];
  luckyNumbers: string[];
  summary: string;
};

function stripHtmlToText(htmlStr: string) {
  const div = document.createElement("div");
  div.innerHTML = htmlStr;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function buildNumerologyReportHtml(result: NumerologyResult) {
  const cards = result.cards
    .map(
      (card) => `
        <div class="num-card">
          <p class="num-label">${card.label}</p>
          <p class="num-value">${card.number}</p>
          <p class="num-desc">${card.description}</p>
        </div>
      `,
    )
    .join("");

  return `
    <div class="prose-kundli">
      <h1>न्यूमरोलॉजी रिपोर्ट</h1>
      <div class="cards-grid">${cards}</div>
      <p><strong>Lucky Colors:</strong> ${result.luckyColors.join(", ")}</p>
      <p><strong>Lucky Days:</strong> ${result.luckyDays.join(", ")}</p>
      <p><strong>Lucky Numbers:</strong> ${result.luckyNumbers.join(", ")}</p>
      <p>${result.summary}</p>
    </div>
  `;
}

export default function NumerologyPage() {
  const [saved, setSaved] = useState<KundaliRecord[]>([]);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NumerologyResult | null>(null);
  const [reportHtml, setReportHtml] = useState("");
  const [speechState, setSpeechState] = useState<
    "idle" | "speaking" | "paused"
  >("idle");

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    setSaved(getSavedKundalis());
  }, []);

  useEffect(() => {
    if (!result) {
      setReportHtml("");
      setSpeechState("idle");
      return;
    }
    setReportHtml(buildNumerologyReportHtml(result));
    setSpeechState("idle");
  }, [result]);

  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  const applySaved = (index: number) => {
    if (index < 0) return;
    const r = saved[index];
    setName(r.name);
    setDob(r.dob);
  };

  const handlePlayPause = () => {
    if (!speechSupported || !reportHtml) return;
    const synth = window.speechSynthesis;
    if (speechState === "speaking") {
      synth.pause();
      setSpeechState("paused");
      return;
    }
    if (speechState === "paused") {
      synth.resume();
      setSpeechState("speaking");
      return;
    }

    const text = stripHtmlToText(reportHtml);
    if (!text) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices?.() ?? [];
    const preferredVoice =
      voices.find((voice) => voice.lang.toLowerCase().startsWith("hi")) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
      null;

    utterance.lang = "hi-IN";
    utterance.rate = 0.95;
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => setSpeechState("idle");
    utterance.onerror = () => setSpeechState("idle");

    try {
      synth.speak(utterance);
      setSpeechState("speaking");
    } catch {
      setSpeechState("idle");
    }
  };

  const handleStopSpeech = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeechState("idle");
  };

  const handleSaveToLocalStorage = () => {
    if (!name || !dob || !reportHtml) {
      setError("सभी जानकारी भरें।");
      return;
    }
    try {
      const record: KundaliRecord = {
        name,
        dob,
        bot: "",
        bop: "",
        gender: "",
        content: reportHtml,
      };
      saveKundaliRecord(record);
      setSaved(getSavedKundalis());
      setError(null);
      setError("न्यूमरोलॉजी रिपोर्ट सेव हो गई।");
    } catch (err) {
      console.error(err);
      setError("सेव करने में समस्या आई।");
    }
  };

  const loadSavedReport = (index: number) => {
    if (index < 0 || index >= saved.length) return;
    const record = saved[index];
    setName(record.name);
    setDob(record.dob);
    setReportHtml(record.content);
  };

  const deleteSavedReport = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saved.filter((_, i) => i !== index);
    setSaved(updated);
    localStorage.setItem("kundali", JSON.stringify(updated));
  };

  const handleDownloadPdf = () => {
    if (!reportHtml) return;
    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Numerology Report</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            :root { --bg: #ffffff; --text: #111111; --gold: #b77c2b; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: Arial, sans-serif; }
            .print-wrapper { width: 100%; max-width: 100%; padding: 12px; }
            .print-wrapper h1, .print-wrapper h2, .print-wrapper h3 { color: var(--gold); font-family: Georgia, serif; margin: 0 0 12px; page-break-after: avoid; }
            .print-wrapper p, .print-wrapper li, .print-wrapper td, .print-wrapper th { color: var(--text); font-size: 12.5px; line-height: 1.7; }
            .print-wrapper table { width: 100%; border-collapse: collapse; margin: 16px 0; page-break-inside: auto; }
            .print-wrapper th, .print-wrapper td { border: 1px solid #ccc; padding: 7px 8px; text-align: left; }
            .print-wrapper th { background: #f5f5f5; font-weight: bold; }
            .print-wrapper ul, .print-wrapper ol { margin: 12px 0; padding-left: 20px; }
            .print-wrapper li { margin: 6px 0; }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${reportHtml}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
      setError(
        isQuotaOrRateLimitError(err)
          ? QUOTA_ERROR_MESSAGE_HI
          : "Numerology calculate karte waqt kuch gadbad ho gayi. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
        <h2 className="font-display text-xl font-semibold text-[#f5efe6] mb-1">
          न्यूमरोलॉजी
        </h2>
        <p className="text-xs text-[#afbdd7] mb-5">
          Naam aur date of birth se aapke ank (numbers) nikalte hain।
        </p>

        {saved.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#f4d7a7] mb-1.5">
              Saved reading se bharein (optional)
            </label>
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
            <label className="block text-xs font-medium text-[#f4d7a7] mb-1.5">
              Full name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Sharma"
              className="w-full rounded-lg bg-[#111d31] border border-[#d8b36a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] placeholder:text-[#8ea1c2] outline-none focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#f4d7a7] mb-1.5">
              Date of birth
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-lg bg-[#111d31] border border-[#d8b36a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] outline-none focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2">
            {error}
          </p>
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

      {(result || reportHtml) && !loading && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/60 backdrop-blur p-6 shadow-xl shadow-black/30">
            <div className="flex flex-wrap justify-end gap-2 mb-4">
              {speechSupported && (
                <>
                  <button
                    onClick={handlePlayPause}
                    className="text-xs rounded-lg border border-[#d8b36a]/20 px-3 py-1.5 text-[#e3cbb0]"
                  >
                    {speechState === "speaking"
                      ? "⏸ रोकें"
                      : speechState === "paused"
                        ? "▶ फिर से सुनें"
                        : "🔊 रिस्पॉन्स सुनें"}
                  </button>
                  {speechState !== "idle" && (
                    <button
                      onClick={handleStopSpeech}
                      className="text-xs rounded-lg border border-[#d8b36a]/20 px-3 py-1.5 text-[#e3cbb0]"
                    >
                      ⏹ बंद करें
                    </button>
                  )}
                </>
              )}
              {result && (
                <button
                  onClick={handleSaveToLocalStorage}
                  className="text-xs rounded-lg border border-[#d8b36a]/20 px-3 py-1.5 text-[#e3cbb0]"
                >
                  💾 सेव करें
                </button>
              )}
              <button
                onClick={handleDownloadPdf}
                className="text-xs rounded-lg border border-[#d8b36a]/50 px-3 py-1.5 text-[#d8b36a]"
              >
                ⬇ चार्ट सहित डाउनलोड करें
              </button>
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              dangerouslySetInnerHTML={{ __html: reportHtml }}
            />
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
          <h3 className="font-display text-lg font-semibold text-[#f5efe6] mb-3">
            Saved reports
          </h3>
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {saved.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => loadSavedReport(index)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors border bg-transparent border-[#d8b36a]/10 hover:border-[#d8b36a]/30 text-[#e3cbb0]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {item.name || "Untitled"}
                    </span>
                    <span className="block text-xs text-[#afbdd7] truncate">
                      {item.dob}
                    </span>
                  </span>
                  <span
                    role="button"
                    onClick={(e) => deleteSavedReport(index, e)}
                    className="shrink-0 text-[#afbdd7] hover:text-[#f0958a] text-xs px-1.5 py-0.5 rounded transition-colors"
                    aria-label={`Delete ${item.name}`}
                  >
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
