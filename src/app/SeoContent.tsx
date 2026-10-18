import { getFaqJsonLd, getSeoPage, type SeoPageKey } from "../lib/seo";

export default function SeoContent({ page }: { page: SeoPageKey }) {
  const content = getSeoPage(page);
  const jsonLd = JSON.stringify(getFaqJsonLd(content.faqs)).replace(/</g, "\\u003c");

  return (
    <article className="border-t border-white/10 bg-[#071a2a] text-[#d5d9e2]">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
        <header className="mb-9 max-w-3xl">
          <h2 className="font-display text-3xl font-bold leading-tight text-[#f2c36b] sm:text-4xl">
            {content.heading}
          </h2>
          <p lang="hi" className="mt-2 text-lg text-[#e8d5ae]">{content.hindiHeading}</p>
          <p className="mt-4 text-base leading-7 text-[#aeb6c5]">{content.intro}</p>
        </header>

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
          {content.sections.map((section) => (
            <section key={section.heading} className="border-t border-white/10 pt-5">
              <h3 className="font-display text-xl font-semibold text-[#eee5d5]">{section.heading}</h3>
              <p className="mt-2 text-sm leading-7 text-[#aeb6c5]">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-14" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="font-display text-3xl font-bold text-[#f6f0e6]">
            Frequently Asked Questions
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {content.faqs.map((faq) => (
              <div key={faq.question} className="border-t border-white/10 pt-4">
                <h3 className="font-display text-lg font-semibold text-[#eee5d5]">{faq.question}</h3>
                <p className="mt-2 text-sm leading-7 text-[#aeb6c5]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      </div>
    </article>
  );
}