import { useEffect, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import { getSavedKundalis, saveKundaliRecord } from "../lib/storage";
import type { KundaliRecord } from "../types";

type GunaRow = {
  guna: string;
  var: string;
  vadhu: string;
  ank: string;
  maxAnk: number;
};

type MilanResult = {
  totalScore: number;
  maxScore: number;
  rows: GunaRow[];
  verdict: string;
  summary: string;
};

function stripHtmlToText(htmlStr: string) {
  const div = document.createElement("div");
  div.innerHTML = htmlStr;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function buildMilanReportHtml(result: MilanResult) {
  const rows = result.rows
    .map(
      (row) => `
        <tr>
          <td>${row.guna}</td>
          <td>${row.var}</td>
          <td>${row.vadhu}</td>
          <td>${row.ank}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <div class="prose-kundli">
      <h1>कुंडली मिलान रिपोर्ट</h1>
      <h2>गुण मिलान ${result.totalScore} / ${result.maxScore}</h2>
      <p><strong>निष्कर्ष:</strong> ${result.verdict}</p>
      <table>
        <thead>
          <tr>
            <th>गुण</th>
            <th>वर</th>
            <th>वधु</th>
            <th>अंक</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>${result.summary}</p>
    </div>
  `;
}

function PersonPicker({
  label,
  records,
  selectedIndex,
  onSelect,
}: {
  label: string;
  records: KundaliRecord[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const selected = selectedIndex !== null ? records[selectedIndex] : null;
  return (
    <div className="rounded-xl border border-[#d8b36a]/20 bg-[#111d31]/70 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wide text-[#afbdd7]">
          {label}
        </p>
        {selected && <span className="text-[#d8b36a] text-sm">✔</span>}
      </div>
      <select
        value={selectedIndex ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="w-full rounded-lg bg-[#0a1529] border border-[#d8b36a]/20 px-3 py-2 text-sm text-[#f5e6d3] outline-none focus:border-[#d8b36a]/60 mb-3"
      >
        <option value="" disabled>
          Saved reading choose karein…
        </option>
        {records.map((r, i) => (
          <option key={i} value={i}>
            {r.name || "Untitled"} · {r.dob}
          </option>
        ))}
      </select>
      {selected ? (
        <>
          <p className="font-display text-base font-semibold text-[#f5efe6]">
            {selected.name || "—"}
          </p>
          <p className="text-xs text-[#afbdd7] mt-1">
            {selected.dob} {selected.bot ? `· ${selected.bot}` : ""}
          </p>
          <p className="text-xs text-[#afbdd7] truncate">{selected.bop}</p>
        </>
      ) : (
        <p className="text-xs text-[#8ea1c2]">
          Koi reading select nahi ki gayi
        </p>
      )}
    </div>
  );
}

export default function KundaliMilanPage() {
  const [records, setRecords] = useState<KundaliRecord[]>([]);
  const [varIndex, setVarIndex] = useState<number | null>(null);
  const [vadhuIndex, setVadhuIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MilanResult | null>(null);
  const [reportHtml, setReportHtml] = useState("");
  const [speechState, setSpeechState] = useState<
    "idle" | "speaking" | "paused"
  >("idle");

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    setRecords(getSavedKundalis());
  }, []);

  useEffect(() => {
    if (!result) {
      setReportHtml("");
      setSpeechState("idle");
      return;
    }
    setReportHtml(buildMilanReportHtml(result));
    setSpeechState("idle");
  }, [result]);

  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  const varRecord = varIndex !== null ? records[varIndex] : null;
  const vadhuRecord = vadhuIndex !== null ? records[vadhuIndex] : null;
  const canCompute = Boolean(
    varRecord && vadhuRecord && varIndex !== vadhuIndex,
  );

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
    if (!varRecord || !vadhuRecord || !reportHtml) {
      setError("सभी जानकारी भरें।");
      return;
    }
    try {
      const record: KundaliRecord = {
        name: `${varRecord.name} & ${vadhuRecord.name}`,
        dob: `${varRecord.dob} / ${vadhuRecord.dob}`,
        bot: `${varRecord.bot} / ${vadhuRecord.bot}`,
        bop: `${varRecord.bop} / ${vadhuRecord.bop}`,
        gender: "",
        content: reportHtml,
      };
      saveKundaliRecord(record);
      setRecords(getSavedKundalis());
      setError(null);
      setError("कुंडली मिलान रिपोर्ट सेव हो गई।");
    } catch (err) {
      console.error(err);
      setError("सेव करने में समस्या आई।");
    }
  };

  const loadSavedReport = (index: number) => {
    if (index < 0 || index >= records.length) return;
    const record = records[index];
    setReportHtml(record.content);
  };

  const deleteSavedReport = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = records.filter((_, i) => i !== index);
    setRecords(updated);
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
          <title>Kundali Milan Report</title>
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

  const runMilan = async () => {
    if (!varRecord || !vadhuRecord) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await callGemini({
        model: "gemini-3.5-flash",
        input: `You are a Vedic astrology expert performing an Ashtakoot Guna Milan (traditional 8-factor marriage compatibility match) between two people, using their birth details.

वर (Groom): Name: ${varRecord.name}, DOB: ${varRecord.dob}, Time: ${varRecord.bot}, Place: ${varRecord.bop}
वधु (Bride): Name: ${vadhuRecord.name}, DOB: ${vadhuRecord.dob}, Time: ${vadhuRecord.bot}, Place: ${vadhuRecord.bop}

Compute their Moon sign / Nakshatra based Ashtakoot Milan across the 8 traditional gunas: वर्ण (Varna, max 1), वश्य (Vashya, max 2), तारा (Tara, max 3), योनि (Yoni, max 4), ग्रह मैत्री (Graha Maitri, max 5), गण (Gana, max 6), भकूट (Bhakoot, max 7), नाड़ी (Nadi, max 8). Total max is 36.

Respond with ONLY a raw JSON object, no markdown fences, no explanation outside the JSON. Use exactly this shape:

{
  "totalScore": 18.5,
  "maxScore": 36,
  "rows": [
    {"guna": "वर्ण", "var": "वैश्य", "vadhu": "वैश्य", "ank": "1 / 1", "maxAnk": 1},
    {"guna": "वश्य", "var": "द्विपद", "vadhu": "चतुष्पाद", "ank": "0.0 / 2", "maxAnk": 2},
    {"guna": "तारा", "var": "क्षेम", "vadhu": "विपत", "ank": "1.5 / 3", "maxAnk": 3},
    {"guna": "योनि", "var": "महीशा", "vadhu": "छाग", "ank": "3 / 4", "maxAnk": 4},
    {"guna": "ग्रह मैत्री", "var": "बुध", "vadhu": "शुक्र", "ank": "5.0 / 5", "maxAnk": 5},
    {"guna": "गण", "var": "देव", "vadhu": "राक्षस", "ank": "0 / 6", "maxAnk": 6},
    {"guna": "भकूट", "var": "कन्या", "vadhu": "वृषभ", "ank": "0 / 7", "maxAnk": 7},
    {"guna": "नाड़ी", "var": "आदि (वात)", "vadhu": "अन्त्य (कफ)", "ank": "8 / 8", "maxAnk": 8}
  ],
  "verdict": "एक-दो वाक्य में सामान्य निष्कर्ष — e.g. Score is above average, generally favorable with a couple of areas to watch",
  "summary": "2-4 sentence plain-language interpretation, mentioning any dosha (Nadi/Bhakoot) if applicable and general compatibility outlook, without guaranteeing outcomes"
}

Rules:
- Give your best-effort computed values (do not fabricate wildly-off values; reason from the birth details given).
- Always include all 8 rows in this exact order and exact "guna" labels above.
- Keep "var" and "vadhu" cell values short (a rashi/nakshatra/gana/nadi name), in Hindi (Devanagari).
- totalScore is the sum of the 8 "ank" numerators, out of maxScore 36.
- Never claim the match is guaranteed to succeed or fail — frame as traditional astrological compatibility only.
- Do not include any text outside the JSON object.`,
      });

      const text = response.output_text ?? "";
      const parsed = extractJson(text);
      if (parsed && Array.isArray(parsed.rows)) {
        setResult(parsed as MilanResult);
      } else {
        setError("Milan result parse nahi ho paya. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError(
        isQuotaOrRateLimitError(err)
          ? QUOTA_ERROR_MESSAGE_HI
          : "Guna Milan calculate karte waqt kuch gadbad ho gayi. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (records.length < 2) {
    return (
      <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/60 backdrop-blur p-10 flex-col flex gap-2 justify-center items-center text-center">
        <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#d8b36a] flex items-center justify-center text-[#0a1529] font-display font-bold text-lg shrink-0">
          <img src="/logo.png" alt="" />
        </div>
        <p className="font-display text-xl font-semibold text-[#afbdd7] mb-2">
          कुंडली मिलान
        </p>
        <p className="text-sm text-[#afbdd7] max-w-md mx-auto">
          Guna Milan ke liye kam se kam 2 saved readings chahiye. पहले "कुंडली"
          page se दो लोगों की readings generate karke save karein, फिर यहाँ वापस
          आएं।
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
        <h2 className="font-display text-xl font-semibold text-[#f5efe6] mb-1">
          कुंडली मिलान
        </h2>
        <p className="text-xs text-[#afbdd7] mb-5">
          Saved readings mein se वर और वधु चुनें, फिर Guna Milan निकालें।
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <PersonPicker
            label="वर"
            records={records}
            selectedIndex={varIndex}
            onSelect={setVarIndex}
          />
          <PersonPicker
            label="वधु"
            records={records}
            selectedIndex={vadhuIndex}
            onSelect={setVadhuIndex}
          />
        </div>

        {varIndex !== null &&
          vadhuIndex !== null &&
          varIndex === vadhuIndex && (
            <p className="text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2 mb-4">
              वर और वधु के लिए अलग-अलग readings चुनें।
            </p>
          )}

        {error && (
          <p className="text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={runMilan}
          disabled={!canCompute || loading}
          className="w-full rounded-lg bg-[#d8b36a] hover:bg-[#c99a58] disabled:bg-[#7a5c2c] disabled:cursor-not-allowed text-[#0b1324] font-display font-semibold text-sm py-2.5 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[#0b1324]/40 border-t-[#0b1324] animate-spin" />
              गुण मिलान निकाला जा रहा है…
            </>
          ) : (
            "गुण मिलान निकालें"
          )}
        </button>
      </div>

      {result && (
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

          <h3 className="font-display text-lg font-semibold text-[#d8b36a] text-center mb-1">
            गुण मिलान {result.totalScore} / {result.maxScore}
          </h3>
          <p className="text-center text-xs text-[#afbdd7] mb-5">
            {result.verdict}
          </p>

          <div className="overflow-x-auto rounded-xl border border-[#d8b36a]/20">
            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
          </div>
        </div>
      )}

      {!result && reportHtml && (
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

          <div className="overflow-x-auto rounded-xl border border-[#d8b36a]/20">
            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
          </div>
        </div>
      )}

      {records.length > 2 && (
        <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
          <h3 className="font-display text-lg font-semibold text-[#f5efe6] mb-3">
            Saved reports
          </h3>
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {records.slice(2).map((item, index) => {
              const actualIndex = index + 2;
              return (
                <li key={actualIndex}>
                  <button
                    onClick={() => loadSavedReport(actualIndex)}
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
                      onClick={(e) => deleteSavedReport(actualIndex, e)}
                      className="shrink-0 text-[#afbdd7] hover:text-[#f0958a] text-xs px-1.5 py-0.5 rounded transition-colors"
                      aria-label={`Delete ${item.name}`}
                    >
                      ✕
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
