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
    <main className="min-h-screen bg-[#F8F0E8] px-5 py-8 text-[#171717] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-[#A95F35] hover:text-[#80602F]">← Gen-K home</Link>
        <header className="mt-8 border-b border-[#E8D9CC] pb-6">
          <h1 className="font-display text-4xl font-bold text-[#171717]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#625C56]">{description}</p>
        </header>
        <div className="divide-y divide-[#E8D9CC]">
          {sections.map((section) => (
            <section key={section.title} className="py-6">
              <h2 className="font-display text-xl font-semibold">{section.title}</h2>
              <div className="mt-2 space-y-3 text-sm leading-7 text-[#403A34]">
                {section.content}
              </div>
            </section>
          ))}
        </div>
        <footer className="border-t border-[#E8D9CC] py-6 text-xs text-[#89837D]">
          <LegalFooter />
          <p className="mt-4 text-center">Replace every bracketed business placeholder before launch.</p>
        </footer>
      </div>
    </main>
  );
}
