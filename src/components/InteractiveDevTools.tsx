"use client";

import { AuthProvider } from "../lib/AuthContext";
import DevToolsPage from "../features/DevToolsPage";

export default function InteractiveDevTools() {
  return (
    <AuthProvider>
      <DevToolsPage />
    </AuthProvider>
  );
}
