import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { callGemini, extractJson, isQuotaOrRateLimitError, QUOTA_ERROR_MESSAGE_HI } from "../lib/gemini";
import { deleteKundaliRecord, getSavedKundalis, saveKundaliRecord } from "../lib/storage";
import { KundaliChartSVG } from "../components/KundaliChartSVG";
import { BIRTH_FIELDS, type ChartData, type KundaliRecord } from "../types";

function stripHtmlToText(htmlStr: string) {
  const div = document.createElement("div");
  div.innerHTML = htmlStr;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

export default function KundaliPage() {
  const [html, setHtml] = useState("");
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [input, setInput] = useState({ name: "", dob: "", bot: "", bop: "", gender: "" });
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kundali, setKundali] = useState<KundaliRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [speechState, setSpeechState] = useState<"idle" | "speaking" | "paused">("idle");

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    setKundali(getSavedKundalis());
  }, []);

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

  const storedData = () => {
    const updated = saveKundaliRecord({
      name: input.name,
      dob: input.dob,
      bot: input.bot,
      bop: input.bop,
      gender: input.gender,
      content: html,
      chart: chartData,
    });
    setKundali(updated);
    setActiveIndex(updated.length - 1);
  };

  const getData = (item: KundaliRecord, index: number) => {
    setHtml(item.content);
    setChartData(item.chart ?? null);
    setInput({ name: item.name, dob: item.dob, bot: item.bot, bop: item.bop, gender: item.gender });
    setActiveIndex(index);
    setError(null);
  };

  const deleteData = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteKundaliRecord(index);
    setKundali(updated);
    if (activeIndex === index) {
      setActiveIndex(null);
      setHtml("");
      setChartData(null);
    } else if (activeIndex !== null && index < activeIndex) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const onchangeHandle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setInput({ ...input, [e.target.name]: e.target.value });
  };

  // Second, lightweight AI call: asks for a strict JSON house/planet map so
  // the birth chart (Kundali diagram) can be drawn accurately from the same
  // reading. Failure here never blocks the main text reading.
  const generateChartData = async () => {
    try {
      setChartLoading(true);
      const response = await callGemini({
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
      const text = response.output_text ?? "";
      const parsed = extractJson(text);
      setChartData(parsed && parsed.houses ? (parsed as ChartData) : null);
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

      const response = await callGemini({
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
        * Lagna/Ascendant, Rashi/Moon sign, Sun sign, Nakshatra and Pada
        * Important planetary placements, strong and weak planets
        * Benefic and challenging influences, important yogas and doshas
        * Overall personality indicated by the chart

        ## 2. Personality & Character
        Natural personality, strengths, weaknesses, emotional nature, thinking and decision-making style, confidence and self-image, communication style, hidden talents, behavioral patterns, major character-development themes.

        ## 3. Education & Intelligence
        Learning ability, academic potential, suitable fields of study, higher education possibilities, competitive exams, research/technical/creative abilities, potential educational challenges, periods favorable for education.

        ## 4. Career & Profession
        Suitable career fields, job vs business potential, leadership ability, professional strengths, career obstacles, career changes, foreign opportunities, government/private-sector possibilities, entrepreneurship potential, professional reputation, major career growth periods. Give the reasoning from the relevant houses, planets and dashas.

        ## 5. Money & Wealth
        Income potential, savings, wealth accumulation, financial stability, business/investment tendencies, sudden gains or expenses, property/asset potential, financially favorable periods, financial risks and habits. Avoid guaranteeing exact financial outcomes.

        ## 6. Love & Relationships
        Romantic personality, relationship patterns, emotional needs, attraction patterns, possibility of serious relationships, potential relationship challenges, compatibility tendencies, important relationship periods. Do not claim certainty about another person's feelings or behavior.

        ## 7. Marriage
        Marriage tendencies, likely nature of spouse, spouse's personality characteristics, relationship dynamics, possible delays or challenges, married-life strengths and weaknesses, favorable marriage periods based on dasha/transits. If predicting timing, clearly label it as an astrological estimate rather than a guaranteed event.

        ## 8. Family & Parents
        Relationship with parents, family environment, responsibilities toward family, sibling relationships, major family-related themes, potential changes in family life.

        ## 9. Children & Family Life
        Possibility and general tendencies regarding children, parenting style, relationship with children, family expansion periods. Do not make definitive medical or fertility claims.

        ## 10. Health & Well-being
        Areas where the person may need to maintain healthy habits, stress tendencies, energy patterns, lifestyle considerations. Never diagnose diseases or replace professional medical advice.

        ## 11. Overall Life Summary
        Biggest natural strengths, main life challenges, career direction, financial tendencies, relationship/marriage tendencies, important life phases, areas where conscious effort can improve outcomes.

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

        Start with **🔮 Your Personalized Kundli Analysis**, then show **Birth Details** (DOB, Birth Time, Birth Place), then sections 1–11 above, and end with **✨ Key Takeaways** — the 5–10 most important insights from the person's Kundli in simple language.
        `,
      });

      const text = response.output_text ?? "";
      const shayari = await marked.parse(text);
      setHtml(shayari);
      setActiveIndex(null);

      // Fire the chart request after the main reading succeeds; this never
      // blocks or fails the text reading if it errors out.
      generateChartData();
    } catch (error) {
      console.error(error);
      setError(isQuotaOrRateLimitError(error) ? QUOTA_ERROR_MESSAGE_HI : "Something went wrong while consulting the stars. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const translateToHindi = async () => {
    if (!html) return;
    try {
      setTranslating(true);
      setError(null);
      const response = await callGemini({
        model: "gemini-3.5-flash",
        input: `Translate the following Kundli reading (given as HTML) into natural, fluent Hindi using Devanagari script. Keep all HTML tags (h1, h2, h3, p, ul, li, table, tr, th, td, strong, etc.) and their structure exactly as they are — translate only the visible text content inside the tags. Do not add commentary before or after. Do not wrap the output in markdown code fences.

HTML to translate:
${html}`,
      });
      const text = response.output_text ?? "";
      setHtml(text.trim());
      setLanguage("hi");
    } catch (error) {
      console.error(error);
      setError(isQuotaOrRateLimitError(error) ? QUOTA_ERROR_MESSAGE_HI : "Could not translate this reading to Hindi. Please try again.");
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
    <div id="mainGrid" className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      {/* Left column: form + saved list */}
      <div className="space-y-6 lg:sticky lg:top-8 no-print">
        <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
          <h2 className="font-display text-xl font-semibold text-[#fbe9d0] mb-1">जन्म विवरण &middot; Birth details</h2>
          <p className="text-xs text-[#c99a6b] mb-5">
            Accuracy of time and place matters most for house-based predictions.
          </p>

          <div className="space-y-4">
            {BIRTH_FIELDS.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="block text-xs font-medium text-[#f2b25c] mb-1.5">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={input[field.key]}
                  name={field.key}
                  onChange={onchangeHandle}
                  className="w-full rounded-lg bg-[#1c0e05] border border-[#e8a13a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] placeholder:text-[#7a5c40] outline-none focus:border-[#e8a13a]/70 focus:ring-1 focus:ring-[#e8a13a]/40 transition-colors"
                />
              </div>
            ))}

            <div>
              <label htmlFor="gender" className="block text-xs font-medium text-[#f2b25c] mb-1.5">
                Gender <span className="text-[#7a5c40]">(optional)</span>
              </label>
              <select
                id="gender"
                name="gender"
                value={input.gender}
                onChange={onchangeHandle}
                className="w-full rounded-lg bg-[#1c0e05] border border-[#e8a13a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] outline-none focus:border-[#e8a13a]/70 focus:ring-1 focus:ring-[#e8a13a]/40 transition-colors"
              >
                <option value="">Prefer not to say</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#f2b25c] mb-1.5">Reading language</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                    language === "en"
                      ? "bg-[#e8a13a]/15 border-[#e8a13a]/60 text-[#e8a13a]"
                      : "bg-[#1c0e05] border-[#e8a13a]/15 text-[#c99a6b] hover:border-[#e8a13a]/40"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("hi")}
                  className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                    language === "hi"
                      ? "bg-[#e8a13a]/15 border-[#e8a13a]/60 text-[#e8a13a]"
                      : "bg-[#1c0e05] border-[#e8a13a]/15 text-[#c99a6b] hover:border-[#e8a13a]/40"
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-xs text-[#f0958a] bg-[#f0958a]/10 border border-[#f0958a]/25 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              onClick={createShayari}
              disabled={loading}
              className="w-full rounded-lg bg-[#e8a13a] hover:bg-[#d68f28] disabled:bg-[#7a5c2c] disabled:cursor-not-allowed text-[#20100a] font-display font-semibold text-sm py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-[#20100a]/40 border-t-[#20100a] animate-spin" />
                  Consulting the stars…
                </>
              ) : (
                "Generate reading"
              )}
            </button>
            <button
              onClick={storedData}
              disabled={!html || loading}
              className="w-full rounded-lg border border-[#e8a13a]/25 hover:border-[#e8a13a]/60 hover:text-[#f2b25c] disabled:opacity-40 disabled:cursor-not-allowed text-[#f5e6d3] text-sm py-2.5 transition-colors"
            >
              Save this reading
            </button>
          </div>
        </div>

        {kundali.length > 0 && (
          <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 backdrop-blur p-6 shadow-xl shadow-black/30">
            <h3 className="font-display text-lg font-semibold text-[#fbe9d0] mb-3">Saved readings</h3>
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {kundali.map((item, index) => (
                <li key={index}>
                  <button
                    onClick={() => getData(item, index)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors border ${
                      activeIndex === index
                        ? "bg-[#e8a13a]/15 border-[#e8a13a]/50 text-[#e8a13a]"
                        : "bg-transparent border-[#e8a13a]/10 hover:border-[#e8a13a]/30 text-[#e3cbb0]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.name || "Untitled"}</span>
                      <span className="block text-xs text-[#a9835f] truncate">{item.dob}</span>
                    </span>
                    <span
                      role="button"
                      onClick={(e) => deleteData(index, e)}
                      className="shrink-0 text-[#a9835f] hover:text-[#f0958a] text-xs px-1.5 py-0.5 rounded transition-colors"
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
      <div id="printArea" className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/60 backdrop-blur p-6 sm:p-8 min-h-[420px] shadow-xl shadow-black/30">
        {!html && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 text-[#7a5c40] no-print">
            <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#e8a13a] flex items-center justify-center text-[#2a1608] font-display font-bold text-lg shrink-0">
            <img src="/public/logo.png" alt="" />
          </div>
            <p className="font-display text-xl font-semibold text-[#c99a6b] mb-1">Your reading will appear here</p>
            <p className="text-sm max-w-sm">Fill in your birth details and generate a reading, or select a saved one from the left.</p>
          </div>
        )}

        {loading && (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center no-print">
            <div className="h-8 w-8 rounded-full border-2 border-[#e8a13a]/30 border-t-[#e8a13a] animate-spin mb-4" />
            <p className="text-sm text-[#c99a6b]">Mapping planetary placements and dashas…</p>
          </div>
        )}

        {!loading && html && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 no-print">
              <div className="rounded-xl border border-[#e8a13a]/20 bg-[#1c0e05]/70 p-4">
                <p className="text-[10px] uppercase tracking-wide text-[#a9835f] mb-1">Name</p>
                <p className="font-display text-base font-semibold text-[#fbe9d0]">{input.name || "—"}</p>
                <p className="text-xs text-[#c99a6b] mt-1">{input.dob} {input.bot ? `· ${input.bot}` : ""}</p>
                <p className="text-xs text-[#a9835f] truncate">{input.bop}</p>
              </div>
              <div className="rounded-xl border border-[#e8a13a]/20 bg-[#1c0e05]/70 p-4 flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-wide text-[#a9835f] mb-1">Lagna &middot; Ayanamsa</p>
                <p className="font-display text-base font-semibold text-[#fbe9d0]">
                  {chartData?.lagna || (chartLoading ? "Calculating…" : "—")}
                </p>
                <p className="text-xs text-[#c99a6b] mt-1">{chartData?.ayanamsa || ""}</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 mb-4 no-print">
              <button
                onClick={translateToHindi}
                disabled={translating || language === "hi"}
                className="text-xs flex items-center gap-1.5 rounded-lg border border-[#e8a13a]/20 hover:border-[#e8a13a]/50 hover:text-[#f2b25c] disabled:opacity-40 disabled:cursor-not-allowed text-[#e3cbb0] px-3 py-1.5 transition-colors"
              >
                {translating ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-[#f2b25c]/30 border-t-[#f2b25c] animate-spin" />
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
                    className="text-xs flex items-center gap-1.5 rounded-lg border border-[#e8a13a]/20 hover:border-[#e8a13a]/50 hover:text-[#e8a13a] text-[#e3cbb0] px-3 py-1.5 transition-colors"
                  >
                    {speechState === "speaking" ? "⏸ रोकें" : speechState === "paused" ? "▶ फिर से सुनें" : "🔊 रिस्पॉन्स सुनें"}
                  </button>
                  {speechState !== "idle" && (
                    <button
                      onClick={handleStopSpeech}
                      className="text-xs flex items-center gap-1.5 rounded-lg border border-[#e8a13a]/20 hover:border-[#f0958a]/50 hover:text-[#f0958a] text-[#e3cbb0] px-3 py-1.5 transition-colors"
                    >
                      ⏹ बंद करें
                    </button>
                  )}
                </>
              )}

              <button
                onClick={handleDownloadPdf}
                className="text-xs flex items-center gap-1.5 rounded-lg border border-[#e8a13a]/50 hover:border-[#e8a13a] text-[#e8a13a] px-3 py-1.5 transition-colors"
              >
                ⬇ चार्ट सहित डाउनलोड करें
              </button>
            </div>

            {(chartLoading || chartData) && (
              <div className="mb-6 rounded-xl border border-[#e8a13a]/20 bg-[#1c0e05]/60 p-4">
                <h3 className="font-display text-lg font-semibold text-[#e8a13a] mb-2 text-center">Janma Kundali (Birth Chart)</h3>
                {chartLoading && !chartData && (
                  <p className="text-xs text-[#c99a6b] text-center py-6 no-print">चार्ट तैयार किया जा रहा है…</p>
                )}
                {chartData && (
                  <>
                    <KundaliChartSVG data={chartData} />
                    <p className="text-center text-xs text-[#a9835f] mt-3">
                      {chartData.lagna ? `Lagna: ${chartData.lagna}` : ""}
                      {chartData.lagna && chartData.ayanamsa ? " · " : ""}
                      {chartData.ayanamsa ? `Ayanamsa: ${chartData.ayanamsa}` : ""}
                    </p>
                    <p className="text-center text-[10px] text-[#7a5c40] mt-1">
                      North Indian style chart, AI-computed from your reading — verify against a certified astrologer for critical decisions.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="prose-kundli" dangerouslySetInnerHTML={{ __html: html }} />
          </>
        )}
      </div>
    </div>
  );
}
