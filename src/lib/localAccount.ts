const ACCOUNTS_KEY = "genk_local_accounts";
const ACTIVE_PHONE_KEY = "genk_active_phone";
const DATA_PREFIX = "genk_local_data:";
const ADMIN_SESSION_KEY = "genk_admin_session";

type LocalAccount = { phone: string; createdAt: string };
type LocalData = Record<string, string>;

function readAccounts(): LocalAccount[] {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (account) =>
        account &&
        typeof account.phone === "string" &&
        typeof account.createdAt === "string",
    )
  ) {
    throw new Error("Saved local accounts have an invalid format.");
  }
  return parsed;
}

function dataKey(phone: string) {
  return DATA_PREFIX + phone;
}

function isAccountKey(key: string) {
  return (
    key === ACCOUNTS_KEY ||
    key === ACTIVE_PHONE_KEY ||
    key === ADMIN_SESSION_KEY ||
    key.startsWith(DATA_PREFIX)
  );
}

function captureAppData(): LocalData {
  const data: LocalData = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && !isAccountKey(key)) {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  }
  return data;
}

function clearAppData() {
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key && !isAccountKey(key)) localStorage.removeItem(key);
  }
}

function restoreAppData(data: LocalData) {
  for (const [key, value] of Object.entries(data)) {
    if (!isAccountKey(key)) localStorage.setItem(key, value);
  }
}

function readAccountData(phone: string): LocalData | null {
  const raw = localStorage.getItem(dataKey(phone));
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Saved account data has an invalid format.");
  }
  return parsed as LocalData;
}

export function normalizePhoneNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function getActivePhoneNumber(): string | null {
  return localStorage.getItem(ACTIVE_PHONE_KEY);
}

export function loginLocalAccount(value: string): string {
  const phone = normalizePhoneNumber(value);
  if (!phone) throw new Error("10 se 15 digits ka valid mobile number daalein.");

  const original = captureAppData();
  const previousPhone = getActivePhoneNumber();
  const accounts = readAccounts();
  const firstAccount = accounts.length === 0;

  try {
    if (previousPhone === phone) return phone;
    if (previousPhone) {
      localStorage.setItem(dataKey(previousPhone), JSON.stringify(original));
    }

    const savedData = readAccountData(phone);
    const initialData = savedData ?? (firstAccount ? original : {});
    clearAppData();
    restoreAppData(initialData);

    if (!accounts.some((account) => account.phone === phone)) {
      accounts.push({ phone, createdAt: new Date().toISOString() });
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
    localStorage.setItem(ACTIVE_PHONE_KEY, phone);
    return phone;
  } catch (error) {
    clearAppData();
    restoreAppData(original);
    if (previousPhone) localStorage.setItem(ACTIVE_PHONE_KEY, previousPhone);
    else localStorage.removeItem(ACTIVE_PHONE_KEY);
    throw error;
  }
}

export function logoutLocalAccount() {
  const phone = getActivePhoneNumber();
  if (!phone) return;
  localStorage.setItem(dataKey(phone), JSON.stringify(captureAppData()));
  clearAppData();
  localStorage.removeItem(ACTIVE_PHONE_KEY);
}
