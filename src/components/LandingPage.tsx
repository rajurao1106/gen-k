import Link from "next/link";
import type { ReactNode } from "react";
import LegalFooter from "./LegalFooter";

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
    <main className="min-h-screen overflow-x-clip bg-[#F8F0E8] text-[#171717]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Mukta:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Rajdhani', sans-serif; letter-spacing: 0.01em; }
      `}</style>
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Gen-K home" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[#101010] shadow-[0_0_24px_rgba(16,16,16,0.12)]">
            <img src="/logo.png" alt="" className="h-full w-full object-cover" />
          </span>
          <span>
            <span className="block font-display text-xl font-bold tracking-wide">
              Gen-K
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-[#77716B]">
              Vedic astrology
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <a
            href="#services"
            className="hidden rounded-full px-4 py-2 text-sm text-[#5F5A55] transition hover:text-[#B77A25] sm:inline-flex"
          >
            Explore services
          </a>
          <Link
            href="/start"
            className="inline-flex items-center gap-2 rounded-full border border-[#101010] bg-[#101010] px-4 py-2.5 text-sm font-semibold text-[#FFF9F3] shadow-[0_8px_24px_rgba(16,16,16,0.12)] transition hover:-translate-y-0.5 hover:bg-[#302A25] sm:px-5"
          >
            Open app <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <section className="relative isolate mx-auto grid min-h-[610px] w-full max-w-7xl items-center gap-10 px-5 pb-20 pt-12 sm:px-8 md:min-h-[670px] md:pb-24 lg:grid-cols-[1.12fr_0.88fr] lg:px-12 lg:pt-6">
        <div className="pointer-events-none absolute -left-48 top-10 -z-10 h-[460px] w-[460px] rounded-full bg-[#E8B99A]/25 blur-[110px]" />
        <div className="pointer-events-none absolute right-[-10%] top-[-15%] -z-10 h-[580px] w-[580px] rounded-full bg-[#F2DCCB]/70 blur-[130px]" />

        <div className="relative z-10 max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#D9A441]/35 bg-white/70 px-3.5 py-2 text-xs tracking-wide text-[#80602F]">
            <span aria-hidden="true" className="text-[#D9A441]">✦</span>
            Ancient wisdom, made personal
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[60px]">
            Free Kundali, Milan &amp;
            <span className="mt-1 block bg-gradient-to-r from-[#B77A25] via-[#D9A441] to-[#A95F35] bg-clip-text text-transparent">
              Numerology Online
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#625C56] sm:text-lg sm:leading-8">
            Enter your birth details and get an AI-based Vedic astrology
            reading in Hindi or English. Match kundalis, explore your
            mahadasha and download a PDF report.
          </p>
          <p lang="hi" className="mt-3 font-display text-lg text-[#80602F] sm:text-xl">
            आपकी यात्रा, आपकी कुंडली, आपकी समझ।
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/start"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#101010] px-6 py-3 text-sm font-bold text-[#FFF9F3] transition hover:-translate-y-0.5 hover:bg-[#302A25]"
            >
              Create your free kundali <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="#services"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#D7C9BC] bg-white/65 px-6 py-3 text-sm font-semibold text-[#302A25] transition hover:border-[#D9A441]/65 hover:bg-white"
            >
              Explore all tools <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[#77716B]">
            <span className="flex items-center gap-2">
              <span className="text-[#D9A441]" aria-hidden="true">✦</span>
              AI-based readings &middot; PDF report
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#D9A441]" aria-hidden="true">◈</span>
              Hindi &amp; English readings
            </span>
          </div>
        </div>

        <div aria-hidden="true" className="relative mx-auto flex h-[360px] w-full max-w-[430px] items-center justify-center sm:h-[460px]">
  <div className="absolute h-[280px] w-[280px] rounded-full border border-[#D9A441]/25 sm:h-[360px] sm:w-[360px]" />
  <div className="absolute h-[220px] w-[220px] rounded-full border border-dashed border-[#D9A441]/30 sm:h-[290px] sm:w-[290px]" />
  <div className="absolute h-[170px] w-[170px] rounded-full bg-[radial-gradient(circle_at_35%_28%,rgba(217,164,65,0.22),rgba(248,232,216,0.8)_46%,rgba(248,240,232,0.25)_72%)] shadow-[0_0_100px_rgba(204,151,74,0.14)] sm:h-[220px] sm:w-[220px]" />
  <div className="absolute h-[270px] w-[270px] rotate-45 border border-[#D9A441]/25 sm:h-[350px] sm:w-[350px]" />
  <div className="absolute h-[270px] w-[270px] -rotate-45 border border-[#D9A441]/20 sm:h-[350px] sm:w-[350px]" />

  {/* Om (peeks out behind the head like a halo) */}
  <div className="relative -translate-y-16 flex h-28 w-28 items-center justify-center rounded-full border border-[#D9A441]/35 bg-[#F8E8D8]/85 text-5xl text-[#B77A25] shadow-[0_0_55px_rgba(217,164,65,0.18)] sm:-translate-y-24 sm:h-36 sm:w-36 sm:text-6xl">
    <span className="translate-y-[-2px]">ॐ</span>
  </div>

  {/* Astrologer image on top of Om */}
  <img
    src="/vedic-astrologer.png"
    alt=""
    className="absolute bottom-0 left-1/2 z-10 w-[115%] max-w-none -translate-x-1/2 object-contain [mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)] drop-shadow-[0_20px_40px_rgba(60,40,25,0.2)]"
  />

  <span className="absolute left-[13%] top-[21%] text-xl text-[#D9A441]">✦</span>
  <span className="absolute right-[13%] top-[29%] text-sm text-[#A95F35]">✧</span>
  <span className="absolute bottom-[20%] left-[20%] z-20 text-sm text-[#B77A25]">✧</span>
  <span className="absolute bottom-[18%] right-[19%] z-20 text-lg text-[#A95F35]">✦</span>
  <span className="absolute right-[8%] top-[57%] h-1.5 w-1.5 rounded-full bg-[#D9A441]" />
  <span className="absolute left-[9%] top-[62%] h-1 w-1 rounded-full bg-[#A95F35]" />
</div>
      </section>

      <section
        id="services"
        className="relative overflow-x-clip border-t border-[#E6D9CE] px-5 py-20 sm:px-8 sm:py-24 lg:px-12"
      >
        <div className="pointer-events-none absolute -right-40 top-20 h-[420px] w-[420px] rounded-full bg-[#E8B99A]/25 blur-[110px]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-16 lg:self-start">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#B77A25]">
              <span className="h-px w-8 bg-[#B77A25]/70" />
              Your personal astrology toolkit
            </p>
            <h2 className="mt-5 max-w-md font-display text-4xl font-bold leading-[1.05] sm:text-5xl">
              One sky.
              <span className="block text-[#B77A25]">Many ways to</span>
              understand it.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#625C56] sm:text-base">
              Begin with a question, then follow your curiosity. Each tool
              offers a different lens on your chart and your journey.
            </p>
            <Link
              href="/start"
              className="mt-8 inline-flex items-center gap-3 border-b border-[#D9A441]/50 pb-2 text-sm font-semibold text-[#B77A25] transition hover:border-[#A95F35] hover:text-[#A95F35]"
            >
              Open the app <span aria-hidden="true">↗</span>
            </Link>
            <div
              aria-hidden="true"
              className="mt-12 hidden items-center gap-4 text-[#D9A441]/50 lg:flex"
            >
              <span className="h-px w-12 bg-current" />
              <span className="text-2xl">✧</span>
              <span className="h-px w-12 bg-current" />
            </div>
          </div>

          <div className="border-t border-[#E3D7CC]">
            {services.map((service) => (
              <Link
                key={service.href}
                href={service.href}
                className="group relative grid gap-3 border-b border-[#E3D7CC] py-6 transition-colors sm:grid-cols-[54px_1fr_40px] sm:items-center sm:gap-5 sm:py-7"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 inset-y-2 -z-10 scale-x-0 bg-gradient-to-r from-[#D9A441]/[0.12] via-[#D9A441]/[0.04] to-transparent transition-transform duration-300 origin-left group-hover:scale-x-100"
                />
                <span className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
                  <span className="font-display text-2xl text-[#B77A25] transition-colors group-hover:text-[#A95F35]">
                    {service.symbol}
                  </span>
                  <span className="font-display text-xs tracking-[0.16em] text-[#8A8178]">
                    {service.number}
                  </span>
                </span>
                <span>
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-2xl font-bold tracking-wide text-[#171717] transition-colors group-hover:text-[#A95F35] sm:text-[26px]">
                      {service.title}
                    </span>
                    <span className="text-sm text-[#80602F]">
                      {service.hindi}
                    </span>
                  </span>
                  <span className="mt-1 block max-w-xl text-sm leading-6 text-[#625C56]">
                    {service.description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="hidden h-9 w-9 items-center justify-center rounded-full border border-[#D7C9BC] text-sm text-[#77716B] transition group-hover:translate-x-1 group-hover:border-[#D9A441]/65 group-hover:text-[#A95F35] sm:flex"
                >
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="border-t border-[#E6D9CE] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <h2 id="how-it-works" className="font-display text-3xl font-bold sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="border-t border-[#D9A441]/40 pt-5">
                <span className="font-display text-sm tracking-[0.2em] text-[#B77A25]">0{i + 1}</span>
                <h3 className="mt-2 font-display text-xl font-semibold text-[#171717]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#625C56]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {children}

      <footer className="border-t border-[#E6D9CE] px-5 py-8 text-center text-xs text-[#77716B] sm:px-8">
        <nav aria-label="Footer" className="mb-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {services.map((service) => (
            <Link key={service.href} href={service.href} className="hover:text-[#A95F35]">
              {service.title}
            </Link>
          ))}
        </nav>
        <div className="mb-4"><LegalFooter /></div>
        <p className="mx-auto max-w-2xl">
          Gen-K readings are AI-generated for reflection and information only.
          They are not a substitute for professional medical, legal, financial
          or mental-health advice.
        </p>
      </footer>
    </main>
  );
}