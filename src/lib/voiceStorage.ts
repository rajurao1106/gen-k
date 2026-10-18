// Voice cloning via the app's own backend (/api/voice/*), which talks to a
// hosted voice-cloning service. Works on a live site for every visitor — no
// local Python/Chatterbox service needed. Only the returned voice id is stored
// in this browser (per profile); the audio sample itself is not kept.

export type VoiceSampleLanguage = "en" | "hi";

export type SavedVoiceSample = {
  profileId: string;
  voiceId: string;
  fileName: string;
  language: VoiceSampleLanguage;
  savedAt: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");
const STORAGE_PREFIX = "gen-k-ai-friend-voice:";

async function errorMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export async function getVoiceSample(profileId: string): Promise<SavedVoiceSample | null> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + profileId);
    if (!raw) return null;
    const sample = JSON.parse(raw) as SavedVoiceSample;
    return sample?.voiceId ? sample : null;
  } catch {
    return null;
  }
}

export async function saveVoiceSample(
  profileId: string,
  file: File,
  language: VoiceSampleLanguage,
): Promise<SavedVoiceSample> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/voice/clone?label=${encodeURIComponent(profileId.slice(0, 20))}`,
      {
        method: "POST",
        headers: { "Content-Type": file.type || "audio/mpeg" },
        body: file,
      },
    );
  } catch (error) {
    console.error("Could not reach the voice service:", error);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Could not create a voice from this sample."));
  }

  const { voiceId } = (await response.json()) as { voiceId: string };
  const sample: SavedVoiceSample = {
    profileId,
    voiceId,
    fileName: file.name,
    language,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_PREFIX + profileId, JSON.stringify(sample));
  return sample;
}

export async function deleteVoiceSample(profileId: string): Promise<void> {
  const sample = await getVoiceSample(profileId);
  localStorage.removeItem(STORAGE_PREFIX + profileId);
  if (!sample) return;
  // Best effort: free the cloned voice on the server too.
  try {
    await fetch(`${API_BASE_URL}/api/voice/${encodeURIComponent(sample.voiceId)}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Could not remove the voice on the server:", error);
  }
}

export async function synthesizeWithSavedVoice(
  sample: SavedVoiceSample,
  text: string,
  // Language is auto-detected by the multilingual model; kept for call-site compatibility.
  _language: VoiceSampleLanguage,
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/voice/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: sample.voiceId, text }),
    });
  } catch (error) {
    console.error("Could not reach the voice service:", error);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new Error(await errorMessage(response, "Voice is unavailable right now."));
  }
  return response.blob();
}