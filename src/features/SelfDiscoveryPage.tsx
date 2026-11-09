"use client";

import { useEffect, useId, useState } from "react";
import {
  callGemini,
  extractJson,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import { getBirthChart, vimshottariFacts } from "../lib/chartFacts";
import { getKundaliProfileId, getUserKundaliProfile } from "../lib/storage";
import { HELPLINES, screenForRisk, type RiskLevel } from "../lib/Psychologistinsight";
import {
  buildSelfDiscoveryPrompt,
  DISCLAIMER_HI,
  loadJournal,
  MAX_ANSWER_CHARS,
  normalizeDiscovery,
  questionOfTheDay,
  saveJournalAnswer,
  type DiscoveryResult,
  type DiscoverySection,
  type JournalEntries,
} from "../lib/SelfDiscovery";
import type { KundaliProfile } from "../types";

const cardClass =
  "rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 p-5 shadow-xl shadow-black/30 sm:p-6";
const resultKey = (profileId: string) => `genk_selfdiscovery_result_${profileId}`;

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone: "good" | "grow" | "do" }) {
  if (items.length === 0) return null;
  const border =
    tone === "good" ? "border-[#8fd3a8]/40" : tone === "grow" ? "border-[#f2c36b]/40" : "border-[#9ec1ff]/40";
  return (
    <div className={`rounded-xl border ${border} bg-[#0d2138]/70 p-4`}>
      <h4 className="font-display text-base font-semibold text-[#f9f3eb]">{title}</h4>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#edf2fb] marker:text-[#f2c36b]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SafetyNote({ level }: { level: RiskLevel }) {
  if (level === "none") return null;
  return (
    <div
      role={level === "high" ? "alert" : "status"}
      className="mt-3 rounded-xl border border-[#ef9f90]/50 bg-[#ef9f90]/10 p-4 text-sm leading-6 text-[#f5e6d3]"
    >
      <p className="font-semibold text-[#f9f3eb]">Aapne jo likha hai wo bhaari lag raha hai.</p>
      <p className="mt-1">
        Kisi apne, ya kisi professional se abhi baat karna madad kar sakta hai. Agar aap khud ko nuksan
        pahunchane ke baare mein soch rahe hain, to turant madad lein.
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {HELPLINES.map((h) => (
          <li key={h.name} className="rounded-lg border border-[#d8b36a]/30 px-3 py-1.5">
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

function ReflectionQuestion({
  question,
  saved,
  onSave,
}: {
  question: string;
  saved?: string;
  onSave: (question: string, answer: string) => RiskLevel;
}) {
  const [text, setText] = useState(saved ?? "");
  const [risk, setRisk] = useState<RiskLevel>("none");
  const [status, setStatus] = useState("");
  const inputId = useId();

  return (
    <div className="rounded-xl border border-[#d8b36a]/20 bg-[#0d2138]/60 p-4">
      <label htmlFor={inputId} className="block text-sm font-medium leading-6 text-[#f9e6b2]">
        {question}
      </label>
      <textarea
        id={inputId}
        value={text}
        maxLength={MAX_ANSWER_CHARS}
        rows={3}
        onChange={(e) => {
          setText(e.target.value);
          setStatus("");
        }}
        placeholder="Apne shabdon mein likhein. Ye sirf aapke is device par rehta hai."
        className="mt-2 w-full rounded-lg border border-[#d8b36a]/20 bg-[#111d31] px-3.5 py-2.5 text-sm text-[#f5e6d3] outline-none placeholder:text-[#8ea1c2] focus:border-[#d8b36a]/70 focus:ring-1 focus:ring-[#d8b36a]/40"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setRisk(onSave(question, text));
            setStatus(text.trim() ? "Saved" : "Removed");
          }}
          className="rounded-full bg-[#f2c36b] px-4 py-1.5 text-sm font-semibold text-[#081724] transition-colors hover:bg-[#f8d27a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/70"
        >
          Save answer
        </button>
        <span role="status" className="text-xs text-[#a6bddb]">
          {status}
        </span>
      </div>
      <SafetyNote level={risk} />
    </div>
  );
}

function SectionCard({
  section,
  journal,
  onSave,
}: {
  section: DiscoverySection;
  journal: JournalEntries;
  onSave: (question: string, answer: string) => RiskLevel;
}) {
  return (
    <article className={cardClass} aria-labelledby={`sec-${section.key}`}>
      <h3 id={`sec-${section.key}`} className="font-display text-2xl font-bold text-[#f9f3eb]">
        {section.title}
      </h3>
      {section.basedOn && <p className="mt-1 text-xs text-[#a6bddb]">Chart se: {section.basedOn}</p>}
      <p className="mt-3 text-[15px] leading-7 text-[#edf2fb]">{section.insight}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ListBlock title="Aapki taakat" items={section.strengths} tone="good" />
        <ListBlock title="Dhyan dene wali baatein" items={section.challenges} tone="grow" />
        <ListBlock title="Is hafte ki chhoti aadat" items={section.habits} tone="do" />
      </div>

      {section.questions.length > 0 && (
        <div className="mt-5">
          <h4 className="font-display text-lg font-semibold text-[#f2c36b]">Khud se poochhiye</h4>
          <div className="mt-2 space-y-3">
            {section.questions.map((q) => (
              <ReflectionQuestion key={q} question={q} saved={journal[q]?.answer} onSave={onSave} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function SelfDiscoveryPage() {
  const [profile, setProfile] = useState<KundaliProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [journal, setJournal] = useState<JournalEntries>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const profileId = profile ? getKundaliProfileId(profile) : "";

  useEffect(() => {
    const p = getUserKundaliProfile();
    // oxlint-disable-next-line react/set-state-in-effect
    setProfile(p);
    if (p) {
      const id = getKundaliProfileId(p);
      setJournal(loadJournal(id));
      try {
        const cached = sessionStorage.getItem(resultKey(id));
        if (cached) setResult(JSON.parse(cached) as DiscoveryResult);
      } catch {
        /* ignore a broken cache */
      }
    }
    setReady(true);
  }, []);

  const generate = async () => {
    if (!profile) return;
    setLoading(true);
    setError("");
    try {
      const chart = await getBirthChart({ dob: profile.dob, bot: profile.bot, bop: profile.bop });
      if (!chart) {
        setError("Aapki kundali abhi calculate nahi ho paayi. Profile mein janm vivaran check karke dobara try karein.");
        return;
      }
      const response = await callGemini({
        model: "gemini-3.5-flash-lite",
        purpose: "selfdiscovery",
        input: buildSelfDiscoveryPrompt({
          name: profile.name,
          gender: profile.gender,
          chart,
          dashaFacts: vimshottariFacts(chart, profile.dob),
        }),
      });
      const parsed = normalizeDiscovery(extractJson(response.output_text ?? ""));
      if (!parsed) {
        setError("AI ka jawab samajh nahi aaya. Dobara try karein.");
        return;
      }
      setResult(parsed);
      try {
        sessionStorage.setItem(resultKey(profileId), JSON.stringify(parsed));
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(
        isQuotaOrRateLimitError(err)
          ? QUOTA_ERROR_MESSAGE_HI
          : err instanceof Error && err.message
            ? err.message
            : "Reflection ban nahi paaya. Dobara try karein.",
      );
    } finally {
      setLoading(false);
    }
  };

  const saveAnswer = (question: string, answer: string): RiskLevel => {
    setJournal(saveJournalAnswer(profileId, question, answer));
    return screenForRisk(answer);
  };

  const todayQuestion = questionOfTheDay(result);

  if (!ready) return null;

  if (!profile) {
    return (
      <section className={cardClass}>
        <h1 className="font-display text-2xl font-bold text-[#f9f3eb]">Swa-Bodh</h1>
        <p className="mt-2 text-sm leading-6 text-[#c9d8ed]">
          Apni reflection banane ke liye pehle apni janm tithi, samay aur sthaan profile mein bharein.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="sd-heading" className="space-y-5">
      <div>
        <h1 id="sd-heading" className="font-display text-3xl font-bold text-[#f9f3eb]">
          Swa-Bodh
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-6 text-[#c9d8ed]">
          Apni kundali ko aaine ki tarah dekhiye: aapka swabhav, mann, rishte aur kaam ka tareeka. Ye
          bhavishyavani nahi hai, khud ko samajhne ka ek nazariya hai.
        </p>
      </div>

      {!result && (
        <div className={cardClass}>
          <p className="text-sm leading-6 text-[#edf2fb]">
            <span className="font-semibold text-[#f9f3eb]">{profile.name}</span> ki kundali se 6 hisson mein
            reflection banegi. Har hisse mein taakat, dhyan dene wali baatein, chhoti aadatein aur khud se
            poochhne ke sawal honge.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="mt-4 rounded-full bg-[#f2c36b] px-6 py-2.5 text-sm font-semibold text-[#081724] transition-colors hover:bg-[#f8d27a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/70 disabled:opacity-60"
          >
            {loading ? "Reflection ban raha hai..." : "Meri reflection banayein"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-[#ef9f90]/50 bg-[#ef9f90]/10 p-4 text-sm text-[#ffd1c9]">
          {error}
        </p>
      )}

      {result && (
        <>
          {result.intro && (
            <div className={cardClass}>
              <p className="text-[15px] leading-7 text-[#edf2fb]">{result.intro}</p>
            </div>
          )}

          {todayQuestion && (
            <div className="rounded-2xl border border-[#f2c36b]/40 bg-[#f2c36b]/10 p-5">
              <h2 className="font-display text-xl font-bold text-[#f9f3eb]">Aaj ka ek sawal</h2>
              <div className="mt-2">
                <ReflectionQuestion
                  key={todayQuestion}
                  question={todayQuestion}
                  saved={journal[todayQuestion]?.answer}
                  onSave={saveAnswer}
                />
              </div>
            </div>
          )}

          {result.sections.map((section) => (
            <SectionCard key={section.key} section={section} journal={journal} onSave={saveAnswer} />
          ))}

          {result.closing && (
            <div className={cardClass}>
              <p className="text-[15px] leading-7 text-[#f9e6b2]">{result.closing}</p>
            </div>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-full border border-[#f2c36b]/40 px-5 py-2 text-sm text-[#f9e6b2] transition-colors hover:bg-[#f2c36b]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c36b]/60 disabled:opacity-60"
          >
            {loading ? "Dobara ban raha hai..." : "Reflection dobara banayein"}
          </button>
        </>
      )}

      <p className="text-xs leading-5 text-[#a6bddb]">{DISCLAIMER_HI}</p>
    </section>
  );
}