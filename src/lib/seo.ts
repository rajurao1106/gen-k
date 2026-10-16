import type { Metadata } from "next";

export type SeoPageKey =
  | "home"
  | "kundali"
  | "milan"
  | "numerology"
  | "mahadasha"
  | "ai-friend";

type SeoPage = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: { heading: string; body: string }[];
};

const pages: Record<SeoPageKey, SeoPage> = {
  home: {
    title: "Free Online Kundali, Horoscope & Astrology Tools",
    description:
      "Explore your birth chart, kundali matching, numerology and mahadasha insights with Gen-K's free online astrology tools.",
    heading: "Vedic Astrology Tools for Your Life Journey",
    intro:
      "Gen-K brings practical Vedic astrology and numerology tools together in one place. Explore a birth-chart reading, compare kundalis, understand name numbers or learn about your mahadasha timeline.",
    sections: [
      {
        heading: "Explore your birth chart",
        body: "Enter your birth details to explore personalized kundali insights. The chart experience is designed to help you understand planetary placements and reflect on the themes in your life.",
      },
      {
        heading: "Check compatibility and numerology",
        body: "Use kundali milan to review traditional compatibility factors, or explore numerology readings based on a name and date of birth.",
      },
      {
        heading: "Understand your mahadasha",
        body: "Review the Vimshottari mahadasha sequence and learn how planetary periods are traditionally interpreted in Vedic astrology.",
      },
    ],
  },
  kundali: {
    title: "Free Online Kundali and Birth Chart Reading",
    description:
      "Create a personalized kundali online with your birth date, time and place. Explore Vedic birth-chart insights with Gen-K.",
    heading: "Free Online Kundali and Birth Chart",
    intro:
      "A kundali, also called a Janam Kundali or birth chart, maps the positions of celestial bodies at the time and place of birth. Gen-K helps you explore a personalized Vedic astrology reading using your birth details.",
    sections: [
      {
        heading: "What details do you need?",
        body: "For a more precise chart, provide your date of birth, local time of birth and birthplace. Birth time can affect the ascendant and house placements, so use the most accurate time available.",
      },
      {
        heading: "What can a birth chart show?",
        body: "A Vedic chart organizes planetary placements across signs and houses. Traditional readings use these placements to discuss personality, relationships, work and important life themes.",
      },
      {
        heading: "Use your reading thoughtfully",
        body: "Astrology is a cultural and spiritual practice, not a substitute for professional medical, legal or financial advice. Use your chart as a reflective guide rather than a guaranteed prediction.",
      },
    ],
  },
  milan: {
    title: "Kundali Milan Online for Marriage Compatibility",
    description:
      "Compare two birth charts with an online kundali milan tool. Explore Ashtakoot guna matching and traditional compatibility factors.",
    heading: "Online Kundali Milan and Guna Matching",
    intro:
      "Kundali milan is a traditional Vedic astrology practice used to compare two birth charts before marriage. Gen-K's matching tool helps you enter both partners' birth details and explore Ashtakoot compatibility factors.",
    sections: [
      {
        heading: "What is Ashtakoot matching?",
        body: "Ashtakoot compares eight traditional categories, often called kootas, and assigns a combined guna score. The score is one part of a broader compatibility discussion, not a complete assessment of a relationship.",
      },
      {
        heading: "Enter accurate birth details",
        body: "The reading depends on birth date, time and place for both people. If a birth time is uncertain, keep that in mind when interpreting chart-based results.",
      },
      {
        heading: "A thoughtful approach to compatibility",
        body: "A healthy relationship also depends on communication, mutual respect and shared values. Treat astrological matching as cultural guidance and discuss important decisions together.",
      },
    ],
  },
  numerology: {
    title: "Online Numerology Reading by Name and Date of Birth",
    description:
      "Explore name and birth-date numerology online. Get a personal numerology reading with Gen-K's free numerology tool.",
    heading: "Online Numerology Name and Birth-Date Reading",
    intro:
      "Numerology interprets numbers associated with a name and date of birth as symbols for personal themes. Use Gen-K to explore a number-based reading and understand the traditional meanings behind your results.",
    sections: [
      {
        heading: "How numerology readings work",
        body: "Different numerology traditions calculate core numbers from letters in a name and digits in a birth date. The resulting numbers are commonly associated with personality, motivation and life direction.",
      },
      {
        heading: "Try a personal reading",
        body: "Enter the name and birth date requested by the tool to generate your reading. Names can be transliterated differently, so use a consistent spelling when comparing results.",
      },
      {
        heading: "Interpret numbers as reflection",
        body: "Numerology is a spiritual and cultural system rather than a scientific prediction method. Use the reading for reflection and entertainment, not as a replacement for professional guidance.",
      },
    ],
  },
  mahadasha: {
    title: "Vimshottari Mahadasha Calculator and Timeline",
    description:
      "Explore your Vimshottari mahadasha sequence and planetary period timeline with Gen-K's online Vedic astrology tool.",
    heading: "Vimshottari Mahadasha Timeline",
    intro:
      "In Vedic astrology, Vimshottari dasha is a planetary-period system used to organize major and sub-periods across a person's life. Gen-K helps you explore a mahadasha timeline using birth details.",
    sections: [
      {
        heading: "What is a mahadasha?",
        body: "A mahadasha is a major planetary period in the Vimshottari system. Each major period is traditionally associated with a ruling planet and contains shorter sub-periods called antardashas.",
      },
      {
        heading: "Why birth time and place matter",
        body: "The sequence and starting balance are calculated from the Moon's position at birth, which makes accurate date, time and place information important for a personalized timeline.",
      },
      {
        heading: "Use the timeline as traditional guidance",
        body: "Planetary periods have different interpretations across traditions and astrologers. Consider the timeline a cultural framework for reflection, not a certain forecast of future events.",
      },
    ],
  },
  "ai-friend": {
    title: "AI Astrology Companion for Kundali Questions",
    description:
      "Ask questions about your kundali and explore personalized astrology insights with Gen-K's AI astrology companion.",
    heading: "Your AI Astrology Companion",
    intro:
      "Gen-K's AI Friend offers a conversational way to explore astrology questions using your saved profile. Start a chat to ask about kundali themes and reflect on your birth-chart reading.",
    sections: [
      {
        heading: "Start with your birth profile",
        body: "Choose or create a profile with accurate birth information to give the companion relevant context for astrology-related questions.",
      },
      {
        heading: "Ask clear, thoughtful questions",
        body: "You can ask about traditional chart interpretations, planetary placements and general astrological concepts. AI-generated responses can be incomplete, so consider them informational rather than authoritative.",
      },
      {
        heading: "Protect personal information",
        body: "Only share details needed for your reading. Do not use AI astrology responses as a replacement for professional medical, financial, legal or mental-health advice.",
      },
    ],
  },
};

export function getSeoPage(page: SeoPageKey) {
  return pages[page];
}

export function getPageMetadata(page: SeoPageKey): Metadata {
  const content = pages[page];
  const path = page === "home" ? "/" : `/${page}`;

  return {
    title: content.title,
    description: content.description,
    alternates: { canonical: path },
    openGraph: {
      title: content.title,
      description: content.description,
      url: path,
      siteName: "Gen-K",
      type: "website",
      locale: "en_IN",
    },
    twitter: {
      card: "summary",
      title: content.title,
      description: content.description,
    },
  };
}

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

  return new URL(configuredUrl);
}
