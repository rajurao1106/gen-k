import type { KundaliProfile, KundaliRecord } from "../types";

const KUNDALI_STORAGE_KEY = "kundali";
const KUNDALI_PROFILE_KEY = "kundali_user_profile";
const KUNDALI_PROFILES_KEY = "kundali_user_profiles";
const AI_FRIEND_CHAT_KEY = "ai_friend_chat";

export type StoredChatMessage = {
  role: "user" | "assistant";
  content: string;
};

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

export function getKundaliProfileId(profile: KundaliProfile) {
  return profileId(profile);
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
