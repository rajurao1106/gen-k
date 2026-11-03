"use client";

import { useEffect, useRef, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import { fetchBirthChart } from "../lib/api";
import { vimshottariFacts } from "../lib/chartFacts";
import {
  buildInsightPrompt,
  buildConversationReviewPrompt,
  chartHighlights,
  DISCLAIMER_HI,
  HELPLINES,
  MAX_TRANSCRIPT_CHARS,
  MAX_PROBLEM_CHARS,
  maxRisk,
  normalizeConversationReview,
  normalizeInsight,
  screenForRisk,
  type ChartHighlights,
  type ConversationReview,
  type ConversationSpeaker,
  type ConversationTurn,
  type InsightResult,
  type RiskLevel,
} from "../lib/Psychologistinsight";

type Step = "form" | "result";
type Tab = "doctor" | "client";

const inputClass =
  "w-full rounded-lg bg-[#111d31] border border-[#d8b36a]/20 px-3.5 py-2.5 text-sm text-[#f5e6d3] placeholder:text-[#8ea1c2] outline-none focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40";
const labelClass = "block text-xs font-medium text-[#f4d7a7] mb-1.5";
const cardClass =
  "rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 backdrop-blur p-6 shadow-xl shadow-black/30";

const EMPTY = { problem: "", dob: "", bot: "", bop: "" };

// ------------------------------------------------------------ small pieces ----

function SafetyAlert({ level, note }: { level: RiskLevel; note?: string }) {
  if (level === "none") return null;
  const high = level === "high";
  return (
    <div
      role={high ? "alert" : "status"}
      className={`rounded-2xl border p-5 ${
        high ? "border-[#ef9f90]/60 bg-[#ef9f90]/12" : "border-[#f2c36b]/45 bg-[#f2c36b]/10"
      }`}
    >
      <h2 className="font-display text-lg font-semibold text-[#f9f3eb]">
        {high ? "Turant dhyan dein: safety concern" : "Gehre distress ke sanket mile hain"}
      </h2>
      <p className="mt-1 text-sm leading-6 text-[#f5e6d3]">
        {high
          ? "Input mein self-harm ya suicide se jude sanket hain. Is session mein pehle client ki safety ko dekhein, risk assessment karein, aur zarurat ho to turant professional/emergency madad lein. Ye app is jagah par clinical judgment ka vikalp nahi hai."
          : "Input mein severe distress ke sanket hain. Kundali insight se pehle client ki current halat aur safety ke baare mein seedha poochhein, aur zarurat ho to professional follow-up tay karein."}
      </p>
      {note && <p className="mt-2 text-sm leading-6 text-[#f9e6b2]">AI note: {note}</p>}
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {HELPLINES.map((h) => (
          <li key={h.name} className="rounded-lg border border-[#d8b36a]/30 bg-[#0a1529]/70 px-3 py-1.5 text-[#f5e6d3]">
            {h.name}:{" "}
            {h.numbers.map((n, i) => (
              <span key={n}>
                {i > 0 && " / "}
                <a href={`tel:${n.replace(/-/g, "")}`} className="font-semibold text-[#f8d27a] underline underline-offset-2">
                  {n}
                </a>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d8b36a]/15 bg-[#111d31]/70 p-3">
      <dt className="text-[11px] text-[#afbdd7]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-[#f5efe6]">{value}</dd>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-6 text-[#e3cbb0]">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d8b36a]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Disclaimer() {
  return (
    <p className="pt-2 text-center text-[11px] leading-5 text-[#8ea1c2]">
      {DISCLAIMER_HI} Kundali sirf ek supportive lens hai, medical diagnosis nahi.
    </p>
  );
}

type SpeechRecognitionLike = InstanceType<NonNullable<Window["SpeechRecognition"]>>;

function ConversationReviewMode({ onBack }: { onBack: () => void }) {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [speaker, setSpeaker] = useState<ConversationSpeaker>("patient");
  const [language, setLanguage] = useState("hi-IN");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConversationReview | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const turnsRef = useRef<ConversationTurn[]>([]);
  const speakerRef = useRef<ConversationSpeaker>(speaker);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const selectSpeaker = (nextSpeaker: ConversationSpeaker) => {
    speakerRef.current = nextSpeaker;
    setSpeaker(nextSpeaker);
  };

  const addTurn = (nextTurn: ConversationTurn) => {
    const next = [...turnsRef.current, nextTurn];
    const size = next.reduce((total, turn) => total + turn.text.length, 0);
    if (size > MAX_TRANSCRIPT_CHARS) {
      setError("Transcript limit poori ho gayi. Recording rok di gayi hai; kuch text hata kar phir try karein.");
      recognitionRef.current?.stop();
      return;
    }
    turnsRef.current = next;
    setTurns(next);
  };

  const startRecording = () => {
    if (!consent) {
      setError("Recording se pehle psychologist aur patient dono ki sahmati confirm karein.");
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Is browser mein speech recognition available nahi hai. Chrome ya Edge ke latest version mein kholkar try karein.");
      return;
    }

    setError("");
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const resultIndex = (event as Event & { resultIndex?: number }).resultIndex ?? 0;
      for (let index = resultIndex; index < event.results.length; index += 1) {
        const recognized = event.results[index][0]?.transcript.trim();
        if (event.results[index].isFinal && recognized) {
          addTurn({ speaker: speakerRef.current, text: recognized });
        }
      }
    };
    recognition.onerror = (event) => {
      const errorCode = "error" in event ? String(event.error) : "unknown";
      setError(
        errorCode === "not-allowed"
          ? "Microphone permission nahi mili. Browser settings mein permission dein aur dobara try karein."
          : `Speech recognition ruk gaya (${errorCode}). Permission/network check karke phir try karein.`,
      );
      setRecording(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setRecording(false);
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setRecording(true);
    } catch (startError) {
      recognitionRef.current = null;
      setError(startError instanceof Error ? startError.message : "Recording shuru nahi ho paayi.");
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  };

  const clearTranscript = () => {
    stopRecording();
    turnsRef.current = [];
    setTurns([]);
    setResult(null);
    setError("");
    setConsent(false);
  };

  const removeTurn = (index: number) => {
    const next = turnsRef.current.filter((_, itemIndex) => itemIndex !== index);
    turnsRef.current = next;
    setTurns(next);
  };

  const analyzeConversation = async () => {
    if (!consent) {
      setError("Analysis se pehle dono ki sahmati confirm karein.");
      return;
    }
    if (recording) {
      setError("Pehle recording rokein, phir analysis complete karein.");
      return;
    }
    if (turns.length === 0) {
      setError("Analysis se pehle conversation record karein.");
      return;
    }
    const transcript = turns.map((turn) => turn.text).join("\n");
    const localRisk = screenForRisk(transcript);
    setError("");
    setLoading(true);
    try {
      const response = await callGemini({
        model: "gemini-3.5-flash-lite",
        purpose: "psychologist",
        input: buildConversationReviewPrompt(turns, localRisk),
      });
      const parsed = normalizeConversationReview(extractJson(response.output_text ?? ""));
      if (!parsed) {
        setError("AI ka analysis samajh nahi aaya. Dobara try karein.");
        return;
      }
      setResult({
        ...parsed,
        riskLevel: maxRisk(localRisk, parsed.riskLevel),
      });
    } catch (requestError) {
      console.error(
        "Psychologist conversation review failed:",
        requestError instanceof Error ? requestError.message : "unknown error",
      );
      setError(
        isQuotaOrRateLimitError(requestError)
          ? QUOTA_ERROR_MESSAGE_HI
          : requestError instanceof Error && requestError.message
            ? requestError.message
            : "Analysis nahi ho paaya. Dobara try karein.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const risk = result.riskLevel;
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="no-print flex flex-wrap justify-between gap-2">
          <button type="button" onClick={() => setResult(null)} className="rounded-full border border-[#f2c36b]/30 px-3.5 py-1.5 text-sm text-[#f9e6b2]">
            ← Transcript dekhein
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onBack} className="rounded-full border border-[#f2c36b]/30 px-3.5 py-1.5 text-sm text-[#f9e6b2]">
              Kundali insight
            </button>
            <button type="button" onClick={clearTranscript} className="rounded-full border border-[#d8b36a]/30 px-3.5 py-1.5 text-sm text-[#e3cbb0]">
              Naya session / data clear
            </button>
          </div>
        </div>
        <SafetyAlert level={risk} note={result.riskNote} />
        <div className={cardClass}>
          <h1 className="mb-2 font-display text-xl font-semibold text-[#f5efe6]">Baatcheet ka provisional summary</h1>
          <p className="text-sm leading-7 text-[#e3cbb0]">{result.presentingConcerns}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <section className={cardClass}>
            <h2 className="mb-3 font-display text-lg font-semibold text-[#d8b36a]">Psychologist ki achhi baatein</h2>
            <BulletList items={result.psychologistStrengths.length ? result.psychologistStrengths : ["Transcript mein specific strengths kaafi saaf nahi the; aur context dekhna hoga."]} />
          </section>
          <section className={cardClass}>
            <h2 className="mb-3 font-display text-lg font-semibold text-[#d8b36a]">Abhi kya unclear hai</h2>
            <BulletList items={result.uncertainties.length ? result.uncertainties : ["Is transcript se aur koi specific gap saamne nahi aaya."]} />
          </section>
        </div>
        <section className={cardClass}>
          <h2 className="mb-3 font-display text-lg font-semibold text-[#d8b36a]">Question-by-question feedback</h2>
          {result.questionFeedback.length ? (
            <ol className="space-y-3">
              {result.questionFeedback.map((item, index) => (
                <li key={`${item.psychologistQuestion}-${index}`} className="rounded-lg border border-[#d8b36a]/15 bg-[#111d31]/60 p-4">
                  <p className="text-xs font-semibold text-[#f9e6b2]">Psychologist: {item.psychologistQuestion}</p>
                  <p className="mt-1 text-xs text-[#afbdd7]">Patient: {item.patientReply}</p>
                  <p className="mt-2 text-sm leading-6 text-[#e3cbb0]">
                    {item.assessment === "helpful" ? "Helpful" : item.assessment === "missed_follow_up" ? "Follow-up ka mauka" : "Behtar ho sakta tha"}: {item.why}
                  </p>
                  {item.alternativeQuestion && (
                    <p className="mt-2 text-sm leading-6 text-[#f9e6b2]">Possible open question: {item.alternativeQuestion}</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm leading-6 text-[#e3cbb0]">Transcript mein psychologist ke sawal aur patient ke jawab ki saaf pairing nahi mili; isliye specific question feedback nahi diya gaya.</p>
          )}
        </section>
        <section className={cardClass}>
          <h2 className="mb-3 font-display text-lg font-semibold text-[#d8b36a]">Psychologist ke liye possible next steps</h2>
          <BulletList items={result.suggestedNextSteps} />
          <p className="mt-4 text-xs leading-5 text-[#afbdd7]">
            Yeh transcript par aadharit non-diagnostic support hai, “actual diagnosis” ya treatment plan nahi. Clinical judgment use karein; AI output ko patient ko dene se pehle review karein.
          </p>
        </section>
        <Disclaimer />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={onBack} className="rounded-full border border-[#f2c36b]/30 px-3.5 py-1.5 text-sm text-[#f9e6b2]">← Kundali insight par wapas</button>
        <button type="button" onClick={clearTranscript} disabled={recording || loading} className="rounded-full border border-[#d8b36a]/30 px-3.5 py-1.5 text-sm text-[#e3cbb0] disabled:opacity-50">Transcript clear karein</button>
      </div>
      <section className={cardClass}>
        <h1 className="mb-1 font-display text-xl font-semibold text-[#f5efe6]">Psychologist–patient conversation review</h1>
        <p className="mb-4 text-xs leading-5 text-[#afbdd7]">
          Mic se transcript banega. Speaker aap manually select karein. Raw audio app mein save nahi hota; browser ki speech recognition service audio process kar sakti hai. “Complete & Analyze” par transcript Google Gemini ko bheja jayega. Page chhodne par yeh transcript clear ho jayega.
        </p>
        <label className="mb-5 flex items-start gap-2.5 text-xs leading-5 text-[#e3cbb0]">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={recording || loading} className="mt-0.5 h-4 w-4 shrink-0 accent-[#d8b36a]" />
          <span>Psychologist aur patient dono ko recording/transcription aur AI analysis ki jaankari hai aur dono ne consent diya hai.</span>
        </label>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className={labelClass}>Abhi kaun bol raha hai?</p>
            <div className="flex gap-2">
              {(["psychologist", "patient"] as const).map((value) => (
                <button key={value} type="button" disabled={recording || loading} onClick={() => selectSpeaker(value)} aria-pressed={speaker === value} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${speaker === value ? "border-[#d8b36a] bg-[#d8b36a]/15 text-[#f9e6b2]" : "border-[#d8b36a]/20 text-[#afbdd7]"}`}>
                  {value === "psychologist" ? "Psychologist" : "Patient"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="pi-speech-language" className={labelClass}>Speech language</label>
            <select id="pi-speech-language" value={language} disabled={recording || loading} onChange={(event) => setLanguage(event.target.value)} className={inputClass}>
              <option value="hi-IN">Hindi</option>
              <option value="en-IN">English (India)</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!recording ? (
            <button type="button" onClick={startRecording} disabled={loading} className="rounded-lg bg-[#d8b36a] px-4 py-2.5 text-sm font-semibold text-[#0b1324] disabled:opacity-50">● Recording shuru karein</button>
          ) : (
            <button type="button" onClick={stopRecording} className="rounded-lg border border-[#ef9f90]/60 px-4 py-2.5 text-sm font-semibold text-[#ffd1c9]">Recording rokein</button>
          )}
          <button type="button" onClick={() => void analyzeConversation()} disabled={recording || loading || turns.length === 0} className="rounded-lg border border-[#d8b36a]/40 px-4 py-2.5 text-sm font-semibold text-[#f9e6b2] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Transcript analyze ho raha hai…" : "Complete & Analyze"}
          </button>
        </div>
        <p role="status" aria-live="polite" className="mt-3 text-xs text-[#afbdd7]">
          {recording
            ? "Recording chal rahi hai. Speaker badalne ke liye pehle rokein, naya speaker select karein, phir dobara shuru karein."
            : "Pehle consent lein, speaker select karein, phir recording shuru karein."}
        </p>
        {error && <p role="alert" className="mt-3 rounded-lg border border-[#f0958a]/25 bg-[#f0958a]/10 px-3 py-2 text-xs text-[#f0958a]">{error}</p>}
      </section>

      <section className={cardClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-[#d8b36a]">Transcript</h2>
          <p className="text-[11px] text-[#8ea1c2]">{turns.reduce((sum, turn) => sum + turn.text.length, 0)}/{MAX_TRANSCRIPT_CHARS}</p>
        </div>
        {turns.length ? (
          <ol className="space-y-2">
            {turns.map((turn, index) => (
              <li key={`${index}-${turn.text}`} className="flex items-start gap-3 rounded-lg border border-[#d8b36a]/15 bg-[#111d31]/60 p-3">
                <p className="flex-1 text-sm leading-6 text-[#e3cbb0]"><strong className="text-[#f9e6b2]">{turn.speaker === "psychologist" ? "Psychologist" : "Patient"}:</strong> {turn.text}</p>
                <button type="button" onClick={() => removeTurn(index)} disabled={recording || loading} aria-label={`Turn ${index + 1} delete karein`} className="text-xs text-[#ef9f90] disabled:opacity-50">Delete</button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[#afbdd7]">Abhi transcript khaali hai.</p>
        )}
      </section>
      <Disclaimer />
    </div>
  );
}

// -------------------------------------------------------------- main page ----

export default function PsychologistInsightPage() {
  const [input, setInput] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [tab, setTab] = useState<Tab>("doctor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localRisk, setLocalRisk] = useState<RiskLevel>("none");
  const [result, setResult] = useState<InsightResult | null>(null);
  const [facts, setFacts] = useState<ChartHighlights | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"kundali" | "conversation">("kundali");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ doctor: null, client: null });

  const risk = maxRisk(localRisk, result?.riskLevel ?? "none");

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInput((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Wipes every trace of the client from this page (nothing is stored anywhere else).
  const clearAll = () => {
    setInput(EMPTY);
    setConsent(false);
    setResult(null);
    setFacts(null);
    setLocalRisk("none");
    setError(null);
    setStep("form");
    setTab("doctor");
  };

  const run = async () => {
    const problem = input.problem.trim();
    if (problem.length < 10) {
      setError("Client ki pareshani kam se kam ek-do line mein likhein.");
      return;
    }
    if (!input.dob || !input.bot || input.bop.trim().length < 2) {
      setError("Client ki Date of Birth, Time of Birth aur Place of Birth bharein.");
      return;
    }
    if (!consent) {
      setError("Aage badhne se pehle client ki sahmati confirm karein.");
      return;
    }

    // 1) Safety screen runs on-device first, so the alert never waits for (or depends on) the AI.
    const screened = screenForRisk(problem);
    setLocalRisk(screened);
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      // 2) Real chart from the server (not cached in the browser, for privacy).
      const chart = await fetchBirthChart({ dob: input.dob, bot: input.bot, bop: input.bop.trim() });
      const dashaFacts = vimshottariFacts(chart, input.dob);
      if (!chart.summary || !dashaFacts) {
        setError("Kundali calculate nahi ho paayi. Birth date, time aur place check karke dobara try karein.");
        return;
      }

      // 3) AI sees only the problem text + chart facts (no name, no birth place).
      const response = await callGemini({
        model: "gemini-3.5-flash-lite",
        purpose: "psychologist",
        input: buildInsightPrompt({ problem, chart, dashaFacts, localRisk: screened }),
      });
      const parsed = normalizeInsight(extractJson(response.output_text ?? ""));
      if (!parsed) {
        setError("AI ka jawab samajh nahi aaya. Dobara try karein.");
        return;
      }
      setFacts(chartHighlights(chart, dashaFacts));
      setResult(parsed);
      setTab("doctor");
      setStep("result");
    } catch (err) {
      // Never log the request body: it contains the client's private details.
      console.error("Psychologist insight failed:", err instanceof Error ? err.message : "unknown error");
      setError(
        isQuotaOrRateLimitError(err)
          ? QUOTA_ERROR_MESSAGE_HI
          : err instanceof Error && err.message
            ? err.message
            : "Insight banate waqt kuch gadbad ho gayi. Dobara try karein.",
      );
    } finally {
      setLoading(false);
    }
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next: Tab = tab === "doctor" ? "client" : "doctor";
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const copyClientGuidance = async () => {
    if (!result) return;
    const lines = [
      result.clientView.message,
      "",
      ...result.clientView.practices.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`),
      "",
      DISCLAIMER_HI,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy nahi ho paya. Text ko select karke copy karein.");
    }
  };

  if (viewMode === "conversation") {
    return <ConversationReviewMode onBack={() => setViewMode("kundali")} />;
  }

  // --------------------------------------------------------------- form ----
  if (step === "form") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {!loading && <SafetyAlert level={localRisk} />}

        <div className={cardClass}>
          <button
            type="button"
            onClick={() => setViewMode("conversation")}
            className="mb-5 rounded-lg border border-[#d8b36a]/35 px-3 py-2 text-sm font-semibold text-[#f9e6b2] transition-colors hover:bg-[#d8b36a]/10"
          >
            Psychologist–patient conversation record & analyze
          </button>
          <h1 className="font-display text-xl font-semibold text-[#f5efe6] mb-1">Psychologist Client Insight</h1>
          <p className="text-xs leading-5 text-[#afbdd7] mb-5">
            Client ki pareshani aur birth details se Kundali-based supportive insight. Ye data save nahi hota
            aur page band karte hi hat jata hai.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="pi-problem" className={labelClass}>
                Client ki main pareshani (client ne jo bataya)
              </label>
              <textarea
                id="pi-problem"
                name="problem"
                rows={5}
                maxLength={MAX_PROBLEM_CHARS}
                autoComplete="off"
                value={input.problem}
                onChange={onChange}
                placeholder="e.g. Pichhle 3 mahine se neend nahi aati, chhoti baaton par ghabrahat hoti hai, kaam mein mann nahi lagta…"
                className={`${inputClass} resize-y`}
              />
              <p className="mt-1 text-right text-[11px] text-[#8ea1c2]">
                {input.problem.length}/{MAX_PROBLEM_CHARS}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pi-dob" className={labelClass}>Date of Birth</label>
                <input id="pi-dob" type="date" name="dob" autoComplete="off" value={input.dob} onChange={onChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="pi-bot" className={labelClass}>Time of Birth</label>
                <input id="pi-bot" type="time" name="bot" autoComplete="off" value={input.bot} onChange={onChange} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="pi-bop" className={labelClass}>Place of Birth</label>
                <input
                  id="pi-bop"
                  type="text"
                  name="bop"
                  autoComplete="off"
                  placeholder="City, State, Country"
                  value={input.bop}
                  onChange={onChange}
                  className={inputClass}
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs leading-5 text-[#e3cbb0]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#d8b36a]"
              />
              <span>
                Client ne apni pareshani aur birth details is analysis ke liye use karne ki sahmati di hai. Naam
                aur birth place AI ko nahi bheje jaate.
              </span>
            </label>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-lg border border-[#f0958a]/25 bg-[#f0958a]/10 px-3 py-2">
              <p className="text-xs text-[#f0958a]">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-[#d8b36a] hover:bg-[#c99a58] disabled:bg-[#7a5c2c] disabled:cursor-not-allowed text-[#0b1324] font-display font-semibold text-sm py-2.5 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-[#0b1324]/40 border-t-[#0b1324] animate-spin" />
                Kundali aur insight taiyaar ho raha hai…
              </>
            ) : (
              "Insight banayein"
            )}
          </button>
        </div>

        <Disclaimer />
      </div>
    );
  }

  // ------------------------------------------------------------- result ----
  const r = result!;
  const unclear = r.problemClarity === "unclear";

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep("form")}
          className="rounded-full border border-[#f2c36b]/30 px-3.5 py-1.5 text-sm text-[#f9e6b2] transition-colors hover:bg-[#f2c36b]/10"
        >
          <span aria-hidden="true">←</span> Details badlein
        </button>
        <button
          type="button"
          onClick={() => setViewMode("conversation")}
          className="rounded-full border border-[#f2c36b]/30 px-3.5 py-1.5 text-sm text-[#f9e6b2] transition-colors hover:bg-[#f2c36b]/10"
        >
          Conversation record & analyze
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full border border-[#d8b36a]/30 px-3.5 py-1.5 text-sm text-[#e3cbb0] transition-colors hover:border-[#ef9f90]/60 hover:text-[#ef9f90]"
        >
          Naya client (data clear karein)
        </button>
      </div>

      <SafetyAlert level={risk} note={r.riskNote} />

      <div role="tablist" aria-label="Insight view" onKeyDown={onTabKey} className="flex gap-1 rounded-xl border border-[#d8b36a]/20 bg-[#0a1529]/80 p-1">
        {(
          [
            ["doctor", "Doctor View"],
            ["client", "Client View"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            ref={(el) => { tabRefs.current[key] = el; }}
            id={`pi-tab-${key}`}
            role="tab"
            type="button"
            aria-selected={tab === key}
            aria-controls={`pi-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-2 font-display text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b36a]/60 ${
              tab === key ? "bg-[#d8b36a] text-[#0b1324]" : "text-[#e3cbb0] hover:bg-[#d8b36a]/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "doctor" && (
        <div role="tabpanel" id="pi-panel-doctor" aria-labelledby="pi-tab-doctor" className="space-y-5">
          <div className={cardClass}>
            <h2 className="font-display text-lg font-semibold text-[#d8b36a] mb-3">Kundali summary</h2>
            {facts && (
              <dl className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Fact label="Lagna" value={facts.lagna} />
                <Fact label="Moon sign (Chandra Rashi)" value={facts.moon} />
                <Fact label="Mercury (Budh)" value={facts.mercury} />
                <Fact label="Saturn (Shani)" value={facts.saturn} />
                <Fact label="Mahadasha" value={facts.mahadasha} />
                <Fact label="Antardasha" value={facts.antardasha} />
              </dl>
            )}
            <p className="text-sm leading-7 text-[#e3cbb0]">{r.doctorView.kundaliSummary}</p>
            {facts?.placeUncertain && (
              <p className="mt-3 rounded-lg border border-[#f2c36b]/35 bg-[#f2c36b]/10 px-3 py-2 text-xs leading-5 text-[#f9e6b2]">
                Birth place ({facts.placeLabel || "naam match nahi hua"}) pakka match nahi hua. Kundali ke
                sthaan-aadharit hisse badal sakte hain, kripya place confirm karein.
              </p>
            )}
            {facts?.timeSensitive && (
              <p className="mt-3 rounded-lg border border-[#f2c36b]/35 bg-[#f2c36b]/10 px-3 py-2 text-xs leading-5 text-[#f9e6b2]">
                Birth time thoda sa badalne par Lagna ya Moon sign badal sakta hai. Time confirm ho to hi is
                summary par zyada bharosa karein.
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className={cardClass}>
              <h2 className="font-display text-lg font-semibold text-[#d8b36a] mb-3">Personality traits</h2>
              <BulletList items={r.doctorView.personalityTraits} />
            </div>
            <div className={cardClass}>
              <h2 className="font-display text-lg font-semibold text-[#d8b36a] mb-3">Mental health tendencies</h2>
              <BulletList items={r.doctorView.mentalHealthTendencies} />
              <p className="mt-3 text-[11px] leading-5 text-[#8ea1c2]">
                Ye tendencies explore karne ke liye hain, diagnosis nahi.
              </p>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="font-display text-lg font-semibold text-[#d8b36a] mb-1">
              {unclear ? "Pehle ye sawal poochhein" : "Aage poochne layak sawal"}
            </h2>
            {r.clarityNote && <p className="mb-4 text-xs leading-5 text-[#afbdd7]">{r.clarityNote}</p>}
            <ol className="space-y-3">
              {r.doctorView.suggestedQuestions.map((q, i) => (
                <li key={i} className="rounded-lg border border-[#d8b36a]/15 bg-[#111d31]/60 p-4">
                  <p className="text-sm font-medium leading-6 text-[#f5efe6]">
                    {i + 1}. {q.question}
                  </p>
                  {q.reason && <p className="mt-1.5 text-xs leading-5 text-[#afbdd7]">Kyun: {q.reason}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {tab === "client" && (
        <div role="tabpanel" id="pi-panel-client" aria-labelledby="pi-tab-client" className="space-y-5">
          {risk === "high" && (
            <p className="rounded-lg border border-[#ef9f90]/40 bg-[#ef9f90]/10 px-3 py-2 text-xs leading-5 text-[#ffd1c9]">
              Safety concern flag hua hai. Ye guidance client ko dene se pehle apna clinical judgment lagayein.
            </p>
          )}
          <div className={cardClass}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-[#d8b36a]">Aapke liye</h2>
              <button
                type="button"
                onClick={copyClientGuidance}
                className="rounded-lg border border-[#d8b36a]/30 px-3 py-1.5 text-xs text-[#e3cbb0] transition-colors hover:bg-[#d8b36a]/10"
              >
                {copied ? "Copy ho gaya" : "Copy karein"}
              </button>
            </div>
            <p className="text-sm leading-7 text-[#e3cbb0]">{r.clientView.message}</p>
          </div>

          {r.clientView.practices.length > 0 && (
            <div className={cardClass}>
              <h2 className="font-display text-lg font-semibold text-[#d8b36a] mb-3">
                {unclear ? "Abhi ke liye halki practices" : "Aapke liye practices"}
              </h2>
              <ul className="space-y-3">
                {r.clientView.practices.map((p, i) => (
                  <li key={i} className="rounded-lg border border-[#d8b36a]/15 bg-[#111d31]/60 p-4">
                    <p className="text-sm font-semibold text-[#f5efe6]">{p.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#e3cbb0]">{p.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Disclaimer />
    </div>
  );
}