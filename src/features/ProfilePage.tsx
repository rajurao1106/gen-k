"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { KundaliProfile } from "../types";
import { getUserKundaliProfile, saveUserKundaliProfile } from "../lib/storage";
import { getActivePhoneNumber, logoutLocalAccount } from "../lib/localAccount";

type Place = { label: string; lat: number; lng: number; tz: string };
type GeoResult = { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string };
type OnboardingDetails = { status?: string; timeUnknown?: boolean; lat?: number; lng?: number; timezone?: string };

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<KundaliProfile | null>(null);
  const [dob, setDob] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [details, setDetails] = useState<OnboardingDetails>({});
  const [placeQuery, setPlaceQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchError, setSearchError] = useState("");
  const [language, setLanguage] = useState("en");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const current = getUserKundaliProfile();
      if (!current) {
        router.replace("/start");
        return;
      }
      setProfile(current);
      setDob(current.dob);
      setBirthTime(current.bot);
      setGender(current.gender);
      setPlaceQuery(current.bop);
      setPhone(getActivePhoneNumber() ?? "");
      const stored = JSON.parse(localStorage.getItem("genk_onboarding") || "{}") as OnboardingDetails;
      setDetails(stored);
      setStatus(stored.status ?? "");
      setUnknownTime(stored.timeUnknown === true);
      setLanguage(localStorage.getItem("ai_friend_language") === "hi" ? "hi" : "en");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Profile load nahi ho saka.");
    }
  }, [router]);

  useEffect(() => {
    if (!profile || !placeQuery.trim() || placeQuery.trim() === profile.bop || selectedPlace) {
      setPlaces([]);
      return;
    }
    if (placeQuery.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchError("");
      try {
        const response = await fetch(
          "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(placeQuery.trim()) + "&count=6&language=en&format=json",
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Place search abhi kaam nahi kar raha.");
        const result = await response.json() as { results?: GeoResult[] };
        setPlaces((result.results ?? []).map((place) => ({
          label: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
          lat: place.latitude,
          lng: place.longitude,
          tz: place.timezone ?? "",
        })));
      } catch (searchFailure) {
        if (searchFailure instanceof DOMException && searchFailure.name === "AbortError") return;
        setSearchError(searchFailure instanceof Error ? searchFailure.message : "Place search fail ho gaya.");
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [placeQuery, profile, selectedPlace]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setError("");
    setSaved(false);
    if (placeQuery.trim() !== profile.bop && !selectedPlace) {
      setError("Naye birth place ko search result se select karein.");
      return;
    }
    const nextProfile: KundaliProfile = {
      ...profile,
      name: profile.name.trim(),
      dob,
      bot: unknownTime ? "12:00" : birthTime,
      bop: selectedPlace?.label ?? profile.bop,
      gender,
    };
    if (!nextProfile.name || !nextProfile.dob || (!unknownTime && !nextProfile.bot)) {
      setError("Naam, janm-tithi aur janm-samay bharna zaroori hai.");
      return;
    }
    try {
      saveUserKundaliProfile(nextProfile);
      const nextDetails = {
        ...details,
        status,
        timeUnknown: unknownTime,
        ...(selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng, timezone: selectedPlace.tz } : {}),
      };
      localStorage.setItem("genk_onboarding", JSON.stringify(nextDetails));
      setProfile(nextProfile);
      setDetails(nextDetails);
      setSelectedPlace(null);
      setPlaceQuery(nextProfile.bop);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Profile save nahi ho saka.");
    }
  };

  const changeLanguage = (value: string) => {
    try {
      localStorage.setItem("ai_friend_language", value);
      setLanguage(value);
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Setting save nahi ho saki.");
    }
  };

  const logout = () => {
    try {
      logoutLocalAccount();
      router.replace("/account");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Logout nahi ho saka; data save nahi hua.");
    }
  };

  if (!profile) return null;

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 pb-6 text-[#f9f3eb]">
      <section className="rounded-3xl border border-[#f2c36b]/30 bg-[#10273d] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#f2c36b]">Account profile</p>
            <h1 className="mt-1 font-display text-2xl font-bold">Aapki details</h1>
          </div>
          <button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-[#f2c36b]/30 px-3 py-2 text-sm text-[#f9e6b2]">Home</button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm text-[#f9e6b2]">Naam<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3 text-base text-white" /></label>
          <label className="block text-sm text-[#f9e6b2]">Janm-tithi<input id="profile-dob" type="date" value={dob} onChange={(event) => setDob(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3 text-base text-white" /></label>
          <label className="block text-sm text-[#f9e6b2]">Janm-samay<input id="profile-time" type="time" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} disabled={unknownTime} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3 text-base text-white disabled:opacity-50" /></label>
          <label className="flex items-center gap-2 text-sm text-[#c9d8ed]"><input type="checkbox" checked={unknownTime} onChange={(event) => setUnknownTime(event.target.checked)} />Janm-samay maloom nahi hai</label>
          <label className="block text-sm text-[#f9e6b2]">Janm-sthan<input value={placeQuery} onChange={(event) => { setPlaceQuery(event.target.value); setSelectedPlace(null); setSaved(false); }} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3 text-base text-white" /></label>
          {places.length > 0 && <ul className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#0a1a2e]">{places.map((place) => <li key={place.label + place.lat}><button type="button" onClick={() => { setSelectedPlace(place); setPlaceQuery(place.label); setPlaces([]); }} className="w-full px-3 py-2 text-left text-sm hover:bg-white/10">{place.label}</button></li>)}</ul>}
          {searchError && <p role="alert" className="text-sm text-[#ffd1c9]">{searchError}</p>}
          <label className="block text-sm text-[#f9e6b2]">Gender<select id="profile-gender" value={gender} onChange={(event) => setGender(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3 text-base text-white"><option value="">Select</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label>
          <label className="block text-sm text-[#f9e6b2]">Relationship status<input value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3 text-base text-white" /></label>
          {error && <p role="alert" className="rounded-lg border border-[#ef9f90]/40 bg-[#ef9f90]/10 px-3 py-2 text-sm text-[#ffd1c9]">{error}</p>}
          {saved && <p role="status" className="text-sm text-[#a9e6b4]">Profile save ho gaya.</p>}
          <button type="submit" className="w-full rounded-xl bg-[#f2c36b] px-4 py-3 font-semibold text-[#0b1324]">Save details</button>
        </form>
      </section>

      <section className="rounded-3xl border border-[#f2c36b]/30 bg-[#10273d] p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Settings</h2>
        <label className="mt-4 block text-sm text-[#f9e6b2]">AI Friend language<select value={language} onChange={(event) => changeLanguage(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3 text-base text-white"><option value="en">English</option><option value="hi">Hindi</option></select></label>
        <p className="mt-4 text-sm text-[#c9d8ed]">Mobile: {phone}</p>
        <p className="mt-2 text-xs leading-5 text-[#a6bddb]">Local-only account: number OTP se verify nahi hua. Aapka data is browser mein phone number ke account ke andar save hota hai. Logout par data device par rehta hai aur dobara usi number se continue karne par restore hoga.</p>
        <button type="button" onClick={logout} className="mt-5 w-full rounded-xl border border-[#ef9f90]/50 px-4 py-3 font-semibold text-[#ffd1c9] hover:bg-[#ef9f90]/10">Logout</button>
      </section>
    </main>
  );
}
