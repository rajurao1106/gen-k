import type { ReactNode } from "react";
import Link from "next/link";
import LegalFooter from "./LegalFooter";

export type LegalPageSection = { title: string; content: ReactNode };

export default function LegalPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: LegalPageSection[];
}) {
  return (
    <main className="min-h-screen bg-[#080d18] px-5 py-8 text-[#f6f0e6] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-[#f2c36b] hover:text-[#ffda91]">← Gen-K home</Link>
        <header className="mt-8 border-b border-white/10 pb-6">
          <h1 className="font-display text-4xl font-bold text-[#f2c36b]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#aeb6c5]">{description}</p>
        </header>
        <div className="divide-y divide-white/10">
          {sections.map((section) => (
            <section key={section.title} className="py-6">
              <h2 className="font-display text-xl font-semibold">{section.title}</h2>
              <div className="mt-2 space-y-3 text-sm leading-7 text-[#b8bfcd]">
                {section.content}
              </div>
            </section>
          ))}
        </div>
        <footer className="border-t border-white/10 py-6 text-xs text-[#858e9d]">
          <LegalFooter />
          <p className="mt-4 text-center">Replace every bracketed business placeholder before launch.</p>
        </footer>
      </div>
    </main>
  );
}
