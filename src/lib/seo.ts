import type { Metadata } from "next";

export type SeoPageKey =
  | "home"
  | "kundali"
  | "milan"
  | "numerology"
  | "mahadasha"
  | "ai-friend";

export type SeoFaq = { question: string; answer: string };

type SeoPage = {
  title: string; // layout template adds " | Gen-K"
  description: string; // keep under ~155 characters
  keywords: string[];
  heading: string; // the single H1 on the page
  hindiHeading: string; // Devanagari line shown under the H1 (helps Hindi searches)
  intro: string;
  sections: { heading: string; body: string }[];
  faqs: SeoFaq[];
};

const pages: Record<SeoPageKey, SeoPage> = {
  /* ------------------------------------------------------------------ */
  home: {
    title: "Free Kundali in Hindi & English, Milan & Numerology",
    description:
      "Create a free janam kundali online in Hindi or English. AI-based kundali milan (36 gun), numerology and mahadasha readings with PDF download.",
    keywords: [
      "free kundali online",
      "janam kundali in hindi",
      "kundali milan online",
      "36 gun milan",
      "numerology by name and date of birth",
      "mahadasha calculator",
      "vedic astrology online",
      "online jyotish",
      "ai astrology",
    ],
    heading: "Free Online Kundali, Kundali Milan & Numerology",
    hindiHeading: "मुफ़्त ऑनलाइन जन्म कुंडली, कुंडली मिलान, न्यूमरोलॉजी और महादशा",
    intro:
      "Gen-K is a Vedic astrology (Jyotish) platform where you can create your janam kundali online, match two kundalis for marriage, read your numerology numbers and explore your Vimshottari mahadasha timeline, all in one place. Enter your date, time and place of birth, choose English or Hindi, and get a clear, AI-based reading that you can save or download as a PDF.",
    sections: [
      {
        heading: "Janam Kundali (जन्म कुंडली) in Hindi and English",
        body: "A janam kundali is a map of the sky at the exact moment and place you were born. Gen-K uses AI to turn your birth details into a Vedic birth chart reading and explains the ascendant, planetary positions and houses in simple language. You can switch the reading between English and Hindi (हिंदी) so that the explanation feels natural and easy to share with family.",
      },
      {
        heading: "Kundali Milan (कुंडली मिलान) with 36 Gun Matching",
        body: "Before marriage, many families compare the kundalis of the boy and girl. Create and save both kundalis in Gen-K, then run kundali milan. It follows the traditional Ashtakoot method, which scores eight factors such as Varna, Bhakoot and Nadi out of a total of 36 gunas. You get a breakdown of every koota, so you can see where the match is strong and where it needs a calm, thoughtful discussion.",
      },
      {
        heading: "Numerology by Name and Date of Birth",
        body: "Numerology looks at the numbers hidden in your name and birth date. Our numerology tool calculates core numbers such as your Life Path and Destiny number and shares related lucky numbers, lucky days and lucky colours. It is a simple way to reflect on your strengths, habits and direction in life.",
      },
      {
        heading: "Mahadasha and Antardasha Timeline (महादशा)",
        body: "In Vedic astrology, life is read in planetary periods called dashas. Gen-K shows your Vimshottari mahadasha sequence with antardasha sub-periods, so you can see which planet's period is running now and what is traditionally associated with it. The timeline is estimated from the Moon's position at birth.",
      },
      {
        heading: "Ask Questions with Your AI Astrology Friend",
        body: "Have a doubt about your chart? AI Friend is a conversational companion that uses your saved birth profile to answer astrology questions on career, relationships, health themes and more. It is built for guidance and reflection, and its answers should be taken as informational, not as a guaranteed prediction.",
      },
      {
        heading: "Save, Revisit and Download Your Reports",
        body: "Your readings can be saved so you do not need to type your birth details again for kundali, milan, numerology or mahadasha. Reports can also be downloaded as a PDF, which is handy when you want to share a chart with a pandit, a family member or your partner.",
      },
    ],
    faqs: [
      {
        question: "How can I make my kundali online for free?",
        answer:
          "Open the Kundali tool, enter your name, date of birth, exact time of birth and birthplace, and choose English or Hindi. Gen-K generates your janam kundali and a written reading that you can save or download as a PDF.",
      },
      {
        question: "Can I get my kundali in Hindi?",
        answer:
          "Yes. Gen-K lets you switch the reading language between English and Hindi (हिंदी), so you can read your janam kundali in the language you are most comfortable with.",
      },
      {
        question: "What is kundali milan and how are the 36 gunas calculated?",
        answer:
          "Kundali milan compares the birth charts of two people, usually before marriage. The Ashtakoot system checks eight areas such as Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot and Nadi, which together add up to 36 gunas. A higher score is traditionally seen as a better match, but it is only one part of judging compatibility.",
      },
      {
        question: "How accurate is my kundali if I don't know my birth time?",
        answer:
          "Birth time decides your ascendant (lagna) and house positions, so even a few minutes can change the chart. Use the time from your birth certificate or hospital record if possible. If the time is only approximate, treat the house-based parts of the reading with extra care.",
      },
      {
        question: "What is a mahadasha?",
        answer:
          "A mahadasha is a major planetary period in the Vimshottari dasha system, which divides a 120-year cycle among nine planets. Each mahadasha has smaller sub-periods called antardashas. Your starting dasha depends on the Moon's position at your birth.",
      },
      {
        question: "Are Gen-K readings calculated by AI?",
        answer:
          "Yes. Gen-K readings are AI-generated from the birth details you enter, so they are best treated as an informational estimate. For important decisions, please confirm your chart with a qualified astrologer.",
      },
      {
        question: "Is astrology a guaranteed prediction?",
        answer:
          "No. Astrology and numerology are traditional and cultural systems that many people use for reflection and guidance. Please do not use any reading as a substitute for professional medical, legal, financial or mental-health advice.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  kundali: {
    title: "Free Janam Kundali Online in Hindi & English",
    description:
      "Create your janam kundali online with date, time and place of birth. Get a Vedic birth chart reading in Hindi or English and download it as a PDF.",
    keywords: [
      "janam kundali online",
      "free kundali in hindi",
      "birth chart online",
      "kundali by date of birth",
      "lagna chart",
      "vedic birth chart",
      "kundali banane wala",
    ],
    heading: "Free Janam Kundali Online (Birth Chart)",
    hindiHeading: "जन्म कुंडली बनाएं, हिंदी या अंग्रेज़ी में",
    intro:
      "A kundali, also called a janam kundali, janam patri or Vedic birth chart, shows where the planets were placed in the sky at your time and place of birth. With Gen-K you can create your kundali online, read an easy explanation in Hindi or English, and save or download it as a PDF.",
    sections: [
      {
        heading: "What details do you need to make a kundali?",
        body: "You need your date of birth, the most accurate time of birth you can find, and your birthplace. The place is used to work out the ascendant (lagna) and the house positions, so choose the nearest city or town to where you were born.",
      },
      {
        heading: "What does a Vedic birth chart show?",
        body: "A kundali places the nine grahas (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu and Ketu) across twelve houses and zodiac signs. Traditionally, these placements are used to discuss personality, family, career, money, relationships and the main themes of life.",
      },
      {
        heading: "Read your kundali in your own language",
        body: "Many tools give a reading that is hard to follow. Gen-K lets you choose between English and हिंदी, and writes the explanation in plain words, so you can read it yourself, discuss it with your family or show it to your family astrologer.",
      },
      {
        heading: "Use your reading thoughtfully",
        body: "A kundali is a reflective guide, not a promise of what will happen. Your choices, effort and circumstances matter a great deal, and astrology should never replace professional medical, legal or financial advice.",
      },
    ],
    faqs: [
      {
        question: "How do I make a kundali by date of birth?",
        answer:
          "Enter your date of birth, time of birth and birthplace in the Kundali tool. Gen-K calculates your chart and prepares a reading. Date alone is not enough for a complete chart, because time and place are needed for the ascendant and houses.",
      },
      {
        question: "What is the difference between kundali and horoscope?",
        answer:
          "A kundali is a personal chart based on your exact birth details. A daily or sun-sign horoscope is more general and is based only on your zodiac sign, so it is the same for everyone with that sign.",
      },
      {
        question: "Can I download my kundali as a PDF?",
        answer:
          "Yes. After your reading is generated, you can save it and download it as a PDF to keep or share.",
      },
      {
        question: "What if I only know my approximate birth time?",
        answer:
          "Use your best estimate and keep in mind that the ascendant and house-based predictions may shift if the time is off. A birth certificate or hospital record is the most reliable source.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  milan: {
    title: "Kundali Milan Online – 36 Gun Matching for Marriage",
    description:
      "Do kundali milan online with Ashtakoot 36 gun matching. Compare two birth charts, see every koota score and download your compatibility report.",
    keywords: [
      "kundali milan online",
      "36 gun milan",
      "ashtakoot matching",
      "gun milan by date of birth",
      "marriage matching",
      "nadi dosh",
      "bhakoot dosh",
    ],
    heading: "Kundali Milan Online – 36 Gun Matching",
    hindiHeading: "कुंडली मिलान: अष्टकूट गुण मिलान ऑनलाइन",
    intro:
      "Kundali milan, also called gun milan or horoscope matching, is the traditional Vedic way of comparing two kundalis before marriage. Enter the birth details of both partners in Gen-K and see a clear Ashtakoot score out of 36, along with a koota-by-koota breakdown.",
    sections: [
      {
        heading: "What is Ashtakoot matching?",
        body: "Ashtakoot means eight factors: Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot and Nadi. Each one carries a fixed number of points, and together they make 36 gunas. The scores are based mainly on the position of the Moon in both charts.",
      },
      {
        heading: "How to read the guna score",
        body: "In many traditions, a score of around 18 out of 36 is seen as the minimum for a workable match, and higher scores are considered more favourable. Instead of looking only at the total, check which kootas scored low, such as Nadi or Bhakoot, since these are often discussed separately.",
      },
      {
        heading: "Enter accurate details for both partners",
        body: "You will need date, time and place of birth for the boy and the girl. Even a small error in birth time can change the Moon's nakshatra and therefore the final score, so use verified details wherever you can.",
      },
      {
        heading: "Compatibility is more than a score",
        body: "A happy marriage depends on communication, respect, shared values and family support. Treat kundali milan as cultural guidance, talk openly with each other, and consult a trusted astrologer or elder for important decisions.",
      },
    ],
    faqs: [
      {
        question: "How many gunas should match for marriage?",
        answer:
          "Traditionally, 18 or more out of 36 gunas is considered acceptable, and 25 or more is seen as very good. These are guidelines only, and families and astrologers often look at the whole chart as well.",
      },
      {
        question: "What are the 8 kootas in Ashtakoot?",
        answer:
          "They are Varna (1 point), Vashya (2), Tara (3), Yoni (4), Graha Maitri (5), Gana (6), Bhakoot (7) and Nadi (8), which add up to 36.",
      },
      {
        question: "Can I do kundali milan by date of birth only?",
        answer:
          "For a reliable result you need date, exact time and place of birth for both people, because the Moon's nakshatra and sign are used for the calculation.",
      },
      {
        question: "Is a low guna score a reason to cancel a marriage?",
        answer:
          "No single score should decide a relationship. Astrology offers traditional guidance, and many couples and astrologers consider remedies, cancellation rules and personal compatibility along with the guna score.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  numerology: {
    title: "Numerology Calculator by Name & Date of Birth",
    description:
      "Find your Life Path, Destiny number, lucky numbers, lucky days and lucky colours with a free online numerology reading by name and date of birth.",
    keywords: [
      "numerology calculator",
      "numerology by name",
      "numerology by date of birth",
      "life path number",
      "destiny number",
      "lucky number",
      "ank jyotish",
    ],
    heading: "Numerology Calculator by Name and Date of Birth",
    hindiHeading: "न्यूमरोलॉजी: नाम और जन्म तारीख से अंक ज्योतिष",
    intro:
      "Numerology (ank jyotish) studies the meaning of numbers connected with your name and birth date. Gen-K's numerology tool calculates your key numbers and explains them in simple language, along with lucky numbers, days and colours.",
    sections: [
      {
        heading: "What is your Life Path number?",
        body: "Your Life Path number is calculated from your full date of birth by reducing the digits to a single number. In numerology it is linked with your natural strengths, challenges and the general direction of your life.",
      },
      {
        heading: "What is the Destiny number?",
        body: "The Destiny (or Expression) number comes from the letters in your name. It is often discussed in connection with talents, ambitions and the way you express yourself. Spelling matters, so use the name exactly as you normally write it.",
      },
      {
        heading: "Lucky numbers, days and colours",
        body: "Along with your core numbers, Gen-K shares lucky numbers, lucky days and lucky colours as per your reading. Many people use these as simple, positive reminders when choosing dates, colours or numbers for special occasions.",
      },
      {
        heading: "Numerology as reflection, not a guarantee",
        body: "Numerology is a traditional belief system, not a scientific method of prediction. Enjoy the insights, reflect on what resonates with you, and avoid making major life decisions based only on numbers.",
      },
    ],
    faqs: [
      {
        question: "How do I calculate numerology by date of birth?",
        answer:
          "Add all the digits of your date of birth and keep reducing the total until you reach a single digit (or a master number in some systems). For example, 14-08-1995 becomes 1+4+0+8+1+9+9+5 = 37, then 3+7 = 10, then 1+0 = 1. Gen-K does this for you automatically.",
      },
      {
        question: "Does the spelling of my name change the result?",
        answer:
          "Yes. Name-based numbers depend on the letters, so different spellings can give different results. Use the spelling you use most often in official documents or daily life.",
      },
      {
        question: "What is my lucky number according to numerology?",
        answer:
          "Lucky numbers are usually linked with your birth-date number and name number. Enter your details in the Gen-K numerology tool to see your lucky numbers, lucky days and lucky colours.",
      },
      {
        question: "Is numerology the same as astrology?",
        answer:
          "No. Astrology (Jyotish) uses the positions of planets and stars at your birth, while numerology uses numbers drawn from your name and date of birth. Many people read both together for a fuller picture.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  mahadasha: {
    title: "Vimshottari Mahadasha & Antardasha Calculator",
    description:
      "Calculate your Vimshottari mahadasha and antardasha online from birth details. See your current planetary period and full dasha timeline.",
    keywords: [
      "mahadasha calculator",
      "vimshottari dasha online",
      "antardasha calculator",
      "current mahadasha",
      "dasha timeline",
      "shani mahadasha",
      "rahu mahadasha",
    ],
    heading: "Vimshottari Mahadasha and Antardasha Calculator",
    hindiHeading: "महादशा और अंतर्दशा: विंशोत्तरी दशा कैलकुलेटर",
    intro:
      "The Vimshottari dasha is the most widely used planetary-period system in Vedic astrology. With Gen-K you can find out which mahadasha and antardasha is running in your life and view your complete dasha timeline from your birth details.",
    sections: [
      {
        heading: "What is a mahadasha?",
        body: "A mahadasha is a long planetary period ruled by one of the nine grahas. The full Vimshottari cycle is 120 years, and each planet gets a fixed share: for example Ketu 7 years, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19 and Mercury 17.",
      },
      {
        heading: "What is an antardasha?",
        body: "Every mahadasha is divided into smaller sub-periods called antardashas (or bhuktis). The combination of the main planet and the sub-planet is what astrologers study to describe the flavour of a particular phase of life.",
      },
      {
        heading: "How is your starting dasha decided?",
        body: "Your first mahadasha depends on the nakshatra of the Moon at the time of your birth, and the balance of that period is worked out from how far the Moon had travelled in that nakshatra. This is why correct birth time and place are important.",
      },
      {
        heading: "Use the timeline with perspective",
        body: "Traditions interpret dashas differently, and a planet's effects also depend on its place in your chart. Use the timeline as a framework for reflection and planning, not as a certain forecast of events.",
      },
    ],
    faqs: [
      {
        question: "How do I find my current mahadasha?",
        answer:
          "Enter your date, time and place of birth in the Gen-K Mahadasha tool. It shows your complete timeline and highlights the mahadasha and antardasha that apply today.",
      },
      {
        question: "How long is each mahadasha?",
        answer:
          "In the Vimshottari system: Ketu 7 years, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19 and Mercury 17, totalling 120 years.",
      },
      {
        question: "Does a Saturn or Rahu mahadasha always bring bad results?",
        answer:
          "No. Traditionally, the results depend on the planet's strength, house and aspects in your own chart, so the same mahadasha can feel very different for different people.",
      },
      {
        question: "Why is my birth time so important for dasha?",
        answer:
          "The dasha sequence starts from the Moon's nakshatra, and the Moon moves about 13 degrees in a day. A change in birth time can shift the balance of the first dasha and every period after it.",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  "ai-friend": {
    title: "AI Astrology Friend – Ask Kundali Questions",
    description:
      "Chat with an AI astrology friend about your kundali, career, relationships and more. Get simple answers in Hindi or English based on your birth profile.",
    keywords: [
      "ai astrologer",
      "ai astrology chat",
      "ask astrologer online",
      "kundali questions",
      "jyotish ai",
      "voice astrology",
    ],
    heading: "AI Astrology Friend: Ask Your Kundali Questions",
    hindiHeading: "AI फ्रेंड: अपनी कुंडली के बारे में सवाल पूछें",
    intro:
      "AI Friend is Gen-K's conversational astrology companion. Choose your saved birth profile, ask a question in simple words, and get an easy explanation based on traditional Vedic astrology concepts, in Hindi or English.",
    sections: [
      {
        heading: "Start with your birth profile",
        body: "Select or create a profile with your date, time and place of birth. The companion uses this context so that its answers relate to your chart instead of being generic.",
      },
      {
        heading: "What can you ask?",
        body: "You can ask about career and study themes, relationships, planetary placements, your current dasha or the meaning of a term in your reading. Short, clear questions usually give the most useful answers.",
      },
      {
        heading: "Talk in your own language",
        body: "Ask in English or Hindi and get a reply that is easy to follow, without heavy jargon. It is a friendly way to understand your chart when an astrologer is not available.",
      },
      {
        heading: "Important to remember",
        body: "AI-generated answers can be incomplete or wrong. Treat them as informational, share only the details you need, and do not rely on them for medical, legal, financial or mental-health decisions.",
      },
    ],
    faqs: [
      {
        question: "Can AI predict my future?",
        answer:
          "No. AI Friend explains traditional astrology concepts and themes in your chart, but it cannot predict the future with certainty. Use its answers for reflection and guidance.",
      },
      {
        question: "Do I need to enter my birth details again?",
        answer:
          "If you have already saved a profile in Gen-K, you can select it and start chatting. Otherwise, create a profile once with accurate birth details.",
      },
      {
        question: "Can I ask questions in Hindi?",
        answer:
          "Yes. You can switch between English and Hindi and ask in the language you prefer.",
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
    keywords: content.keywords,
    robots: page === "home" ? undefined : { index: false, follow: true },
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

/** FAQPage structured data (JSON-LD) for a page's FAQs. */
export function getFaqJsonLd(faqs: SeoFaq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
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