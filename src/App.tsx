import { Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { HamburgerButton, Sidebar } from "./components/Sidebar";
import type { PageKey } from "./types";
import KundaliPage from "./pages/KundaliPage";
import KundaliMilanPage from "./pages/KundaliMilanPage";
import NumerologyPage from "./pages/NumerologyPage";
import MahadashaPage from "./pages/MahadashaPage";
import LoginPage from "./pages/LoginPage";
import UserDataPage from "./pages/UserDataPage";

const PAGE_TITLES: Record<PageKey, { hi: string; sub: string }> = {
  kundali: { hi: "कुंडली", sub: "Personalized life reading" },
  milan: { hi: "कुंडली मिलान", sub: "Ashtakoot compatibility match" },
  numerology: { hi: "न्यूमरोलॉजी", sub: "Name & birth-number reading" },
  mahadasha: { hi: "महादशा", sub: "Vimshottari dasha timeline & outlook" },
};

const isAdminAuthenticated = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("genk_admin_session") === "true";
};

function KundaliExperience() {
  const [page, setPage] = useState<PageKey>("kundali");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      id="appShell"
      className="relative min-h-screen bg-[#20100a] text-[#f5e6d3] overflow-x-hidden"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Mukta:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Rajdhani', sans-serif; letter-spacing: 0.01em; }
        .font-body { font-family: 'Mukta', sans-serif; }

        .brass-surface {
          background:
            radial-gradient(circle at 15% 20%, rgba(232,161,58,0.10), transparent 45%),
            radial-gradient(circle at 85% 80%, rgba(232,161,58,0.06), transparent 50%),
            linear-gradient(160deg, #3a2010 0%, #2a1608 60%, #1c0e05 100%);
        }
        .brass-header {
          background: linear-gradient(135deg, #4a2a12 0%, #3a1f0a 55%, #2a1608 100%);
        }

        .prose-kundli h2 { font-family: 'Rajdhani', sans-serif; color: #e8a13a; font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(232,161,58,0.3); padding-bottom: 0.4rem; }
        .prose-kundli h1 { font-family: 'Rajdhani', sans-serif; color: #fbe9d0; font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
        .prose-kundli h3 { color: #f2b25c; font-size: 1.05rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.4rem; }
        .prose-kundli p { color: #e3cbb0; line-height: 1.7; margin-bottom: 0.85rem; }
        .prose-kundli ul { color: #e3cbb0; margin-bottom: 0.85rem; padding-left: 1.1rem; }
        .prose-kundli li { margin-bottom: 0.35rem; }
        .prose-kundli li::marker { color: #e8a13a; }
        .prose-kundli strong { color: #fbe9d0; }
        .prose-kundli table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin-bottom: 1rem; -webkit-overflow-scrolling: touch; border: 1px solid rgba(232,161,58,0.25); border-radius: 8px; }
        .prose-kundli th, .prose-kundli td { border: 1px solid rgba(232,161,58,0.18); padding: 0.55rem 0.8rem; text-align: left; color: #e3cbb0; white-space: nowrap; }
        .prose-kundli th { color: #20100a; background: #e8a13a; font-weight: 700; }
        .prose-kundli tr:nth-child(even) td { background: rgba(232,161,58,0.05); }
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
          onNavigate={setPage}
        />

        <div className="min-w-0 flex-1 ">
          <header className="relative brass-header border-b border-[#e8a13a]/20 no-print">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
              <HamburgerButton
                onClick={() => setMenuOpen(true)}
                className="lg:hidden"
              />
              <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#e8a13a] flex items-center justify-center text-[#2a1608] font-display font-bold text-lg shrink-0">
                <img src="/public/logo.png" alt="" />
              </div>
              <div>
                <h1 className="font-display text-lg sm:text-xl font-semibold tracking-wide text-[#fbe9d0]">
                  Gen-K &middot; {PAGE_TITLES[page].hi}
                </h1>
                <p className="text-[10px] sm:text-xs text-[#c99a6b] tracking-wide">
                  {PAGE_TITLES[page].sub}
                </p>
              </div>
            </div>
          </header>

          <div className="relative max-w-6xl h-screen overflow-scroll mx-auto px-4 sm:px-6 lg:px-8 py-8 font-body">
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
