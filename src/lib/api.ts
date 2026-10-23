const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: T;
  count?: number;
  dayKey?: string;
  cached?: boolean;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  let body: ApiResponse<T> | null = null;
  try {
    body = await response.json() as ApiResponse<T>;
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new ApiError(
      body?.message || `Request failed with status ${response.status}.`,
      response.status,
      body?.code,
    );
  }
  if (!body || body.success === false) {
    throw new ApiError("The server returned an invalid response.", response.status);
  }
  return body;
}

export type AuthUser = {
  id: string;
  phone: string;
  role: "user" | "admin";
  referralCode: string;
  isNewAccount?: boolean;
};

export type SaveUserDetailPayload = {
  fullName: string;
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  gender?: string;
  readingLanguage?: "en" | "hi";
  content?: string;
  chart?: Record<string, unknown> | null;
  relationshipStatus?: string;
  birthTimeUnknown?: boolean;
  birthLatitude?: number | null;
  birthLongitude?: number | null;
  birthTimezone?: string;
  referralCode?: string;
};

export type UserDetailRecord = SaveUserDetailPayload & {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DailyGuideData = {
  belief: string;
  power: string;
  caution: string;
  note?: string;
  luckyNo: number;
  color: string;
  direction?: string;
  energy?: number;
  remedy?: { title: string; steps: string[]; mantra: string };
  full?: boolean;
};

export type Plan = {
  planId: string;
  name: string;
  type: "free" | "one-time" | "subscription" | "add-on";
  amountPaise: number;
  currency: string;
  durationDays: number | null;
  grants: Record<string, string | number | boolean>;
};

export type EntitlementSummary = {
  plan: Plan;
  entitlements: Array<{
    planId: string;
    kind: "subscription" | "report" | "addon";
    startsAt: string;
    expiresAt: string | null;
    remainingUses: number | null;
    status: "active" | "expired" | "revoked";
    sourceOrderId: string | null;
  }>;
  usage: {
    dayKey: string;
    ai_chat: { used: number; limit: number; remaining: number };
    other: Array<{ key: string; count: number }>;
  };
};

export type PaymentHistoryItem = {
  id: string;
  planId: string;
  planName: string;
  amountPaise: number;
  currency: string;
  provider: string;
  status: "created" | "paid" | "failed" | "refunded";
  createdAt: string;
  paidAt: string | null;
};

export type DevUser = { id: string; phone: string; role: "user" | "admin" };
export type DevEntitlement = {
  id: string;
  planId: string;
  kind: "subscription" | "report" | "addon";
  status: "active" | "expired" | "revoked";
  startsAt: string;
  expiresAt: string | null;
  remainingUses: number | null;
};
export type DevOrder = {
  id: string;
  userPhone: string;
  planId: string;
  amountPaise: number;
  currency: string;
  status: string;
  createdAt: string;
};

export async function requestOtp(phone: string) {
  return request<never>("/api/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, code: string) {
  const response = await request<AuthUser>("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
  if (!response.data) throw new ApiError("The server did not return an account.", 500);
  return response.data;
}

export async function fetchCurrentUser() {
  const response = await request<AuthUser>("/api/auth/me");
  if (!response.data) throw new ApiError("The server did not return an account.", 500);
  return response.data;
}

export async function logoutCurrentUser() {
  await request<never>("/api/auth/logout", { method: "POST" });
}

export async function deleteMyAccount() {
  return request<{ deleted: boolean }>("/api/me", { method: "DELETE" });
}

export async function fetchMyProfiles(): Promise<UserDetailRecord[]> {
  const response = await request<UserDetailRecord[]>("/api/users/me/profiles");
  if (!Array.isArray(response.data)) {
    throw new ApiError("The server returned an invalid profile list.", 500);
  }
  return response.data;
}

export async function saveUserDetail(payload: SaveUserDetailPayload) {
  const response = await request<UserDetailRecord>("/api/users/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.data) throw new ApiError("The server did not save the profile.", 500);
  return response.data;
}

export async function updateUserDetail(id: string, payload: SaveUserDetailPayload) {
  const response = await request<UserDetailRecord>(`/api/users/me/profiles/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.data) throw new ApiError("The server did not update the profile.", 500);
  return response.data;
}

export async function fetchAllUserDetails(): Promise<UserDetailRecord[]> {
  const response = await request<UserDetailRecord[]>("/api/users/all");
  if (!Array.isArray(response.data)) {
    throw new ApiError("The server returned an invalid record list.", 500);
  }
  return response.data;
}

export async function deleteUserDetail(id: string) {
  return request<UserDetailRecord>(`/api/users/delete/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function deleteMyProfile(id: string) {
  return request<UserDetailRecord>(`/api/users/me/profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchPlans(): Promise<Plan[]> {
  const response = await request<Plan[]>("/api/plans");
  if (!Array.isArray(response.data)) {
    throw new ApiError("The server returned an invalid plan list.", 500);
  }
  return response.data;
}

export async function fetchMyEntitlements(): Promise<EntitlementSummary> {
  const response = await request<EntitlementSummary>("/api/me/entitlements");
  if (!response.data) {
    throw new ApiError("The server did not return account entitlements.", 500);
  }
  return response.data;
}

export async function fetchTodaysGuide(profileId: string) {
  const response = await request<DailyGuideData>("/api/guide/today", {
    method: "POST",
    body: JSON.stringify({ profileId }),
  });
  if (!response.data || typeof response.dayKey !== "string") {
    throw new ApiError("The server did not return today's guide.", 500);
  }
  return { guide: response.data, dayKey: response.dayKey, cached: response.cached === true };
}

export async function createPaymentOrder(planId: string) {
  const response = await request<{
    orderId: string;
    providerOrderId: string;
    amount: number;
    currency: string;
    mode: "demo" | "razorpay";
    keyId?: string;
  }>("/api/payments/create-order", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
  if (!response.data) throw new ApiError("The server did not create a payment order.", 500);
  return response.data;
}

export async function completeDemoPayment(orderId: string, outcome: "success" | "failure") {
  const response = await request<{
    orderId: string;
    status: "paid" | "failed";
    alreadyPaid?: boolean;
    providerPaymentId?: string;
    signature?: string;
  }>("/api/payments/demo/complete", {
    method: "POST",
    body: JSON.stringify({ orderId, outcome }),
  });
  if (!response.data) throw new ApiError("The server did not complete the demo payment.", 500);
  return response.data;
}

export async function verifyPayment(input: {
  orderId: string;
  providerPaymentId: string;
  signature: string;
}) {
  const response = await request<{
    orderId: string;
    status: "paid";
    alreadyPaid: boolean;
    entitlement: EntitlementSummary["entitlements"][number] | null;
  }>("/api/payments/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.data) throw new ApiError("The server did not verify the payment.", 500);
  return response.data;
}

export async function refundDemoPayment(orderId: string) {
  const response = await request<{ orderId: string; status: "refunded" }>("/api/payments/demo/refund", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
  if (!response.data) throw new ApiError("The server did not refund the demo payment.", 500);
  return response.data;
}

export async function fetchPaymentHistory(): Promise<PaymentHistoryItem[]> {
  const response = await request<PaymentHistoryItem[]>("/api/payments/history");
  if (!Array.isArray(response.data)) {
    throw new ApiError("The server returned an invalid payment history.", 500);
  }
  return response.data;
}

async function devRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await request<T>(`/api/dev${path}`, init);
  if (!response.data) throw new ApiError("The developer tools returned an invalid response.", 500);
  return response.data;
}

export async function fetchDevUsers() {
  return devRequest<DevUser[]>("/users");
}

export async function fetchDevOrders() {
  return devRequest<DevOrder[]>("/orders");
}

export async function fetchDevEntitlements(userId: string) {
  return devRequest<DevEntitlement[]>(`/entitlements?userId=${encodeURIComponent(userId)}`);
}

export async function grantDevPlan(userId: string, planId: string) {
  return devRequest<DevEntitlement>("/entitlements/grant", {
    method: "POST",
    body: JSON.stringify({ userId, planId }),
  });
}

export async function revokeDevEntitlement(entitlementId: string) {
  return devRequest<DevEntitlement>("/entitlements/revoke", {
    method: "POST",
    body: JSON.stringify({ entitlementId }),
  });
}

export async function resetDevUsage(userId: string) {
  return devRequest<{ deletedCounters: number }>("/usage/reset", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function expireDevSubscriptions(userId: string) {
  return devRequest<{ expiredSubscriptions: number }>("/subscriptions/expire", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}
