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
  if (IMAGES[key]) return <img src={IMAGES[key]} alt="" className="mx-auto h-full object-contain" />;
  const kind = ART[key];
  return (
    <svg viewBox="0 0 120 100" className="mx-auto h-full" fill="none" stroke="#f2c36b" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      {kind === "moon" && (<><path d="M72 18a30 30 0 1 0 24 46A26 26 0 0 1 72 18Z" /><path d="M22 26v8M18 30h8M98 22v6M95 25h6M30 78v6M27 81h6" /></>)}
      {kind === "constellation" && (<><path d="M20 72l24-22 16 10 26-32 14 14" />{[[20, 72], [44, 50], [60, 60], [86, 28], [100, 42]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.6" fill="#f2c36b" />)}</>)}
      {kind === "globe" && (<><circle cx="60" cy="50" r="28" /><ellipse cx="60" cy="50" rx="12" ry="28" /><path d="M32 50h56M36 34h48M36 66h48" /></>)}
      {kind === "hearts" && (<><path d="M44 66c-16-11-16-28-4-28 6 0 4 6 4 6s-2-6 4-6c12 0 12 17-4 28Z" /><path d="M84 50c-10-7-10-17-3-17 4 0 3 4 3 4s-1-4 3-4c7 0 7 10-3 17Z" /><path d="M20 30v8M16 34h8M98 74v6M95 77h6" /></>)}
    </svg>
  );
}

function Intro({ text, name }: { text: string; name: string }) {
  const parts = text.split("{name}");
  return (
    <p className="text-[15px] leading-6 text-[#aeb6c5]">
      {parts.map((p, i) => (
        <span key={i}>{p}{i < parts.length - 1 && <b className="text-[#f2c36b]">{name}</b>}</span>
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
        <div key={i} className={`flex h-10 snap-center items-center justify-center text-lg ${i === index ? "font-semibold text-[#f6f0e6]" : "text-[#6f7c91]"}`}>{t}</div>
      ))}
      <div style={{ height: 60 }} />
    </div>
  );
}

function Wheels({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-4 flex gap-2">
      {children}
      <div className="pointer-events-none absolute inset-x-0 top-[60px] h-10 border-y border-[#f2c36b]/30" />
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
      {error && <p role="alert" className="mb-3 rounded-xl border border-[#ef9f90]/30 bg-[#ef9f90]/10 px-3 py-2 text-sm text-[#ffd1c9]">{error}</p>}
      <button type="button" onClick={onClick} disabled={!enabled || saving}
        className="w-full rounded-2xl bg-[#f2c36b] py-4 font-display text-base font-bold tracking-wide text-[#17130c] transition hover:bg-[#ffda91] disabled:bg-[#f2c36b]/20 disabled:text-[#f2c36b]/45">
        {saving ? "Saving…" : `${label} →`}
      </button>
    </>
  );
  const option = (label: string, selected: boolean, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-[15px] transition ${selected ? "border-[#f2c36b] bg-[#f2c36b]/10 text-[#f6f0e6]" : "border-[#f2c36b]/20 bg-[#10273d]/70 text-[#d5d9e2] hover:border-[#f2c36b]/50"}`}>
      {label}{selected && <span className="text-[#f2c36b]" aria-hidden="true">✓</span>}
    </button>
  );

  if (step === 0) {
    const w = TEXT.welcome;
    return (
      <Shell>
        <div className="h-52 pt-10"><Art step={0} /></div>
        <div className="mt-6 flex flex-1 flex-col px-6 pb-6 text-center">
          <h1 className="font-display text-[30px] font-bold leading-tight">{w.title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#aeb6c5]">{w.subtitle}</p>
          <div className="mt-auto pt-8">{cta(w.cta, () => setStep(1))}</div>
          <p className="mt-4 text-[11px] leading-4 text-[#858e9d]">
            {w.legalPre} <Link href={w.privacyHref} className="text-[#f2c36b]">{w.privacy}</Link>{w.legalMid}{" "}
            <Link href={w.termsHref} className="text-[#f2c36b]">{w.terms}</Link>.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="flex items-center justify-between px-5 pt-5">
        <button type="button" aria-label="Back" onClick={() => setStep(step - 1)} className="h-9 w-9 text-xl text-[#f6f0e6]">←</button>
        <div className="flex gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((n) => <span key={n} className={`h-1 w-4 rounded-full ${n <= step ? "bg-[#f2c36b]" : "bg-white/15"}`} />)}
        </div>
        {step === 3 ? (
          <button type="button" onClick={() => { set({ status: "" }); setStep(4); }} className="text-[10px] font-semibold tracking-wide text-[#f2c36b]">{TEXT.status.skip}</button>
        ) : <span className="w-9" />}
      </header>
      <div className="h-28 pt-3"><Art step={step} /></div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
        {step === 1 && (<>
          <p className="text-[15px] text-[#aeb6c5]">{TEXT.name.intro}</p>
          <label htmlFor="ob-name" className="mt-1 block text-base font-semibold">{TEXT.name.title}</label>
          <input id="ob-name" autoFocus value={data.name} onChange={(e) => set({ name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && valid && next()} placeholder={TEXT.name.placeholder}
            className="mt-4 w-full border-b border-[#f2c36b]/30 bg-transparent pb-2 font-display text-3xl outline-none placeholder:text-[#f6f0e6]/20 focus:border-[#f2c36b]" />
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
          <p className="mt-3 text-[11px] text-[#858e9d]">{TEXT.status.note}</p>
        </>)}

        {step === 4 && (<>
          <p className="text-[15px] leading-6 text-[#aeb6c5]">{TEXT.dob.intro}</p>
          <p className="mt-3 text-base font-semibold">{TEXT.dob.title}</p>
          <Wheels>
            <Wheel items={MONTHS} index={data.m} onChange={(m) => set({ m })} />
            <Wheel key={dim} items={Array.from({ length: dim }, (_, i) => String(i + 1))} index={day} onChange={(d) => set({ d })} />
            <Wheel items={YEARS.map(String)} index={data.yi} onChange={(yi) => set({ yi })} />
          </Wheels>
        </>)}

        {step === 5 && (<>
          <p className="text-[15px] leading-6 text-[#aeb6c5]">{TEXT.time.intro}</p>
          <p className="mt-3 text-base font-semibold">{TEXT.time.title}</p>
          <div className={data.unknown ? "opacity-40" : ""}>
            <Wheels>
              <Wheel items={HOURS} index={data.h} onChange={(h) => set({ h, unknown: false })} />
              <Wheel items={MINS} index={data.mi} onChange={(mi) => set({ mi, unknown: false })} />
              <Wheel items={["AM", "PM"]} index={data.ap} onChange={(ap) => set({ ap, unknown: false })} />
            </Wheels>
          </div>
          <button type="button" onClick={() => set({ unknown: !data.unknown })}
            className={`mx-auto mt-4 text-xs font-semibold tracking-widest ${data.unknown ? "text-[#f2c36b]" : "text-[#d5d9e2]"}`}>
            {data.unknown ? "✓ " : ""}{TEXT.time.unknown}
          </button>
        </>)}

        {step === 6 && (<>
          <p className="text-[15px] leading-6 text-[#aeb6c5]">{TEXT.place.intro}</p>
          <p className="mt-3 text-base font-semibold">{TEXT.place.title}</p>
          <button type="button" onClick={() => { setQ(data.place?.label ?? ""); setMapPlace(data.place); setSearching(true); }}
            className={`mt-4 w-full border-b border-[#f2c36b]/30 pb-2 text-left font-display text-3xl ${data.place ? "text-[#f6f0e6]" : "text-[#f6f0e6]/20"}`}>
            {data.place ? data.place.label : TEXT.place.placeholder}
          </button>
          <label className="mt-5 block text-sm text-[#aeb6c5]">
            Referral code (optional)
            <input
              value={referralCode}
              onChange={(event) => setReferralCode(event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
              autoCapitalize="characters"
              maxLength={16}
              className="mt-2 w-full rounded-xl border border-[#f2c36b]/30 bg-[#071a2a] px-3 py-3 text-base text-[#f6f0e6] outline-none focus:border-[#f2c36b]"
            />
            <span className="mt-1 block text-xs">You and your friend receive one report credit after onboarding.</span>
          </label>
        </>)}

        <div className="mt-auto pt-6">{cta(TEXT.cta, next, valid)}</div>
      </div>

      {searching && (
        <div className="absolute inset-0 z-10 flex flex-col bg-[#071a2a] px-6 pt-5">
          <button type="button" aria-label="Close" onClick={() => { setSearching(false); setResults([]); }} className="h-9 w-9 text-left text-xl">✕</button>
          <p className="mt-4 text-base font-semibold">{TEXT.place.title}</p>
          <div className="mt-3 flex items-center border-b border-[#f2c36b]/40">
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setResults([]); }} aria-label="City"
              className="w-full bg-transparent pb-2 font-display text-3xl outline-none" />
            {q && <button type="button" aria-label="Clear" onClick={() => { setQ(""); setResults([]); }} className="pb-2 text-[#858e9d]">✕</button>}
          </div>
          <div className="mt-3 shrink-0">
            <p className="mb-1 text-xs text-[#aeb6c5]">Map par tap karein ya pin ko drag karke exact jagah chunein.</p>
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
                <p className="text-xs text-[#c9d8ed]">
                  {mapPlace.lat.toFixed(5)}, {mapPlace.lng.toFixed(5)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    set({ place: mapPlace });
                    setSearching(false);
                    setResults([]);
                  }}
                  className="rounded-lg bg-[#f2c36b] px-3 py-2 text-xs font-semibold text-[#17130c]"
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
                  className="w-full py-3 text-left text-[15px] text-[#d5d9e2] hover:text-[#ffda91]">{p.label}</button>
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

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] justify-center bg-[#050e18] text-[#f6f0e6]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Mukta:wght@400;500;600&display=swap'); .font-display{font-family:'Rajdhani',sans-serif}`}</style>
      <main className="relative flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[linear-gradient(180deg,#1b2a40_0%,#0c1d2f_35%,#071a2a_100%)] sm:border-x sm:border-white/10" style={{ fontFamily: "Mukta, sans-serif" }}>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#f2c36b]/10 blur-[90px]" />
        <div className="relative flex flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}