import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { HamburgerButton, Sidebar } from "./components/Sidebar";
import type { PageKey } from "./types";
import KundaliPage from "./pages/KundaliPage";
import KundaliMilanPage from "./pages/KundaliMilanPage";
import NumerologyPage from "./pages/NumerologyPage";
import MahadashaPage from "./pages/MahadashaPage";
import LoginPage from "./pages/LoginPage";
import UserDataPage from "./pages/UserDataPage";

const PAGE_TITLES: Record<PageKey, { hi: string; sub: string }> = {
  home: { hi: "Home", sub: "Introduction & quick access" },
  kundali: { hi: "कुंडली", sub: "Personalized life reading" },
  milan: { hi: "कुंडली मिलान", sub: "Ashtakoot compatibility match" },
  numerology: { hi: "न्यूमरोलॉजी", sub: "Name & birth-number reading" },
  mahadasha: { hi: "महादशा", sub: "Vimshottari dasha timeline & outlook" },
};

const PAGE_ROUTES: Record<PageKey, string> = {
  home: "/",
  kundali: "/kundali",
  milan: "/milan",
  numerology: "/numerology",
  mahadasha: "/mahadasha",
};

function HomeIntroPage() {
  const navigate = useNavigate();
  const cards = [
    { label: "कुंडली", desc: "Birth details, chart reading & guidance", path: "/kundali" },
    { label: "कुंडली मिलान", desc: "Compatibility matching & guna analysis", path: "/milan" },
    { label: "न्यूमरोलॉजी", desc: "Name and number-based insights", path: "/numerology" },
    { label: "महादशा", desc: "Timeline and major life phases", path: "/mahadasha" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#f2c36b]/20 bg-[#10273d]/80 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
        <p className="text-xs uppercase tracking-[0.22em] text-[#f2c36b]">Welcome</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-[#f9f3eb]">Gen-K Astrology</h2>
        <p className="mt-3 max-w-2xl text-sm text-[#d9e5f7]">
          Your spiritual companion for kundali insights, love compatibility, numerology and mahadasha guidance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => navigate(card.path)}
            className="rounded-2xl border border-[#f2c36b]/25 bg-[#0d2138]/80 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#f2c36b]/60 hover:shadow-[0_0_20px_rgba(248,210,122,0.12)]"
          >
            <p className="font-display text-2xl font-semibold text-[#f8d27a]">{card.label}</p>
            <p className="mt-2 text-sm text-[#d9e5f7]">{card.desc}</p>
            <span className="mt-4 inline-block text-xs uppercase tracking-wide text-[#f8d27a]">Open page →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const isAdminAuthenticated = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("genk_admin_session") === "true";
};

function KundaliExperience() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = useMemo<PageKey>(() => {
    switch (location.pathname) {
      case "/milan":
        return "milan";
      case "/numerology":
        return "numerology";
      case "/mahadasha":
        return "mahadasha";
      case "/kundali":
        return "kundali";
      default:
        return "home";
    }
  }, [location.pathname]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      id="appShell"
      className="relative min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-x-hidden"
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
        html, body { max-width: 100%; overflow-x: hidden; }
        * { min-width: 0; }

        @media print {
          html, body, #root { height: auto !important; overflow: visible !important; }
          #appShell { position: static !important; height: auto !important; overflow: visible !important; }

          .no-print { display: none !important; }

          #printArea {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111111 !important;
            box-shadow: none !important;
            border: none !important;
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
          #printArea table { break-inside: avoid-page; }
        }
      `}</style>

      <div className="absolute inset-0 brass-surface pointer-events-none no-print" />

      <div className="relative lg:flex lg:items-start lg:min-h-screen">
        <Sidebar
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          activePage={page}
          onNavigate={(nextPage) => navigate(PAGE_ROUTES[nextPage])}
        />

        <div className="min-w-0 flex-1 ">
          <header className="relative lg:hidden brass-header border-b border-[#f2c36b]/25 no-print">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
              <HamburgerButton
                onClick={() => setMenuOpen(true)}
                className="lg:hidden"
              />
              {/* <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#f2c36b] flex items-center justify-center text-[#0b1324] font-display font-bold text-lg shrink-0">
                <img src="/logo.png" alt="" />
              </div> */}
              <div>
                <h1 className="font-display text-lg sm:text-xl font-semibold tracking-wide text-[#f5efe6]">
                  Gen-K &middot; {PAGE_TITLES[page].hi}
                </h1>
                <p className="text-[10px] sm:text-xs text-[#afbdd7] tracking-wide">
                  {PAGE_TITLES[page].sub}
                </p>
              </div>
            </div>
          </header>

          <div className="relative max-w-6xl h-screen overflow-y-scroll  mx-auto px-4 sm:px-6 lg:px-8 py-8 font-body">
            {page === "home" && <HomeIntroPage />}
            {page === "kundali" && <KundaliPage />}
            {page === "milan" && <KundaliMilanPage />}
            {page === "numerology" && <NumerologyPage />}
            {page === "mahadasha" && <MahadashaPage />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<KundaliExperience />} />
      <Route path="/kundali" element={<KundaliExperience />} />
      <Route path="/milan" element={<KundaliExperience />} />
      <Route path="/numerology" element={<KundaliExperience />} />
      <Route path="/mahadasha" element={<KundaliExperience />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/user-data"
        element={
          isAdminAuthenticated() ? (
            <UserDataPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
