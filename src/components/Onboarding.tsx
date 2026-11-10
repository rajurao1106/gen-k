"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveUserKundaliProfile } from "../lib/storage";
import { saveUserDetail } from "../lib/api";
import { trackAnalytics } from "../lib/analytics";
import { ART, IMAGES, STEP_KEYS, TEXT } from "../lib/onboardingSteps"
import AdvancedPlaceInput from "./AdvancedPlaceInput";
import BirthPlaceMap from "./BirthPlaceMap";

type Place = { label: string; lat: number; lng: number; tz: string };
type Data = {
  name: string; gender: string; status: string;
  m: number; d: number; yi: number; h: number; mi: number; ap: number;
  unknown: boolean; place: Place | null;
};
type Geo = { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string };

const INIT: Data = { name: "", gender: "", status: "", m: 0, d: 0, yi: 80, h: 5, mi: 0, ap: 0, unknown: false, place: null };
const ROW = 40;
const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = Array.from({ length: new Date().getFullYear() - 1919 }, (_, i) => 1920 + i);
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINS = Array.from({ length: 60 }, (_, i) => pad(i));

function Art({ step }: { step: number }) {
  const key = STEP_KEYS[step];
  if (IMAGES[key]) {
    return (
      <img
        src={IMAGES[key]}
        alt=""
        className={`mx-auto h-full w-full ${key === "welcome" ? "object-cover object-[center_38%] md:object-contain" : key === "name" ? "max-w-[430px] object-cover object-[center_15%]" : key === "gender" ? "object-cover object-top" : "object-contain"}`}
      />
    );
  }
  const kind = ART[key];
  if (key === "welcome") {
    return (
      <svg viewBox="0 0 360 420" className="mx-auto h-full w-full max-w-[420px]" fill="none" aria-hidden="true">
        <g fill="#80602F">
          {[[30, 60], [82, 34], [154, 52], [318, 64], [44, 142], [113, 112], [284, 32], [332, 174], [68, 210], [307, 245], [24, 286], [260, 100]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2 : 1.4} />
          ))}
        </g>
        <g stroke="#80602F" strokeLinecap="round" strokeWidth="1.5">
          <path d="M288 52v14m-7-7h14M42 102v10m-5-5h10M320 292v12m-6-6h12" />
        </g>
        <circle cx="92" cy="104" r="43" fill="#171717" />
        <circle cx="108" cy="96" r="41" fill="#FFF8F1" />
        <g stroke="#171717" strokeLinecap="round" strokeLinejoin="round">
          <path d="M183 299c46 4 89 2 151 0" strokeWidth="3" />
          <path d="M235 178c-5 16-9 31-9 47 0 9 6 16 15 18l24 2c10 0 16-8 12-18l-9-33" fill="#E8B99A" strokeWidth="2.5" />
          <path d="M232 190c-9 17-11 38-20 61l-23 42c-3 6 1 11 7 9l34-42c8-10 15-24 19-38" fill="#FFF8F1" strokeWidth="2.5" />
          <path d="M253 241c-4 18 2 38 8 55l-16 20c-4 5 0 10 6 9l28-7c5-1 7-5 5-10l-11-25 2-38" fill="#FFF8F1" strokeWidth="2.5" />
          <path d="M212 254c12 5 24 7 37 7m-28 33 11 4m28-3 12-2" strokeWidth="2" />
          <path d="M194 299l-13 2c-5 1-7 6-2 9l15 5 8-7m43 8-7 9c-3 4 0 8 5 8h19c5 0 7-4 4-8l-9-10" fill="#171717" strokeWidth="2" />
          <path d="M235 176c-5-10-2-22 8-27 11-5 23 2 23 14 0 6-3 10-7 14" fill="#E8B99A" strokeWidth="2.5" />
          <path d="M236 172c-4-7-2-18 4-24 5-6 15-7 22-2 8 6 7 16 3 23l-2 9c-2 7 3 14 11 19 9 6 9 16 1 21-7 5-17 1-22-6-5-6-7-15-13-19-6-4-8-12-4-21Z" fill="#171717" strokeWidth="2" />
          <path d="M237 195c-6 15-12 30-22 44" stroke="#171717" strokeWidth="3" />
        </g>
        <circle cx="243" cy="175" r="1.4" fill="#171717" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 100" className="mx-auto h-full w-full max-w-[280px]" fill="none" stroke="#B77A25" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      {kind === "moon" && (<><path d="M72 18a30 30 0 1 0 24 46A26 26 0 0 1 72 18Z" /><path d="M22 26v8M18 30h8M98 22v6M95 25h6M30 78v6M27 81h6" /></>)}
      {kind === "constellation" && (<><path d="M20 72l24-22 16 10 26-32 14 14" />{[[20, 72], [44, 50], [60, 60], [86, 28], [100, 42]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.6" fill="#D9A441" />)}</>)}
      {kind === "globe" && (<><circle cx="60" cy="50" r="28" /><ellipse cx="60" cy="50" rx="12" ry="28" /><path d="M32 50h56M36 34h48M36 66h48" /></>)}
      {kind === "hearts" && (<><path d="M44 66c-16-11-16-28-4-28 6 0 4 6 4 6s-2-6 4-6c12 0 12 17-4 28Z" /><path d="M84 50c-10-7-10-17-3-17 4 0 3 4 3 4s-1-4 3-4c7 0 7 10-3 17Z" /><path d="M20 30v8M16 34h8M98 74v6M95 77h6" /></>)}
    </svg>
  );
}

function Intro({ text, name }: { text: string; name: string }) {
  const parts = text.split("{name}");
  return (
    <p className="text-[15px] leading-6 text-[#625C56]">
      {parts.map((p, i) => (
        <span key={i}>{p}{i < parts.length - 1 && <b className="text-[#A95F35]">{name}</b>}</span>
      ))}
    </p>
  );
}

function Wheel({ items, index, onChange }: { items: string[]; index: number; onChange: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: index * ROW }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const mask = "linear-gradient(transparent, #000 30%, #000 70%, transparent)";
  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const i = Math.min(items.length - 1, Math.max(0, Math.round(e.currentTarget.scrollTop / ROW)));
        if (i !== index) onChange(i);
      }}
      className="h-[160px] flex-1 snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
    >
      <div style={{ height: 60 }} />
      {items.map((t, i) => (
        <div key={i} className={`flex h-10 snap-center items-center justify-center text-lg ${i === index ? "font-semibold text-[#171717]" : "text-[#A9A29B]"}`}>{t}</div>
      ))}
      <div style={{ height: 60 }} />
    </div>
  );
}

function Wheels({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-4 flex gap-2">
      {children}
      <div className="pointer-events-none absolute inset-x-0 top-[60px] h-10 border-y border-[#D9A441]/40" />
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(INIT);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [mapPlace, setMapPlace] = useState<Place | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  useEffect(() => {
    // Keep the interactive onboarding wizard out of the server-rendered markup.
    // oxlint-disable-next-line react/set-state-in-effect
    setReady(true);
  }, []);


  useEffect(() => {
    if (!searching || q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=8&language=en&format=json`, { signal: ctrl.signal });
        const j: { results?: Geo[] } = await r.json();
        setResults((j.results ?? []).map((p) => ({
          label: [p.name, p.admin1, p.country].filter(Boolean).join(", "),
          lat: p.latitude, lng: p.longitude, tz: p.timezone ?? "",
        })));
      } catch { /* aborted or offline */ }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, searching]);

  if (!ready) return null;

  const dim = new Date(YEARS[data.yi], data.m + 1, 0).getDate();
  const day = Math.min(data.d, dim - 1);
  const valid = [true, data.name.trim().length > 1, !!data.gender, !!data.status, true, true, !!data.place][step];

  const finish = async () => {
    if (!data.place || saving) return;
    const h24 = ((data.h + 1) % 12) + (data.ap === 1 ? 12 : 0);
    const profile = {
      name: data.name.trim(),
      dob: `${YEARS[data.yi]}-${pad(data.m + 1)}-${pad(day + 1)}`,
      bot: data.unknown ? "12:00" : `${pad(h24)}:${pad(data.mi)}`,
      bop: data.place.label,
      gender: data.gender,
    };
    setSaving(true);
    setError("");
    try {
      await saveUserDetail({
        fullName: profile.name,
        dateOfBirth: profile.dob,
        timeOfBirth: profile.bot,
        placeOfBirth: profile.bop,
        gender: profile.gender,
        relationshipStatus: data.status,
        birthTimeUnknown: data.unknown,
        birthLatitude: data.place.lat,
        birthLongitude: data.place.lng,
        birthTimezone: data.place.tz,
        ...(referralCode.trim() ? { referralCode: referralCode.trim().toUpperCase() } : {}),
      });
      saveUserKundaliProfile(profile);
      trackAnalytics("kundali_created");
      router.replace("/dashboard");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
      setSaving(false);
    }
  };
  const next = () => (step === 6 ? void finish() : setStep(step + 1));

  const cta = (label: string, onClick: () => void, enabled = true) => (
    <>
      {error && <p role="alert" className="mb-3 rounded-xl border border-[#B94E3D]/25 bg-[#B94E3D]/[0.07] px-3 py-2 text-sm text-[#8E3529]">{error}</p>}
      <button type="button" onClick={onClick} disabled={!enabled || saving}
        className="w-full rounded-xl bg-[#101010] py-3 font-display text-sm font-bold tracking-wide text-white transition hover:bg-[#302A25] disabled:bg-[#E9E7E1] disabled:text-white">
        {saving ? "Saving…" : `${label} →`}
      </button>
    </>
  );
  const option = (label: string, selected: boolean, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-[15px] transition ${selected ? "border-[#D9A441] bg-[#F8E8D8]/70 text-[#171717]" : "border-[#E9E9E9] bg-white text-[#625C56] hover:border-[#D9A441]/70"}`}>
      {label}{selected && <span className="text-[#B77A25]" aria-hidden="true">✓</span>}
    </button>
  );

  if (step === 0) {
    const w = TEXT.welcome;
    return (
      <Shell welcome>
        <div className="grid flex-1 grid-rows-[minmax(320px,55svh)_1fr] md:grid-cols-2 md:grid-rows-1">
          <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden bg-[#FBF2E9] px-5 pt-4 md:min-h-0 md:px-8 md:py-10">
            <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-10 h-48 w-48 rounded-full bg-[#F2DCCB]/70 blur-3xl" />
            <Art step={0} />
          </div>
          <div className="flex flex-col items-center px-6 pb-7 pt-7 text-center sm:px-10 md:items-start md:justify-center md:px-12 md:py-14 md:text-left lg:px-16">
            <h1 className="max-w-md font-sans text-[30px] font-bold leading-[1.05] tracking-tight sm:text-4xl">{w.title}</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#77716B]">{w.subtitle}</p>
            <div className="mt-7 w-full max-w-sm md:mt-9">{cta(w.cta, () => setStep(1))}</div>
            <p className="mt-4 max-w-sm text-[10px] leading-[1.55] text-[#89837D]">
              {w.legalPre} <Link href={w.privacyHref} className="font-medium text-[#A95F35] underline underline-offset-2">{w.privacy}</Link>{w.legalMid}{" "}
              <Link href={w.termsHref} className="font-medium text-[#A95F35] underline underline-offset-2">{w.terms}</Link>.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="flex items-center justify-between px-5 pt-5 sm:px-8">
        <button type="button" aria-label="Back" onClick={() => setStep(step - 1)} className="h-9 w-9 text-xl text-[#302A25]">←</button>
        <div className="flex gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((n) => <span key={n} className={`h-1 w-4 rounded-full ${n <= step ? "bg-[#D9A441]" : "bg-[#E8E1DB]"}`} />)}
        </div>
        {step === 3 ? (
          <button type="button" onClick={() => { set({ status: "" }); setStep(4); }} className="text-[10px] font-semibold tracking-wide text-[#A95F35]">{TEXT.status.skip}</button>
        ) : <span className="w-9" />}
      </header>
      <div className={`pt-3 ${step === 1 ? "h-[164px] sm:h-[180px]" : "h-32 sm:h-40"}`}><Art step={step} /></div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-6 pt-4 sm:px-10">
        {step === 1 && (<>
          <p className="text-[15px] text-[#625C56]">{TEXT.name.intro}</p>
          <label htmlFor="ob-name" className="mt-1 block text-base font-semibold">{TEXT.name.title}</label>
          <input id="ob-name" autoFocus value={data.name} onChange={(e) => set({ name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && valid && next()} placeholder={TEXT.name.placeholder}
            className="mt-4 w-full border-b border-[#D7C9BC] bg-transparent pb-2 font-display text-3xl outline-none placeholder:text-[#B7AEA6] focus:border-[#D9A441]" />
        </>)}

        {step === 2 && (<>
          <Intro text={TEXT.gender.intro} name={data.name.trim()} />
          <p className="mb-3 mt-3 text-base font-semibold">{TEXT.gender.title}</p>
          <div className="space-y-3">{TEXT.gender.options.map((o: { label: string; value: string; }) => option(o.label, data.gender === o.value, () => set({ gender: o.value })))}</div>
        </>)}

        {step === 3 && (<>
          <Intro text={TEXT.status.intro} name={data.name.trim()} />
          <p className="mb-3 mt-3 text-base font-semibold">{TEXT.status.title}</p>
          <div className="space-y-2.5">{TEXT.status.options.map((o: string) => option(o, data.status === o, () => set({ status: o })))}</div>
          <p className="mt-3 text-[11px] text-[#89837D]">{TEXT.status.note}</p>
        </>)}

        {step === 4 && (<>
          <p className="text-[15px] leading-6 text-[#625C56]">{TEXT.dob.intro}</p>
          <p className="mt-3 text-base font-semibold">{TEXT.dob.title}</p>
          <Wheels>
            <Wheel items={MONTHS} index={data.m} onChange={(m) => set({ m })} />
            <Wheel key={dim} items={Array.from({ length: dim }, (_, i) => String(i + 1))} index={day} onChange={(d) => set({ d })} />
            <Wheel items={YEARS.map(String)} index={data.yi} onChange={(yi) => set({ yi })} />
          </Wheels>
        </>)}

        {step === 5 && (<>
          <p className="text-[15px] leading-6 text-[#625C56]">{TEXT.time.intro}</p>
          <p className="mt-3 text-base font-semibold">{TEXT.time.title}</p>
          <div className={data.unknown ? "opacity-40" : ""}>
            <Wheels>
              <Wheel items={HOURS} index={data.h} onChange={(h) => set({ h, unknown: false })} />
              <Wheel items={MINS} index={data.mi} onChange={(mi) => set({ mi, unknown: false })} />
              <Wheel items={["AM", "PM"]} index={data.ap} onChange={(ap) => set({ ap, unknown: false })} />
            </Wheels>
          </div>
          <button type="button" onClick={() => set({ unknown: !data.unknown })}
            className={`mx-auto mt-4 text-xs font-semibold tracking-widest ${data.unknown ? "text-[#A95F35]" : "text-[#625C56]"}`}>
            {data.unknown ? "✓ " : ""}{TEXT.time.unknown}
          </button>
        </>)}

        {step === 6 && (<>
          <p className="text-[15px] leading-6 text-[#625C56]">{TEXT.place.intro}</p>
          <p className="mt-3 text-base font-semibold">{TEXT.place.title}</p>
          <button type="button" onClick={() => { setQ(data.place?.label ?? ""); setMapPlace(data.place); setSearching(true); }}
            className={`mt-4 w-full border-b border-[#D7C9BC] pb-2 text-left font-display text-3xl ${data.place ? "text-[#171717]" : "text-[#B7AEA6]"}`}>
            {data.place ? data.place.label : TEXT.place.placeholder}
          </button>
          <label className="mt-5 block text-sm text-[#625C56]">
            Referral code (optional)
            <input
              value={referralCode}
              onChange={(event) => setReferralCode(event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
              autoCapitalize="characters"
              maxLength={16}
              className="mt-2 w-full rounded-xl border border-[#D7C9BC] bg-[#F7F6F4] px-3 py-3 text-base text-[#171717] outline-none focus:border-[#D9A441]"
            />
            <span className="mt-1 block text-xs">You and your friend receive one report credit after onboarding.</span>
          </label>
        </>)}

        <div className="mt-auto pt-6">{cta(TEXT.cta, next, valid)}</div>
      </div>

      {searching && (
        <div className="absolute inset-0 z-10 flex flex-col bg-[#FFFCF8] px-6 pt-5 text-[#171717]">
          <button type="button" aria-label="Close" onClick={() => { setSearching(false); setResults([]); }} className="h-9 w-9 text-left text-xl">✕</button>
          <p className="mt-4 text-base font-semibold">{TEXT.place.title}</p>
          <div className="mt-3 flex items-center border-b border-[#D9A441]/50">
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setResults([]); }} aria-label="City"
              className="w-full bg-transparent pb-2 font-display text-3xl outline-none" />
            {q && <button type="button" aria-label="Clear" onClick={() => { setQ(""); setResults([]); }} className="pb-2 text-[#89837D]">✕</button>}
          </div>
          <div className="mt-3 shrink-0">
            <p className="mb-1 text-xs text-[#625C56]">Map par tap karein ya pin ko drag karke exact jagah chunein.</p>
            <BirthPlaceMap
              lat={mapPlace?.lat ?? null}
              lng={mapPlace?.lng ?? null}
              center={results[0] ? { lat: results[0].lat, lng: results[0].lng } : undefined}
              onPick={(lat, lng) => setMapPlace({
                label: q.trim() || "Map pin",
                lat,
                lng,
                tz: "",
              })}
            />
            {mapPlace && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-[#625C56]">
                  {mapPlace.lat.toFixed(5)}, {mapPlace.lng.toFixed(5)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    set({ place: mapPlace });
                    setSearching(false);
                    setResults([]);
                  }}
                  className="rounded-lg bg-[#101010] px-3 py-2 text-xs font-semibold text-white"
                >
                  Use this location
                </button>
              </div>
            )}
          </div>
          <ul className="mt-2 flex-1 overflow-y-auto pb-6">
            {results.map((p) => (
              <li key={`${p.label}${p.lat}`}>
                <button type="button" onClick={() => { set({ place: p }); setMapPlace(null); setSearching(false); setResults([]); }}
                  className="w-full py-3 text-left text-[15px] text-[#625C56] hover:text-[#A95F35]">{p.label}</button>
              </li>
            ))}
          </ul>
          <div className="pb-6">
            <AdvancedPlaceInput onUse={(p) => { set({ place: p }); setMapPlace(null); setSearching(false); setResults([]); }} />
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, welcome = false }: { children: ReactNode; welcome?: boolean }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F8F0E8] px-2 py-2 text-[#171717] md:px-6 md:py-8">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Mukta:wght@400;500;600&display=swap'); .font-display{font-family:'Rajdhani',sans-serif}`}</style>
      <main
        className={`relative flex min-h-[calc(100dvh-16px)] w-full flex-col overflow-x-hidden overflow-y-auto rounded-[24px] border border-[#E3D7CC] bg-[#FFFCF8] shadow-[0_16px_50px_rgba(80,54,32,0.1)] md:min-h-[min(760px,calc(100dvh-64px))] md:rounded-[30px] md:shadow-[0_28px_90px_rgba(80,54,32,0.14)] ${welcome ? "max-w-[1080px]" : "max-w-[720px]"}`}
        style={{ fontFamily: "Mukta, sans-serif" }}
      >
        <div className="relative flex flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}