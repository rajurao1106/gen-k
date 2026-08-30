import { GoogleGenAI } from "@google/genai";
import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";

type ChartData = {
  lagna?: string;
  ayanamsa?: string;
  houses: Record<string, string[]>;
};

type KundaliRecord = {
  name: string;
  dob: string;
  bot: string;
  bop: string;
  gender: string;
  content: string;
  chart?: ChartData | null;
};

type FieldKey = "name" | "dob" | "bot" | "bop" | "gender";

const FIELDS: {
  key: FieldKey;
  label: string;
  placeholder: string;
  type: string;
}[] = [
  {
    key: "name",
    label: "Full name",
    placeholder: "e.g. Ananya Sharma",
    type: "text",
  },
  {
    key: "dob",
    label: "Date of birth",
    placeholder: "DD/MM/YYYY",
    type: "date",
  },
  {
    key: "bot",
    label: "Time of birth",
    placeholder: "e.g. 06:45 AM",
    type: "time",
  },
  {
    key: "bop",
    label: "Place of birth",
    placeholder: "City, State, Country",
    type: "text",
  },
];

// Fixed North-Indian style kundali layout: 12 house polygons + label centers
// drawn on a 400x400 viewBox. House 1 (Lagna) is always the top diamond,
// numbering proceeds clockwise, matching the classic North Indian chart.
const HOUSE_POLYGONS: Record<number, string> = {
  1: "200,0 300,100 200,200 100,100",
  2: "200,0 400,0 300,100",
  3: "400,0 400,200 300,100",
  4: "400,200 300,300 200,200 300,100",
  5: "400,200 400,400 300,300",
  6: "400,400 200,400 300,300",
  7: "200,400 100,300 200,200 300,300",
  8: "200,400 0,400 100,300",
  9: "0,400 0,200 100,300",
  10: "0,200 100,100 200,200 100,300",
  11: "0,200 0,0 100,100",
  12: "0,0 200,0 100,100",
};

const HOUSE_CENTERS: Record<number, [number, number]> = {
  1: [200, 100],
  2: [300, 33],
  3: [367, 100],
  4: [300, 200],
  5: [367, 300],
  6: [300, 367],
  7: [200, 300],
  8: [100, 367],
  9: [33, 300],
  10: [100, 200],
  11: [33, 100],
  12: [100, 33],
};

function KundaliChartSVG({ data }: { data: ChartData }) {
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[320px] mx-auto">
      <rect
        x="1"
        y="1"
        width="398"
        height="398"
        fill="#0a0e26"
        stroke="#d4af6a"
        strokeWidth="2"
      />
      <polygon
        points="200,0 400,200 200,400 0,200"
        fill="none"
        stroke="#d4af6a"
        strokeWidth="1.5"
      />
      <line x1="0" y1="0" x2="400" y2="400" stroke="#d4af6a" strokeWidth="1.5" />
      <line x1="400" y1="0" x2="0" y2="400" stroke="#d4af6a" strokeWidth="1.5" />
      {Object.entries(HOUSE_POLYGONS).map(([houseNum]) => {
        const n = Number(houseNum);
        const [cx, cy] = HOUSE_CENTERS[n];
        const planets = data.houses?.[houseNum] ?? [];
        return (
          <g key={houseNum}>
            <text
              x={cx}
              y={cy - 14}
              textAnchor="middle"
              fontSize="10"
              fill="#7a80a8"
            >
              {houseNum}
              {n === 1 ? " (Lg)" : ""}
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="#f1ede4"
            >
              {planets.join(" ")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function stripHtmlToText(htmlStr: string) {
  const div = document.createElement("div");
  div.innerHTML = htmlStr;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default function App() {
  const [html, setHtml] = useState("");
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [input, setInput] = useState({
    name: "",
    dob: "",
    bot: "",
    bop: "",
    gender: "",
  });
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kundali, setKundali] = useState<KundaliRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [speechState, setSpeechState] = useState<
    "idle" | "speaking" | "paused"
  >("idle");

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    const existingRaw = localStorage.getItem("kundali");
    setKundali(existingRaw ? JSON.parse(existingRaw) : []);
  }, []);

  // Stop any speech in progress if the underlying reading changes or unmounts.
  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (speechSupported) window.speechSynthesis.cancel();
    setSpeechState("idle");
  }, [html]);

  const isFormComplete = useMemo(
    () => Boolean(input.name && input.dob && input.bot && input.bop),
    [input],
  );

  const details: KundaliRecord[] = [
    {
      name: input.name,
      dob: input.dob,
      bot: input.bot,
      bop: input.bop,
      gender: input.gender,
      content: html,
      chart: chartData,
    },
  ];

  const storedData = () => {
    const existingRaw = localStorage.getItem("kundali");
    const existingList: KundaliRecord[] = existingRaw
      ? JSON.parse(existingRaw)
      : [];
    const updateList = [...existingList, ...details];
    localStorage.setItem("kundali", JSON.stringify(updateList));
    setKundali(updateList);
    setActiveIndex(updateList.length - 1);
  };

  const getData = (item: KundaliRecord, index: number) => {
    setHtml(item.content);
    setChartData(item.chart ?? null);
    setInput({
      name: item.name,
      dob: item.dob,
      bot: item.bot,
      bop: item.bop,
      gender: item.gender,
    });
    setActiveIndex(index);
    setError(null);
  };

  const deleteData = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updateList = kundali.filter((_, i) => i !== index);
    localStorage.setItem("kundali", JSON.stringify(updateList));
    setKundali(updateList);
    if (activeIndex === index) {
      setActiveIndex(null);
      setHtml("");
      setChartData(null);
    } else if (activeIndex !== null && index < activeIndex) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const onchangeHandle = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setInput({
      ...input,
      [e.target.name]: e.target.value,
    });
  };

  // Second, lightweight AI call: asks for a strict JSON house/planet map so
  // the birth chart (Kundali diagram) can be drawn accurately from the same
  // reading. Failure here never blocks the main text reading.
  const generateChartData = async () => {
    try {
      setChartLoading(true);
      const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_API_KEY,
      });

      const response = ai.interactions.create({
        model: "gemini-3.5-flash",
        input: `Based on this person's exact birth details, compute their Vedic (sidereal) birth chart.

Name: ${input.name}
Date of Birth: ${input.dob}
Time of Birth: ${input.bot}
Place of Birth: ${input.bop}

Respond with ONLY a raw JSON object, no markdown fences, no explanation, no extra text. Use this exact shape:

{"lagna":"<ascendant rashi name>","ayanamsa":"<ayanamsa system used, e.g. Lahiri>","houses":{"1":["Su","Ma"],"2":[],"3":[],"4":[],"5":[],"6":[],"7":[],"8":[],"9":[],"10":[],"11":[],"12":["Ke"]}}

Rules:
- Keys "1" through "12" must all be present in "houses", house 1 is always the Lagna/Ascendant house.
- Use only these two-letter planet codes: Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke.
- Place each planet in exactly one house based on the actual computed chart.
- If birth time is uncertain and house placement cannot be reliably computed, still give your best estimate rather than omitting the field.
- Do not include any text outside the JSON object.`,
      });

      const text = (await response).output_text ?? "";
      const parsed = extractJson(text);
      if (parsed && parsed.houses) {
        setChartData(parsed as ChartData);
      } else {
        setChartData(null);
      }
    } catch (err) {
      console.error(err);
      setChartData(null);
    } finally {
      setChartLoading(false);
    }
  };

  const createShayari = async () => {
    if (!isFormComplete) {
      setError("Please fill in name, date, time, and place of birth.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setChartData(null);
      const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_API_KEY,
      });

      const response = ai.interactions.create({
        model: "gemini-3.5-flash",

        input: `# AI Kundli Life Analysis — Master Prompt

        You are an expert Vedic Astrology (Jyotish) AI assistant. Your task is to analyze a person's Kundli based on their exact **Date of Birth, Time of Birth, and Place of Birth** and provide a detailed, personalized interpretation of their life.

        ## User Birth Details

        * **Name:**  ${input.name}
        * **Date of Birth:**  ${input.dob}
        * **Time of Birth:**  ${input.bot}
        * **Place of Birth:**  ${input.bop}
        * **Gender (optional):**  ${input.gender}

        ## Response Language

        Write the ENTIRE response in ${
          language === "hi" ? "Hindi, using Devanagari script" : "English"
        }. Every heading, section title, table label and sentence — including "Your Personalized Kundli Analysis", "Birth Details" and "Key Takeaways" — must be in ${
          language === "hi" ? "Hindi" : "English"
        }. Do not mix languages.

        First, use these birth details to determine the person's Vedic astrology chart, including Lagna/Ascendant, Moon sign, Sun sign, planetary placements, houses, Nakshatra, Vimshottari Dasha and relevant divisional charts where applicable.

        Do not make generic horoscope statements. Every interpretation should be connected to the person's actual Kundli.

        ---

        # Analysis Requirements

        Provide a comprehensive life analysis covering the following areas:

        ## 1. Kundli Overview

        * Lagna/Ascendant
        * Rashi/Moon sign
        * Sun sign
        * Nakshatra and Pada
        * Important planetary placements
        * Strong and weak planets
        * Benefic and challenging influences
        * Important yogas and doshas
        * Overall personality indicated by the chart

        ## 2. Personality & Character

        Explain:

        * Natural personality
        * Strengths
        * Weaknesses
        * Emotional nature
        * Thinking and decision-making style
        * Confidence and self-image
        * Communication style
        * Hidden talents
        * Behavioral patterns
        * Major character-development themes

        ## 3. Education & Intelligence

        Analyze:

        * Learning ability
        * Academic potential
        * Suitable fields of study
        * Higher education possibilities
        * Competitive exams
        * Research/technical/creative abilities
        * Potential educational challenges
        * Periods favorable for education

        ## 4. Career & Profession

        Analyze:

        * Suitable career fields
        * Job vs business potential
        * Leadership ability
        * Professional strengths
        * Career obstacles
        * Career changes
        * Foreign opportunities
        * Government/private-sector possibilities
        * Entrepreneurship potential
        * Professional reputation
        * Major career growth periods

        Give the reasoning from the relevant houses, planets and dashas.

        ## 5. Money & Wealth

        Analyze:

        * Income potential
        * Savings
        * Wealth accumulation
        * Financial stability
        * Business/investment tendencies
        * Sudden gains or expenses
        * Property/asset potential
        * Financially favorable periods
        * Financial risks and habits

        Avoid guaranteeing exact financial outcomes.

        ## 6. Love & Relationships

        Analyze:

        * Romantic personality
        * Relationship patterns
        * Emotional needs
        * Attraction patterns
        * Possibility of serious relationships
        * Potential relationship challenges
        * Compatibility tendencies
        * Important relationship periods

        Do not claim certainty about another person's feelings or behavior.

        ## 7. Marriage

        Analyze:

        * Marriage tendencies
        * Likely nature of spouse
        * Spouse's personality characteristics
        * Relationship dynamics
        * Possible delays or challenges
        * Married-life strengths and weaknesses
        * Favorable marriage periods based on dasha/transits

        If predicting timing, clearly label it as an astrological estimate rather than a guaranteed event.

        ## 8. Family & Parents

        Analyze:

        * Relationship with parents
        * Family environment
        * Responsibilities toward family
        * Sibling relationships
        * Major family-related themes
        * Potential changes in family life

        ## 9. Children & Family Life

        Analyze, where astrologically appropriate:

        * Possibility and general tendencies regarding children
        * Parenting style
        * Relationship with children
        * Family expansion periods

        Do not make definitive medical or fertility claims.

        ## 10. Health & Well-being

        Analyze only general astrological tendencies:

        * Areas where the person may need to maintain healthy habits
        * Stress tendencies
        * Energy patterns
        * Lifestyle considerations

        Never diagnose diseases or replace professional medical advice.

        ## 11. Overall Life Summary

        End with a concise but meaningful summary covering:

        * The person's biggest natural strengths
        * Main life challenges
        * Career direction
        * Financial tendencies
        * Relationship/marriage tendencies
        * Important life phases
        * Areas where conscious effort can improve outcomes

        # Response Rules

        1. Be personalized and specific to the provided birth details.
        2. Explain the astrological reasoning behind important conclusions.
        3. Do not make generic statements that could apply to everyone.
        4. Never guarantee future events.
        5. Use phrases such as "Kundli indicates", "there is a possibility", "this period may favor", or "astrologically, this suggests".
        6. Never use astrology to make medical diagnoses.
        7. Never create unnecessary fear regarding death, disease, accidents, divorce, financial loss or other serious events.
        8. Do not claim that a prediction is 100% certain.
        9. If birth time is uncertain, explicitly explain that house and timing-based predictions may become less reliable.
        10. If required birth-chart calculations are unavailable or uncertain, do not fabricate planetary positions. State what information/calculation is missing.
        11. Prefer Vedic/Sidereal astrology and clearly state the ayanamsa/system being used.
        12. Use clear headings, tables and bullet points where they improve readability.
        13. Give the user both positive possibilities and potential challenges.
        14. Make the reading insightful, balanced and easy for a non-astrologer to understand.

        # Final Output Structure

        Start with:

        **🔮 Your Personalized Kundli Analysis**

        Then show:

        **Birth Details**

        * DOB
        * Birth Time
        * Birth Place

        Then provide:

        1. Kundli Overview
        2. Personality
        3. Education
        4. Career
        5. Money & Wealth
        6. Love & Relationships
        7. Marriage
        8. Family
        9. Children
        10. Health & Well-being
        11. Overall Life Summary

        End with a section titled:

        **✨ Key Takeaways**

        Give the 5–10 most important insights from the person's Kundli in simple language.
        `,
      });

      const text = (await response).output_text ?? "";
      const shayari = await marked.parse(text);

      setHtml(shayari);
      setActiveIndex(null);

      // Fire the chart request after the main reading succeeds; this never
      // blocks or fails the text reading if it errors out.
      generateChartData();
    } catch (error) {
      console.error(error);
      setError(
        "Something went wrong while consulting the stars. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const translateToHindi = async () => {
    if (!html) return;
    try {
      setTranslating(true);
      setError(null);
      const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_API_KEY,
      });

      const response = ai.interactions.create({
        model: "gemini-3.5-flash",
        input: `Translate the following Kundli reading (given as HTML) into natural, fluent Hindi using Devanagari script. Keep all HTML tags (h1, h2, h3, p, ul, li, table, tr, th, td, strong, etc.) and their structure exactly as they are — translate only the visible text content inside the tags. Do not add commentary before or after. Do not wrap the output in markdown code fences.

HTML to translate:
${html}`,
      });

      const text = (await response).output_text ?? "";
      setHtml(text.trim());
      setLanguage("hi");
    } catch (error) {
      console.error(error);
      setError("Could not translate this reading to Hindi. Please try again.");
    } finally {
      setTranslating(false);
    }
  };

  const handlePlayPause = () => {
    if (!speechSupported || !html) return;
    if (speechState === "speaking") {
      window.speechSynthesis.pause();
      setSpeechState("paused");
      return;
    }
    if (speechState === "paused") {
      window.speechSynthesis.resume();
      setSpeechState("speaking");
      return;
    }
    window.speechSynthesis.cancel();
    const text = stripHtmlToText(html);
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => setSpeechState("idle");
    utterance.onerror = () => setSpeechState("idle");
    window.speechSynthesis.speak(utterance);
    setSpeechState("speaking");
  };

  const handleStopSpeech = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeechState("idle");
  };

  const handleDownloadPdf = () => {
    if (!html) return;
    window.print();
  };

  return (
    <div id="appShell" className="relative min-h-screen bg-[#0a0e26] text-[#f1ede4] overflow-x-hidden">
      {/* Font import + subtle starfield background */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Cormorant Garamond', serif; }
        .font-body { font-family: 'Manrope', sans-serif; }
        .starfield {
          background-image:
            radial-gradient(1px 1px at 20px 30px, rgba(241,237,228,0.5), transparent),
            radial-gradient(1px 1px at 120px 80px, rgba(241,237,228,0.4), transparent),
            radial-gradient(1.5px 1.5px at 200px 150px, rgba(212,175,106,0.5), transparent),
            radial-gradient(1px 1px at 300px 40px, rgba(241,237,228,0.35), transparent),
            radial-gradient(1.5px 1.5px at 340px 220px, rgba(142,124,195,0.5), transparent),
            radial-gradient(1px 1px at 60px 200px, rgba(241,237,228,0.4), transparent);
          background-repeat: repeat;
          background-size: 380px 260px;
        }
        .prose-kundli h2 { font-family: 'Cormorant Garamond', serif; color: #d4af6a; font-size: 1.5rem; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(212,175,106,0.25); padding-bottom: 0.4rem; }
        .prose-kundli h1 { font-family: 'Cormorant Garamond', serif; color: #f1ede4; font-size: 2rem; margin-bottom: 1rem; }
        .prose-kundli h3 { color: #b8ade0; font-size: 1.05rem; margin-top: 1.25rem; margin-bottom: 0.4rem; }
        .prose-kundli p { color: #cbd0e8; line-height: 1.7; margin-bottom: 0.85rem; }
        .prose-kundli ul { color: #cbd0e8; margin-bottom: 0.85rem; padding-left: 1.1rem; }
        .prose-kundli li { margin-bottom: 0.35rem; }
        .prose-kundli li::marker { color: #d4af6a; }
        .prose-kundli strong { color: #f1ede4; }
        .prose-kundli table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin-bottom: 1rem; -webkit-overflow-scrolling: touch; }
        .prose-kundli th, .prose-kundli td { border: 1px solid rgba(255,255,255,0.1); padding: 0.5rem 0.75rem; text-align: left; color: #cbd0e8; white-space: nowrap; }
        .prose-kundli th { color: #d4af6a; font-weight: 600; }
        .prose-kundli h1, .prose-kundli h2, .prose-kundli h3, .prose-kundli p, .prose-kundli li {
          overflow-wrap: break-word;
          word-break: break-word;
        }
        input[type="date"], input[type="time"] { color-scheme: dark; }
        html, body { max-width: 100%; overflow-x: hidden; }
        * { min-width: 0; }

        @media print {
          /* Chrome clips overflowing content to one page when it sits inside
             a display:grid/flex ancestor. Flatten every ancestor of the
             printable area back to normal block flow so the full reading
             (which can run several pages) is allowed to paginate. */
          html, body, #root { height: auto !important; overflow: visible !important; }
          #appShell { position: static !important; height: auto !important; overflow: visible !important; }
          #mainGrid { display: block !important; height: auto !important; }

          .no-print { display: none !important; }

          #printArea {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111111 !important;
            box-shadow: none !important;
            border: none !important;
          }
          #printArea .prose-kundli h2 { color: #6b4f14; }
          #printArea .prose-kundli p,
          #printArea .prose-kundli ul,
          #printArea .prose-kundli li,
          #printArea .prose-kundli th,
          #printArea .prose-kundli td { color: #111111; }
          #printArea .prose-kundli strong { color: #000000; }
          #printArea .prose-kundli h2,
          #printArea .prose-kundli h3,
          #printArea table { break-inside: avoid-page; }
        }
      `}</style>

      <div className="absolute inset-0 starfield opacity-60 pointer-events-none no-print" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[560px] w-[560px] rounded-full border border-[#d4af6a]/10 pointer-events-none no-print" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full border border-[#8e7cc3]/10 pointer-events-none no-print" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 font-body">
        {/* Header */}
        <header className="text-center mb-10">
          <p className="text-[#d4af6a] text-xs tracking-[0.3em] uppercase mb-3">
            Vedic Astrology · Jyotish
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">
            Gen-K Generate Your Kundali Online{" "}
          </h1>
          <p className="text-[#9ca3c2] mt-3 max-w-xl mx-auto text-sm sm:text-base">
            Enter your exact birth details and receive a personalized life
            reading — grounded in your chart, not generic horoscopes.
          </p>
        </header>

        <div id="mainGrid" className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* Left column: form + saved list */}
          <div className="space-y-6 lg:sticky lg:top-8 no-print">
            <div className="rounded-2xl border border-white/10 bg-[#12163a]/80 backdrop-blur p-6 shadow-xl shadow-black/20">
              <h2 className="font-display text-xl text-[#f1ede4] mb-1">
                Birth details
              </h2>
              <p className="text-xs text-[#9ca3c2] mb-5">
                Accuracy of time and place matters most for house-based
                predictions.
              </p>

              <div className="space-y-4">
                {FIELDS.map((field) => (
                  <div key={field.key}>
                    <label
                      htmlFor={field.key}
                      className="block text-xs font-medium text-[#b8ade0] mb-1.5"
                    >
                      {field.label}
                    </label>
                    <input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={input[field.key]}
                      name={field.key}
                      onChange={onchangeHandle}
                      className="w-full rounded-lg bg-[#0a0e26] border border-white/10 px-3.5 py-2.5 text-sm text-[#f1ede4] placeholder:text-[#5c6390] outline-none focus:border-[#d4af6a]/60 focus:ring-1 focus:ring-[#d4af6a]/40 transition-colors"
                    />
                  </div>
                ))}

                <div>
                  <label
                    htmlFor="gender"
                    className="block text-xs font-medium text-[#b8ade0] mb-1.5"
                  >
                    Gender <span className="text-[#5c6390]">(optional)</span>
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={input.gender}
                    onChange={onchangeHandle}
                    className="w-full rounded-lg bg-[#0a0e26] border border-white/10 px-3.5 py-2.5 text-sm text-[#f1ede4] outline-none focus:border-[#d4af6a]/60 focus:ring-1 focus:ring-[#d4af6a]/40 transition-colors"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#b8ade0] mb-1.5">
                    Reading language
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLanguage("en")}
                      className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                        language === "en"
                          ? "bg-[#d4af6a]/10 border-[#d4af6a]/50 text-[#d4af6a]"
                          : "bg-[#0a0e26] border-white/10 text-[#9ca3c2] hover:border-white/20"
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage("hi")}
                      className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                        language === "hi"
                          ? "bg-[#d4af6a]/10 border-[#d4af6a]/50 text-[#d4af6a]"
                          : "bg-[#0a0e26] border-white/10 text-[#9ca3c2] hover:border-white/20"
                      }`}
                    >
                      हिंदी
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-4 text-xs text-[#e08a8a] bg-[#e08a8a]/10 border border-[#e08a8a]/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  onClick={createShayari}
                  disabled={loading}
                  className="w-full rounded-lg bg-[#d4af6a] hover:bg-[#c49f58] disabled:bg-[#8a7748] disabled:cursor-not-allowed text-[#0a0e26] font-semibold text-sm py-2.5 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-[#0a0e26]/40 border-t-[#0a0e26] animate-spin" />
                      Consulting the stars…
                    </>
                  ) : (
                    "Generate reading"
                  )}
                </button>
                <button
                  onClick={storedData}
                  disabled={!html || loading}
                  className="w-full rounded-lg border border-white/15 hover:border-[#8e7cc3]/50 hover:text-[#b8ade0] disabled:opacity-40 disabled:cursor-not-allowed text-[#f1ede4] text-sm py-2.5 transition-colors"
                >
                  Save this reading
                </button>
              </div>
            </div>

            {kundali.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#12163a]/80 backdrop-blur p-6 shadow-xl shadow-black/20">
                <h3 className="font-display text-lg text-[#f1ede4] mb-3">
                  Saved readings
                </h3>
                <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {kundali.map((item, index) => (
                    <li key={index}>
                      <button
                        onClick={() => getData(item, index)}
                        className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors border ${
                          activeIndex === index
                            ? "bg-[#d4af6a]/10 border-[#d4af6a]/40 text-[#d4af6a]"
                            : "bg-transparent border-white/5 hover:border-white/15 text-[#cbd0e8]"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {item.name || "Untitled"}
                          </span>
                          <span className="block text-xs text-[#7a80a8] truncate">
                            {item.dob}
                          </span>
                        </span>
                        <span
                          role="button"
                          onClick={(e) => deleteData(index, e)}
                          className="shrink-0 text-[#7a80a8] hover:text-[#e08a8a] text-xs px-1.5 py-0.5 rounded transition-colors"
                          aria-label={`Delete ${item.name}`}
                        >
                          ✕
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right column: reading */}
          <div
            id="printArea"
            className="rounded-2xl border border-white/10 bg-[#12163a]/60 backdrop-blur p-6 sm:p-8 min-h-[420px] shadow-xl shadow-black/20"
          >
            {!html && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 text-[#5c6390] no-print">
                <div className="text-4xl mb-4">✦</div>
                <p className="font-display text-xl text-[#9ca3c2] mb-1">
                  Your reading will appear here
                </p>
                <p className="text-sm max-w-sm">
                  Fill in your birth details and generate a reading, or select a
                  saved one from the left.
                </p>
              </div>
            )}

            {loading && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center no-print">
                <div className="h-8 w-8 rounded-full border-2 border-[#d4af6a]/30 border-t-[#d4af6a] animate-spin mb-4" />
                <p className="text-sm text-[#9ca3c2]">
                  Mapping planetary placements and dashas…
                </p>
              </div>
            )}

            {!loading && html && (
              <>
                <div className="flex flex-wrap justify-end gap-2 mb-4 no-print">
                  <button
                    onClick={translateToHindi}
                    disabled={translating || language === "hi"}
                    className="text-xs flex items-center gap-1.5 rounded-lg border border-white/10 hover:border-[#8e7cc3]/50 hover:text-[#b8ade0] disabled:opacity-40 disabled:cursor-not-allowed text-[#cbd0e8] px-3 py-1.5 transition-colors"
                  >
                    {translating ? (
                      <>
                        <span className="h-3 w-3 rounded-full border-2 border-[#b8ade0]/30 border-t-[#b8ade0] animate-spin" />
                        Hindi mein badla ja raha hai…
                      </>
                    ) : language === "hi" ? (
                      "हिंदी में उपलब्ध"
                    ) : (
                      "हिंदी में अनुवाद करें"
                    )}
                  </button>

                  {speechSupported && (
                    <>
                      <button
                        onClick={handlePlayPause}
                        className="text-xs flex items-center gap-1.5 rounded-lg border border-white/10 hover:border-[#d4af6a]/50 hover:text-[#d4af6a] text-[#cbd0e8] px-3 py-1.5 transition-colors"
                      >
                        {speechState === "speaking"
                          ? "⏸ रोकें"
                          : speechState === "paused"
                            ? "▶ फिर से सुनें"
                            : "🔊 रिस्पॉन्स सुनें"}
                      </button>
                      {speechState !== "idle" && (
                        <button
                          onClick={handleStopSpeech}
                          className="text-xs flex items-center gap-1.5 rounded-lg border border-white/10 hover:border-[#e08a8a]/50 hover:text-[#e08a8a] text-[#cbd0e8] px-3 py-1.5 transition-colors"
                        >
                          ⏹ बंद करें
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={handleDownloadPdf}
                    className="text-xs flex items-center gap-1.5 rounded-lg border border-[#d4af6a]/40 hover:border-[#d4af6a] text-[#d4af6a] px-3 py-1.5 transition-colors"
                  >
                    ⬇ चार्ट सहित डाउनलोड करें
                  </button>
                </div>

                {(chartLoading || chartData) && (
                  <div className="mb-6 rounded-xl border border-white/10 bg-[#0a0e26]/60 p-4">
                    <h3 className="font-display text-lg text-[#d4af6a] mb-2 text-center">
                      Janma Kundali (Birth Chart)
                    </h3>
                    {chartLoading && !chartData && (
                      <p className="text-xs text-[#9ca3c2] text-center py-6 no-print">
                        चार्ट तैयार किया जा रहा है…
                      </p>
                    )}
                    {chartData && (
                      <>
                        <KundaliChartSVG data={chartData} />
                        <p className="text-center text-xs text-[#7a80a8] mt-3">
                          {chartData.lagna ? `Lagna: ${chartData.lagna}` : ""}
                          {chartData.lagna && chartData.ayanamsa ? " · " : ""}
                          {chartData.ayanamsa
                            ? `Ayanamsa: ${chartData.ayanamsa}`
                            : ""}
                        </p>
                        <p className="text-center text-[10px] text-[#5c6390] mt-1">
                          North Indian style chart, AI-computed from your
                          reading — verify against a certified astrologer for
                          critical decisions.
                        </p>
                      </>
                    )}
                  </div>
                )}

                <div
                  className="prose-kundli"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}