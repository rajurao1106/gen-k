import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InteractiveDevTools from "../../components/InteractiveDevTools";

export const metadata: Metadata = {
  title: "Developer tools",
  robots: { index: false, follow: false },
};

export default function DevToolsRoute() {
  if (process.env.NODE_ENV === "production") notFound();
  return <InteractiveDevTools />;
}
