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
];

export default function ExplorePage({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  return (
    <section aria-labelledby="explore-heading">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f2c36b]/15 text-[#f2c36b]">
          <NavIcon name="explore" />
        </span>
        <div>
          <h1 id="explore-heading" className="font-display text-2xl font-bold text-[#f9f3eb]">
            Explore
          </h1>
          <p className="text-sm text-[#c9d8ed]">More Vedic tools for you</p>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <li key={tool.key}>
            <button
              type="button"
              onClick={() => onNavigate(tool.key)}
              className="group flex h-full w-full flex-col rounded-3xl border border-[#f2c36b]/25 bg-[#10273d] p-5 text-left shadow-[0_12px_30px_rgba(0,0,0,0.3)] transition-colors hover:border-[#f2c36b]/55 hover:bg-[#153555] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f2c36b]/15 text-[#f2c36b]">
                <NavIcon name={tool.icon} />
              </span>
              <span className="mt-4 block font-display text-xl font-bold text-[#f9f3eb]">{tool.hi}</span>
              <span className="block text-sm text-[#f9e6b2]">{tool.en}</span>
              <span className="mt-2 block flex-1 text-sm leading-6 text-[#c9d8ed]">{tool.description}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#f2c36b]">
                Open <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}