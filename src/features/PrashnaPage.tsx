"use client";

import { useId, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import { HELPLINES, screenForRisk, type RiskLevel } from "../lib/Psychologistinsight";
import {
  buildPrashnaPrompt,
  CATEGORY_OPTIONS,
  detectSensitiveTopics,
  DISCLAIMER_HI,
  fetchPrashna,
  MAX_QUESTION_CHARS,
  normalizePrashnaExplanation,
  SENSITIVE_NOTE_HI,
  VERDICT_META,
  type PrashnaCategory,
  type PrashnaExplanation,
  type PrashnaResult,
  type SensitiveTopic,
} from "../lib/prashna";
import { KundaliChartSVG } from "../components/KundaliChartSVG";

const cardClass =
  "rounded-2xl border border-[#d8b36a]/20 bg-white/80 p-5 shadow-xl shadow-black/30 sm:p-6";
const inputClass =
  "w-full rounded-lg border border-[#d8b36a]/20 bg-[#F4F4F3] px-3.5 py-2.5 text-sm text-[#171717] outline-none placeholder:text-[#89837D] focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40";
const primaryBtn =
  "rounded-full bg-[#f2c36b] px-6 py-2.5 text-sm font-semibold text-[#081724] transition-colors hover:bg-[#f8d27a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/70 disabled:opacity-60";

type Coords = { lat: number; lon: number; timeZone: string };
type GeoState = "idle" | "asking" | "ok" | "denied";

function SafetyNote({ level }: { level: RiskLevel }) {
  if (level === "none") return null;
  return (
    <div
      role={level === "high" ? "alert" : "status"}
      className="rounded-xl border border-[#ef9f90]/50 bg-[#ef9f90]/10 p-4 text-sm leading-6 text-[#171717]"
    >
      <p className="font-semibold text-[#171717]">Aapne jo likha hai wo bhaari lag raha hai.</p>
      <p className="mt-1">
        Kisi apne, ya kisi professional se abhi baat karna madad kar sakta hai. Agar aap khud ko nuksan
        pahunchane ke baare mein soch rahe hain, to turant madad lein.
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {HELPLINES.map((h) => (
          <li key={h.name} className="rounded-lg border border-[#d8b36a]/30 px-3 py-1.5">
            {h.name}:{" "}
            {h.numbers.map((n, i) => (
              <span key={n}>
                {i > 0 && " / "}
                <a href={`tel:${n.replace(/-/g, "")}`} className="font-semibold text-[#A95F35] underline underline-offset-2">
                  {n}
                </a>
              </span>
            ))}
          </li>
        ))}
      </ul>
      {level === "high" && (
        <p className="mt-2 text-xs text-[#171717]/80">
          Is haalat mein hum jyotish ka jawab nahi dikha rahe. Pehle kisi se baat kijiye.
        </p>
      )}
    </div>
  );
}

export default function PrashnaPage() {
  const questionId = useId();
  const placeId = useId();

  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<PrashnaCategory | "auto">("auto");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [placeText, setPlaceText] = useState("");

  const [risk, setRisk] = useState<RiskLevel>("none");
  const [sensitive, setSensitive] = useState<SensitiveTopic[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");
  const [result, setResult] = useState<PrashnaResult | null>(null);
  const [explanation, setExplanation] = useState<PrashnaExplanation | null>(null);

  const busy = loadingChart || loadingAi;

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("denied");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lon: Math.round(pos.coords.longitude * 10000) / 10000,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
        });
        setGeo("ok");
      },
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  const reset = () => {
    setResult(null);
    setExplanation(null);
    setError("");
    setAiError("");
    setRisk("none");
    setSensitive([]);
    setQuestion("");
  };

  const submit = async () => {
    const q = question.trim();
    setError("");
    setAiError("");
    setResult(null);
    setExplanation(null);

    if (q.length < 3) {
      setError("Pehle apna sawaal likhein.");
      return;
    }

    // 1) Safety first: runs on this device, before anything is sent anywhere.
    const level = screenForRisk(q);
    setRisk(level);
    if (level === "high") return;

    const topics = detectSensitiveTopics(q);
    setSensitive(topics);

    if (!coords && placeText.trim().length < 2) {
      setError("Apni location allow karein, ya shehar ka naam likhein. Chart usi jagah ke liye banta hai.");
      return;
    }

    // 2) Chart + rules + verdict, all calculated on the server.
    setLoadingChart(true);
    let prashna: PrashnaResult;
    try {
      prashna = await fetchPrashna({
        question: q,
        category: category === "auto" ? undefined : category,
        ...(coords ? coords : { place: placeText.trim() }),
      });
      setResult(prashna);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Prashna kundali ban nahi paayi. Dobara try karein.");
      return;
    } finally {
      setLoadingChart(false);
    }

    // 3) AI only explains. If it fails, the calculated result above is still shown.
    setLoadingAi(true);
    try {
      const response = await callGemini({
        model: "gemini-3.5-flash-lite",
        purpose: "prashna",
        input: buildPrashnaPrompt({ question: q, result: prashna, sensitive: topics }),
      });
      const parsed = normalizePrashnaExplanation(extractJson(response.output_text ?? ""));
      if (parsed) setExplanation(parsed);
      else setAiError("AI ki samjhaayi abhi nahi ban paayi, par neeche chart ke kaaran dekh sakte hain.");
    } catch (err) {
      setAiError(
        isQuotaOrRateLimitError(err)
          ? QUOTA_ERROR_MESSAGE_HI
          : "AI ki samjhaayi abhi nahi ban paayi, par neeche chart ke kaaran dekh sakte hain.",
      );
    } finally {
      setLoadingAi(false);
    }
  };

  const verdict = result ? VERDICT_META[result.verdict] : null;

  return (
    <section aria-labelledby="prashna-heading" className="space-y-5">
      <div>
        <h1 id="prashna-heading" className="font-display text-3xl font-bold text-[#171717]">
          Prashna Kundali
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-6 text-[#625C56]">
          Jis pal aap sawaal poochhte hain, usi samay aur jagah ki kundali banti hai. Neeche likhein, hum chart
          se ek narm sanket aur uske kaaran dikhayenge. Ye pakki bhavishyavani nahi hai.
        </p>
      </div>

      {!result && (
        <div className={cardClass}>
          <label htmlFor={questionId} className="block text-sm font-medium text-[#80602F]">
            Aapka sawaal
          </label>
          <textarea
            id={questionId}
            value={question}
            maxLength={MAX_QUESTION_CHARS}
            rows={3}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Jaise: Meri chabi kho gayi hai, kya mil jayegi? Ya: Kya ye kaam ban jayega?"
            className={`${inputClass} mt-2`}
          />
          <p className="mt-1 text-xs text-[#89837D]">
            Ek baar mein ek hi sawaal poochhein, aur wahi jo sach mein jaanna chahte hain.
          </p>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-[#80602F]">Sawaal kis baare mein hai?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ key: "auto" as const, label: "Khud pehchaanein" }, ...CATEGORY_OPTIONS].map((opt) => {
                const active = category === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(opt.key)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60 ${
                      active
                        ? "border-[#f2c36b] bg-[#f2c36b]/20 text-[#80602F]"
                        : "border-[#d8b36a]/25 text-[#625C56] hover:bg-[#f2c36b]/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4">
            <p className="text-sm font-medium text-[#80602F]">Aap abhi kahan hain?</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={geo === "asking"}
                className="rounded-full border border-[#f2c36b]/40 px-4 py-1.5 text-sm text-[#80602F] transition-colors hover:bg-[#f2c36b]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60 disabled:opacity-60"
              >
                {geo === "asking" ? "Location mil rahi hai..." : "Meri location use karein"}
              </button>
              {geo === "ok" && coords && (
                <span role="status" className="text-xs text-[#49643C]">
                  Location mil gayi ({coords.lat}, {coords.lon})
                </span>
              )}
              {geo === "denied" && (
                <span role="status" className="text-xs text-[#8E3529]">
                  Location nahi mili. Neeche shehar ka naam likhein.
                </span>
              )}
            </div>
            {!coords && (
              <div className="mt-3">
                <label htmlFor={placeId} className="block text-xs text-[#89837D]">
                  Ya shehar / gaon ka naam
                </label>
                <input
                  id={placeId}
                  value={placeText}
                  onChange={(e) => setPlaceText(e.target.value)}
                  placeholder="Raipur, Chhattisgarh, India"
                  className={`${inputClass} mt-1`}
                />
              </div>
            )}
            <p className="mt-2 text-xs text-[#89837D]">
              Aapki location sirf chart banane ke liye use hoti hai, kahin save nahi hoti.
            </p>
          </div>

          <button type="button" onClick={submit} disabled={busy} className={`${primaryBtn} mt-5`}>
            {loadingChart ? "Kundali ban rahi hai..." : "Prashna kundali banayein"}
          </button>
        </div>
      )}

      {risk !== "none" && <SafetyNote level={risk} />}

      {error && (
        <p role="alert" className="rounded-xl border border-[#ef9f90]/50 bg-[#ef9f90]/10 p-4 text-sm text-[#8E3529]">
          {error}
        </p>
      )}

      {result && verdict && (
        <>
          <div className={`rounded-2xl border p-5 sm:p-6 ${verdict.box}`}>
            <p className="text-xs uppercase tracking-wide text-[#625C56]">{result.categoryLabel}</p>
            <h2 className={`mt-1 font-display text-2xl font-bold ${verdict.text}`}>{verdict.title}</h2>
            <p className="mt-2 text-[15px] leading-7 text-[#403A34]">{verdict.line}</p>
            {result.categorySource === "detected" && (
              <p className="mt-2 text-xs text-[#625C56]">
                Humne sawaal se ye vishay pehchaana. Galat lage to naya sawaal poochhkar vishay khud chunein.
              </p>
            )}
          </div>

          {sensitive.length > 0 && (
            <div role="note" className="rounded-xl border border-[#9ec1ff]/40 bg-[#9ec1ff]/10 p-4 text-sm leading-6 text-[#403A34]">
              {sensitive.map((t) => (
                <p key={t}>{SENSITIVE_NOTE_HI[t]}</p>
              ))}
            </div>
          )}

          <div className={cardClass}>
            <h3 className="font-display text-xl font-bold text-[#171717]">Seedhi bhasha mein</h3>
            {loadingAi && <p className="mt-2 text-sm text-[#89837D]">Samjhaayi ban rahi hai...</p>}
            {explanation && (
              <div className="mt-2 space-y-3">
                {explanation.summary && <p className="text-[15px] font-medium leading-7 text-[#80602F]">{explanation.summary}</p>}
                {explanation.explanation && <p className="text-[15px] leading-7 text-[#403A34]">{explanation.explanation}</p>}
                {explanation.steps.length > 0 && (
                  <div className="rounded-xl border border-[#9ec1ff]/40 bg-[#F8F0E8]/70 p-4">
                    <h4 className="font-display text-base font-semibold text-[#171717]">Aap ye kar sakte hain</h4>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#403A34] marker:text-[#A95F35]">
                      {explanation.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.note && <p className="text-sm leading-6 text-[#625C56]">{explanation.note}</p>}
              </div>
            )}
            {aiError && <p className="mt-2 text-sm text-[#8E3529]">{aiError}</p>}
          </div>

          <div className={cardClass}>
            <h3 className="font-display text-xl font-bold text-[#171717]">Chart ne kya dikhaya</h3>
            <p className="mt-1 text-xs text-[#89837D]">Ye kaaran fixed niyamon se nikle hain, AI ne nahi.</p>
            <ul className="mt-3 space-y-2">
              {result.factors.map((f) => (
                <li
                  key={f.key}
                  className={`flex gap-3 rounded-xl border p-3 text-sm leading-6 text-[#403A34] ${
                    f.effect === "+" ? "border-[#8fd3a8]/40 bg-[#8fd3a8]/5" : "border-[#ef9f90]/40 bg-[#ef9f90]/5"
                  }`}
                >
                  <span
                    aria-label={f.effect === "+" ? "Anukool" : "Pratikool"}
                    className={`mt-0.5 font-bold ${f.effect === "+" ? "text-[#49643C]" : "text-[#ef9f90]"}`}
                  >
                    {f.effect === "+" ? "+" : "−"}
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
              {result.factors.length === 0 && <li className="text-sm text-[#625C56]">Koi khaas kaaran nahi mila.</li>}
            </ul>
          </div>

          <div className={cardClass}>
            <h3 className="font-display text-xl font-bold text-[#171717]">Is pal ka panchang</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm text-[#403A34] sm:grid-cols-2">
              <div><dt className="inline text-[#89837D]">Tithi: </dt><dd className="inline">{result.panchang.tithi.paksha} {result.panchang.tithi.name}</dd></div>
              <div><dt className="inline text-[#89837D]">Vara: </dt><dd className="inline">{result.panchang.vara.name}</dd></div>
              <div><dt className="inline text-[#89837D]">Nakshatra: </dt><dd className="inline">{result.panchang.nakshatra.name} (pada {result.panchang.nakshatra.pada})</dd></div>
              <div><dt className="inline text-[#89837D]">Yoga: </dt><dd className="inline">{result.panchang.yoga.name}</dd></div>
              <div><dt className="inline text-[#89837D]">Lagna: </dt><dd className="inline">{result.facts.lagna}</dd></div>
              <div><dt className="inline text-[#89837D]">Chandra: </dt><dd className="inline">{result.facts.moon.rashi}, {result.facts.moon.house}th bhav</dd></div>
            </dl>
            <details className="mt-4 rounded-xl border border-[#d8b36a]/20 bg-[#F8F0E8]/60 p-3">
              <summary className="cursor-pointer text-sm font-medium text-[#80602F]">Prashna kundali dekhein</summary>
              <div className="mx-auto mt-3 max-w-md">
                <KundaliChartSVG data={result.chart} />
                <p className="text-center text-xs text-[#89837D]">{result.chart.ayanamsa} ayanamsa</p>
              </div>
            </details>
          </div>

          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-[#f2c36b]/40 px-5 py-2 text-sm text-[#80602F] transition-colors hover:bg-[#f2c36b]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60"
          >
            Naya sawaal poochhein
          </button>
        </>
      )}

      <p className="text-xs leading-5 text-[#89837D]">{DISCLAIMER_HI}</p>
    </section>
  );
}