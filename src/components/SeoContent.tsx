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
    <article className="mx-auto w-full max-w-5xl px-5 py-10 text-slate-900 sm:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {content.heading}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
          {content.intro}
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-3">
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <p className="mt-2 leading-7 text-slate-700">{section.body}</p>
          </section>
        ))}
      </div>
      <nav aria-label="Explore Gen-K tools" className="mt-8 border-t pt-5">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {servicePages.map((service) => (
            <li key={service.href}>
              <Link
                className="text-blue-800 underline underline-offset-4"
                href={service.href}
              >
                {service.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
