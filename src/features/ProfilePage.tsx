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
  const [editing, setEditing] = useState(false);

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
      setEditing(false);
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

  const beginEditing = () => {
    setSaved(false);
    setError("");
    setEditing(true);
  };

  const cancelEditing = () => {
    try {
      const current = getUserKundaliProfile();
      if (current) {
        setProfile(current);
        setDob(current.dob);
        setBirthTime(current.bot);
        setGender(current.gender);
        setPlaceQuery(current.bop);
      }
      const stored = JSON.parse(localStorage.getItem("genk_onboarding") || "{}") as OnboardingDetails;
      setDetails(stored);
      setStatus(stored.status ?? "");
      setUnknownTime(stored.timeUnknown === true);
      setSelectedPlace(null);
      setPlaces([]);
      setError("");
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Profile reset nahi ho saka.");
    }
    setEditing(false);
  };

  if (!profile) return null;

  return (
    <main className="-mx-4 -mt-4 min-h-[calc(100svh-4rem)] w-[calc(100%+2rem)] bg-[#071a2a] px-5 pb-32 pt-6 text-[#f9f3eb] sm:mx-auto sm:mt-0 sm:min-h-0 sm:w-full sm:max-w-xl sm:rounded-3xl sm:px-7 sm:py-7 sm:shadow-xl">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">My profile</h1>
        {/* <button type="button" onClick={() => editing ? cancelEditing() : beginEditing()} aria-label={editing ? "Cancel profile editing" : "Edit profile"} className="grid h-10 w-10 place-items-center rounded-full bg-[#f2c36b]/15 text-[#f2c36b] transition hover:bg-[#f2c36b]/25">
          {editing ? <span aria-hidden="true" className="text-xl leading-none">×</span> : <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>}
        </button> */}
      </header>

      <section className="mb-6 flex flex-col items-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-[#f2c36b]/15 text-3xl font-semibold text-[#f2c36b]">{profile.name.trim().charAt(0).toUpperCase()}</div>
        <h2 className="mt-2 text-lg font-semibold">{profile.name}</h2>
        <p className="mt-0.5 text-sm text-[#a6bddb]">{phone}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#f2c36b]"><span aria-hidden="true">✦</span> Kundali profile</p>
      </section>

      {editing ? (
        <section className="mb-5 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <h2 className="mb-4 text-sm font-semibold">Personal details</h2>
          <form onSubmit={save} className="space-y-3">
            <label className="block text-xs font-medium text-[#f9e6b2]">Name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#10273d] px-3 py-3 text-sm text-[#f9f3eb] outline-none focus:border-[#f2c36b]" /></label>
            <label className="block text-xs font-medium text-[#f9e6b2]">Date of birth<input id="profile-dob" type="date" value={dob} onChange={(event) => setDob(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#10273d] px-3 py-3 text-sm text-[#f9f3eb] outline-none focus:border-[#f2c36b]" /></label>
            <label className="block text-xs font-medium text-[#f9e6b2]">Time of birth<input id="profile-time" type="time" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} disabled={unknownTime} className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#10273d] px-3 py-3 text-sm text-[#f9f3eb] outline-none focus:border-[#f2c36b] disabled:opacity-50" /></label>
            <label className="flex items-center gap-2 text-sm text-[#f9e6b2]"><input type="checkbox" checked={unknownTime} onChange={(event) => setUnknownTime(event.target.checked)} />Birth time is unknown</label>
            <label className="block text-xs font-medium text-[#f9e6b2]">Place of birth<input value={placeQuery} onChange={(event) => { setPlaceQuery(event.target.value); setSelectedPlace(null); setSaved(false); }} className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#10273d] px-3 py-3 text-sm text-[#f9f3eb] outline-none focus:border-[#f2c36b]" /></label>
            {places.length > 0 && <ul className="max-h-40 overflow-y-auto rounded-xl border border-white/15 bg-[#10273d]">{places.map((place) => <li key={place.label + place.lat}><button type="button" onClick={() => { setSelectedPlace(place); setPlaceQuery(place.label); setPlaces([]); }} className="w-full px-3 py-2.5 text-left text-sm hover:bg-white/10">{place.label}</button></li>)}</ul>}
            {searchError && <p role="alert" className="text-sm text-[#ffd1c9]">{searchError}</p>}
            <label className="block text-xs font-medium text-[#f9e6b2]">Gender<select id="profile-gender" value={gender} onChange={(event) => setGender(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#10273d] px-3 py-3 text-sm text-[#f9f3eb] scheme-dark"><option value="">Select</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label>
            <label className="block text-xs font-medium text-[#f9e6b2]">Relationship status<input value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#10273d] px-3 py-3 text-sm text-[#f9f3eb] scheme-dark" /></label>
            {error && <p role="alert" className="text-sm text-[#ffd1c9]">{error}</p>}
            {saved && <p role="status" className="text-sm text-[#a9e6b4]">Profile saved.</p>}
            <button type="submit" className="w-full rounded-xl bg-[#f2c36b] px-4 py-3 text-sm font-semibold text-[#0b1324] transition hover:bg-[#ffda91]">Save changes</button>
          </form>
        </section>
      ) : (
        <section className="mb-5 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Birth details</h2><button type="button" onClick={beginEditing} className="text-xs font-semibold text-[#f2c36b]">Edit</button></div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><dt className="text-[11px] text-[#a6bddb]">Date of birth</dt><dd className="mt-0.5 text-xs font-medium">{dob}</dd></div>
            <div><dt className="text-[11px] text-[#a6bddb]">Time of birth</dt><dd className="mt-0.5 text-xs font-medium">{unknownTime ? "Unknown" : birthTime}</dd></div>
            <div className="col-span-2"><dt className="text-[11px] text-[#a6bddb]">Place of birth</dt><dd className="mt-0.5 text-xs font-medium">{profile.bop}</dd></div>
            <div><dt className="text-[11px] text-[#a6bddb]">Gender</dt><dd className="mt-0.5 text-xs font-medium">{gender || "Not set"}</dd></div>
            <div><dt className="text-[11px] text-[#a6bddb]">Relationship</dt><dd className="mt-0.5 text-xs font-medium">{status || "Not set"}</dd></div>
          </dl>
          {saved && <p role="status" className="mt-3 text-xs font-medium text-[#a9e6b4]">Profile saved.</p>}
        </section>
      )}

      <section className="space-y-2.5">
        <h2 className="px-1 pb-0.5 text-sm font-semibold">Settings</h2>
        <label className="flex items-center gap-3 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#5fa9d0]/15 text-[#82c6e8]" aria-hidden="true">文</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">AI Friend language</span><span className="mt-0.5 block text-xs text-[#a6bddb]">Choose your preferred language</span></span>
          <select aria-label="AI Friend language" value={language} onChange={(event) => changeLanguage(event.target.value)} className="max-w-24 bg-transparent text-right text-xs text-[#c9d8ed] outline-none scheme-dark"><option value="en">English</option><option value="hi">Hindi</option></select>
        </label>
        <div className="flex items-center gap-3 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#b994dc]/15 text-[#c9a8ed]" aria-hidden="true">☎</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Mobile number</span><span className="mt-0.5 block text-xs text-[#a6bddb]">{phone}</span></span><span className="text-xs text-[#a6bddb]">Local</span>
        </div>
        <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-2xl border border-[#ef9f90]/30 bg-[#10273d] px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:bg-[#ef9f90]/10">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ef9f90]/15 text-[#ef9f90]" aria-hidden="true">↪</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-[#ffd1c9]">Log out</span><span className="mt-0.5 block text-xs text-[#a6bddb]">Your saved data stays on this browser</span></span><span aria-hidden="true" className="text-lg text-[#a6bddb]">›</span>
        </button>
        <p className="px-1 pt-1 text-[11px] leading-4 text-[#a6bddb]">This phone-only account is not verified by OTP. Your account data is stored in this browser and will be restored when you continue with the same number.</p>
        {error && !editing && <p role="alert" className="px-1 text-sm text-[#ffd1c9]">{error}</p>}
      </section>
    </main>
  );
}