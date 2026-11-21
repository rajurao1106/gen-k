import type { ChartData, KundaliProfile, KundaliRecord } from "../types";

const KUNDALI_STORAGE_KEY = "kundali";
const KUNDALI_PROFILE_KEY = "kundali_user_profile";
const KUNDALI_PROFILES_KEY = "kundali_user_profiles";
const AI_FRIEND_CHAT_KEY = "ai_friend_chat";
export const KUNDALI_LOCAL_CHAT_KEY = "kundali_local_chat_history_v1";

export type StoredChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StoredKundaliChat = {
  profile: KundaliProfile;
  messages: StoredChatMessage[];
  chart: ChartData | null;
  language: "en" | "hi";
  simpleLanguage?: boolean;
  updatedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKundaliProfile(value: unknown): value is KundaliProfile {
  return (
    isObject(value) &&
    typeof value.name === "string" &&
    typeof value.dob === "string" &&
    typeof value.bot === "string" &&
    typeof value.bop === "string" &&
    typeof value.gender === "string"
  );
}

function isChartData(value: unknown): value is ChartData {
  return (
    isObject(value) &&
    isObject(value.houses) &&
    Object.values(value.houses).every(
      (house) =>
        Array.isArray(house) &&
        house.every((occupant) => typeof occupant === "string"),
    )
  );
}

function isStoredKundaliChat(value: unknown): value is StoredKundaliChat {
  return (
    isObject(value) &&
    isKundaliProfile(value.profile) &&
    Array.isArray(value.messages) &&
    value.messages.every(
      (message) =>
        isObject(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    ) &&
    (value.chart === null || isChartData(value.chart)) &&
    (value.language === "en" || value.language === "hi") &&
    (value.simpleLanguage === undefined ||
      typeof value.simpleLanguage === "boolean") &&
    typeof value.updatedAt === "string"
  );
}

function readLocalKundaliChatStore(): Record<string, StoredKundaliChat[]> {
  const raw = localStorage.getItem(KUNDALI_LOCAL_CHAT_KEY);
  if (!raw) return {};

  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed)) {
    throw new Error("Saved Kundali chat history has an invalid format.");
  }

  const store: Record<string, StoredKundaliChat[]> = {};
  for (const [accountId, chats] of Object.entries(parsed)) {
    if (!Array.isArray(chats) || !chats.every(isStoredKundaliChat)) {
      throw new Error("Saved Kundali chat history has an invalid format.");
    }
    store[accountId] = chats;
  }
  return store;
}

function profileId(profile: KundaliProfile) {
  return [
    profile.name.trim().toLowerCase(),
    profile.dob,
    profile.bot,
    profile.bop.trim().toLowerCase(),
  ].join("|");
}

export function getUserKundaliProfiles(): KundaliProfile[] {
  const profiles = new Map<string, KundaliProfile>();
  const storedProfiles = sessionStorage.getItem(KUNDALI_PROFILES_KEY);

  if (storedProfiles) {
    const parsed: unknown = JSON.parse(storedProfiles);
    if (Array.isArray(parsed)) {
      parsed.forEach((profile) => {
        if (
          profile &&
          typeof profile.name === "string" &&
          typeof profile.dob === "string" &&
          typeof profile.bot === "string" &&
          typeof profile.bop === "string" &&
          profile.name &&
          profile.dob &&
          profile.bot &&
          profile.bop
        ) {
          const validProfile: KundaliProfile = {
            name: profile.name,
            dob: profile.dob,
            bot: profile.bot,
            bop: profile.bop,
            gender: typeof profile.gender === "string" ? profile.gender : "",
            recordId: typeof profile.recordId === "string" ? profile.recordId : undefined,
            avatarSeed: typeof profile.avatarSeed === "string" ? profile.avatarSeed : undefined,
          };
          profiles.set(profileId(validProfile), validProfile);
        }
      });
    }
  }

  const legacyProfile = sessionStorage.getItem(KUNDALI_PROFILE_KEY);
  if (legacyProfile) {
    const parsed: unknown = JSON.parse(legacyProfile);
    if (
      parsed &&
      typeof parsed === "object" &&
      "name" in parsed &&
      "dob" in parsed &&
      "bot" in parsed &&
      "bop" in parsed
    ) {
      const profile = parsed as KundaliProfile;
      if (profile.name && profile.dob && profile.bot && profile.bop) {
        profiles.set(profileId(profile), profile);
      }
    }
  }

  getSavedKundalis().forEach((record) => {
    if (record.name && record.dob && record.bot && record.bop) {
      const profile: KundaliProfile = {
        name: record.name,
        dob: record.dob,
        bot: record.bot,
        bop: record.bop,
        gender: record.gender || "",
      };
      profiles.set(profileId(profile), profile);
    }
  });

  return [...profiles.values()];
}

export function saveUserKundaliProfiles(profiles: KundaliProfile[]) {
  sessionStorage.setItem(KUNDALI_PROFILES_KEY, JSON.stringify(profiles));
}

export function deleteUserKundaliProfile(profile: KundaliProfile) {
  const id = profileId(profile);
  const profiles = getUserKundaliProfiles().filter(
    (savedProfile) => profileId(savedProfile) !== id,
  );
  const readings = getSavedKundalis().filter(
    (record) => profileId({ ...record, gender: record.gender || "" }) !== id,
  );
  sessionStorage.setItem(KUNDALI_PROFILES_KEY, JSON.stringify(profiles));
  sessionStorage.setItem(KUNDALI_STORAGE_KEY, JSON.stringify(readings));

  const currentProfile = sessionStorage.getItem(KUNDALI_PROFILE_KEY);
  if (currentProfile && profileId(JSON.parse(currentProfile) as KundaliProfile) === id) {
    sessionStorage.removeItem(KUNDALI_PROFILE_KEY);
  }

  return profiles;
}

export function getKundaliProfileId(profile: KundaliProfile) {
  return profileId(profile);
}

export function getSavedKundaliChats(accountId: string): StoredKundaliChat[] {
  return readLocalKundaliChatStore()[accountId] ?? [];
}

export function getSavedKundaliChat(
  accountId: string,
  profile: KundaliProfile,
): StoredKundaliChat | null {
  const id = profileId(profile);
  return (
    getSavedKundaliChats(accountId).find(
      (chat) => profileId(chat.profile) === id,
    ) ?? null
  );
}

export function saveKundaliChat(
  accountId: string,
  chat: StoredKundaliChat,
) {
  const store = readLocalKundaliChatStore();
  const id = profileId(chat.profile);
  const chats = store[accountId] ?? [];
  store[accountId] = [
    ...chats.filter((savedChat) => profileId(savedChat.profile) !== id),
    chat,
  ];
  localStorage.setItem(KUNDALI_LOCAL_CHAT_KEY, JSON.stringify(store));
}

export function deleteSavedKundaliChat(
  accountId: string,
  profile: KundaliProfile,
) {
  const store = readLocalKundaliChatStore();
  const id = profileId(profile);
  store[accountId] = (store[accountId] ?? []).filter(
    (chat) => profileId(chat.profile) !== id,
  );
  if (store[accountId].length === 0) delete store[accountId];

  if (Object.keys(store).length === 0) {
    localStorage.removeItem(KUNDALI_LOCAL_CHAT_KEY);
  } else {
    localStorage.setItem(KUNDALI_LOCAL_CHAT_KEY, JSON.stringify(store));
  }
}

function getChatStorageKey(profile: KundaliProfile) {
  const profileKey = profileId(profile);
  return `${AI_FRIEND_CHAT_KEY}:${encodeURIComponent(profileKey)}`;
}

export function getSavedAIFriendChat(
  profile: KundaliProfile,
): StoredChatMessage[] {
  const raw = sessionStorage.getItem(getChatStorageKey(profile));
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
  ) {
    throw new Error("Saved AI Friend chat has an invalid format.");
  }
  return parsed as StoredChatMessage[];
}

export function saveAIFriendChat(
  profile: KundaliProfile,
  messages: StoredChatMessage[],
) {
  sessionStorage.setItem(getChatStorageKey(profile), JSON.stringify(messages));
}

export function getUserKundaliProfile(): KundaliProfile | null {
  const storedProfile = sessionStorage.getItem(KUNDALI_PROFILE_KEY);
  if (storedProfile) {
    const profile = JSON.parse(storedProfile) as KundaliProfile;
    if (profile.name && profile.dob && profile.bot && profile.bop) {
      return profile;
    }
  }

  const legacyRecord = getSavedKundalis().at(-1);
  if (legacyRecord?.name && legacyRecord.dob && legacyRecord.bot && legacyRecord.bop) {
    const { name, dob, bot, bop, gender } = legacyRecord;
    return { name, dob, bot, bop, gender, recordId: legacyRecord._id };
  }
  return null;
}

export function saveUserKundaliProfile(profile: KundaliProfile) {
  sessionStorage.setItem(KUNDALI_PROFILE_KEY, JSON.stringify(profile));
  const profiles = getUserKundaliProfiles();
  const nextProfiles = profiles.filter(
    (existing) => profileId(existing) !== profileId(profile),
  );
  nextProfiles.push(profile);
  saveUserKundaliProfiles(nextProfiles);
}

export function getSavedKundalis(): KundaliRecord[] {
  const raw = sessionStorage.getItem(KUNDALI_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveKundaliRecord(record: KundaliRecord): KundaliRecord[] {
  const updated = [...getSavedKundalis(), record];
  sessionStorage.setItem(KUNDALI_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteKundaliRecord(index: number): KundaliRecord[] {
  const updated = getSavedKundalis().filter((_, i) => i !== index);
  sessionStorage.setItem(KUNDALI_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
