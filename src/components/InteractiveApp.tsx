"use client";

import dynamic from "next/dynamic";
import { AuthProvider } from "../lib/AuthContext";
import PageLoader from "./PageLoader";

const ClientApp = dynamic(() => import("../App"), {
  ssr: false,
  loading: () => <PageLoader />,
});

export default function InteractiveApp() {
  return (
    <AuthProvider>
      <ClientApp />
    </AuthProvider>
  );
}
