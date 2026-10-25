// Voice identifiers and provider IDs stay on the server; this module only
// loads account-owned profile metadata and sends internal profile IDs.

export type VoiceSampleLanguage = "en" | "hi";
export type VoiceConsentConfirmation = "self" | "has_permission";

export type SavedVoiceSample = {
  id: string;
  label: string;
  language: VoiceSampleLanguage;
  createdAt: string;
};
export type VoiceAudioBlob = Blob & { fallbackMessage?: string };

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");

async function apiError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
    code?: string;
  } | null;
  return Object.assign(new Error(body?.message ?? fallback), {
    code: body?.code,
    status: response.status,
  });
}

export async function getVoiceSamples(): Promise<SavedVoiceSample[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/voice`, { credentials: "include" });
  } catch (error) {
    console.error("Could not reach the voice service:", error);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw await apiError(response, "Could not load your saved voices.");
  const body = (await response.json()) as {
    voices?: SavedVoiceSample[];
  };
  return Array.isArray(body.voices) ? body.voices : [];
}

export async function saveVoiceSample(
  label: string,
  file: File,
  language: VoiceSampleLanguage,
  consentConfirmedBy: VoiceConsentConfirmation,
): Promise<SavedVoiceSample> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const contentTypeByExtension: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    opus: "audio/opus",
    m4a: "audio/mp4",
    "3gp": "audio/3gpp",
    amr: "audio/amr",
  };
  const contentType = contentTypeByExtension[extension || ""] || file.type || "audio/mpeg";
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/voice/clone?label=${encodeURIComponent(label)}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": contentType,
          "X-Voice-Consent": "true",
          "X-Voice-Consent-Confirmed-By": consentConfirmedBy,
          "X-Voice-Language": language,
        },
        body: file,
      },
    );
  } catch (error) {
    console.error("Could not reach the voice service:", error);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw await apiError(response, "Could not create a voice from this sample.");

  const body = (await response.json()) as { voice?: SavedVoiceSample };
  if (!body.voice?.id) throw new Error("The server returned an invalid voice profile.");
  return body.voice;
}

export async function deleteVoiceSample(voiceProfileId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/voice/${encodeURIComponent(voiceProfileId)}`,
      { method: "DELETE", credentials: "include" },
    );
  } catch (error) {
    console.error("Could not reach the voice service:", error);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw await apiError(response, "Could not remove this voice.");
}

export async function synthesizeWithSavedVoice(
  sample: SavedVoiceSample,
  text: string,
  _language: VoiceSampleLanguage,
): Promise<VoiceAudioBlob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/voice/speak`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceProfileId: sample.id, text }),
    });
  } catch (error) {
    console.error("Could not reach the voice service:", error);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw await apiError(response, "Voice is unavailable right now.");
  const audio = await response.blob();
  return Object.assign(audio, {
    fallbackMessage: response.headers.get("X-Voice-Message") || undefined,
  });
}
