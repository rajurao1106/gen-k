const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to save user details");
  }

  return data;
}

export async function fetchAllUserDetails(): Promise<UserDetailRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/users/all`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to fetch user data");
  }

  return data?.data || [];
}

export async function deleteUserDetail(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/users/delete/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to delete user record");
  }

  return data;
}
