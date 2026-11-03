import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

// Private professional tool: keep it out of search engines.
export const metadata: Metadata = {
  title: "Psychologist Client Insight",
  robots: { index: false, follow: false },
};

export default function PsychologistInsightRoutePage() {
  return <InteractiveApp />;
}