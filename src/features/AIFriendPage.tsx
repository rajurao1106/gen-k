"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  callGemini,
  isQuotaOrRateLimitError,
  QUOTA_ERROR_MESSAGE_HI,
} from "../lib/gemini";
import {
  getSavedAIFriendChat,
  getKundaliProfileId,
  getUserKundaliProfile,
  getUserKundaliProfiles,
  saveAIFriendChat,
  type StoredChatMessage,
} from "../lib/storage";
import {
  deleteVoiceSample,
  getVoiceSample,
  saveVoiceSample,
  synthesizeWithSavedVoice,
  type SavedVoiceSample,
  type VoiceSampleLanguage,
} from "../lib/voiceStorage";

// ---------------------------------------------------------------------------
// AI Friend - orb UI (navy + gold)
//
//  * Mic is the default input; the keyboard button swaps it for a text field.
//  * Reply mode: Text = chat bubbles + small orb, Voice = big orb with the
//    reply text sliding up in sync with the audio.
//  * Empty states offer tappable starter questions.
//  * Language and reply mode are remembered between visits.
// ---------------------------------------------------------------------------

const MAX_SAMPLE_SIZE = 10 * 1024 * 1024;

type SRAlt = { readonly transcript: string };
type SRResult = ArrayLike<SRAlt> & { readonly isFinal: boolean };
type SREvent = Event & { readonly results: ArrayLike<SRResult> };
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SREvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

type Lang = "en" | "hi";
type Mode = "text" | "voice";
type Phase = "idle" | "thinking" | "playing" | "done";
type Player = { progress: () => number; stop: () => void; done: Promise<void> };

const T = {
  en: {
    online: "Online",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    hint: "Tap the mic and ask anything, or try one of these.",
    placeholder: "Type your question",
    text: "Text",
    voice: "Voice",
    empty: "Ask anything, or start with one of these.",
    replyMode: "Reply mode",
    settings: "Settings",
    user: "User",
    addUser: "Add user",
    language: "Language",
    clear: "Clear chat",
    clearConfirm: "Tap again to clear",
    cancel: "Cancel",
    myVoice: "My voice",
    voiceOn: "Replies use this voice.",
    voiceOff: "No voice added. Upload a clear 30–60 sec recording of your friend (no music/noise). Until then a browser voice is used.",
    remove: "Remove",
    save: "Save voice",
    consent: "This is my own voice, or I have permission to use it.",
    noProfile: "Add your birth details to start talking.",
    blocked: "The browser blocked audio. Tap the orb to replay.",
    typeInstead: "Type instead",
    speak: "Speak",
    stop: "Stop",
    startOver: "Start over",
    send: "Send",
    close: "Close",
    orbStop: "Stop reply",
    orbPlay: "Replay reply",
    tapSpeak: "Tap to speak",
    tapSend: "Tap to send",
    tapOrbStop: "Tap the orb to stop",
    tapOrbPlay: "Tap the orb to replay",
    retry: "Retry",
    noMic: "Speech recognition is not supported here. Try Chrome or Edge.",
    micFail: "Could not use the microphone. Check permission and try again.",
    saveFail: "This chat could not be saved in this browser.",
    sampleBig: "The audio sample must be 10 MB or smaller.",
    sampleType: "Choose a WAV, MP3, FLAC, or OGG file.",
    emptyReply: "AI Friend returned an empty reply.",
    failed: "AI Friend could not reply. Please try again.",
    suggestions: [
      "How is my day looking?",
      "I feel stuck. Can we talk it through?",
      "What are my natural strengths?",
      "Help me think through a decision",
    ],
  },
  hi: {
    online: "ऑनलाइन",
    listening: "सुन रहा हूँ…",
    thinking: "सोच रहा हूँ…",
    speaking: "बोल रहा हूँ…",
    hint: "माइक दबाकर कुछ भी पूछें, या नीचे से चुनें।",
    placeholder: "अपना सवाल लिखें",
    text: "टेक्स्ट",
    voice: "वॉइस",
    empty: "कुछ भी पूछें, या नीचे से चुनें।",
    replyMode: "जवाब का तरीका",
    settings: "सेटिंग्स",
    user: "User चुनें",
    addUser: "User जोड़ें",
    language: "भाषा",
    clear: "चैट साफ़ करें",
    clearConfirm: "साफ़ करने के लिए दोबारा टैप करें",
    cancel: "रद्द करें",
    myVoice: "मेरी आवाज़",
    voiceOn: "जवाब इसी आवाज़ में आएँगे।",
    voiceOff: "कोई आवाज़ नहीं जोड़ी गई। दोस्त की साफ़ 30–60 सेकंड की रिकॉर्डिंग (बिना music/शोर) अपलोड करें। तब तक Browser की आवाज़ इस्तेमाल होगी।",
    remove: "हटाएँ",
    save: "Voice सेव करें",
    consent: "यह मेरी अपनी आवाज़ है, या मेरे पास इसकी अनुमति है।",
    noProfile: "बात शुरू करने के लिए पहले जन्म विवरण जोड़ें।",
    blocked: "Browser ने audio रोक दिया। Orb पर टैप करके दोबारा सुनें।",
    typeInstead: "टाइप करें",
    speak: "बोलें",
    stop: "रोकें",
    startOver: "नए सिरे से",
    send: "भेजें",
    close: "बंद करें",
    orbStop: "जवाब रोकें",
    orbPlay: "जवाब फिर सुनें",
    tapSpeak: "बोलने के लिए टैप करें",
    tapSend: "भेजने के लिए टैप करें",
    tapOrbStop: "रोकने के लिए Orb पर टैप करें",
    tapOrbPlay: "फिर सुनने के लिए Orb पर टैप करें",
    retry: "दोबारा कोशिश करें",
    noMic: "इस browser में speech recognition नहीं है। Chrome या Edge आज़माएँ।",
    micFail: "Microphone नहीं चला। Permission देखकर दोबारा कोशिश करें।",
    saveFail: "यह चैट इस browser में सेव नहीं हो सकी।",
    sampleBig: "Audio sample 10 MB या उससे छोटा होना चाहिए।",
    sampleType: "WAV, MP3, FLAC या OGG file चुनें।",
    emptyReply: "AI Friend ने खाली जवाब दिया।",
    failed: "AI Friend जवाब नहीं दे सका। दोबारा कोशिश करें।",
    suggestions: [
      "आज का दिन कैसा रहेगा?",
      "मैं उलझा हुआ हूँ, क्या हम बात कर सकते हैं?",
      "मेरी स्वाभाविक ताकतें क्या हैं?",
      "एक फ़ैसले के बारे में सोचने में मदद करें",
    ],
  },
} as const;

const STYLES = `
.af{--af-accent:#d8b36a;--af-ink:#1a1405;--af-navy:#232c63;--af-dim:rgba(255,255,255,.6);color:#f4f1ea;
background:radial-gradient(90% 55% at 50% 36%,#18215a 0%,#0a0e22 58%,#060814 100%)}
.af button:focus-visible,.af input:focus-visible,.af select:focus-visible{outline:2px solid var(--af-accent);outline-offset:2px}
.af-orb{--morph:11s;--spin:18s;--pulse:6s;position:relative;isolation:isolate;aspect-ratio:1;animation:af-pulse var(--pulse) ease-in-out infinite;transition:width .5s ease,height .5s ease}
.af-orb::before{content:"";position:absolute;inset:-22%;z-index:-1;border-radius:50%;background:radial-gradient(circle,rgba(216,179,106,.30),transparent 66%)}
.af-orb[data-s=listening]{--morph:4s;--spin:6s;--pulse:1.6s}
.af-orb[data-s=thinking]{--morph:3s;--spin:2.4s;--pulse:2.4s}
.af-orb[data-s=speaking]{--morph:2.6s;--spin:8s;--pulse:.9s}
.af-blob{position:absolute;inset:0;border-radius:46% 54% 52% 48%/50% 44% 56% 50%;
background:radial-gradient(circle at 50% 50%,#050714 34%,transparent 60%),conic-gradient(from 0deg,#f6dc96,#d8b36a,#7d6cf0,#4cc3f5,#f08fb8,#f6dc96);
box-shadow:0 0 52px rgba(216,179,106,.35),inset 0 0 22px rgba(255,255,255,.5);
animation:af-morph var(--morph) ease-in-out infinite,af-spin var(--spin) linear infinite}
.af-sheen{position:absolute;inset:6%;border-radius:50%;pointer-events:none;mix-blend-mode:screen;
background:radial-gradient(circle at 28% 22%,rgba(255,255,255,.7),transparent 42%),radial-gradient(circle at 75% 80%,rgba(255,255,255,.22),transparent 40%)}
.af-ring{position:absolute;inset:0;border-radius:9999px;border:1px solid var(--af-accent);animation:af-ring 2.2s ease-out infinite}
.af-fade{-webkit-mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent);scrollbar-width:none}
.af-dots{display:inline-flex;gap:4px;align-items:center;height:1.5rem}
.af-dots i{width:6px;height:6px;border-radius:9999px;background:currentColor;animation:af-dot 1.2s ease-in-out infinite}
.af-dots i:nth-child(2){animation-delay:.15s}.af-dots i:nth-child(3){animation-delay:.3s}
.af-sheet{animation:af-sheet .22s ease-out}
@keyframes af-morph{0%,100%{border-radius:46% 54% 52% 48%/50% 44% 56% 50%}33%{border-radius:55% 45% 42% 58%/46% 56% 44% 54%}66%{border-radius:42% 58% 56% 44%/56% 42% 58% 44%}}
@keyframes af-spin{to{transform:rotate(360deg)}}
@keyframes af-pulse{0%,100%{scale:1}50%{scale:1.04}}
@keyframes af-ring{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.9);opacity:0}}
@keyframes af-dot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
@keyframes af-sheet{from{transform:translateY(28px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.af-orb,.af-blob,.af-ring,.af-dots i,.af-sheet{animation:none}}
`;

const ICONS = {
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  keyboard: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10",
  x: "M6 6l12 12M18 6 6 18",
  send: "M12 19V5m-6 6 6-6 6 6",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4",
  stop: "M7 7h10v10H7z",
  reset: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  speaker: "M4 9v6h4l5 4V5L8 9H4ZM16.5 8.5a5 5 0 0 1 0 7",
} as const;

const clean = (s: string) => s.replace(/[*_#`>~]+/g, "");

function Icon({ name, className = "h-6 w-6" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function RoundButton({
  label,
  tone,
  onClick,
  children,
  type = "button",
  disabled,
}: {
  label: string;
  tone: "navy" | "dark" | "accent";
  onClick?: () => void;
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const tones = {
    navy: "bg-[var(--af-navy)] text-white",
    dark: "bg-white/10 text-white/80",
    accent: "bg-[var(--af-accent)] text-[var(--af-ink)]",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-40 ${tones[tone]}`}>
      {children}
    </button>
  );
}

function Chips({ items, onPick, disabled }: { items: readonly string[]; onPick: (q: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((q) => (
        <button key={q} type="button" disabled={disabled} onClick={() => onPick(q)}
          className="rounded-full border border-[var(--af-accent)]/35 bg-white/5 px-3.5 py-2 text-left text-[0.8rem] leading-snug text-white/85 transition-colors active:bg-[var(--af-accent)]/20 disabled:opacity-40">
          {q}
        </button>
      ))}
    </div>
  );
}

const Dots = () => <span className="af-dots" aria-hidden="true"><i /><i /><i /></span>;

// ---- audio players (all expose progress 0..1 so the text can follow) -------

function timerPlayer(text: string): Player {
  const ms = Math.max(3000, text.split(/\s+/).length * 380);
  const t0 = performance.now();
  let finish!: () => void;
  const done = new Promise<void>((resolve) => { finish = resolve; });
  const id = window.setTimeout(finish, ms);
  return {
    done,
    progress: () => Math.min(1, (performance.now() - t0) / ms),
    stop: () => { window.clearTimeout(id); finish(); },
  };
}

// Browser voice, spoken sentence by sentence (long utterances get cut off in
// Chrome). Progress is estimated from characters spoken.
function speakBrowser(text: string, lang: Lang): Player {
  const synth = window.speechSynthesis;
  if (!synth) return timerPlayer(text);
  synth.cancel();
  const parts = (text.match(/[^.!?।\n]+[.!?।]*/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
  const total = parts.reduce((n, s) => n + s.length, 0) || 1;
  const cps = lang === "hi" ? 11 : 14;
  let doneChars = 0, idx = 0, t0 = performance.now(), stopped = false;
  let finish!: () => void;
  const done = new Promise<void>((resolve) => { finish = resolve; });
  const next = () => {
    if (stopped || idx >= parts.length) { finish(); return; }
    const part = parts[idx];
    const utterance = new SpeechSynthesisUtterance(part);
    utterance.lang = lang === "hi" ? "hi-IN" : "en-US";
    t0 = performance.now();
    const advance = () => { doneChars += part.length; idx += 1; next(); };
    utterance.onend = advance;
    utterance.onerror = advance;
    synth.speak(utterance);
  };
  next();
  return {
    done,
    stop: () => { stopped = true; synth.cancel(); finish(); },
    progress: () => {
      const cur = idx < parts.length ? parts[idx].length : 0;
      const frac = Math.min(0.98, ((performance.now() - t0) / 1000 * cps) / Math.max(cur, 1));
      return Math.min(1, (doneChars + cur * frac) / total);
    },
  };
}

function loadProfileChat(profile: ReturnType<typeof getUserKundaliProfile>) {
  if (!profile) return [];
  try {
    return getSavedAIFriendChat(profile);
  } catch (error) {
    console.error("Could not load this profile's saved AI Friend chat:", error);
    return [];
  }
}

function lastExchange(messages: StoredChatMessage[]) {
  const answer = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  return { question, answer: clean(answer) };
}

export default function AIFriendPage() {
  const router = useRouter();
  const [profiles] = useState(() => getUserKundaliProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState(() => {
    const saved = localStorage.getItem("ai_friend_selected_profile");
    if (saved && profiles.some((p) => getKundaliProfileId(p) === saved)) return saved;
    const fallback = getUserKundaliProfile() ?? profiles[0];
    return fallback ? getKundaliProfileId(fallback) : "";
  });
  const profile = profiles.find((p) => getKundaliProfileId(p) === selectedProfileId) ?? profiles[0] ?? null;

  const [language, setLanguage] = useState<Lang>(() =>
    localStorage.getItem("ai_friend_language") === "hi" ? "hi" : "en",
  );
  const [mode, setMode] = useState<Mode>(() =>
    localStorage.getItem("ai_friend_reply_mode") === "text" ? "text" : "voice",
  );
  const [messages, setMessages] = useState<StoredChatMessage[]>(() => loadProfileChat(profile));
  const [stage, setStage] = useState(() => lastExchange(loadProfileChat(profile)));
  const [phase, setPhase] = useState<Phase>(() => (stage.answer ? "done" : "idle"));
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [chatError, setChatError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [voiceSample, setVoiceSample] = useState<SavedVoiceSample | null>(null);
  const [loadingSample, setLoadingSample] = useState(true);
  const [sampleLanguage, setSampleLanguage] = useState<VoiceSampleLanguage>("hi");
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [savingSample, setSavingSample] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const playerRef = useRef<Player | null>(null);
  const playToken = useRef(0);
  const busyRef = useRef(false);
  const lastQuestionRef = useRef("");
  const blobRef = useRef<{ key: string; blob: Blob } | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const t = T[language];
  const voiceMode = mode === "voice";
  const orbState = listening ? "listening" : phase === "thinking" ? "thinking" : phase === "playing" ? "speaking" : "idle";
  const statusText = listening ? t.listening : phase === "thinking" ? t.thinking : phase === "playing" ? t.speaking : t.online;
  const busy = listening || phase === "thinking" || phase === "playing";
  const canReset = busy || (voiceMode && Boolean(stage.answer || stage.question));
  const showStarters = !listening && phase === "idle" && !stage.answer && !stage.question;

  // ---- text slide: bottom -> top, following audio progress -----------------
  const applyProgress = (p: number) => {
    const view = viewRef.current, el = textRef.current;
    if (!view || !el) return;
    const c = view.clientHeight, h = el.offsetHeight;
    const start = c * 0.45, end = Math.min(0, c - h);
    el.style.transform = `translateY(${start + (end - start) * p}px)`;
  };

  useLayoutEffect(() => {
    if (phase === "playing") applyProgress(playerRef.current?.progress() ?? 0);
  }, [phase, stage.answer]);

  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const tick = () => {
      applyProgress(playerRef.current?.progress() ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    const view = viewRef.current, el = textRef.current;
    if (!view || !el || phase === "playing") return;
    el.style.transform = "";
    if (phase === "done") view.scrollTop = view.scrollHeight;
  }, [phase, stage.answer, mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, mode]);

  useEffect(() => () => {
    playToken.current += 1;
    playerRef.current?.stop();
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  // Settings sheet: focus it on open, close with Escape.
  useEffect(() => {
    if (!sheet) return;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSheet(false); setConfirmClear(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  useEffect(() => {
    let current = true;
    getVoiceSample(selectedProfileId)
      .then((sample) => { if (current) setVoiceSample(sample); })
      .catch((error: unknown) => {
        console.error("Could not load the locally saved voice sample:", error);
      })
      .finally(() => { if (current) setLoadingSample(false); });
    return () => { current = false; };
  }, [selectedProfileId]);

  // ---- playback ---------------------------------------------------------------
  const stopPlayback = () => {
    playToken.current += 1;
    playerRef.current?.stop();
    playerRef.current = null;
    window.speechSynthesis?.cancel();
  };

  const createPlayer = async (text: string): Promise<Player> => {
    if (voiceSample) {
      try {
        const key = `${language}|${text}`;
        const blob = blobRef.current?.key === key
          ? blobRef.current.blob
          : await synthesizeWithSavedVoice(voiceSample, text, language);
        blobRef.current = { key, blob };
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        let finish!: () => void;
        const done = new Promise<void>((resolve) => { finish = resolve; });
        audio.onended = () => finish();
        audio.onerror = () => finish();
        try {
          await audio.play();
        } catch (error) {
          URL.revokeObjectURL(url);
          throw error;
        }
        return {
          done,
          progress: () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0),
          stop: () => { audio.pause(); URL.revokeObjectURL(url); finish(); },
        };
      } catch (error) {
        console.error("Saved-voice playback failed, using the browser voice:", error);
        setChatError(error instanceof Error && error.name !== "NotAllowedError" ? error.message : t.blocked);
      }
    }
    return speakBrowser(text, language);
  };

  const runPlayback = async (text: string) => {
    stopPlayback();
    const token = playToken.current;
    setPhase("thinking");
    const player = await createPlayer(text);
    if (token !== playToken.current) { player.stop(); return; }
    playerRef.current = player;
    setPhase("playing");
    await player.done;
    if (token === playToken.current) { playerRef.current = null; setPhase("done"); }
  };

  const onOrb = () => {
    if (!voiceMode) return;
    if (phase === "playing") { stopPlayback(); setPhase("done"); }
    else if (phase !== "thinking" && stage.answer) void runPlayback(stage.answer);
  };

  // ---- chat -------------------------------------------------------------------
  const persist = (next: StoredChatMessage[]) => {
    if (!profile) return;
    try {
      saveAIFriendChat(profile, next);
    } catch (error) {
      console.error("Could not save this profile's AI Friend chat:", error);
      setChatError(t.saveFail);
    }
  };

  const sendMessage = async (raw: string, retry = false) => {
    const question = raw.trim();
    if (!profile || !question || busyRef.current) return;
    busyRef.current = true;
    stopPlayback();
    const spoken = mode === "voice";
    // On retry the failed question is already the last message: don't duplicate it.
    const last = messages[messages.length - 1];
    const base = retry && last?.role === "user" && last.content === question ? messages.slice(0, -1) : messages;
    const history = base.slice(-6);
    const withUser = [...base, { role: "user" as const, content: question }];
    lastQuestionRef.current = question;
    setMessages(withUser);
    persist(withUser);
    setInput("");
    setInterim("");
    setChatError("");
    setCanRetry(false);
    setStage({ question, answer: "" });
    setPhase("thinking");

    let shown = "";
    try {
      const conversation = history
        .map((e) => `${e.role === "user" ? "User" : "AI Friend"}: ${e.content.slice(0, 600)}`)
        .join("\n");
      const response = await callGemini({
        model: "gemini-3.5-flash-lite",
        input: `You are ${profile.name}'s warm, thoughtful AI Friend. Use the user's saved birth details as personal context, but do not claim astrology is scientifically certain. Be kind, conversational, and answer the actual question. Do not invent horoscope/chart placements. Keep safety-sensitive advice cautious and encourage professional help where appropriate.${spoken ? " This reply will be read aloud: use 3 to 6 short plain sentences, with no markdown, lists or emojis." : ""}

User details:
- Name: ${profile.name}
- Date of birth: ${profile.dob}
- Time of birth: ${profile.bot}
- Place of birth: ${profile.bop}
- Gender: ${profile.gender || "not provided"}

Reply entirely in ${language === "hi" ? "Hindi using Devanagari script" : "English"}.
${conversation ? `Earlier conversation:\n${conversation}\n` : ""}
User: ${question}
AI Friend:`,
      });
      const answer = response.output_text?.trim();
      if (!answer) throw new Error(t.emptyReply);
      const next = [...withUser, { role: "assistant" as const, content: answer }];
      setMessages(next);
      persist(next);
      shown = clean(answer);
      setStage({ question, answer: shown });
    } catch (error) {
      console.error("AI Friend chat request failed:", error);
      setCanRetry(true);
      setChatError(
        isQuotaOrRateLimitError(error) ? QUOTA_ERROR_MESSAGE_HI : error instanceof Error ? error.message : t.failed,
      );
    } finally {
      busyRef.current = false;
    }
    if (!shown) setPhase("idle");
    else if (spoken) void runPlayback(shown);
    else setPhase("done");
  };

  // The speech callback outlives the render it was created in; always call the latest sendMessage.
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  const toggleMic = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setChatError(t.noMic); return; }
    stopPlayback();
    if (phase === "playing") setPhase("done");
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = language === "hi" ? "hi-IN" : "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results.map((r) => r[0]?.transcript ?? "").join(" ").trim();
      setInterim(transcript);
      if (results[results.length - 1]?.isFinal && transcript) void sendRef.current(transcript);
    };
    recognition.onerror = (event) => {
      console.error("Browser speech recognition failed:", event);
      setListening(false);
      setCanRetry(false);
      setChatError(t.micFail);
    };
    recognition.onend = () => { setListening(false); setInterim(""); };
    recognitionRef.current = recognition;
    setChatError("");
    setListening(true);
    try {
      recognition.start();
    } catch (error) {
      console.error("Could not start browser speech recognition:", error);
      setListening(false);
      setChatError(t.micFail);
    }
  };

  const stopOrReset = () => {
    recognitionRef.current?.abort();
    setListening(false);
    stopPlayback();
    setChatError("");
    setCanRetry(false);
    if (phase === "playing" || phase === "thinking") {
      setPhase(stage.answer ? "done" : "idle");
    } else {
      setPhase("idle");
      setStage({ question: "", answer: "" });
    }
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    localStorage.setItem("ai_friend_reply_mode", next);
    if (next === "text") { stopPlayback(); if (phase === "playing") setPhase("done"); }
  };

  const changeLanguage = (next: Lang) => {
    setLanguage(next);
    localStorage.setItem("ai_friend_language", next);
  };

  const submitTyped = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const closeSheet = () => { setSheet(false); setConfirmClear(false); };

  // ---- settings handlers ------------------------------------------------------
  const selectProfile = (profileId: string) => {
    recognitionRef.current?.abort();
    stopPlayback();
    setListening(false);
    const next = profiles.find((p) => getKundaliProfileId(p) === profileId) ?? null;
    const chat = loadProfileChat(next);
    setSelectedProfileId(profileId);
    localStorage.setItem("ai_friend_selected_profile", profileId);
    setMessages(chat);
    const exchange = lastExchange(chat);
    setStage(exchange);
    setPhase(exchange.answer ? "done" : "idle");
    setInput("");
    setChatError("");
    setCanRetry(false);
    setLoadingSample(true);
    setVoiceSample(null);
    setSampleFile(null);
    setConsent(false);
    setVoiceError("");
  };

  const clearChat = () => {
    if (!profile) return;
    if (!confirmClear) { setConfirmClear(true); return; }
    try {
      saveAIFriendChat(profile, []);
      stopPlayback();
      setMessages([]);
      setStage({ question: "", answer: "" });
      setPhase("idle");
      setChatError("");
      setCanRetry(false);
      setConfirmClear(false);
      setSheet(false);
    } catch (error) {
      console.error("Could not clear this profile's AI Friend chat:", error);
      setChatError(t.saveFail);
    }
  };

  const pickSample = (file: File | null) => {
    setVoiceError("");
    setConsent(false);
    if (file && file.size > MAX_SAMPLE_SIZE) { setSampleFile(null); setVoiceError(t.sampleBig); return; }
    if (file && !file.type.startsWith("audio/") && !/\.(wav|mp3|flac|ogg|oga)$/i.test(file.name)) {
      setSampleFile(null);
      setVoiceError(t.sampleType);
      return;
    }
    setSampleFile(file);
  };

  const saveSample = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !sampleFile || !consent || savingSample) return;
    try {
      setSavingSample(true);
      setVoiceError("");
      setVoiceSample(await saveVoiceSample(getKundaliProfileId(profile), sampleFile, sampleLanguage));
      setSampleFile(null);
      setConsent(false);
    } catch (error) {
      console.error("Could not save the local voice sample:", error);
      setVoiceError(error instanceof Error ? error.message : t.saveFail);
    } finally {
      setSavingSample(false);
    }
  };

  const removeSample = async () => {
    if (!profile) return;
    try {
      await deleteVoiceSample(getKundaliProfileId(profile));
      setVoiceSample(null);
    } catch (error) {
      console.error("Could not remove the local voice sample:", error);
      setVoiceError(t.saveFail);
    }
  };

  const fieldClass = "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white";

  // ---- render ---------------------------------------------------------------
  return (
    <main className="af relative mx-auto flex h-[min(44rem,calc(100dvh-13rem))] lg:h-[min(44rem,calc(100dvh-4rem))] max-lg:h-[90vh] w-full max-w-[26rem] flex-col overflow-hidden  ring-1 ring-[var(--af-accent)]/20">
      <style>{STYLES}</style>

      <header className="grid shrink-0 grid-cols-[2.5rem_1fr_auto] items-start gap-2 px-4 pt-4">
        <button type="button" onClick={() => setSheet(true)} aria-label={t.settings} title={t.settings}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80">
          <Icon name="sliders" className="h-5 w-5" />
        </button>
        {/* <div className="flex min-w-0 flex-col items-center gap-1.5">
          <span className="rounded-full bg-[var(--af-accent)] px-4 py-1 text-sm font-medium text-[var(--af-ink)]">AI Friend</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--af-dim)]" aria-live="polite">
            <span className={`h-1.5 w-1.5 rounded-full bg-[var(--af-accent)] ${busy ? "animate-pulse" : ""}`} />
            {statusText}
          </span>
          {profile && profiles.length > 1 && (
            <span className="max-w-full truncate text-[0.7rem] text-white/45">{profile.name}</span>
          )}
        </div> */}
        {/* <div role="group" aria-label={t.replyMode} className="flex rounded-full bg-white/10 p-0.5 text-xs">
          {(["text", "voice"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => changeMode(m)}
              className={`rounded-full px-3 py-1.5 ${mode === m ? "bg-[var(--af-accent)] font-medium text-[var(--af-ink)]" : "text-white/70"}`}>
              {t[m]}
            </button>
          ))}
        </div> */}
      </header>

      {!profile ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-sm text-[var(--af-dim)]">{t.noProfile}</p>
          <button type="button" onClick={() => router.push("/kundali?newProfile=1")}
            className="rounded-full bg-[var(--af-accent)] px-5 py-2.5 text-sm font-medium text-[var(--af-ink)]">
            {t.addUser}
          </button>
        </section>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col px-5">
          <div className={voiceMode ? "flex flex-1 items-center justify-center" : "flex shrink-0 justify-center pb-3 pt-2"}>
            <button type="button" onClick={onOrb} disabled={!voiceMode} className="rounded-full"
              aria-label={phase === "playing" ? t.orbStop : t.orbPlay}>
              <div className="af-orb" data-s={orbState}
                style={{ width: voiceMode ? "clamp(8rem, 32dvh, 14.5rem)" : "5rem" }}>
                <div className="af-blob" />
                <div className="af-sheen" />
              </div>
            </button>
          </div>

          {voiceMode ? (
            <>
              <p className="mb-2 line-clamp-2 min-h-10 text-center text-sm text-[var(--af-dim)]">
                {listening ? interim || t.listening : stage.question}
              </p>
              {showStarters ? (
                <div className="h-40 w-full shrink-0 overflow-y-auto pb-2">
                  <p className="mb-3 text-center text-sm text-[var(--af-dim)]">{t.hint}</p>
                  <Chips items={t.suggestions} onPick={(q) => void sendMessage(q)} />
                </div>
              ) : (
                <div ref={viewRef} className={`af-fade h-40 w-full shrink-0 ${phase === "done" ? "overflow-y-auto" : "overflow-hidden"}`}>
                  <div ref={textRef} className="whitespace-pre-wrap px-1 pb-8 pt-5 text-center font-serif text-[1.2rem] leading-8 text-white will-change-transform">
                    {phase === "thinking" ? (
                      <span className="text-[var(--af-dim)]"><Dots /><span className="sr-only">{t.thinking}</span></span>
                    ) : (
                      stage.answer || <span className="font-sans text-sm text-[var(--af-dim)]">{listening ? "" : t.hint}</span>
                    )}
                  </div>
                </div>
              )}
              <p className="h-5 text-center text-[0.7rem] text-white/40" aria-hidden="true">
                {phase === "playing" ? t.tapOrbStop : phase === "done" && stage.answer ? t.tapOrbPlay : ""}
              </p>
            </>
          ) : (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-3" role="log" aria-live="polite">
              {messages.length === 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-center text-sm text-[var(--af-dim)]">{t.empty}</p>
                  <Chips items={t.suggestions} onPick={(q) => void sendMessage(q)} disabled={phase === "thinking"} />
                </div>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <p key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[var(--af-accent)] px-3.5 py-2 text-sm leading-6 text-[var(--af-ink)]">
                    {m.content}
                  </p>
                ) : (
                  <div key={i} className="mr-auto flex max-w-[92%] flex-col items-start">
                    <p className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white/[0.08] px-3.5 py-2 text-sm leading-6 ring-1 ring-white/10">
                      {m.content}
                    </p>
                    <button type="button" aria-label={t.orbPlay} title={t.orbPlay}
                      onClick={() => void runPlayback(clean(m.content))}
                      className="ml-1 mt-0.5 grid h-8 w-8 place-items-center rounded-full text-white/45 active:text-[var(--af-accent)]">
                      <Icon name="speaker" className="h-4 w-4" />
                    </button>
                  </div>
                ),
              )}
              {(phase === "thinking" || listening) && (
                <p className="mr-auto w-fit rounded-2xl bg-white/[0.08] px-3.5 py-2 text-sm text-[var(--af-dim)]">
                  {listening ? interim || t.listening : (<><Dots /><span className="sr-only">{t.thinking}</span></>)}
                </p>
              )}
              <div ref={endRef} />
            </div>
          )}
        </section>
      )}

      {chatError && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 pb-2 text-xs text-[#ff9d9d]">
          <span className="text-center">{chatError}</span>
          {canRetry && (
            <button type="button" onClick={() => void sendMessage(lastQuestionRef.current, true)}
              className="rounded-full border border-[#ff9d9d]/50 px-3 py-1 font-medium">
              {t.retry}
            </button>
          )}
        </div>
      )}

      {profile && (typing ? (
        <form onSubmit={submitTyped} className="flex shrink-0 items-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <RoundButton label={t.speak} tone="navy" onClick={() => setTyping(false)}><Icon name="mic" /></RoundButton>
          <input value={input} onChange={(e) => setInput(e.currentTarget.value)} autoFocus enterKeyHint="send"
            placeholder={t.placeholder} aria-label={t.placeholder}
            className="h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40" />
          <RoundButton label={t.send} tone="accent" type="submit" disabled={!input.trim() || phase === "thinking"}>
            <Icon name="send" />
          </RoundButton>
        </form>
      ) : (
        <div className="flex shrink-0 items-start justify-between px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <div className="pt-4">
            <RoundButton label={t.typeInstead} tone="navy" onClick={() => { recognitionRef.current?.abort(); setTyping(true); }}>
              <Icon name="keyboard" />
            </RoundButton>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative grid h-20 w-20 place-items-center">
              <span className="absolute -inset-3 rounded-full border border-white/10" aria-hidden="true" />
              <span className="absolute -inset-7 rounded-full border border-white/[0.06]" aria-hidden="true" />
              {listening && (<><span className="af-ring" aria-hidden="true" /><span className="af-ring" style={{ animationDelay: "1.1s" }} aria-hidden="true" /></>)}
              <button type="button" onClick={toggleMic} aria-pressed={listening}
                aria-label={listening ? t.tapSend : t.speak}
                className={`relative grid h-20 w-20 place-items-center rounded-full bg-[var(--af-accent)] text-[var(--af-ink)] shadow-[0_0_28px_rgba(216,179,106,.35)] transition-transform active:scale-95 ${listening ? "scale-95" : ""}`}>
                <Icon name={listening ? "send" : "mic"} className="h-8 w-8" />
              </button>
            </div>
            <span className="mt-4 text-[0.7rem] text-white/50">{listening ? t.tapSend : t.tapSpeak}</span>
          </div>
          <div className="pt-4">
            <RoundButton label={busy ? t.stop : t.startOver} tone="dark" onClick={stopOrReset} disabled={!canReset}>
              <Icon name={busy ? "stop" : "reset"} className="h-5 w-5" />
            </RoundButton>
          </div>
        </div>
      ))}

      {sheet && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/60" onClick={closeSheet}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t.settings}
            onClick={(e) => e.stopPropagation()}
            className="af-sheet flex max-h-[92%] w-full flex-col gap-5 overflow-y-auto rounded-t-3xl border-t border-[var(--af-accent)]/25 bg-[#0c1128] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">{t.settings}</h2>
              <RoundButton label={t.close} tone="dark" onClick={closeSheet}><Icon name="x" /></RoundButton>
            </div>

            <label className="flex flex-col gap-2 text-sm text-[var(--af-dim)]">
              {t.user}
              <select value={selectedProfileId} onChange={(e) => selectProfile(e.target.value)} className={fieldClass}>
                {profiles.map((p) => (
                  <option key={getKundaliProfileId(p)} value={getKundaliProfileId(p)} className="bg-black">{p.name}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => router.push("/kundali?newProfile=1")}
              className="w-fit rounded-full border border-white/20 px-4 py-2 text-sm">{t.addUser}</button>

            <div className="flex flex-col gap-2 text-sm text-[var(--af-dim)]">
              {t.language}
              <div role="group" aria-label={t.language} className="flex w-fit rounded-full bg-white/10 p-0.5 text-sm">
                {([["en", "English"], ["hi", "हिंदी"]] as const).map(([code, label]) => (
                  <button key={code} type="button" aria-pressed={language === code} onClick={() => changeLanguage(code)}
                    className={`rounded-full px-4 py-1.5 ${language === code ? "bg-[var(--af-accent)] font-medium text-[var(--af-ink)]" : "text-white/70"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
              <h3 className="text-sm font-medium">{t.myVoice}</h3>
              {loadingSample ? null : voiceSample ? (
                <>
                  <p className="text-sm text-[var(--af-dim)]">{t.voiceOn} ({voiceSample.fileName})</p>
                  <button type="button" onClick={removeSample} className="w-fit rounded-full border border-white/20 px-4 py-2 text-sm">{t.remove}</button>
                </>
              ) : (
                <form onSubmit={saveSample} className="flex flex-col gap-3">
                  <p className="text-sm text-[var(--af-dim)]">{t.voiceOff}</p>
                  <input type="file" accept="audio/*,.wav,.mp3,.flac,.ogg,.oga" aria-label={t.myVoice}
                    onChange={(e) => pickSample(e.currentTarget.files?.[0] ?? null)} className={fieldClass} />
                  <select value={sampleLanguage} onChange={(e) => setSampleLanguage(e.target.value as VoiceSampleLanguage)}
                    aria-label={t.language} className={fieldClass}>
                    <option value="hi" className="bg-black">हिंदी</option>
                    <option value="en" className="bg-black">English</option>
                  </select>
                  <label className="flex items-start gap-2 text-sm text-[var(--af-dim)]">
                    <input type="checkbox" checked={consent} disabled={!sampleFile} onChange={(e) => setConsent(e.currentTarget.checked)} className="mt-1" />
                    {t.consent}
                  </label>
                  <button type="submit" disabled={!sampleFile || !consent || savingSample}
                    className="w-fit rounded-full bg-[var(--af-accent)] px-5 py-2 text-sm font-medium text-[var(--af-ink)] disabled:opacity-40">{t.save}</button>
                </form>
              )}
              {voiceError && <p role="alert" className="text-sm text-[#ff9d9d]">{voiceError}</p>}
            </div>

            <div className="flex items-center gap-2 border-t border-white/10 pt-4">
              <button type="button" onClick={clearChat}
                className={`w-fit rounded-full border px-4 py-2 text-sm ${confirmClear ? "border-[#ff9d9d] bg-[#ff9d9d]/15 text-[#ffb4b4]" : "border-[#ff9d9d]/40 text-[#ff9d9d]"}`}>
                {confirmClear ? t.clearConfirm : t.clear}
              </button>
              {confirmClear && (
                <button type="button" onClick={() => setConfirmClear(false)} className="rounded-full px-3 py-2 text-sm text-white/60">{t.cancel}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}