const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const getSafeErrorMessage = (operation: string, status: number) => {
  if (status >= 500) {
    return "Service temporarily unavailable. Please try again later.";
  }

  return `Unable to ${operation}. Please check your details and try again.`;
};

const parseResponse = async (response: Response, operation: string) => {
  let data: { success?: boolean } | null = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(getSafeErrorMessage(operation, response.status));
  }

  return data;
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
};

export type UserDetailRecord = {
  _id?: string;
  fullName?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: string;
  gender?: string;
  readingLanguage?: string;
  content?: string;
  createdAt?: string;
};

export async function saveUserDetail(payload: SaveUserDetailPayload) {
  const response = await fetch(`${API_BASE_URL}/api/users/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response, "save user details");
}

export async function fetchAllUserDetails(): Promise<UserDetailRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/users/all`);
  const data = (await parseResponse(response, "load saved records")) as {
    data?: UserDetailRecord[];
  } | null;

  return data?.data || [];
}

export async function deleteUserDetail(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/users/delete/${id}`, {
    method: "DELETE",
  });

  return parseResponse(response, "delete user record");
}
