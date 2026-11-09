import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "Prashna Kundali: Ask your question",
  description: "Cast a Prashna chart for the moment you ask a question and get a soft, reasoned jyotish signal.",
  robots: { index: false, follow: true },
};

export default function PrashnaRoutePage() {
  return <InteractiveApp />;
}