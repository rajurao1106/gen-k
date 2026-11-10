"use client";

import { NavIcon, type NavIconName } from "../components/NavIcon";
import type { PageKey } from "../types";

type Tool = {
  key: PageKey;
  hi: string;
  en: string;
  description: string;
  icon: NavIconName;
};

const TOOLS: Tool[] = [
  {
    key: "self-discovery",
    hi: "स्व-बोध",
    en: "Swa-Bodh · Self Discovery",
    description: "Understand your nature, emotions, relationships and purpose through your Kundali, with reflection questions and a private journal.",
    icon: "sparkles",
  },
  {
    key: "prashna",
    hi: "प्रश्न कुंडली",
    en: "Prashna Kundali",
    description: "Ask one question and get a soft signal (favourable, mixed or unfavourable) with clear reasons, from the chart of the moment you ask.",
    icon: "search",
  },
  {
    key: "muhurat",
    hi: "मुहूर्त कुंडली",
    en: "Muhurat Kundali",
    description: "Pick an activity (griha pravesh, vivah, vahan, business) and dates, and see the best-scored time slots with clear reasons.",
    icon: "clock",
  },
  {
    key: "company",
    hi: "कंपनी / गृह कुंडली",
    en: "Company / Griha Kundali",
    description: "Give the date, time and place a company started or a house construction began, and get a soft signal for each theme with clear reasons. Vastu is not included.",
    icon: "flag",
  },
  {
    key: "milan",
    hi: "कुंडली मिलान",
    en: "Kundli Milan",
    description: "Match two kundalis with the Ashtakoot Guna Milan and see the compatibility score.",
    icon: "rings",
  },
  {
    key: "mahadasha",
    hi: "महादशा",
    en: "Mahadasha",
    description: "Your Vimshottari dasha timeline with a yearly outlook for the years ahead.",
    icon: "orbit",
  },
  {
    key: "numerology",
    hi: "न्यूमरोलॉजी",
    en: "Numerology",
    description: "Name and birth-number reading based on your details.",
    icon: "numbers",
  },
  {
    key: "psychologist-insight",
    hi: "साइकोलॉजिस्ट क्लाइंट इनसाइट",
    en: "Psychologist Client Insight",
    description: "For psychologists: understand a client better with a Kundali-based supportive insight, suggested questions and practices.",
    icon: "heart",
  },
];

export default function ExplorePage({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  return (
    <section aria-labelledby="explore-heading">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F8E8D8] text-[#A95F35]">
          <NavIcon name="explore" />
        </span>
        <div>
          <h1 id="explore-heading" className="font-display text-2xl font-bold text-[#171717]">
            Explore
          </h1>
          <p className="text-sm text-[#625C56]">More Vedic tools for you</p>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <li key={tool.key}>
            <button
              type="button"
              onClick={() => onNavigate(tool.key)}
              className="group flex h-full w-full flex-col rounded-3xl border border-[#E8D9CC] bg-white p-5 text-left shadow-[0_8px_24px_rgba(80,54,32,0.06)] transition-colors hover:border-[#D9A441] hover:bg-[#FFFCF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]/60"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F8E8D8] text-[#A95F35]">
                <NavIcon name={tool.icon} />
              </span>
              <span className="mt-4 block font-display text-xl font-bold text-[#171717]">{tool.hi}</span>
              <span className="block text-sm text-[#80602F]">{tool.en}</span>
              <span className="mt-2 block flex-1 text-sm leading-6 text-[#625C56]">{tool.description}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#A95F35]">
                Open <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}