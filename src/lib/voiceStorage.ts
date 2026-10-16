export type VoiceSampleLanguage = "en" | "hi";

export type SavedVoiceSample = {
  profileId: string;
  file: Blob;
  fileName: string;
  language: VoiceSampleLanguage;
  savedAt: string;
};

const CHATTERBOX_URL =
  process.env.NEXT_PUBLIC_CHATTERBOX_URL || "http://127.0.0.1:8001";
const DATABASE_NAME = "gen-k-ai-friend";
const DATABASE_VERSION = 1;
const STORE_NAME = "voice-samples";

function openVoiceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "profileId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local voice storage."));
  });
}

export async function getVoiceSample(
  profileId: string,
): Promise<SavedVoiceSample | null> {
  const database = await openVoiceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(profileId);
    request.onsuccess = () =>
      resolve((request.result as SavedVoiceSample | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read the saved voice sample."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not read the saved voice sample."));
    };
  });
}

export async function saveVoiceSample(
  profileId: string,
  file: File,
  language: VoiceSampleLanguage,
): Promise<SavedVoiceSample> {
  const database = await openVoiceDatabase();
  const sample: SavedVoiceSample = {
    profileId,
    file,
    fileName: file.name,
    language,
    savedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(sample);
    transaction.oncomplete = () => {
      database.close();
      resolve(sample);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save the voice sample."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save the voice sample."));
    };
  });
}

export async function deleteVoiceSample(profileId: string): Promise<void> {
  const database = await openVoiceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(profileId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not remove the voice sample."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not remove the voice sample."));
    };
  });
}

export async function synthesizeWithSavedVoice(
  sample: SavedVoiceSample,
  text: string,
  language: VoiceSampleLanguage,
): Promise<Blob> {
  const form = new FormData();
  form.append("text", text);
  form.append("language", language);
  form.append("reference_audio", sample.file, sample.fileName);

  let response: Response;
  try {
    response = await fetch(`${CHATTERBOX_URL}/api/tts`, {
      method: "POST",
      body: form,
    });
  } catch (error) {
    console.error("Could not reach the local Chatterbox service:", error);
    throw new Error(
      "Cannot reach local Chatterbox. Start the voice service on this computer, then try again.",
    );
  }
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(
      result?.detail ??
        "Local Chatterbox voice service is unavailable. Start the voice service and try again.",
    );
  }
  return response.blob();
}
