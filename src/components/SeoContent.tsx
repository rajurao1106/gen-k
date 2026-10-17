import Link from "next/link";
import { getSeoPage, type SeoPageKey } from "../lib/seo";

const servicePages: { href: string; label: string }[] = [
  { href: "/kundali", label: "Kundali" },
  { href: "/milan", label: "Kundali Milan" },
  { href: "/numerology", label: "Numerology" },
  { href: "/mahadasha", label: "Mahadasha" },
  { href: "/ai-friend", label: "AI Friend" },
];

export default function SeoContent({ page }: { page: SeoPageKey }) {
  const content = getSeoPage(page);

  return (
    <article className="border-t border-white/10 bg-[#071a2a] text-[#d5d9e2]">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
        <header className="mb-9 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d9ad62]">
            Learn more
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#f2c36b] sm:text-4xl">
            {content.heading}
          </h2>
          <p className="mt-4 text-base leading-7 text-[#aeb6c5]">
            {content.intro}
          </p>
        </header>
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
          {content.sections.map((section) => (
            <section
              key={section.heading}
              className="border-t border-white/10 pt-5"
            >
              <h3 className="font-display text-xl font-semibold text-[#eee5d5]">
                {section.heading}
              </h3>
              <p className="mt-2 text-sm leading-7 text-[#aeb6c5]">
                {section.body}
              </p>
            </section>
          ))}
        </div>
        <nav
          aria-label="Explore Gen-K tools"
          className="mt-10 border-t border-white/10 pt-6"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#858e9d]">
            Explore other tools
          </p>
          <ul className="flex flex-wrap gap-2">
            {servicePages
              .filter((service) => `/${page}` !== service.href)
              .map((service) => (
                <li key={service.href}>
                  <Link
                    className="inline-flex rounded-full border border-white/10 px-3.5 py-2 text-sm text-[#d6c394] transition hover:border-[#f2c36b]/40 hover:text-[#ffda91]"
                    href={service.href}
                  >
                    {service.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </article>
  );
}
