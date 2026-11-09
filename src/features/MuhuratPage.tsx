"use client";

import { useId, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import {
  ACTIVITY_OPTIONS,
  buildMuhuratPrompt,
  DISCLAIMER_HI,
  fetchMuhurat,
  formatDateHi,
  GRADE_META,
  MAX_RANGE_DAYS,
  normalizeMuhuratExplanation,
  RASHI_OPTIONS,
  todayLocalISO,
  type MuhuratActivity,
  type MuhuratExplanation,
  type MuhuratResult,
} from "../lib/muhurat";
import { KundaliChartSVG } from "../components/KundaliChartSVG";

const cardClass =
  "rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 p-5 shadow-xl shadow-black/30 sm:p-6";
const inputClass =
  "w-full rounded-lg border border-[#d8b36a]/20 bg-[#111d31] px-3.5 py-2.5 text-sm text-[#f5e6d3] outline-none placeholder:text-[#8ea1c2] focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40";
const primaryBtn =
  "rounded-full bg-[#f2c36b] px-6 py-2.5 text-sm font-semibold text-[#081724] transition-colors hover:bg-[#f8d27a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/70 disabled:opacity-60";

type Coords = { lat: number; lon: number; timeZone: string };
type GeoState = "idle" | "asking" | "ok" | "denied";

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

export default function MuhuratPage() {
  const placeId = useId();
  const fromId = useId();
  const toId = useId();
  const rashiId = useId();

  const [activity, setActivity] = useState<MuhuratActivity>("griha_pravesh");
  const [fromDate, setFromDate] = useState(todayLocalISO(0));
  const [toDate, setToDate] = useState(todayLocalISO(14));
  const [natalMoon, setNatalMoon] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [placeText, setPlaceText] = useState("");

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");
  const [result, setResult] = useState<MuhuratResult | null>(null);
  const [explanation, setExplanation] = useState<MuhuratExplanation | null>(null);

  const busy = loadingSlots || loadingAi;

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

    if (!fromDate || !toDate) {
      setError("Tarikh ki shuruaat aur aakhri tarikh dono chunein.");
      return;
    }
    if (toDate < fromDate) {
      setError("Aakhri tarikh shuruaat ki tarikh se pehle nahi ho sakti.");
      return;
    }
    if (daysBetween(fromDate, toDate) > MAX_RANGE_DAYS) {
      setError(`Ek baar mein ${MAX_RANGE_DAYS} din tak hi dekh sakte hain.`);
      return;
    }
    if (!coords && placeText.trim().length < 2) {
      setError("Muhurat jis shehar ke liye chahiye, uska naam likhein ya apni location allow karein.");
      return;
    }

    // 1) Slots, rules, scores and ranking: all calculated on the server.
    setLoadingSlots(true);
    let found: MuhuratResult;
    try {
      found = await fetchMuhurat({
        activity,
        fromDate,
        toDate,
        ...(natalMoon ? { natalMoonSign: natalMoon } : {}),
        ...(coords && !placeText.trim() ? coords : { place: placeText.trim() }),
      });
      setResult(found);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Muhurat abhi nahi nikal paaya. Dobara try karein.");
      return;
    } finally {
      setLoadingSlots(false);
    }
    if (found.slots.length === 0) return;

    // 2) AI only explains. If it fails, the calculated slots above are still shown.
    setLoadingAi(true);
    try {
      const response = await callGemini({
        model: "gemini-3.5-flash-lite",
        purpose: "muhurat",
        input: buildMuhuratPrompt(found),
      });
      const parsed = normalizeMuhuratExplanation(
        extractJson(response.output_text ?? ""),
        found.slots.map((s) => s.id),
      );
      if (parsed) setExplanation(parsed);
      else setAiError("AI ki samjhaayi abhi nahi ban paayi, par neeche niyamon ke kaaran dekh sakte hain.");
    } catch (err) {
      setAiError(
        isQuotaOrRateLimitError(err)
          ? QUOTA_ERROR_MESSAGE_HI
          : "AI ki samjhaayi abhi nahi ban paayi, par neeche niyamon ke kaaran dekh sakte hain.",
      );
    } finally {
      setLoadingAi(false);
    }
  };

  const whyFor = (id: string) => explanation?.slots.find((s) => s.id === id)?.why;

  return (
    <section aria-labelledby="muhurat-heading" className="space-y-5">
      <div>
        <h1 id="muhurat-heading" className="font-display text-3xl font-bold text-[#f9f3eb]">
          Muhurat Kundali
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-6 text-[#c9d8ed]">
          Kaam aur tarikhon ki range chunein. Hum har 30 minute ka samay jaanchkar tithi, nakshatra, vara, lagna
          aur rahukaal ke niyamon se sabse anukool samay dikhayenge. Ye pakki guarantee nahi hai.
        </p>
      </div>

      {!result && (
        <div className={cardClass}>
          <fieldset>
            <legend className="text-sm font-medium text-[#f9e6b2]">Kaun sa kaam?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACTIVITY_OPTIONS.map((opt) => {
                const active = activity === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    title={opt.hint}
                    onClick={() => setActivity(opt.key)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60 ${
                      active
                        ? "border-[#f2c36b] bg-[#f2c36b]/20 text-[#f9e6b2]"
                        : "border-[#d8b36a]/25 text-[#c9d8ed] hover:bg-[#f2c36b]/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-[#a6bddb]">{ACTIVITY_OPTIONS.find((o) => o.key === activity)?.hint}</p>
          </fieldset>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={fromId} className="block text-sm font-medium text-[#f9e6b2]">
                Kab se
              </label>
              <input
                id={fromId}
                type="date"
                value={fromDate}
                min={todayLocalISO(0)}
                onChange={(e) => setFromDate(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor={toId} className="block text-sm font-medium text-[#f9e6b2]">
                Kab tak (zyada se zyada {MAX_RANGE_DAYS} din)
              </label>
              <input
                id={toId}
                type="date"
                value={toDate}
                min={fromDate || todayLocalISO(0)}
                onChange={(e) => setToDate(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-[#f9e6b2]">Kis jagah ke liye?</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={geo === "asking"}
                className="rounded-full border border-[#f2c36b]/40 px-4 py-1.5 text-sm text-[#f9e6b2] transition-colors hover:bg-[#f2c36b]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60 disabled:opacity-60"
              >
                {geo === "asking" ? "Location mil rahi hai..." : "Meri location use karein"}
              </button>
              {geo === "ok" && coords && (
                <span role="status" className="text-xs text-[#b9ecca]">
                  Location mil gayi ({coords.lat}, {coords.lon})
                </span>
              )}
              {geo === "denied" && (
                <span role="status" className="text-xs text-[#ffd1c9]">
                  Location nahi mili. Neeche shehar ka naam likhein.
                </span>
              )}
            </div>
            <div className="mt-3">
              <label htmlFor={placeId} className="block text-xs text-[#a6bddb]">
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

          <div className="mt-4">
            <label htmlFor={rashiId} className="block text-sm font-medium text-[#f9e6b2]">
              Aapki janm rashi (Chandra rashi) <span className="text-xs font-normal text-[#a6bddb]">(zaroori nahi)</span>
            </label>
            <select
              id={rashiId}
              value={natalMoon}
              onChange={(e) => setNatalMoon(e.target.value)}
              className={`${inputClass} mt-1 sm:max-w-xs`}
            >
              <option value="">Pata nahi / abhi chhodein</option>
              {RASHI_OPTIONS.map((r) => (
                <option key={r.en} value={r.en}>
                  {r.hi} ({r.en})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#a6bddb]">Dene par Chandra bala bhi jaanchi jaati hai, jisse nateeja aapke liye zyada khaas hota hai.</p>
          </div>

          <button type="button" onClick={submit} disabled={busy} className={`${primaryBtn} mt-5`}>
            {loadingSlots ? "Samay jaanche ja rahe hain..." : "Muhurat dhundhein"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-[#ef9f90]/50 bg-[#ef9f90]/10 p-4 text-sm text-[#ffd1c9]">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="rounded-2xl border border-[#d8b36a]/25 bg-[#10273d] p-5 sm:p-6">
            <p className="text-xs uppercase tracking-wide text-[#c9d8ed]">{result.activityLabel}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#f9f3eb]">
              {result.slots.length > 0 ? `${result.slots.length} anukool samay mile` : "Is range mein koi achha samay nahi mila"}
            </h2>
            <p className="mt-1 text-sm text-[#c9d8ed]">
              {formatDateHi(result.range.fromDate)} se {formatDateHi(result.range.toDate)} · {result.place.label ?? "aapki jagah"} ·{" "}
              {result.slotsChecked} samay jaanche
              {result.usedChandraBala ? " · Chandra bala shaamil" : ""}
            </p>
            {result.slots.length === 0 && (
              <div className="mt-3 text-sm leading-6 text-[#edf2fb]">
                <p>Niyamon ke hisaab se is range ke zyadatar samay ruk gaye. Zyada baar ye kaaran aaye:</p>
                <ul className="mt-1 list-disc pl-5 marker:text-[#f2c36b]">
                  {result.mainBlockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-2">Tarikhon ki range badhakar dobara dekhein.</p>
              </div>
            )}
            {explanation?.summary && <p className="mt-3 text-[15px] leading-7 text-[#f9e6b2]">{explanation.summary}</p>}
            {loadingAi && <p className="mt-3 text-sm text-[#a6bddb]">Samjhaayi ban rahi hai...</p>}
            {aiError && <p className="mt-3 text-sm text-[#ffd1c9]">{aiError}</p>}
          </div>

          {result.slots.map((slot) => {
            const grade = GRADE_META[slot.grade];
            const why = whyFor(slot.id);
            return (
              <article key={slot.id} className={`rounded-2xl border p-5 sm:p-6 ${grade.box}`} aria-label={`Muhurat ${slot.rank}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-[#c9d8ed]">Muhurat {slot.rank}</p>
                  <p className={`text-sm font-semibold ${grade.text}`}>
                    {grade.title} sanket · {slot.percent}% niyam mile
                  </p>
                </div>
                <h3 className="mt-1 font-display text-2xl font-bold text-[#f9f3eb]">
                  {formatDateHi(slot.date)} ({slot.weekday})
                </h3>
                <p className={`text-lg font-semibold ${grade.text}`}>
                  {slot.startLocal} se {slot.endLocal}
                </p>

                {why && <p className="mt-3 text-[15px] leading-7 text-[#edf2fb]">{why}</p>}

                <ul className="mt-3 space-y-2">
                  {slot.factors.map((f) => (
                    <li
                      key={f.key}
                      className={`flex gap-3 rounded-xl border p-3 text-sm leading-6 text-[#edf2fb] ${
                        f.effect === "+" ? "border-[#8fd3a8]/40 bg-[#8fd3a8]/5" : "border-[#ef9f90]/40 bg-[#ef9f90]/5"
                      }`}
                    >
                      <span
                        aria-label={f.effect === "+" ? "Anukool" : "Pratikool"}
                        className={`mt-0.5 font-bold ${f.effect === "+" ? "text-[#8fd3a8]" : "text-[#ef9f90]"}`}
                      >
                        {f.effect === "+" ? "+" : "−"}
                      </span>
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-[#edf2fb] sm:grid-cols-2">
                  <div><dt className="inline text-[#a6bddb]">Tithi: </dt><dd className="inline">{slot.panchang.tithi.paksha} {slot.panchang.tithi.name}</dd></div>
                  <div><dt className="inline text-[#a6bddb]">Nakshatra: </dt><dd className="inline">{slot.panchang.nakshatra.name}</dd></div>
                  <div><dt className="inline text-[#a6bddb]">Yoga: </dt><dd className="inline">{slot.panchang.yoga.name}</dd></div>
                  <div><dt className="inline text-[#a6bddb]">Lagna: </dt><dd className="inline">{slot.lagna}</dd></div>
                  <div><dt className="inline text-[#a6bddb]">Rahukaal us din: </dt><dd className="inline">{slot.day.rahukaal.start}-{slot.day.rahukaal.end}</dd></div>
                  <div><dt className="inline text-[#a6bddb]">Gulika kaal: </dt><dd className="inline">{slot.day.gulika.start}-{slot.day.gulika.end}</dd></div>
                </dl>

                <details className="mt-4 rounded-xl border border-[#d8b36a]/20 bg-[#0d2138]/60 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-[#f9e6b2]">Is samay ki kundali dekhein ({slot.bestLocal})</summary>
                  <div className="mx-auto mt-3 max-w-md">
                    <KundaliChartSVG data={slot.chart} />
                    <p className="text-center text-xs text-[#afbdd7]">{slot.chart.ayanamsa} ayanamsa</p>
                  </div>
                </details>
              </article>
            );
          })}

          {explanation?.note && <p className="text-sm leading-6 text-[#c9d8ed]">{explanation.note}</p>}

          {result.slots.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-[#a6bddb] marker:text-[#f2c36b]">
              {result.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-[#f2c36b]/40 px-5 py-2 text-sm text-[#f9e6b2] transition-colors hover:bg-[#f2c36b]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60"
          >
            Naya muhurat dhundhein
          </button>
        </>
      )}

      <p className="text-xs leading-5 text-[#a6bddb]">{DISCLAIMER_HI}</p>
    </section>
  );
}