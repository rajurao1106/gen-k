import { useEffect, useRef, useState } from "react";
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

const MAX_SAMPLE_SIZE = 16 * 1024 * 1024;

type SpeechRecognitionResult = {
  readonly transcript: string;
};

type SpeechRecognitionEvent = Event & {
  readonly results: ArrayLike<ArrayLike<SpeechRecognitionResult>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
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

function loadProfileChat(profile: ReturnType<typeof getUserKundaliProfile>) {
  if (!profile) return [];
  try {
    return getSavedAIFriendChat(profile);
  } catch (error) {
    console.error("Could not load this profile's saved AI Friend chat:", error);
    return [];
  }
}

function FriendAvatar() {
  return (
    <svg
      viewBox="0 0 260 300"
      role="img"
      aria-label="AI Friend illustrated human avatar"
      className="relative mx-auto w-full max-w-[260px] drop-shadow-[0_20px_30px_rgba(0,0,0,0.38)]"
    >
      <defs>
        <linearGradient id="friend-shirt" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#36728c" />
          <stop offset="1" stopColor="#18364d" />
        </linearGradient>
        <linearGradient id="friend-skin" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#f4c6a2" />
          <stop offset="1" stopColor="#d99573" />
        </linearGradient>
        <linearGradient id="friend-hair" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#352c34" />
          <stop offset="1" stopColor="#151923" />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="281" rx="82" ry="13" fill="#050d18" opacity=".45" />
      <path
        d="M39 280c5-53 35-81 91-81s86 28 91 81H39Z"
        fill="url(#friend-shirt)"
      />
      <path d="m100 198 30 37 31-37-11-23h-39l-11 23Z" fill="#d99573" />
      <path
        d="M76 105c0-48 23-73 57-73 39 0 59 29 55 78l-5 47c-3 28-23 49-51 49-28 0-48-21-51-49l-5-52Z"
        fill="url(#friend-skin)"
      />
      <path
        d="M76 117c-8-18-8-48 2-66 11-21 34-34 58-34 32 0 55 20 61 51 4 20-1 42-5 54l-12-29c-19 1-41-7-54-22-11 19-29 28-47 30l-3 16Z"
        fill="url(#friend-hair)"
      />
      <path
        d="M82 109c-14-7-22 2-19 19 2 12 8 20 17 20M179 108c13-7 21 2 18 19-2 12-8 20-17 20"
        fill="url(#friend-skin)"
      />
      <path
        d="M97 123c7-5 15-5 22 0M141 123c7-5 15-5 22 0"
        fill="none"
        stroke="#593d37"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <ellipse cx="108" cy="134" rx="3.5" ry="4.5" fill="#26303c" />
      <ellipse cx="151" cy="134" rx="3.5" ry="4.5" fill="#26303c" />
      <path
        d="m128 135-5 20 9 2"
        fill="none"
        stroke="#bd7d66"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <path
        d="M116 168q13 10 27 0"
        fill="none"
        stroke="#8b4b48"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

export default function AIFriendPage() {
  const router = useRouter();
  const [profiles] = useState(() => getUserKundaliProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState(() => {
    const savedProfileId = localStorage.getItem("ai_friend_selected_profile");
    if (
      savedProfileId &&
      profiles.some(
        (profile) => getKundaliProfileId(profile) === savedProfileId,
      )
    ) {
      return savedProfileId;
    }
    const defaultProfile = getUserKundaliProfile() ?? profiles[0];
    return defaultProfile ? getKundaliProfileId(defaultProfile) : "";
  });
  const initialProfile =
    profiles.find((item) => getKundaliProfileId(item) === selectedProfileId) ??
    profiles[0] ??
    null;
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [messages, setMessages] = useState<StoredChatMessage[]>(() =>
    loadProfileChat(initialProfile),
  );
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [generatingSpeech, setGeneratingSpeech] = useState(false);
  const [chatError, setChatError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [sampleLanguage, setSampleLanguage] =
    useState<VoiceSampleLanguage>("hi");
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [savingSample, setSavingSample] = useState(false);
  const [loadingSample, setLoadingSample] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const [voiceSample, setVoiceSample] = useState<SavedVoiceSample | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profile =
    profiles.find((item) => getKundaliProfileId(item) === selectedProfileId) ??
    profiles[0] ??
    null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendingMessage, generatingSpeech]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  useEffect(() => {
    let isCurrentProfile = true;
    getVoiceSample(selectedProfileId)
      .then((sample) => {
        if (isCurrentProfile) setVoiceSample(sample);
      })
      .catch((error: unknown) => {
        console.error("Could not load the locally saved voice sample:", error);
        if (isCurrentProfile) {
          setVoiceError("Could not load this profile's saved voice sample.");
        }
      })
      .finally(() => {
        if (isCurrentProfile) setLoadingSample(false);
      });
    return () => {
      isCurrentProfile = false;
    };
  }, [selectedProfileId]);

  const selectProfile = (profileId: string) => {
    recognitionRef.current?.abort();
    setListening(false);
    const nextProfile =
      profiles.find((item) => getKundaliProfileId(item) === profileId) ?? null;
    setSelectedProfileId(profileId);
    localStorage.setItem("ai_friend_selected_profile", profileId);
    setMessages(loadProfileChat(nextProfile));
    setMessageInput("");
    setChatError("");
    setAudioUrl("");
    setLoadingSample(true);
    setVoiceSample(null);
    setSampleFile(null);
    setConsentConfirmed(false);
    setVoiceError("");
  };

  const addUser = () => router.push("/kundali?newProfile=1");

  const handleSampleChange = (file: File | null) => {
    setVoiceError("");
    setConsentConfirmed(false);
    if (file && file.size > MAX_SAMPLE_SIZE) {
      setSampleFile(null);
      setVoiceError(
        language === "hi"
          ? "Audio sample 16 MB ya usse chhoti honi chahiye."
          : "The audio sample must be 16 MB or smaller.",
      );
      return;
    }
    if (
      file &&
      !file.type.startsWith("audio/") &&
      !/\.(wav|mp3|flac|ogg|oga)$/i.test(file.name)
    ) {
      setSampleFile(null);
      setVoiceError(
        language === "hi"
          ? "WAV, MP3, FLAC, ya OGG audio file chunen."
          : "Choose a WAV, MP3, FLAC, or OGG audio file.",
      );
      return;
    }
    setSampleFile(file);
  };

  const saveSampleForProfile = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!profile || !sampleFile || !consentConfirmed || savingSample) return;
    try {
      setSavingSample(true);
      setVoiceError("");
      const profileId = getKundaliProfileId(profile);
      setVoiceSample(
        await saveVoiceSample(profileId, sampleFile, sampleLanguage),
      );
      setSampleFile(null);
      setConsentConfirmed(false);
    } catch (error) {
      console.error("Could not save the local Chatterbox voice sample:", error);
      setVoiceError(
        error instanceof Error
          ? error.message
          : language === "hi"
            ? "Voice sample save nahi hua. Browser storage check karke dobara koshish karein."
            : "The voice sample could not be saved. Check browser storage and try again.",
      );
    } finally {
      setSavingSample(false);
    }
  };

  const removeVoiceFromProfile = async () => {
    if (!profile) return;
    try {
      await deleteVoiceSample(getKundaliProfileId(profile));
      setVoiceSample(null);
      setVoiceError("");
    } catch (error) {
      console.error(
        "Could not remove the local Chatterbox voice sample:",
        error,
      );
      setVoiceError(
        language === "hi"
          ? "Voice sample remove nahi hua. Dobara koshish karein."
          : "The voice sample could not be removed. Please try again.",
      );
    }
  };

  const sendMessage = async (message = messageInput) => {
    const question = message.trim();
    if (!profile || !question || sendingMessage) return;

    const priorMessages = messages.slice(-10);
    const userMessages = [
      ...messages,
      { role: "user" as const, content: question },
    ];
    setMessages(userMessages);
    try {
      saveAIFriendChat(profile, userMessages);
    } catch (error) {
      console.error("Could not save this profile's AI Friend chat:", error);
      setChatError(
        language === "hi"
          ? "Chat save nahi ho saki; jawab ke liye phir bhi koshish kar raha hoon."
          : "This chat could not be saved; I will still try to get a reply.",
      );
    }
    setMessageInput("");
    setChatError("");
    setSendingMessage(true);
    setGeneratingSpeech(false);
    setAudioUrl("");

    try {
      const conversation = priorMessages
        .map(
          (entry) =>
            `${entry.role === "user" ? "User" : "AI Friend"}: ${entry.content}`,
        )
        .join("\n");
      const response = await callGemini({
        model: "gemini-3.5-flash-lite",
        input: `You are ${profile.name}'s warm, thoughtful AI Friend. Use the user's saved birth details as personal context, but do not claim astrology is scientifically certain. Be kind, conversational, and answer the actual question. Do not invent horoscope/chart placements. Keep safety-sensitive advice cautious and encourage professional help where appropriate.

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
      if (!answer) throw new Error("AI Friend returned an empty response.");

      const assistantMessage: StoredChatMessage = {
        role: "assistant",
        content: answer,
      };
      const nextMessages = [...userMessages, assistantMessage];
      setMessages(nextMessages);
      try {
        saveAIFriendChat(profile, nextMessages);
      } catch (error) {
        console.error("Could not save this profile's AI Friend chat:", error);
        setChatError(
          language === "hi"
            ? "Jawab aa gaya, lekin chat is browser mein save nahi ho saki."
            : "The reply arrived, but this chat could not be saved in this browser.",
        );
      }

      if (speakReplies && voiceSample) {
        setGeneratingSpeech(true);
        try {
          const audio = await synthesizeWithSavedVoice(
            voiceSample,
            answer,
            language,
          );
          setAudioUrl(URL.createObjectURL(audio));
        } catch (error) {
          console.error("Chatterbox speech generation failed:", error);
          setChatError(
            error instanceof Error
              ? error.message
              : "Could not generate speech with the saved voice sample.",
          );
        } finally {
          setGeneratingSpeech(false);
        }
      }
    } catch (error) {
      console.error("AI Friend chat request failed:", error);
      setChatError(
        isQuotaOrRateLimitError(error)
          ? QUOTA_ERROR_MESSAGE_HI
          : error instanceof Error
            ? error.message
            : language === "hi"
              ? "AI Friend se jawab nahi mila. Dobara koshish karein."
              : "AI Friend could not reply. Please try again.",
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const startListening = () => {
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setChatError(
        language === "hi"
          ? "Is browser mein speech recognition support nahi hai. Chrome ya Edge try karein."
          : "Speech recognition is not supported by this browser. Try Chrome or Edge.",
      );
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = language === "hi" ? "hi-IN" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      setListening(false);
      if (transcript) void sendMessage(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      console.error("Browser speech recognition failed:", event);
      setChatError(
        language === "hi"
          ? "Mic input nahi mil saka. Microphone permission check karke dobara try karein."
          : "Could not capture microphone input. Check microphone permission and try again.",
      );
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setChatError("");
    setListening(true);
    try {
      recognition.start();
    } catch (error) {
      setListening(false);
      console.error("Could not start browser speech recognition:", error);
      setChatError(
        language === "hi"
          ? "Microphone shuru nahi ho saka. Dobara koshish karein."
          : "Could not start the microphone. Please try again.",
      );
    }
  };

  const clearChat = () => {
    if (!profile) return;
    try {
      saveAIFriendChat(profile, []);
      setMessages([]);
      setChatError("");
      setAudioUrl("");
    } catch (error) {
      console.error("Could not clear this profile's AI Friend chat:", error);
      setChatError("Could not clear this chat from local browser storage.");
    }
  };

  const submitChat = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    startListening();
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#d8b36a]/20 bg-[#09182a]/85 shadow-2xl shadow-black/30 ">
      <section className="flex w-full flex-col items-center justify-center border-b border-[#d8b36a]/15 bg-[radial-gradient(ellipse_at_50%_38%,rgba(69,119,146,0.22),transparent_60%)] p-6 sm:p-10 lg:w-[42%] lg:border-b-0 lg:border-r">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#d8b36a]">
          {language === "hi"
            ? "आपका personal companion"
            : "Your personal companion"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-[#f5efe6]">
          AI Friend
        </h1>
        <div className="mt-5 w-full max-w-[260px] rounded-full bg-[#36728c]/10">
          <FriendAvatar />
        </div>
        <p className="mt-3 font-display text-xl font-semibold text-[#f5efe6]">
          {profile?.name ??
            (language === "hi" ? "User चुनें" : "Select a user")}
        </p>
        <p className="mt-1 text-center text-sm text-[#afbdd7]">
          {language === "hi"
            ? "अपनी पसंद की भाषा और कुंडली profile चुनें।"
            : "Choose a language and a saved Kundli profile."}
        </p>
      </section>

      <section className="flex min-w-0 flex-1 flex-col justify-center p-5 sm:p-8 lg:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#d8b36a]">
              {language === "hi" ? "Profile सेटिंग्स" : "Profile settings"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-[#f5efe6]">
              {language === "hi" ? "AI Friend सेटअप" : "AI Friend setup"}
            </h2>
          </div>
          <div
            className="flex shrink-0 rounded-lg border border-[#d8b36a]/20 bg-[#111d31] p-1"
            aria-label="Language"
          >
            <button
              type="button"
              onClick={() => setLanguage("en")}
              aria-pressed={language === "en"}
              className={`rounded-md px-3 py-2 text-xs transition ${
                language === "en"
                  ? "bg-[#d8b36a] font-semibold text-[#0b1324]"
                  : "text-[#afbdd7] hover:text-[#f5efe6]"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage("hi")}
              aria-pressed={language === "hi"}
              className={`rounded-md px-3 py-2 text-xs transition ${
                language === "hi"
                  ? "bg-[#d8b36a] font-semibold text-[#0b1324]"
                  : "text-[#afbdd7] hover:text-[#f5efe6]"
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#d8b36a]/15 bg-[#111d31]/70 p-5 sm:p-6">
          <label
            htmlFor="ai-friend-profile"
            className="mb-2 block text-sm font-medium text-[#f4d7a7]"
          >
            {language === "hi" ? "User चुनें" : "Select user"}
          </label>
          {profiles.length > 0 ? (
            <select
              id="ai-friend-profile"
              value={profile ? getKundaliProfileId(profile) : ""}
              onChange={(event) => selectProfile(event.target.value)}
              disabled={sendingMessage || generatingSpeech}
              className="w-full rounded-lg border border-[#d8b36a]/25 bg-[#0a1529] px-4 py-3 text-sm text-[#f5e6d3] outline-none focus:border-[#d8b36a]/70"
            >
              {profiles.map((item) => (
                <option
                  key={getKundaliProfileId(item)}
                  value={getKundaliProfileId(item)}
                >
                  {item.name} · {item.dob}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-lg border border-[#d8b36a]/10 bg-[#0a1529] px-4 py-3 text-sm text-[#afbdd7]">
              {language === "hi"
                ? "अभी कोई saved user नहीं है। पहले user की कुंडली details जोड़ें।"
                : "No saved users yet. Add a user's Kundli details to get started."}
            </p>
          )}

          {profile && (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: language === "hi" ? "नाम" : "Name",
                  value: profile.name,
                },
                {
                  label: language === "hi" ? "जन्म तिथि" : "Date of birth",
                  value: profile.dob,
                },
                {
                  label: language === "hi" ? "जन्म समय" : "Time of birth",
                  value: profile.bot,
                },
                {
                  label: language === "hi" ? "जन्म स्थान" : "Place of birth",
                  value: profile.bop,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#d8b36a]/10 bg-[#0a1529]/70 p-3"
                >
                  <dt className="text-[10px] uppercase tracking-wide text-[#8ea1c2]">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-[#f5e6d3]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <button
            type="button"
            onClick={addUser}
            className="mt-5 w-full rounded-lg bg-[#d8b36a] px-4 py-3 text-sm font-semibold text-[#0b1324] transition hover:bg-[#c99a58]"
          >
            {language === "hi" ? "+ नया user जोड़ें" : "+ Add new user"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-[#8ea1c2]">
            {language === "hi"
              ? "नया user जोड़ने पर Kundali page खुलेगा। Details भरकर Continue दबाएँ; profile इस browser में save हो जाएगी।"
              : "Add new user opens the Kundali page. Fill in their details and continue to save the profile in this browser."}
          </p>
        </div>

        {profile && (
          <section className="mt-5 rounded-2xl border border-[#d8b36a]/15 bg-[#111d31]/70 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#d8b36a]">
                  AI Friend
                </p>
                <h3 className="mt-1 font-display text-xl font-semibold text-[#f5efe6]">
                  {language === "hi"
                    ? "Baat shuru karein"
                    : "Start a conversation"}
                </h3>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="rounded-lg border border-[#d8b36a]/20 px-3 py-2 text-xs text-[#afbdd7] transition hover:text-[#f5efe6]"
                >
                  {language === "hi" ? "Chat saaf karein" : "Clear chat"}
                </button>
              )}
            </div>

            <div
              className="mt-4 max-h-[28rem] min-h-48 space-y-3 overflow-y-auto rounded-xl border border-[#d8b36a]/10 bg-[#0a1529]/75 p-3 sm:p-4"
              aria-live="polite"
              aria-label={language === "hi" ? "Chat messages" : "Chat messages"}
            >
              {messages.length === 0 && (
                <p className="py-12 text-center text-sm text-[#8ea1c2]">
                  {language === "hi"
                    ? `${profile.name} ki kundali aur apne sawalon ke baare mein Hindi ya English mein poochhein.`
                    : `Ask ${profile.name}'s AI Friend a question in English or Hindi.`}
                </p>
              )}
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <p
                    className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#d8b36a] text-[#0b1324]"
                        : "rounded-bl-md border border-[#d8b36a]/10 bg-[#111d31] text-[#f5e6d3]"
                    }`}
                  >
                    {message.content}
                  </p>
                </div>
              ))}
              {(sendingMessage || generatingSpeech) && (
                <p className="text-xs text-[#afbdd7]">
                  {sendingMessage
                    ? language === "hi"
                      ? "AI Friend soch raha hai…"
                      : "AI Friend is thinking…"
                    : language === "hi"
                      ? "Saved voice mein jawab bana raha hai…"
                      : "Generating reply in the saved voice…"}
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {audioUrl && (
              <audio
                key={audioUrl}
                controls
                autoPlay
                src={audioUrl}
                className="mt-3 w-full"
              >
                {language === "hi"
                  ? "Aapka browser audio play nahi kar sakta."
                  : "Your browser cannot play this audio."}
              </audio>
            )}

            {chatError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-[#f0958a]/25 bg-[#f0958a]/10 px-3 py-2 text-xs text-[#f0958a]"
              >
                {chatError}
              </p>
            )}

            <form onSubmit={submitChat} className="mt-3 flex items-end gap-2">
              <textarea
                value={messageInput}
                onChange={(event) => setMessageInput(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!sendingMessage && messageInput.trim()) {
                      void sendMessage();
                    }
                  }
                }}
                placeholder={
                  language === "hi"
                    ? "Apna sawal likhein ya mic dabakar bolein…"
                    : "Type a message or tap the mic to speak…"
                }
                rows={2}
                disabled={!profile || sendingMessage}
                className="min-h-12 min-w-0 flex-1 resize-y rounded-xl border border-[#d8b36a]/20 bg-[#0a1529] px-3 py-3 text-sm text-[#f5e6d3] outline-none placeholder:text-[#7183a3] focus:border-[#d8b36a]/60 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={toggleListening}
                disabled={!profile || sendingMessage}
                aria-label={
                  listening
                    ? language === "hi"
                      ? "Microphone band karein"
                      : "Stop microphone"
                    : language === "hi"
                      ? "Bolne ke liye microphone shuru karein"
                      : "Start microphone input"
                }
                aria-pressed={listening}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50 ${
                  listening
                    ? "animate-pulse border-rose-300/60 bg-rose-400/20 text-rose-200"
                    : "border-[#d8b36a]/25 bg-[#0a1529] text-[#f4d7a7] hover:bg-[#d8b36a]/10"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={!profile || !messageInput.trim() || sendingMessage}
                className="h-12 shrink-0 rounded-xl bg-[#d8b36a] px-4 text-sm font-semibold text-[#0b1324] transition hover:bg-[#c99a58] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {language === "hi" ? "Bhejein" : "Send"}
              </button>
            </form>

            <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#afbdd7]">
              <input
                type="checkbox"
                checked={speakReplies}
                onChange={(event) =>
                  setSpeakReplies(event.currentTarget.checked)
                }
                disabled={!voiceSample}
                className="mt-0.5 accent-[#d8b36a]"
              />
              <span>
                {voiceSample
                  ? language === "hi"
                    ? "AI Friend ka jawab saved voice mein bolein"
                    : "Speak AI Friend replies in the saved voice"
                  : language === "hi"
                    ? "Voice reply ke liye pehle neeche sample save karein"
                    : "Save a voice sample below to enable spoken replies"}
              </span>
            </label>
            <p className="mt-2 text-[10px] leading-relaxed text-[#8ea1c2]">
              {language === "hi"
                ? "Mic button dabane par browser speech recognition chalu hoga. Voice reply local Chatterbox server se banega."
                : "Tap the mic to use browser speech recognition. Voice replies are generated by the local Chatterbox service."}
            </p>
          </section>
        )}

        {profile && (
          <section className="mt-5 rounded-2xl border border-[#d8b36a]/15 bg-[#111d31]/70 p-5 sm:p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#d8b36a]">
                Chatterbox Multilingual V3
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold text-[#f5efe6]">
                {language === "hi"
                  ? "इस user ka voice sample"
                  : "This user's voice sample"}
              </h3>
            </div>

            {loadingSample ? (
              <p className="mt-4 text-sm text-[#afbdd7]">
                {language === "hi"
                  ? "Saved sample load ho raha hai…"
                  : "Loading saved sample…"}
              </p>
            ) : voiceSample ? (
              <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                <p className="text-sm font-medium text-emerald-100">
                  {language === "hi"
                    ? "Voice sample saved locally"
                    : "Voice sample saved locally"}
                </p>
                <p className="mt-1 break-all text-xs text-[#afbdd7]">
                  {voiceSample.fileName} · {voiceSample.language.toUpperCase()}
                </p>
                <button
                  type="button"
                  onClick={removeVoiceFromProfile}
                  className="mt-3 rounded-lg border border-[#f0958a]/30 px-3 py-2 text-xs text-[#f5b5aa] transition hover:bg-[#f0958a]/10"
                >
                  {language === "hi"
                    ? "Is profile se voice hatayein"
                    : "Remove voice from this profile"}
                </button>
                <p className="mt-2 text-[10px] leading-relaxed text-[#8ea1c2]">
                  {language === "hi"
                    ? "Yeh audio isi browser ke IndexedDB mein save hai aur local Chatterbox service ise voice reference ke roop mein use karegi."
                    : "This audio is saved in this browser's IndexedDB and the local Chatterbox service uses it as the voice reference."}
                </p>
              </div>
            ) : (
              <form onSubmit={saveSampleForProfile} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="chatterbox-voice-sample"
                    className="mb-1.5 block text-xs font-medium text-[#f4d7a7]"
                  >
                    {language === "hi"
                      ? "Voice sample upload karein (max 16 MB)"
                      : "Upload voice sample (max 16 MB)"}
                  </label>
                  <input
                    id="chatterbox-voice-sample"
                    type="file"
                    accept=".wav,.mp3,.flac,.ogg,.oga,audio/wav,audio/mpeg,audio/flac,audio/ogg"
                    onChange={(event) =>
                      handleSampleChange(event.currentTarget.files?.[0] ?? null)
                    }
                    className="block w-full rounded-lg border border-[#d8b36a]/20 bg-[#0a1529] px-3 py-2 text-xs text-[#f5e6d3] file:mr-3 file:rounded-md file:border-0 file:bg-[#d8b36a] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#0b1324]"
                  />
                  <p className="mt-1 text-[10px] text-[#8ea1c2]">
                    {language === "hi"
                      ? "Ek speaker ki saaf recording, bina music/noise ke; 10–60 seconds recommended."
                      : "A clean recording of one speaker, without music/noise; 10–60 seconds recommended."}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="chatterbox-sample-language"
                    className="mb-1.5 block text-xs font-medium text-[#f4d7a7]"
                  >
                    {language === "hi"
                      ? "Sample kis bhasha mein hai?"
                      : "Language spoken in the sample"}
                  </label>
                  <select
                    id="chatterbox-sample-language"
                    value={sampleLanguage}
                    onChange={(event) =>
                      setSampleLanguage(
                        event.target.value as VoiceSampleLanguage,
                      )
                    }
                    className="w-full rounded-lg border border-[#d8b36a]/20 bg-[#0a1529] px-3 py-2.5 text-sm text-[#f5e6d3] outline-none focus:border-[#d8b36a]/60"
                  >
                    <option value="hi">हिंदी</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[#d6dfeb]">
                  <input
                    type="checkbox"
                    checked={consentConfirmed}
                    onChange={(event) =>
                      setConsentConfirmed(event.currentTarget.checked)
                    }
                    className="mt-0.5 accent-[#d8b36a]"
                  />
                  <span>
                    {language === "hi"
                      ? "Mere paas is speaker ki voice ko use karne ki spasht permission hai. Sample is browser mein local save hoga."
                      : "I have the speaker's explicit permission to use their voice. The sample will be saved locally in this browser."}
                  </span>
                </label>

                {voiceError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-[#f0958a]/25 bg-[#f0958a]/10 px-3 py-2 text-xs text-[#f0958a]"
                  >
                    {voiceError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!sampleFile || !consentConfirmed || savingSample}
                  className="w-full rounded-lg bg-[#d8b36a] px-4 py-3 text-sm font-semibold text-[#0b1324] transition hover:bg-[#c99a58] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingSample
                    ? language === "hi"
                      ? "Sample save ho raha hai…"
                      : "Saving sample…"
                    : language === "hi"
                      ? "Voice sample save karein"
                      : "Save voice sample"}
                </button>
              </form>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-[#8ea1c2]">
              {language === "hi"
                ? "Sample browser ke IndexedDB mein profile-wise save hota hai. Voice replies ke liye local Chatterbox service chalni chahiye. Aapki voice clip us local service ko bheji jaati hai; kisi hosted voice provider ko nahi."
                : "The sample is saved per profile in this browser's IndexedDB. Voice replies require the local Chatterbox service. Your voice clip is sent to that local service, not a hosted voice provider."}
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
