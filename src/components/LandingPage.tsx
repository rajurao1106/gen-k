import Link from "next/link";
import type { ReactNode } from "react";

const services = [
  {
    number: "01",
    title: "Janam Kundali",
    hindi: "जन्म कुंडली",
    description:
      "Explore your birth chart, planetary placements and a thoughtful reading based on your birth details.",
    href: "/kundali",
    symbol: "✦",
  },
  {
    number: "02",
    title: "Kundali Milan",
    hindi: "कुंडली मिलान",
    description:
      "Compare two birth charts with Ashtakoot guna matching and a clear compatibility breakdown.",
    href: "/milan",
    symbol: "♡",
  },
  {
    number: "03",
    title: "Numerology",
    hindi: "अंक ज्योतिष",
    description:
      "Discover the numbers connected to your name and date of birth, with insights made simple.",
    href: "/numerology",
    symbol: "№",
  },
  {
    number: "04",
    title: "Mahadasha",
    hindi: "महादशा",
    description:
      "See your Vimshottari dasha timeline and learn about the planetary periods in your chart.",
    href: "/mahadasha",
    symbol: "◷",
  },
  {
    number: "05",
    title: "AI Friend",
    hindi: "आपका ज्योतिष साथी",
    description:
      "Ask questions about your chart and get a conversational companion for reflection and guidance.",
    href: "/ai-friend",
    symbol: "✧",
  },
];

const steps = [
  { title: "Enter birth details", body: "Add your name, date, time and place of birth. Accurate birth time gives a better reading." },
  { title: "Choose your tool", body: "Pick kundali, kundali milan, numerology, mahadasha or chat with AI Friend, in Hindi or English." },
  { title: "Read, save and download", body: "Get an AI-based reading, save profiles for next time and download a PDF report." },
];

export default function LandingPage({ children }: { children?: ReactNode }) {
  return (
    <main className="min-h-screen overflow-x-clip bg-[#080d18] text-[#f6f0e6]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Mukta:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Rajdhani', sans-serif; letter-spacing: 0.01em; }
      `}</style>
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Gen-K home" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[#f2c36b] shadow-[0_0_28px_rgba(242,195,107,0.2)]">
            <img src="/logo.png" alt="" className="h-full w-full object-cover" />
          </span>
          <span>
            <span className="block font-display text-xl font-bold tracking-wide">
              Gen-K
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-[#a9afbd]">
              Vedic astrology
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <a
            href="#services"
            className="hidden rounded-full px-4 py-2 text-sm text-[#d7d2c8] transition hover:text-[#f4ca7b] sm:inline-flex"
          >
            Explore services
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-[#f2c36b]/55 bg-[#f2c36b] px-4 py-2.5 text-sm font-semibold text-[#17130c] shadow-[0_8px_30px_rgba(242,195,107,0.12)] transition hover:-translate-y-0.5 hover:bg-[#ffda91] sm:px-5"
          >
            Open app <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <section className="relative isolate mx-auto grid min-h-[610px] w-full max-w-7xl items-center gap-10 px-5 pb-20 pt-12 sm:px-8 md:min-h-[670px] md:pb-24 lg:grid-cols-[1.12fr_0.88fr] lg:px-12 lg:pt-6">
        <div className="pointer-events-none absolute -left-48 top-10 -z-10 h-[460px] w-[460px] rounded-full bg-[#bd8743]/10 blur-[110px]" />
        <div className="pointer-events-none absolute right-[-10%] top-[-15%] -z-10 h-[580px] w-[580px] rounded-full bg-[#394985]/20 blur-[130px]" />

        <div className="relative z-10 max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#f2c36b]/20 bg-white/[0.035] px-3.5 py-2 text-xs tracking-wide text-[#e6c98f]">
            <span aria-hidden="true" className="text-[#f2c36b]">✦</span>
            Ancient wisdom, made personal
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[60px]">
            Free Kundali, Milan &amp;
            <span className="mt-1 block bg-gradient-to-r from-[#f7dfa5] via-[#e8b961] to-[#bd8540] bg-clip-text text-transparent">
              Numerology Online
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#b8bfcd] sm:text-lg sm:leading-8">
            Enter your birth details and get an AI-based Vedic astrology
            reading in Hindi or English. Match kundalis, explore your
            mahadasha and download a PDF report.
          </p>
          <p lang="hi" className="mt-3 font-display text-lg text-[#e8d5ae] sm:text-xl">
            आपकी यात्रा, आपकी कुंडली, आपकी समझ।
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/kundali"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f2c36b] px-6 py-3 text-sm font-bold text-[#17130c] transition hover:-translate-y-0.5 hover:bg-[#ffda91]"
            >
              Create your free kundali <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="#services"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-6 py-3 text-sm font-semibold text-[#f5eee2] transition hover:border-[#f2c36b]/50 hover:bg-white/[0.07]"
            >
              Explore all tools <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[#9ca5b5]">
            <span className="flex items-center gap-2">
              <span className="text-[#f2c36b]" aria-hidden="true">✦</span>
              AI-based readings &middot; PDF report
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#f2c36b]" aria-hidden="true">◈</span>
              Hindi &amp; English readings
            </span>
          </div>
        </div>

        <div aria-hidden="true" className="relative mx-auto flex h-[330px] w-full max-w-[430px] items-center justify-center sm:h-[420px]">
          <div className="absolute h-[280px] w-[280px] rounded-full border border-[#e3b865]/15 sm:h-[360px] sm:w-[360px]" />
          <div className="absolute h-[220px] w-[220px] rounded-full border border-dashed border-[#e3b865]/20 sm:h-[290px] sm:w-[290px]" />
          <div className="absolute h-[170px] w-[170px] rounded-full bg-[radial-gradient(circle_at_35%_28%,rgba(242,195,107,0.25),rgba(84,69,112,0.22)_46%,rgba(8,13,24,0.2)_72%)] shadow-[0_0_100px_rgba(204,151,74,0.14)] sm:h-[220px] sm:w-[220px]" />
          <div className="absolute h-[270px] w-[270px] rotate-45 border border-[#e3b865]/20 sm:h-[350px] sm:w-[350px]" />
          <div className="absolute h-[270px] w-[270px] -rotate-45 border border-[#e3b865]/15 sm:h-[350px] sm:w-[350px]" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-[#f4d38f]/35 bg-[#171b2a]/80 text-5xl text-[#f5d895] shadow-[0_0_55px_rgba(242,195,107,0.16)] sm:h-36 sm:w-36 sm:text-6xl">
            <span className="translate-y-[-2px]">ॐ</span>
          </div>
          <span className="absolute left-[13%] top-[21%] text-xl text-[#f2c36b]">✦</span>
          <span className="absolute right-[13%] top-[29%] text-sm text-[#b8a5e8]">✧</span>
          <span className="absolute bottom-[20%] left-[20%] text-sm text-[#e9c77e]">✧</span>
          <span className="absolute bottom-[18%] right-[19%] text-lg text-[#c3b5ed]">✦</span>
          <span className="absolute right-[8%] top-[57%] h-1.5 w-1.5 rounded-full bg-[#f6d895]" />
          <span className="absolute left-[9%] top-[62%] h-1 w-1 rounded-full bg-[#c3b5ed]" />
        </div>
      </section>

      <section
        id="services"
        className="relative overflow-x-clip border-t border-white/[0.07] px-5 py-20 sm:px-8 sm:py-24 lg:px-12"
      >
        <div className="pointer-events-none absolute -right-40 top-20 h-[420px] w-[420px] rounded-full bg-[#b78443]/[0.06] blur-[110px]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-16 lg:self-start">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#d9ad62]">
              <span className="h-px w-8 bg-[#d9ad62]/70" />
              Your personal astrology toolkit
            </p>
            <h2 className="mt-5 max-w-md font-display text-4xl font-bold leading-[1.05] sm:text-5xl">
              One sky.
              <span className="block text-[#e8bd70]">Many ways to</span>
              understand it.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#aeb6c5] sm:text-base">
              Begin with a question, then follow your curiosity. Each tool
              offers a different lens on your chart and your journey.
            </p>
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center gap-3 border-b border-[#d9ad62]/50 pb-2 text-sm font-semibold text-[#f2c36b] transition hover:border-[#ffda91] hover:text-[#ffda91]"
            >
              Open the app <span aria-hidden="true">↗</span>
            </Link>
            <div
              aria-hidden="true"
              className="mt-12 hidden items-center gap-4 text-[#d9ad62]/40 lg:flex"
            >
              <span className="h-px w-12 bg-current" />
              <span className="text-2xl">✧</span>
              <span className="h-px w-12 bg-current" />
            </div>
          </div>

          <div className="border-t border-white/[0.12]">
            {services.map((service) => (
              <Link
                key={service.href}
                href={service.href}
                className="group relative grid gap-3 border-b border-white/[0.12] py-6 transition-colors sm:grid-cols-[54px_1fr_40px] sm:items-center sm:gap-5 sm:py-7"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 inset-y-2 -z-10 scale-x-0 bg-gradient-to-r from-[#f2c36b]/[0.07] via-[#f2c36b]/[0.025] to-transparent transition-transform duration-300 origin-left group-hover:scale-x-100"
                />
                <span className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
                  <span className="font-display text-2xl text-[#d9ad62] transition-colors group-hover:text-[#ffda91]">
                    {service.symbol}
                  </span>
                  <span className="font-display text-xs tracking-[0.16em] text-[#717a8c]">
                    {service.number}
                  </span>
                </span>
                <span>
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-2xl font-bold tracking-wide text-[#f6f0e6] transition-colors group-hover:text-[#ffda91] sm:text-[26px]">
                      {service.title}
                    </span>
                    <span className="text-sm text-[#d2b878]">
                      {service.hindi}
                    </span>
                  </span>
                  <span className="mt-1 block max-w-xl text-sm leading-6 text-[#9fa8b8]">
                    {service.description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 text-sm text-[#c6bda9] transition group-hover:translate-x-1 group-hover:border-[#f2c36b]/45 group-hover:text-[#ffda91] sm:flex"
                >
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="border-t border-white/[0.07] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <h2 id="how-it-works" className="font-display text-3xl font-bold sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="border-t border-[#f2c36b]/30 pt-5">
                <span className="font-display text-sm tracking-[0.2em] text-[#d9ad62]">0{i + 1}</span>
                <h3 className="mt-2 font-display text-xl font-semibold text-[#f6f0e6]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#9fa8b8]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {children}

      <footer className="border-t border-white/[0.07] px-5 py-8 text-center text-xs text-[#858e9d] sm:px-8">
        <nav aria-label="Footer" className="mb-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {services.map((service) => (
            <Link key={service.href} href={service.href} className="hover:text-[#ffda91]">
              {service.title}
            </Link>
          ))}
        </nav>
        <p className="mx-auto max-w-2xl">
          Gen-K readings are AI-generated for reflection and information only.
          They are not a substitute for professional medical, legal, financial
          or mental-health advice.
        </p>
      </footer>
    </main>
  );
}