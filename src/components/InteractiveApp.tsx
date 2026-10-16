"use client";

import dynamic from "next/dynamic";

const ClientApp = dynamic(() => import("../App"), {
  ssr: false,
  loading: () => (
    <div
      aria-busy="true"
      className="min-h-screen bg-[#071a2a]"
      aria-label="Loading Gen-K"
    />
  ),
});

export default function InteractiveApp() {
  return <ClientApp />;
}
