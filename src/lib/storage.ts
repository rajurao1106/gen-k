import type { KundaliRecord } from "../types";

const KUNDALI_STORAGE_KEY = "kundali";

export function getSavedKundalis(): KundaliRecord[] {
  const raw = localStorage.getItem(KUNDALI_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveKundaliRecord(record: KundaliRecord): KundaliRecord[] {
  const updated = [...getSavedKundalis(), record];
  localStorage.setItem(KUNDALI_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteKundaliRecord(index: number): KundaliRecord[] {
  const updated = getSavedKundalis().filter((_, i) => i !== index);
  localStorage.setItem(KUNDALI_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
