"use client";

import { useId, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import {
  buildCompanyPrompt,
  DISCLAIMER_HI,
  fetchCompanyChart,
  formatDateHi,
  normalizeCompanyExplanation,
  SIGNAL_META,
  TYPE_OPTIONS,
  type CompanyChartType,
  type CompanyExplanation,
  type CompanyResult,
} from "../lib/company";
import { KundaliChartSVG } from "../components/KundaliChartSVG";

const cardClass =
  "rounded-2xl border border-[#d8b36a]/20 bg-white/80 p-5 shadow-xl shadow-black/30 sm:p-6";
const inputClass =
  "w-full rounded-lg border border-[#d8b36a]/20 bg-[#F4F4F3] px-3.5 py-2.5 text-sm text-[#171717] outline-none placeholder:text-[#89837D] focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40";
const primaryBtn =
  "rounded-full bg-[#f2c36b] px-6 py-2.5 text-sm font-semibold text-[#081724] transition-colors hover:bg-[#f8d27a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/70 disabled:opacity-60";
const ghostBtn =
  "rounded-full border border-[#f2c36b]/40 px-4 py-1.5 text-sm text-[#80602F] transition-colors hover:bg-[#f2c36b]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60 disabled:opacity-60";

type Coords = { lat: number; lon: number; timeZone: string };
type GeoState = "idle" | "asking" | "ok" | "denied";

const AI_FALLBACK = "AI ki samjhaayi abhi nahi ban paayi, par neeche niyamon ke kaaran dekh sakte hain.";

export default function CompanyPage() {
  const nameId = useId();
  const dateId = useId();
  const timeId = useId();
  const placeId = useId();

  const [type, setType] = useState<CompanyChartType>("company");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [placeText, setPlaceText] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");

  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");
  const [result, setResult] = useState<CompanyResult | null>(null);
  const [explanation, setExplanation] = useState<CompanyExplanation | null>(null);

  const busy = loadingChart || loadingAi;
  const option = TYPE_OPTIONS.find((o) => o.key === type) ?? TYPE_OPTIONS[0];

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
  };

  const submit = async () => {
    setError("");
    setAiError("");
    setResult(null);
    setExplanation(null);

    if (!date) {
      setError(`${option.dateLabel} chunein.`);
      return;
    }
    if (!time) {
      setError(`${option.timeLabel} likhein. Samay jitna sahi hoga, nateeja utna bharosemand hoga.`);
      return;
    }
    if (!coords && placeText.trim().length < 2) {
      setError("Jagah (shehar) ka naam likhein ya apni location allow karein.");
      return;
    }

    // 1) Chart, bhav, dasha and the soft signals: all calculated on the server.
    setLoadingChart(true);
    let found: CompanyResult;
    try {
      found = await fetchCompanyChart({
        type,
        date,
        time,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(coords && !placeText.trim() ? coords : { place: placeText.trim() }),
      });
      setResult(found);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Kundali abhi nahi ban paayi. Dobara try karein.");
      return;
    } finally {
      setLoadingChart(false);
    }

    // 2) AI only explains. If it fails, the calculated result above is still shown.
    setLoadingAi(true);
    try {
      const response = await callGemini({
        model: "gemini-3.5-flash-lite",
        purpose: "company",
        input: buildCompanyPrompt(found),
      });
      const parsed = normalizeCompanyExplanation(
        extractJson(response.output_text ?? ""),
        found.themes.map((t) => t.key),
      );
      if (parsed) setExplanation(parsed);
      else setAiError(AI_FALLBACK);
    } catch (err) {
      setAiError(isQuotaOrRateLimitError(err) ? QUOTA_ERROR_MESSAGE_HI : AI_FALLBACK);
    } finally {
      setLoadingAi(false);
    }
  };

  const whyFor = (key: string) => explanation?.themes.find((t) => t.key === key)?.why;

  return (
    <section aria-labelledby="company-heading" className="space-y-5">
      <div>
        <h1 id="company-heading" className="font-display text-3xl font-bold text-[#171717]">
          Company / Griha Kundali
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-6 text-[#625C56]">
          Company ya ghar ke shuru hone ka tarikh, samay aur jagah dein. Hum us pal ki kundali se company ke 10th, 2nd, 11th
          bhav aur chal rahi dasha, ya ghar ke 4th bhav aur Mangal-Shani ka sthaan dekhkar ek naram sanket denge. Ye pakki
          guarantee nahi hai.
        </p>
      </div>

      {!result && (
        <div className={cardClass}>
          <fieldset>
            <legend className="text-sm font-medium text-[#80602F]">Kiski kundali?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    title={opt.hint}
                    onClick={() => setType(opt.key)}
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
            <p className="mt-1 text-xs text-[#89837D]">{option.hint}</p>
          </fieldset>

          <div className="mt-4">
            <label htmlFor={nameId} className="block text-sm font-medium text-[#80602F]">
              Naam <span className="text-xs font-normal text-[#89837D]">(zaroori nahi)</span>
            </label>
            <input
              id={nameId}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "company" ? "Company ka naam" : "Ghar ka naam ya pata (jaise: Naya ghar)"}
              className={`${inputClass} mt-1 sm:max-w-md`}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={dateId} className="block text-sm font-medium text-[#80602F]">
                {option.dateLabel}
              </label>
              <input
                id={dateId}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor={timeId} className="block text-sm font-medium text-[#80602F]">
                {option.timeLabel}
              </label>
              <input
                id={timeId}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-[#80602F]">{option.placeLabel}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={useMyLocation} disabled={geo === "asking"} className={ghostBtn}>
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
            <div className="mt-3">
              <label htmlFor={placeId} className="block text-xs text-[#89837D]">
                {coords ? "Ya kisi aur shehar ka naam (ye location se pehle chalega)" : "Shehar / gaon ka naam"}
              </label>
              <input
                id={placeId}
                value={placeText}
                onChange={(e) => setPlaceText(e.target.value)}
                placeholder="Raipur, Chhattisgarh, India"
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>

          <button type="button" onClick={submit} disabled={busy} className={`${primaryBtn} mt-5`}>
            {loadingChart ? "Kundali ban rahi hai..." : "Kundali dekhein"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-[#ef9f90]/50 bg-[#ef9f90]/10 p-4 text-sm text-[#8E3529]">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className={`rounded-2xl border p-5 sm:p-6 ${SIGNAL_META[result.verdict].box}`}>
            <p className="text-xs uppercase tracking-wide text-[#625C56]">
              {result.typeLabel}
              {result.name ? ` · ${result.name}` : ""}
            </p>
            <h2 className={`mt-1 font-display text-2xl font-bold ${SIGNAL_META[result.verdict].text}`}>
              {SIGNAL_META[result.verdict].title} sanket
            </h2>
            <p className="mt-1 text-sm text-[#625C56]">{SIGNAL_META[result.verdict].line}</p>
            <p className="mt-1 text-xs text-[#89837D]">
              {formatDateHi(result.event.localDate)}, {result.event.localTime} · {result.place.label ?? "diya gaya sthaan"} ·
              Lagna {result.facts.lagna}
            </p>
            {explanation?.summary && <p className="mt-3 text-[15px] leading-7 text-[#80602F]">{explanation.summary}</p>}
            {loadingAi && <p className="mt-3 text-sm text-[#89837D]">Samjhaayi ban rahi hai...</p>}
            {aiError && <p className="mt-3 text-sm text-[#8E3529]">{aiError}</p>}
          </div>

          {result.themes.map((theme) => {
            const meta = SIGNAL_META[theme.signal];
            const why = whyFor(theme.key);
            return (
              <article key={theme.key} className={`rounded-2xl border p-5 sm:p-6 ${meta.box}`} aria-label={theme.label}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold text-[#171717]">{theme.label}</h3>
                  <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${meta.chip}`}>{meta.title}</span>
                </div>

                {why && <p className="mt-3 text-[15px] leading-7 text-[#403A34]">{why}</p>}

                {theme.factors.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {theme.factors.map((f) => (
                      <li
                        key={f.key}
                        className={`flex gap-3 rounded-xl border p-3 text-sm leading-6 text-[#403A34] ${
                          f.effect === "+" ? "border-[#8fd3a8]/40 bg-[#8fd3a8]/5" : "border-[#ef9f90]/40 bg-[#ef9f90]/5"
                        }`}
                      >
                        <span
                          aria-label={f.effect === "+" ? "Anukool" : "Dhyaan dene wala"}
                          className={`mt-0.5 font-bold ${f.effect === "+" ? "text-[#49643C]" : "text-[#ef9f90]"}`}
                        >
                          {f.effect === "+" ? "+" : "−"}
                        </span>
                        <span>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {theme.notes.map((n) => (
                  <p key={n} className="mt-3 text-sm leading-6 text-[#625C56]">
                    {n}
                  </p>
                ))}

                {theme.key === "dasha" && result.dasha.status === "ok" && (
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-[#403A34] sm:grid-cols-2">
                    <div>
                      <dt className="inline text-[#89837D]">Mahadasha: </dt>
                      <dd className="inline">
                        {result.dasha.mahadasha.name} ({formatDateHi(result.dasha.mahadasha.start)} se{" "}
                        {formatDateHi(result.dasha.mahadasha.end)})
                      </dd>
                    </div>
                    {result.dasha.antardasha && (
                      <div>
                        <dt className="inline text-[#89837D]">Antardasha: </dt>
                        <dd className="inline">
                          {result.dasha.antardasha.name} ({formatDateHi(result.dasha.antardasha.start)} se{" "}
                          {formatDateHi(result.dasha.antardasha.end)})
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline text-[#89837D]">Agli Mahadasha: </dt>
                      <dd className="inline">
                        {result.dasha.nextMahadasha.name} ({formatDateHi(result.dasha.nextMahadasha.start)} se)
                      </dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}

          <details className="rounded-2xl border border-[#d8b36a]/20 bg-[#F8F0E8]/60 p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#80602F]">Is samay ki kundali dekhein</summary>
            <div className="mx-auto mt-3 max-w-md">
              <KundaliChartSVG data={result.chart} />
              <p className="text-center text-xs text-[#89837D]">{result.chart.ayanamsa} ayanamsa</p>
            </div>
          </details>

          {explanation?.note && <p className="text-sm leading-6 text-[#625C56]">{explanation.note}</p>}

          <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-[#89837D] marker:text-[#A95F35]">
            {result.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>

          <button type="button" onClick={reset} className={ghostBtn}>
            Nayi kundali dekhein
          </button>
        </>
      )}

      <p className="text-xs leading-5 text-[#89837D]">{DISCLAIMER_HI}</p>
    </section>
  );
}