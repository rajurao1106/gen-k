import { useEffect, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import { getSavedKundalis, saveKundaliRecord } from "../lib/storage";
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

function stripHtmlToText(htmlStr: string) {
  const div = document.createElement("div");
  div.innerHTML = htmlStr;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function buildMahadashaReportHtml(result: MahadashaResult) {
  const timeline = result.timeline
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.planet}</td>
          <td>${item.start}</td>
          <td>${item.end}</td>
        </tr>
      `,
    )
    .join("");

  const yearly = result.yearlyOutlook
    .map(
      (item) => `
        <div class="year-card">
          <p class="year-head">${item.year}</p>
          <p><strong>${item.focus}</strong></p>
          <p>${item.summary}</p>
        </div>
      `,
    )
    .join("");

  return `
    <div class="prose-kundli">
      <h1>महादशा रिपोर्ट</h1>
      <h2>वर्तमान महादशा</h2>
      <p><strong>महादशा:</strong> ${result.currentMahadasha.planet} (${result.currentMahadasha.start} - ${result.currentMahadasha.end})</p>
      <p><strong>अंतर्दशा:</strong> ${result.currentAntardasha.planet} (${result.currentAntardasha.start} - ${result.currentAntardasha.end})</p>
      <table>
        <thead>
          <tr><th>#</th><th>ग्रह</th><th>शुरू</th><th>अंत</th></tr>
        </thead>
        <tbody>${timeline}</tbody>
      </table>
      <h2>आने वाले वर्षों का दृष्टिकोण</h2>
      ${yearly}
    </div>
  `;
}

export default function MahadashaPage() {
  const [saved, setSaved] = useState<KundaliRecord[]>([]);
  const [input, setInput] = useState({ name: "", dob: "", bot: "", bop: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MahadashaResult | null>(null);
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
    setReportHtml(buildMahadashaReportHtml(result));
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
    setInput({ name: r.name, dob: r.dob, bot: r.bot, bop: r.bop });
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput({ ...input, [e.target.name]: e.target.value });
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
    if (!input.name || !input.dob || !reportHtml) {
      setError("सभी जानकारी भरें।");
      return;
    }
    try {
      const record: KundaliRecord = {
        name: input.name,
        dob: input.dob,
        bot: input.bot,
        bop: input.bop,
        gender: "",
        content: reportHtml,
      };
      saveKundaliRecord(record);
      setSaved(getSavedKundalis());
      setError(null);
      setError("महादशा रिपोर्ट सेव हो गई।");
    } catch (err) {
      console.error(err);
      setError("सेव करने में समस्या आई।");
    }
  };

  const loadSavedReport = (index: number) => {
    if (index < 0 || index >= saved.length) return;
    const record = saved[index];
    // Parse name/dob/bot/bop if they were concatenated
    const nameParts = record.name.split(" · ");
    setInput({
      name: nameParts[0] || record.name,
      dob: record.dob,
      bot: record.bot,
      bop: record.bop,
    });
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
          <title>Mahadasha Report</title>
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
      setError(
        isQuotaOrRateLimitError(err)
          ? QUOTA_ERROR_MESSAGE_HI
          : "Mahadasha calculate karte waqt kuch gadbad ho gayi. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
        <h2 className="font-display text-xl font-semibold text-[#f5efe6] mb-1">
          महादशा
        </h2>
        <p className="text-xs text-[#afbdd7] mb-5">
          Vimshottari Mahadasha timeline aur aane wale saalon ka outlook
          dekhein।
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
          {BIRTH_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-[#f4d7a7] mb-1.5">
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.key}
                placeholder={field.placeholder}
                value={input[field.key as keyof typeof input]}
                onChange={onChange}
                className="w-full rounded-lg bg-[#111d31] border border-[#d8b36a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] placeholder:text-[#8ea1c2] outline-none focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={runMahadasha}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-[#d8b36a] hover:bg-[#c99a58] disabled:bg-[#7a5c2c] disabled:cursor-not-allowed text-[#0b1324] font-display font-semibold text-sm py-2.5 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[#0b1324]/40 border-t-[#0b1324] animate-spin" />
              महादशा गणना हो रही है…
            </>
          ) : (
            "महादशा निकालें"
          )}
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/60 backdrop-blur p-10 text-center">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-[#d8b36a]/30 border-t-[#d8b36a] animate-spin mb-4" />
          <p className="text-sm text-[#afbdd7]">
            दशा क्रम तैयार किया जा रहा है…
          </p>
        </div>
      )}

      {result && !loading && (
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
              <button
                onClick={handleSaveToLocalStorage}
                className="text-xs rounded-lg border border-[#d8b36a]/20 px-3 py-1.5 text-[#e3cbb0]"
              >
                💾 सेव करें
              </button>
              <button
                onClick={handleDownloadPdf}
                className="text-xs rounded-lg border border-[#d8b36a]/50 px-3 py-1.5 text-[#d8b36a]"
              >
                ⬇ चार्ट सहित डाउनलोड करें
              </button>
            </div>

            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#d8b36a]/50 bg-[#d8b36a]/10 p-4">
              <p className="text-[10px] uppercase tracking-wide text-[#d8b36a] mb-1">
                वर्तमान महादशा
              </p>
              <p className="font-display text-lg font-semibold text-[#f5efe6]">
                {result.currentMahadasha.planet}
              </p>
              <p className="text-xs text-[#afbdd7] mt-1">
                {result.currentMahadasha.start} – {result.currentMahadasha.end}
              </p>
            </div>
            <div className="rounded-xl border border-[#d8b36a]/20 bg-[#111d31]/70 p-4">
              <p className="text-[10px] uppercase tracking-wide text-[#afbdd7] mb-1">
                वर्तमान अंतर्दशा
              </p>
              <p className="font-display text-lg font-semibold text-[#f5efe6]">
                {result.currentAntardasha.planet}
              </p>
              <p className="text-xs text-[#afbdd7] mt-1">
                {result.currentAntardasha.start} –{" "}
                {result.currentAntardasha.end}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/60 backdrop-blur p-6 shadow-xl shadow-black/30">
            <h3 className="font-display text-lg font-semibold text-[#d8b36a] mb-4">
              दशा क्रम (Timeline)
            </h3>
            <div className="space-y-0">
              {result.timeline.map((p, i) => {
                const isCurrent =
                  p.planet === result.currentMahadasha.planet &&
                  p.start === result.currentMahadasha.start;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`h-3 w-3 rounded-full shrink-0 mt-1 ${isCurrent ? "bg-[#d8b36a]" : "bg-[#8ea1c2]"}`}
                      />
                      {i < result.timeline.length - 1 && (
                        <span className="w-px flex-1 bg-[#d8b36a]/20 my-1" />
                      )}
                    </div>
                    <div
                      className={`pb-4 ${isCurrent ? "text-[#d8b36a]" : "text-[#e3cbb0]"}`}
                    >
                      <p className="text-sm font-semibold">{p.planet}</p>
                      <p className="text-xs text-[#afbdd7]">
                        {p.start} – {p.end}
                        {isCurrent ? " · अभी चल रही है" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/60 backdrop-blur p-6 shadow-xl shadow-black/30">
            <h3 className="font-display text-lg font-semibold text-[#d8b36a] mb-4">
              आने वाले वर्षों का दृष्टिकोण
            </h3>
            <div className="space-y-3">
              {result.yearlyOutlook.map((y, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[#d8b36a]/15 bg-[#111d31]/60 p-4"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-display text-base font-semibold text-[#f5efe6]">
                      {y.year}
                    </p>
                    <span className="text-[10px] uppercase tracking-wide text-[#d8b36a] bg-[#d8b36a]/10 border border-[#d8b36a]/25 rounded-full px-2 py-0.5">
                      {y.focus}
                    </span>
                  </div>
                  <p className="text-sm text-[#e3cbb0] leading-relaxed">
                    {y.summary}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#8ea1c2] mt-4 text-center">
              AI-computed astrological estimate — koi bhi bada faisla lene se
              pehle certified astrologer se salah lein।
            </p>
          </div>
        </div>
      )}

      {!result && reportHtml && !loading && (
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
              <button
                onClick={handleDownloadPdf}
                className="text-xs rounded-lg border border-[#d8b36a]/50 px-3 py-1.5 text-[#d8b36a]"
              >
                ⬇ चार्ट सहित डाउनलोड करें
              </button>
            </div>

            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
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
