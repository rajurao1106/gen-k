import { useEffect, useState } from "react";
import { callGemini, extractJson, isQuotaOrRateLimitError, QUOTA_ERROR_MESSAGE_HI } from "../lib/gemini";
import { getSavedKundalis } from "../lib/storage";
import type { KundaliRecord } from "../types";

type GunaRow = { guna: string; var: string; vadhu: string; ank: string; maxAnk: number };

type MilanResult = {
  totalScore: number;
  maxScore: number;
  rows: GunaRow[];
  verdict: string;
  summary: string;
};

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
    <div className="rounded-xl border border-[#e8a13a]/20 bg-[#1c0e05]/70 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wide text-[#a9835f]">{label}</p>
        {selected && (
          <span className="text-[#e8a13a] text-sm">✔</span>
        )}
      </div>
      <select
        value={selectedIndex ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="w-full rounded-lg bg-[#2a1608] border border-[#e8a13a]/20 px-3 py-2 text-sm text-[#f5e6d3] outline-none focus:border-[#e8a13a]/60 mb-3"
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
          <p className="font-display text-base font-semibold text-[#fbe9d0]">{selected.name || "—"}</p>
          <p className="text-xs text-[#c99a6b] mt-1">
            {selected.dob} {selected.bot ? `· ${selected.bot}` : ""}
          </p>
          <p className="text-xs text-[#a9835f] truncate">{selected.bop}</p>
        </>
      ) : (
        <p className="text-xs text-[#7a5c40]">Koi reading select nahi ki gayi</p>
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

  useEffect(() => {
    setRecords(getSavedKundalis());
  }, []);

  const varRecord = varIndex !== null ? records[varIndex] : null;
  const vadhuRecord = vadhuIndex !== null ? records[vadhuIndex] : null;
  const canCompute = Boolean(varRecord && vadhuRecord && varIndex !== vadhuIndex);

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
      setError(isQuotaOrRateLimitError(err) ? QUOTA_ERROR_MESSAGE_HI : "Guna Milan calculate karte waqt kuch gadbad ho gayi. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (records.length < 2) {
    return (
      <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/60 backdrop-blur p-10 text-center">
        <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#e8a13a] flex items-center justify-center text-[#2a1608] font-display font-bold text-lg shrink-0">
            <img src="/public/logo.png" alt="" />
          </div>
        <p className="font-display text-xl font-semibold text-[#c99a6b] mb-2">कुंडली मिलान</p>
        <p className="text-sm text-[#a9835f] max-w-md mx-auto">
          Guna Milan ke liye kam se kam 2 saved readings chahiye. पहले "कुंडली" page se दो लोगों की readings generate karke save karein, फिर यहाँ वापस आएं।
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
        <h2 className="font-display text-xl font-semibold text-[#fbe9d0] mb-1">कुंडली मिलान</h2>
        <p className="text-xs text-[#c99a6b] mb-5">Saved readings mein se वर और वधु चुनें, फिर Guna Milan निकालें।</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <PersonPicker label="वर" records={records} selectedIndex={varIndex} onSelect={setVarIndex} />
          <PersonPicker label="वधु" records={records} selectedIndex={vadhuIndex} onSelect={setVadhuIndex} />
        </div>

        {varIndex !== null && vadhuIndex !== null && varIndex === vadhuIndex && (
          <p className="text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2 mb-4">
            वर और वधु के लिए अलग-अलग readings चुनें।
          </p>
        )}

        {error && (
          <p className="text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <button
          onClick={runMilan}
          disabled={!canCompute || loading}
          className="w-full rounded-lg bg-[#e8a13a] hover:bg-[#d68f28] disabled:bg-[#7a5c2c] disabled:cursor-not-allowed text-[#20100a] font-display font-semibold text-sm py-2.5 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[#20100a]/40 border-t-[#20100a] animate-spin" />
              गुण मिलान निकाला जा रहा है…
            </>
          ) : (
            "गुण मिलान निकालें"
          )}
        </button>
      </div>

      {result && (
        <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/60 backdrop-blur p-6 shadow-xl shadow-black/30">
          <h3 className="font-display text-lg font-semibold text-[#e8a13a] text-center mb-1">
            गुण मिलान {result.totalScore} / {result.maxScore}
          </h3>
          <p className="text-center text-xs text-[#c99a6b] mb-5">{result.verdict}</p>

          <div className="overflow-x-auto rounded-xl border border-[#e8a13a]/20">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="bg-[#e8a13a] text-[#20100a] font-semibold text-left px-3 py-2">गुण</th>
                  <th className="bg-[#e8a13a] text-[#20100a] font-semibold text-left px-3 py-2">वर</th>
                  <th className="bg-[#e8a13a] text-[#20100a] font-semibold text-left px-3 py-2">वधु</th>
                  <th className="bg-[#e8a13a] text-[#20100a] font-semibold text-left px-3 py-2">अंक</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 1 ? "bg-[#e8a13a]/5" : ""}>
                    <td className="px-3 py-2 text-[#f2b25c] font-medium border-t border-[#e8a13a]/10">{row.guna}</td>
                    <td className="px-3 py-2 text-[#e3cbb0] border-t border-[#e8a13a]/10">{row.var}</td>
                    <td className="px-3 py-2 text-[#e3cbb0] border-t border-[#e8a13a]/10">{row.vadhu}</td>
                    <td className="px-3 py-2 text-[#fbe9d0] border-t border-[#e8a13a]/10">{row.ank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-[#e3cbb0] leading-relaxed mt-5">{result.summary}</p>
          <p className="text-[10px] text-[#7a5c40] mt-3 text-center">
            AI-computed traditional Ashtakoot estimate — critical decisions ke liye certified astrologer se verify karein।
          </p>
        </div>
      )}
    </div>
  );
}
