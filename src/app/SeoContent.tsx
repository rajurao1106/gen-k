import Link from "next/link";
import { getFaqJsonLd, getSeoPage, type SeoPageKey } from "../lib/seo";

const servicePages: { href: string; label: string }[] = [
  { href: "/kundali", label: "Free Kundali (जन्म कुंडली)" },
  { href: "/milan", label: "Kundali Milan (कुंडली मिलान)" },
  { href: "/numerology", label: "Numerology (न्यूमरोलॉजी)" },
  { href: "/mahadasha", label: "Mahadasha (महादशा)" },
  { href: "/ai-friend", label: "AI Astrology Friend" },
];

export default function SeoContent({ page }: { page: SeoPageKey }) {
  const content = getSeoPage(page);
  // "<" is escaped so the JSON can never close the <script> tag early.
  const faqJsonLd = JSON.stringify(getFaqJsonLd(content.faqs)).replace(
    /</g,
    "\\u003c",
  );

  return (
    <article className="mx-auto w-full max-w-5xl px-5 py-10 text-slate-900 sm:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {content.heading}
        </h1>
        <p className="mt-2 text-lg font-medium text-slate-600" lang="hi">
          {content.hindiHeading}
        </p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
          {content.intro}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <p className="mt-2 leading-7 text-slate-700">{section.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-bold">
          Frequently Asked Questions
        </h2>
        <div className="mt-4 space-y-5">
          {content.faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-lg font-semibold">{faq.question}</h3>
              <p className="mt-1 leading-7 text-slate-700">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="Explore Gen-K tools" className="mt-10 border-t pt-5">
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />
    </article>
  );
}