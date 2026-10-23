"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { KundaliProfile } from "../types";
import { saveUserKundaliProfile } from "../lib/storage";
import { useAuth } from "../lib/useAuth";
import {
  deleteMyAccount,
  fetchMyProfiles,
  saveUserDetail,
  updateUserDetail,
  type UserDetailRecord,
} from "../lib/api";

type Place = { label: string; lat: number; lng: number; tz: string };
type GeoResult = { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string };
type OnboardingDetails = { status?: string; timeUnknown?: boolean; lat?: number; lng?: number; timezone?: string };

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout: logoutAccount } = useAuth();
  const [profile, setProfile] = useState<KundaliProfile | null>(null);
  const [profileRecord, setProfileRecord] = useState<UserDetailRecord | null>(null);
  const [dob, setDob] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("");
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
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetchMyProfiles().then((records) => {
      if (!active) return;
      const currentRecord = records.find((record) =>
        record.fullName && record.dateOfBirth && record.timeOfBirth && record.placeOfBirth,
      );
      if (!currentRecord) {
        router.replace("/start");
        return;
      }
      const current: KundaliProfile = {
        name: currentRecord.fullName!,
        dob: currentRecord.dateOfBirth!,
        bot: currentRecord.timeOfBirth!,
        bop: currentRecord.placeOfBirth!,
        gender: currentRecord.gender || "",
        recordId: currentRecord._id,
      };
      setProfileRecord(currentRecord);
      setProfile(current);
      setDob(current.dob);
      setBirthTime(current.bot);
      setGender(current.gender);
      setPlaceQuery(current.bop);
      const stored: OnboardingDetails = {
        status: currentRecord.relationshipStatus,
        timeUnknown: currentRecord.birthTimeUnknown,
        lat: typeof currentRecord.birthLatitude === "number" ? currentRecord.birthLatitude : undefined,
        lng: typeof currentRecord.birthLongitude === "number" ? currentRecord.birthLongitude : undefined,
        timezone: currentRecord.birthTimezone,
      };
      setDetails(stored);
      setStatus(stored.status ?? "");
      setUnknownTime(stored.timeUnknown === true);
      setLanguage(localStorage.getItem("ai_friend_language") === "hi" ? "hi" : "en");
    }).catch((loadError) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : "Profile load nahi ho saka.");
    });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!profile || !placeQuery.trim() || placeQuery.trim() === profile.bop || selectedPlace) {
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

  const visiblePlaces =
    profile &&
    placeQuery.trim().length >= 2 &&
    placeQuery.trim() !== profile.bop &&
    !selectedPlace
      ? places
      : [];

  const save = async (event: FormEvent<HTMLFormElement>) => {
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
      const nextDetails = {
        ...details,
        status,
        timeUnknown: unknownTime,
        ...(selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng, timezone: selectedPlace.tz } : {}),
      };
      const payload = {
        fullName: nextProfile.name,
        dateOfBirth: nextProfile.dob,
        timeOfBirth: nextProfile.bot,
        placeOfBirth: nextProfile.bop,
        gender: nextProfile.gender,
        relationshipStatus: status,
        birthTimeUnknown: unknownTime,
        ...(typeof nextDetails.lat === "number" ? { birthLatitude: nextDetails.lat } : {}),
        ...(typeof nextDetails.lng === "number" ? { birthLongitude: nextDetails.lng } : {}),
        ...(nextDetails.timezone ? { birthTimezone: nextDetails.timezone } : {}),
      };
      const savedRecord = profileRecord?._id
        ? await updateUserDetail(profileRecord._id, payload)
        : await saveUserDetail(payload);
      if (!savedRecord) throw new Error("Profile save failed.");
      nextProfile.recordId = savedRecord._id;
      setProfileRecord(savedRecord);
      saveUserKundaliProfile(nextProfile);
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
    void logoutAccount().then(() => {
      router.replace("/account");
    }).catch((logoutError) => {
      setError(logoutError instanceof Error ? logoutError.message : "Logout nahi ho saka; data save nahi hua.");
    });
  };

  const removeAccount = async () => {
    if (deletingAccount || !window.confirm("Delete your account and associated data? This cannot be undone.")) return;
    setDeletingAccount(true);
    setError("");
    try {
      await deleteMyAccount();
      await logoutAccount();
      router.replace("/account");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Account deletion could not be completed.");
      setDeletingAccount(false);
    }
  };

  const beginEditing = () => {
    setSaved(false);
    setError("");
    setEditing(true);
  };

  if (!profile) {
    return (
      <main className="mx-auto max-w-xl rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] p-5 text-[#f9f3eb]">
        {error ? <p role="alert" className="text-sm text-[#ffd1c9]">{error}</p> : <p role="status" className="text-sm text-[#c9d8ed]">Loading profile…</p>}
      </main>
    );
  }

  return (
    <main className="-mx-4 -mt-4 min-h-[calc(100svh-4rem)] w-[calc(100%+2rem)] bg-[#071a2a] px-5 pb-32 pt-6 text-[#f9f3eb] sm:mx-auto sm:mt-0 sm:min-h-0 sm:w-full sm:max-w-xl sm:rounded-3xl sm:px-7 sm:py-7 sm:shadow-xl">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">My profile</h1>
        {/*         {/* <button type="button" onClick={beginEditing} aria-label="Edit profile" className="grid h-10 w-10 place-items-center rounded-full bg-[#f2c36b]/15 text-[#f2c36b] transition hover:bg-[#f2c36b]/25">
          <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
        </button> */}
      </header>

      <section className="mb-6 flex flex-col items-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-[#f2c36b]/15 text-3xl font-semibold text-[#f2c36b]">{profile.name.trim().charAt(0).toUpperCase()}</div>
        <h2 className="mt-2 text-lg font-semibold">{profile.name}</h2>
        <p className="mt-0.5 text-sm text-[#a6bddb]">{user?.phone}</p>
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
            {visiblePlaces.length > 0 && <ul className="max-h-40 overflow-y-auto rounded-xl border border-white/15 bg-[#10273d]">{visiblePlaces.map((place) => <li key={place.label + place.lat}><button type="button" onClick={() => { setSelectedPlace(place); setPlaceQuery(place.label); setPlaces([]); }} className="w-full px-3 py-2.5 text-left text-sm hover:bg-white/10">{place.label}</button></li>)}</ul>}
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
        {user?.referralCode && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Your referral code</span>
              <span className="mt-0.5 block text-xs text-[#a6bddb]">Share it with a friend; both accounts get one report credit after onboarding.</span>
              <strong className="mt-1 block tracking-[0.18em] text-[#f2c36b]">{user.referralCode}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(user.referralCode).then(() => setReferralCopied(true))
                  .catch((copyError: unknown) => setError(copyError instanceof Error ? copyError.message : "Could not copy the referral code."));
              }}
              className="rounded-lg border border-[#f2c36b]/30 px-3 py-2 text-xs text-[#f2c36b]"
            >
              {referralCopied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        <label className="flex items-center gap-3 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#5fa9d0]/15 text-[#82c6e8]" aria-hidden="true">文</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">AI Friend language</span><span className="mt-0.5 block text-xs text-[#a6bddb]">Choose your preferred language</span></span>
          <select aria-label="AI Friend language" value={language} onChange={(event) => changeLanguage(event.target.value)} className="max-w-24 bg-transparent text-right text-xs text-[#c9d8ed] outline-none scheme-dark"><option value="en">English</option><option value="hi">Hindi</option></select>
        </label>
        <div className="flex items-center gap-3 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#b994dc]/15 text-[#c9a8ed]" aria-hidden="true">☎</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Mobile number</span><span className="mt-0.5 block text-xs text-[#a6bddb]">{user?.phone}</span></span><span className="text-xs text-[#a6bddb]">Verified</span>
        </div>
        <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-2xl border border-[#ef9f90]/30 bg-[#10273d] px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:bg-[#ef9f90]/10">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ef9f90]/15 text-[#ef9f90]" aria-hidden="true">↪</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-[#ffd1c9]">Log out</span><span className="mt-0.5 block text-xs text-[#a6bddb]">Your account data stays available after sign-in</span></span><span aria-hidden="true" className="text-lg text-[#a6bddb]">›</span>
        </button>
        <button
          type="button"
          onClick={() => void removeAccount()}
          disabled={deletingAccount}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#ef9f90]/30 bg-[#10273d] px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:bg-[#ef9f90]/10 disabled:opacity-50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ef9f90]/15 text-[#ef9f90]" aria-hidden="true">×</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-[#ffd1c9]">
              {deletingAccount ? "Deleting account…" : "Delete my account and data"}
            </span>
            <span className="mt-0.5 block text-xs text-[#a6bddb]">Profiles, guides, reports and saved voices will be removed.</span>
          </span>
        </button>
        {user?.role === "admin" && process.env.NODE_ENV !== "production" && (
          <button
            type="button"
            onClick={() => router.push("/dev-tools")}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] px-3.5 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Developer tools</span>
              <span className="mt-0.5 block text-xs text-[#a6bddb]">Admin-only test controls</span>
            </span>
            <span aria-hidden="true" className="text-lg text-[#a6bddb]">›</span>
          </button>
        )}
        <p className="px-1 pt-1 text-[11px] leading-4 text-[#a6bddb]">Your profile and saved readings are stored with your account. Sign in again with this verified number to access them.</p>
        {error && !editing && <p role="alert" className="px-1 text-sm text-[#ffd1c9]">{error}</p>}
      </section>
    </main>
  );
}