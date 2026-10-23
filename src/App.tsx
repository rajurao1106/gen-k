"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { CurvedBottomNav as BottomNav } from "./components/CurvedBottomNav";
import DashboardHome from "./components/DashboardHome";
import type { PageKey } from "./types";
import KundaliPage from "./features/KundaliPage";
import KundaliMilanPage from "./features/KundaliMilanPage";
import NumerologyPage from "./features/NumerologyPage";
import MahadashaPage from "./features/MahadashaPage";
import LoginPage from "./features/LoginPage";
import UserDataPage from "./features/UserDataPage";
import AIFriendPage from "./features/AIFriendPage";
import AccountLoginPage from "./features/AccountLoginPage";
import ProfilePage from "./features/ProfilePage";
import PlansPage from "./features/PlansPage";
import Onboarding from "./components/Onboarding";
import { useAuth } from "./lib/useAuth";
import { fetchMyProfiles, type UserDetailRecord } from "./lib/api";
import { getKundaliProfileId } from "./lib/storage";

const PAGE_TITLES: Record<PageKey, { hi: string; sub: string }> = {
  home: { hi: "Home", sub: "Introduction & quick access" },
  kundali: { hi: "कुंडली", sub: "Personalized life reading" },
  "ai-friend": { hi: "AI Friend", sub: "Your personal voice companion" },
  milan: { hi: "कुंडली मिलान", sub: "Ashtakoot compatibility match" },
  numerology: { hi: "न्यूमरोलॉजी", sub: "Name & birth-number reading" },
  mahadasha: { hi: "महादशा", sub: "Vimshottari dasha timeline & outlook" },
  profile: { hi: "Profile", sub: "Your details and settings" },
  plans: { hi: "Plans", sub: "Plans, access and billing" },
};

const PAGE_ROUTES: Record<PageKey, string> = {
  home: "/dashboard",
  kundali: "/kundali",
  "ai-friend": "/ai-friend",
  milan: "/milan",
  numerology: "/numerology",
  mahadasha: "/mahadasha",
  profile: "/profile",
  plans: "/plans",
};

function toKundaliProfile(record: UserDetailRecord) {
  if (!record.fullName || !record.dateOfBirth || !record.timeOfBirth || !record.placeOfBirth) {
    return null;
  }
  return {
    name: record.fullName,
    dob: record.dateOfBirth,
    bot: record.timeOfBirth,
    bop: record.placeOfBirth,
    gender: record.gender || "",
    recordId: record._id,
  };
}

function KundaliExperience() {
  const router = useRouter();
  const pathname = usePathname();
  const [authReady, setAuthReady] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const { user, status, error: authError } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "error") {
      // Preserve the explicit auth failure for this route.
      // oxlint-disable-next-line react/set-state-in-effect
      setProfileLoadError(authError || "Could not verify your account.");
      return;
    }
    if (!user) {
      router.replace("/account?next=" + encodeURIComponent(pathname));
      return;
    }

    let active = true;
    // Reset account-scoped profile state before loading the newly signed-in user.
    // oxlint-disable-next-line react/set-state-in-effect
    setAuthReady(false);
    setProfileLoadError("");
    fetchMyProfiles()
      .then((records) => {
        if (!active) return;
        const profilesById = new Map<string, NonNullable<ReturnType<typeof toKundaliProfile>>>();
        records.forEach((record) => {
          const profile = toKundaliProfile(record);
          if (profile && !profilesById.has(getKundaliProfileId(profile))) {
            profilesById.set(getKundaliProfileId(profile), profile);
          }
        });
        const profiles = [...profilesById.values()];
        const savedReadings = records
          .filter((record) => record.content || record.chart)
          .map((record) => ({
            _id: record._id,
            name: record.fullName || "",
            dob: record.dateOfBirth || "",
            bot: record.timeOfBirth || "",
            bop: record.placeOfBirth || "",
            gender: record.gender || "",
            content: record.content || "",
            chart: record.chart ?? null,
            createdAt: record.createdAt,
          }));
        sessionStorage.setItem("kundali", JSON.stringify(savedReadings));
        if (profiles.length) {
          sessionStorage.setItem("kundali_user_profiles", JSON.stringify(profiles));
          sessionStorage.setItem("kundali_user_profile", JSON.stringify(profiles[0]));
          const currentRecord = records.find((record) => toKundaliProfile(record) !== null);
          if (currentRecord) {
            sessionStorage.setItem("genk_onboarding", JSON.stringify({
              status: currentRecord.relationshipStatus || "",
              timeUnknown: currentRecord.birthTimeUnknown === true,
              lat: currentRecord.birthLatitude,
              lng: currentRecord.birthLongitude,
              timezone: currentRecord.birthTimezone || "",
            }));
          }
        }
        const hasProfile = profiles.length > 0;
        const isFreshOnboarding = pathname === "/start" && new URLSearchParams(window.location.search).get("new") === "1";
        if (!hasProfile && pathname !== "/start") {
          router.replace("/start");
          return;
        }
        if (hasProfile && pathname === "/start" && !isFreshOnboarding) {
          router.replace("/dashboard");
          return;
        }
        setAuthReady(true);
      })
      .catch((profileError) => {
        if (!active) return;
        setProfileLoadError(profileError instanceof Error ? profileError.message : "Could not load your profiles.");
      });

    return () => { active = false; };
  }, [authError, pathname, router, status, user]);
  const page = useMemo<PageKey>(() => {
    switch (pathname) {
      case "/milan":
        return "milan";
      case "/numerology":
        return "numerology";
      case "/mahadasha":
        return "mahadasha";
      case "/kundali":
        return "kundali";
      case "/ai-friend":
        return "ai-friend";
      case "/profile":
        return "profile";
      case "/plans":
        return "plans";
      default:
        return "home";
    }
  }, [pathname]);

  if (profileLoadError) {
    return <main role="alert" className="min-h-screen bg-[#071a2a] px-5 py-12 text-center text-[#ffd1c9]">{profileLoadError}</main>;
  }
  if (!authReady) return null;
  if (pathname === "/start") return <Onboarding />;

  return (
    <div
      id="appShell"
      className="relative min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-x-clip"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Mukta:wght@400;500;600;700&display=swap');

        :root {
          --bg-app: #071a2a;
          --bg-surface: #10273d;
          --bg-surface-strong: #153555;
          --bg-surface-soft: #1d446d;
          --bg-header: #0d2138;
          --gold: #f0c06d;
          --gold-strong: #d69b3c;
          --gold-soft: #f8e6b6;
          --text-primary: #f9f3eb;
          --text-body: #edf2fb;
          --text-muted: #c9d8ed;
          --text-subtle: #a6bddb;
          --text-dark: #081724;
          --border: rgba(240,192,109,0.34);
          --danger: #ef9f90;
        }

        .font-display { font-family: 'Rajdhani', sans-serif; letter-spacing: 0.01em; }
        .font-body { font-family: 'Mukta', sans-serif; }

        .brass-surface {
          background:
            radial-gradient(circle at 15% 20%, rgba(240,192,109,0.14), transparent 42%),
            radial-gradient(circle at 85% 80%, rgba(120,170,255,0.08), transparent 48%),
            linear-gradient(160deg, #0a1d2f 0%, #0d233b 45%, #071822 100%);
        }
        .brass-header {
          background: linear-gradient(135deg, #10273d 0%, #0d2138 52%, #0a1a2e 100%);
        }

        .prose-kundli h2 { font-family: 'Rajdhani', sans-serif; color: var(--gold); font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
        .prose-kundli h1 { font-family: 'Rajdhani', sans-serif; color: var(--text-primary); font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose-kundli h3 { color: var(--gold-soft); font-size: 1.05rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.4rem; }
        .prose-kundli p { color: var(--text-body); line-height: 1.7; margin-bottom: 0.85rem; }
        .prose-kundli ul { color: var(--text-body); margin-bottom: 0.85rem; padding-left: 1.1rem; }
        .prose-kundli li { margin-bottom: 0.35rem; }
        .prose-kundli li::marker { color: var(--gold); }
        .prose-kundli strong { color: var(--text-primary); }
        .prose-kundli table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin-bottom: 1rem; -webkit-overflow-scrolling: touch; border: 1px solid var(--border); border-radius: 8px; }
        .prose-kundli th, .prose-kundli td { border: 1px solid rgba(216,179,106,0.18); padding: 0.55rem 0.8rem; text-align: left; color: var(--text-body); white-space: nowrap; }
        .prose-kundli th { color: var(--text-dark); background: var(--gold); font-weight: 700; }
        .prose-kundli tr:nth-child(even) td { background: rgba(216,179,106,0.05); }
        .prose-kundli h1, .prose-kundli h2, .prose-kundli h3, .prose-kundli p, .prose-kundli li {
          overflow-wrap: break-word;
          word-break: break-word;
        }
        input[type="date"], input[type="time"] { color-scheme: dark; }
html, body { max-width: 100%; overflow-x: clip; }
        * { min-width: 0; }

        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html, body, #root {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
          }
          body { background: #ffffff !important; }
          #appShell {
            position: static !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .no-print { display: none !important; }

          #printArea {
            display: block !important;
            position: static !important;
            width: auto !important;
            max-width: none !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111111 !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: auto;
            break-inside: auto;
          }

          #printArea .prose-kundli {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
            color: #111111 !important;
          }

          #printArea .prose-kundli h2 { color: #8a5410; }
          #printArea .prose-kundli p,
          #printArea .prose-kundli ul,
          #printArea .prose-kundli li,
          #printArea .prose-kundli th,
          #printArea .prose-kundli td { color: #111111; }
          #printArea .prose-kundli strong { color: #000000; }
          #printArea .prose-kundli h2,
          #printArea .prose-kundli h3,
          #printArea .prose-kundli p,
          #printArea .prose-kundli ul,
          #printArea .prose-kundli li,
          #printArea table,
          #printArea th,
          #printArea td {
            break-inside: auto;
            page-break-inside: auto;
          }
          #printArea table {
            display: table !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            table-layout: auto;
          }
        }
      `}</style>

      <div className="absolute inset-0 brass-surface pointer-events-none no-print" />

      <div className="relative lg:flex lg:items-start lg:min-h-screen">
        <Sidebar
          open={false}
          onClose={() => {}}
          activePage={page}
          onNavigate={(nextPage) => router.push(PAGE_ROUTES[nextPage])}
        />

        <BottomNav
          activePage={page}
          onNavigate={(nextPage) => router.push(PAGE_ROUTES[nextPage])}
          onOpenProfile={() => router.push(PAGE_ROUTES.profile)}
        />

        <div className="min-w-0 flex-1 ">
          <header className="hidden">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
              {/* <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#f2c36b] flex items-center justify-center text-[#0b1324] font-display font-bold text-lg shrink-0">
                <img src="/logo.png" alt="" />
              </div> */}
              <div>
                {page === "home" ? (
                  <h1 className="font-display text-lg font-semibold tracking-wide text-[#f5efe6] sm:text-xl">
                    Gen-K &middot; {PAGE_TITLES[page].hi}
                  </h1>
                ) : (
                  <p className="font-display text-lg font-semibold tracking-wide text-[#f5efe6] sm:text-xl">
                    Gen-K &middot; {PAGE_TITLES[page].hi}
                  </p>
                )}
                <p className="text-[10px] sm:text-xs text-[#afbdd7] tracking-wide">
                  {PAGE_TITLES[page].sub}
                </p>
              </div>
            </div>
          </header>

          <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-4 font-body sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
            {page === "home" && <DashboardHome />}{" "}
            {page === "kundali" && <KundaliPage />}
            {page === "ai-friend" && <AIFriendPage />}
            {page === "milan" && <KundaliMilanPage />}
            {page === "numerology" && <NumerologyPage />}
            {page === "mahadasha" && <MahadashaPage />}
            {page === "profile" && <ProfilePage />}
            {page === "plans" && <PlansPage />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useAuth();

  useEffect(() => {
    if (pathname === "/user-data" && status !== "loading" && user?.role !== "admin") {
      router.replace("/login");
    }
  }, [pathname, router, status, user]);

  if (pathname === "/account") return <AccountLoginPage />;
  if (pathname === "/login") return <LoginPage />;
  if (pathname === "/user-data") {
    return status === "loading" || user?.role !== "admin" ? null : <UserDataPage />;
  }
  return <KundaliExperience />;
}
