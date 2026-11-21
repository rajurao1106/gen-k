"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, fetchCurrentUser, logoutCurrentUser, type AuthUser } from "./api";
import { AuthContext, type AuthStatus } from "./auth-context";
import { signOutFirebase } from "./firebase";
import { KUNDALI_LOCAL_CHAT_KEY } from "./storage";

function clearUserLocalData() {
  const language = localStorage.getItem("ai_friend_language");
  const kundaliChats = localStorage.getItem(KUNDALI_LOCAL_CHAT_KEY);
  localStorage.clear();
  sessionStorage.clear();
  if (language) localStorage.setItem("ai_friend_language", language);
  if (kundaliChats) localStorage.setItem(KUNDALI_LOCAL_CHAT_KEY, kundaliChats);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      setStatus("authenticated");
      setError("");
      return currentUser;
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setUser(null);
        setStatus("unauthenticated");
        setError("");
        return null;
      }
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "Could not verify your session.");
      return null;
    }
  }, []);

  useEffect(() => {
    // The async session refresh synchronizes auth state with the server.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
  }, [refresh]);

  const acceptLogin = useCallback((authenticatedUser: AuthUser) => {
    clearUserLocalData();
    setUser(authenticatedUser);
    setStatus("authenticated");
    setError("");
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOutFirebase();
      await logoutCurrentUser();
    } finally {
      clearUserLocalData();
      setUser(null);
      setStatus("unauthenticated");
      setError("");
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, error, refresh, acceptLogin, logout }),
    [user, status, error, refresh, acceptLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}