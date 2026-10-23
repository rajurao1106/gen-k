"use client";

import { createContext } from "react";
import type { AuthUser } from "./api";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";
type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  error: string;
  refresh: () => Promise<AuthUser | null>;
  acceptLogin: (user: AuthUser) => void;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
