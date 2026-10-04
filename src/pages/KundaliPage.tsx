import { marked } from "marked";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import {
  deleteKundaliRecord,
  getSavedKundalis,
  saveKundaliRecord,
} from "../lib/storage";
import { KundaliChartSVG } from "../components/KundaliChartSVG";
import { BIRTH_FIELDS, type ChartData, type KundaliRecord } from "../types";
import { saveUserDetail } from "../lib/api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const TOPICS = [
  { id: "overview", en: "Kundli overview", hi: "कुंडली का सार" },
  { id: "personality", en: "Personality", hi: "व्यक्तित्व" },
  { id: "education", en: "Education", hi: "शिक्षा" },
  { id: "career", en: "Career", hi: "करियर" },
  { id: "money", en: "Money & wealth", hi: "धन और समृद्धि" },
  { id: "relationships", en: "Love & relationships", hi: "प्रेम और रिश्ते" },
  { id: "marriage", en: "Marriage", hi: "विवाह" },
  { id: "family", en: "Family & parents", hi: "परिवार और माता-पिता" },
  { id: "children", en: "Children", hi: "संतान" },
  { id: "health", en: "Health & well-being", hi: "स्वास्थ्य और कल्याण" },
  { id: "summary", en: "Life summary", hi: "जीवन का सार" },
] as const;

const ALL_TOPICS_ID = "all";

function plainText(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return (element.textContent || element.innerText || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getErrorMessage(error: unknown) {
  return isQuotaOrRateLimitError(error)
    ? QUOTA_ERROR_MESSAGE_HI
    : "Something went wrong while consulting the stars. Please try again.";
}

export default function KundaliPage() {
  const [input, setInput] = useState({
    name: "",
    dob: "",
    bot: "",
    bop: "",
    gender: "",
  });
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [stage, setStage] = useState<"details" | "chat">("details");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kundali, setKundali] = useState<KundaliRecord[]>(() =>
    getSavedKundalis(),
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const isFormComplete = useMemo(
    () => Boolean(input.name.trim() && input.dob && input.bot && input.bop.trim()),
    [input],
  );

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

Respond with ONLY a raw JSON object, no markdown fences or explanation. Use this shape:
{"lagna":"<ascendant rashi name>","ayanamsa":"<ayanamsa system, e.g. Lahiri>","houses":{"1":["Su","Ma"],"2":[],"3":[],"4":[],"5":[],"6":[],"7":[],"8":[],"9":[],"10":[],"11":[],"12":["Ke"]}}

Include house keys 1 through 12 and use only these planet codes: Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke. Do not fabricate placements if they cannot be reliably calculated.`,
      });
      const parsed = extractJson(response.output_text ?? "");
      setChartData(parsed?.houses ? (parsed as ChartData) : null);
    } catch (chartError) {
      console.error("Could not generate the birth chart:", chartError);
      setChartData(null);
    } finally {
      setChartLoading(false);
    }
  };

  const startChat = () => {
    if (!isFormComplete) {
      setError("Please fill in name, date, time, and place of birth.");
      return;
    }
    setError(null);
    setMessages([]);
    setSelectedTopic(null);
    setSavedLocally(false);
    setStage("chat");
    void generateChartData();
  };

  const askQuestion = async (question: string, topicId?: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading) return;

    setError(null);
    setSelectedTopic(topicId ?? null);
    setMessageInput("");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: trimmedQuestion },
    ]);
    setLoading(true);

    const previousContext = messages
      .slice(-8)
      .map(
        (message) =>
          `${message.role === "user" ? "User" : "Assistant"}: ${plainText(message.content)}`,
      )
      .join("\n");
    const allTopics = topicId === ALL_TOPICS_ID;
    const isTopicQuestion = Boolean(topicId && !allTopics);
    const topic = TOPICS.find(({ id }) => id === topicId);
    const focus = allTopics
      ? `Give a comprehensive reading covering all of these areas: Kundli overview; personality and character; education and intelligence; career and profession; money and wealth; love and relationships; marriage; family and parents; children and family life; health and well-being; overall life summary. Use a separate clear heading for every area.`
      : isTopicQuestion && topic
        ? `Answer only about "${topic.en}". Do not include a full life reading or unrelated sections.`
        : `Answer the user's question directly and personally. Focus only on the aspects relevant to the question; do not produce the full all-topics report unless explicitly requested.`;

    try {
      const response = await callGemini({
        model: "gemini-3.5-flash",
        input: `You are an expert Vedic astrology (Jyotish) assistant. Give personalized, balanced guidance based on the user's birth details and the current conversation.

Birth details:
- Name: ${input.name}
- Date of birth: ${input.dob}
- Time of birth: ${input.bot}
- Place of birth: ${input.bop}
- Gender (optional): ${input.gender || "not provided"}

Write entirely in ${
          language === "hi" ? "Hindi using Devanagari script" : "English"
        }.
${focus}

User's latest request: ${trimmedQuestion}
${previousContext ? `\nConversation so far:\n${previousContext}` : ""}

Use Vedic/sidereal astrology. Explain relevant astrological reasoning where possible, but do not invent planetary placements or calculations that are unavailable. Be clear that predictions are possibilities, not certainties. Never diagnose illness or make definitive fertility, death, accident, or financial claims. Keep the answer useful, warm, and easy to understand.`,
      });
      const html = await marked.parse(response.output_text ?? "");
      const assistantMessage = String(html).trim();
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: assistantMessage },
      ]);
      setSavedLocally(false);

      if (messages.length === 0) {
        try {
          await saveUserDetail({
            fullName: input.name,
            dateOfBirth: input.dob,
            timeOfBirth: input.bot,
            placeOfBirth: input.bop,
            gender: input.gender,
            readingLanguage: language,
            content: assistantMessage,
            chart: chartData,
          });
        } catch (saveError) {
          console.error("Could not save the user's reading:", saveError);
          setError(
            "Your answer is ready, but it could not be saved. You can continue chatting or save it on this device.",
          );
        }
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void askQuestion(messageInput);
  };

  const openSavedReading = (record: KundaliRecord, index: number) => {
    setInput({
      name: record.name,
      dob: record.dob,
      bot: record.bot,
      bop: record.bop,
      gender: record.gender,
    });
    setChartData(record.chart ?? null);
    setMessages(
      record.content
        ? [{ role: "assistant", content: record.content }]
        : [],
    );
    setActiveIndex(index);
    setSavedLocally(Boolean(record.content));
    setError(null);
    setStage("chat");
  };

  const removeSavedReading = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    const updated = deleteKundaliRecord(index);
    setKundali(updated);
    if (activeIndex === index) setActiveIndex(null);
    else if (activeIndex !== null && index < activeIndex) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const saveChatLocally = () => {
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!lastAssistantMessage) return;

    const updated = saveKundaliRecord({
      ...input,
      content: lastAssistantMessage.content,
      chart: chartData,
    });
    setKundali(updated);
    setActiveIndex(updated.length - 1);
    setSavedLocally(true);
    setError(null);
  };

  const backToDetails = () => {
    setStage("details");
    setError(null);
  };

  return (
    <div className="mx-auto max-w-4xl">
      {stage === "details" ? (
        <section className="mx-auto max-w-2xl rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/85 p-5 shadow-xl shadow-black/30 backdrop-blur sm:p-8">
          <div className="mb-6 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-[#d8b36a]">
              Personalized Jyotish
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-[#f5efe6]">
              जन्म विवरण
            </h2>
            <p className="mt-2 text-sm text-[#afbdd7]">
              Add your birth details to start a personal Kundli conversation.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              startChat();
            }}
            className="space-y-4"
          >
            {BIRTH_FIELDS.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={field.key}
                  className="mb-1.5 block text-xs font-medium text-[#f4d7a7]"
                >
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={input[field.key]}
                  name={field.key}
                  required
                  onChange={(event) =>
                    setInput({ ...input, [event.target.name]: event.target.value })
                  }
                  className="w-full rounded-lg border border-[#d8b36a]/20 bg-[#111d31] px-3.5 py-3 text-sm text-[#f5e6d3] outline-none transition-colors placeholder:text-[#8ea1c2] focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40"
                />
              </div>
            ))}

            <div>
              <label
                htmlFor="gender"
                className="mb-1.5 block text-xs font-medium text-[#f4d7a7]"
              >
                Gender (optional)
              </label>
              <select
                id="gender"
                value={input.gender}
                onChange={(event) =>
                  setInput({ ...input, gender: event.target.value })
                }
                className="w-full rounded-lg border border-[#d8b36a]/20 bg-[#111d31] px-3.5 py-3 text-sm text-[#f5e6d3] outline-none focus:border-[#d8b36a]/70"
              >
                <option value="">Prefer not to say</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <p className="mb-1.5 block text-xs font-medium text-[#f4d7a7]">
                Reading language
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["en", "hi"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLanguage(value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      language === value
                        ? "border-[#d8b36a]/60 bg-[#d8b36a]/15 text-[#d8b36a]"
                        : "border-[#d8b36a]/15 bg-[#111d31] text-[#afbdd7] hover:border-[#d8b36a]/40"
                    }`}
                  >
                    {value === "en" ? "English" : "हिंदी"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-[#f0958a]/25 bg-[#f0958a]/10 px-3 py-2 text-xs text-[#f0958a]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!isFormComplete}
              className="w-full rounded-lg bg-[#d8b36a] py-3 font-display text-base font-semibold text-[#0b1324] transition-colors hover:bg-[#c99a58] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to Kundli chat
            </button>
          </form>

          {kundali.length > 0 && (
            <div className="mt-7 border-t border-[#d8b36a]/15 pt-5">
              <h3 className="mb-3 font-display text-lg font-semibold text-[#f5efe6]">
                Saved readings
              </h3>
              <ul className="space-y-2">
                {kundali.map((record, index) => (
                  <li key={`${record.name}-${record.dob}-${index}`}>
                    <div
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        activeIndex === index
                          ? "border-[#d8b36a]/50 bg-[#d8b36a]/15 text-[#d8b36a]"
                          : "border-[#d8b36a]/10 text-[#e3cbb0] hover:border-[#d8b36a]/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openSavedReading(record, index)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate font-medium">
                          {record.name || "Untitled"}
                        </span>
                        <span className="block truncate text-xs text-[#afbdd7]">
                          {record.dob}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => removeSavedReading(index, event)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-xs text-[#afbdd7] transition-colors hover:text-[#f0958a]"
                        aria-label={`Delete ${record.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 shadow-xl shadow-black/30">
          <header className="border-b border-[#d8b36a]/15 bg-[#0d1a2e]/90 p-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-[#f5efe6]">
                  Kundli chat
                </h2>
                <p className="truncate text-xs text-[#afbdd7]">
                  {input.name} · {input.dob} · {input.bop}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLanguage(language === "en" ? "hi" : "en")}
                  className="rounded-lg border border-[#d8b36a]/20 px-3 py-2 text-xs text-[#e3cbb0] hover:border-[#d8b36a]/50"
                >
                  {language === "en" ? "हिंदी" : "English"}
                </button>
                {messages.some((message) => message.role === "assistant") && (
                  <button
                    type="button"
                    onClick={saveChatLocally}
                    disabled={savedLocally}
                    className="rounded-lg border border-[#d8b36a]/30 px-3 py-2 text-xs text-[#d8b36a] hover:border-[#d8b36a]/60 disabled:opacity-50"
                  >
                    {savedLocally ? "Saved" : "Save on this device"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={backToDetails}
                  className="rounded-lg border border-[#d8b36a]/20 px-3 py-2 text-xs text-[#e3cbb0] hover:border-[#d8b36a]/50"
                >
                  Edit details
                </button>
              </div>
            </div>
            {(chartLoading || chartData) && (
              <div className="mt-4 rounded-xl border border-[#d8b36a]/15 bg-[#111d31]/70 p-3">
                {chartLoading && !chartData ? (
                  <p className="text-center text-xs text-[#afbdd7]">
                    Preparing your birth chart…
                  </p>
                ) : chartData ? (
                  <details>
                    <summary className="cursor-pointer text-center text-sm text-[#d8b36a]">
                      Birth chart · {chartData.lagna || "Kundli"}
                    </summary>
                    <div className="mx-auto mt-3 max-w-md">
                      <KundaliChartSVG data={chartData} />
                      <p className="text-center text-xs text-[#afbdd7]">
                        {chartData.ayanamsa || ""}
                      </p>
                    </div>
                  </details>
                ) : null}
              </div>
            )}
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 && (
              <div className="rounded-xl border border-[#d8b36a]/15 bg-[#111d31]/60 p-4">
                <p className="font-medium text-[#f5efe6]">
                  {language === "hi"
                    ? `नमस्ते ${input.name}! अपनी कुंडली के बारे में क्या जानना चाहेंगे?`
                    : `Hi ${input.name}! What would you like to know about your Kundli?`}
                </p>
                <p className="mt-1 text-sm text-[#afbdd7]">
                  {language === "hi"
                    ? "नीचे कोई विषय चुनें या अपना सवाल सीधे लिखें।"
                    : "Choose a topic below or type your own question."}
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <article
                  className={`max-w-[95%] rounded-2xl px-4 py-3 sm:max-w-[85%] ${
                    message.role === "user"
                      ? "bg-[#d8b36a]/15 text-[#f5e6d3]"
                      : "border border-[#d8b36a]/15 bg-[#111d31]/75 text-[#edf2fb]"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div
                      className="prose-kundli text-sm"
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  )}
                </article>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-[#d8b36a]/15 bg-[#111d31]/75 px-4 py-3 text-sm text-[#afbdd7]">
                  <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#d8b36a]/30 border-t-[#d8b36a] align-[-2px]" />
                  {language === "hi" ? "सोच रहा हूँ…" : "Thinking…"}
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-[#f0958a]/25 bg-[#f0958a]/10 px-3 py-2 text-sm text-[#f0958a]"
              >
                {error}
              </p>
            )}
            <div ref={messageEndRef} />
          </div>

          <footer className="border-t border-[#d8b36a]/15 bg-[#0d1a2e]/90 p-4 sm:px-6">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  void askQuestion(
                    language === "hi"
                      ? "मेरी कुंडली के सभी विषयों का विस्तृत विश्लेषण दें।"
                      : "Give me a detailed reading covering all topics in my Kundli.",
                    ALL_TOPICS_ID,
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  selectedTopic === ALL_TOPICS_ID
                    ? "border-[#d8b36a] bg-[#d8b36a]/20 text-[#f8d27a]"
                    : "border-[#d8b36a]/30 text-[#f8d27a] hover:bg-[#d8b36a]/10"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {language === "hi" ? "सभी विषय" : "All topics"}
              </button>
              {TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    void askQuestion(
                      language === "hi"
                        ? `${topic.hi} के बारे में मेरी कुंडली के अनुसार बताएं।`
                        : `Tell me about ${topic.en.toLowerCase()} according to my Kundli.`,
                      topic.id,
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    selectedTopic === topic.id
                      ? "border-[#d8b36a] bg-[#d8b36a]/20 text-[#f8d27a]"
                      : "border-[#d8b36a]/20 text-[#e3cbb0] hover:border-[#d8b36a]/50 hover:text-[#f8d27a]"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {topic[language]}
                </button>
              ))}
            </div>

            <form onSubmit={handleChatSubmit} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="kundli-chat-input">
                Ask a question about your Kundli
              </label>
              <textarea
                id="kundli-chat-input"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  language === "hi"
                    ? "अपनी कुंडली के बारे में कुछ भी पूछें…"
                    : "Ask anything about your Kundli…"
                }
                rows={1}
                className="max-h-32 min-h-12 flex-1 resize-y rounded-xl border border-[#d8b36a]/20 bg-[#111d31] px-4 py-3 text-sm text-[#f5e6d3] outline-none placeholder:text-[#8ea1c2] focus:border-[#d8b36a]/70"
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || loading}
                className="h-12 shrink-0 rounded-xl bg-[#d8b36a] px-5 font-semibold text-[#0b1324] transition-colors hover:bg-[#c99a58] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {language === "hi" ? "भेजें" : "Send"}
              </button>
            </form>
            <p className="mt-2 text-[10px] text-[#8ea1c2]">
              {language === "hi"
                ? "ज्योतिषीय मार्गदर्शन निश्चित भविष्यवाणी या पेशेवर सलाह का विकल्प नहीं है।"
                : "Astrology is guidance, not a guaranteed prediction or a substitute for professional advice."}
            </p>
          </footer>
        </section>
      )}
    </div>
  );
}
