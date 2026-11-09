import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "Muhurat Kundali: Find an auspicious time",
  description: "Pick an activity and a date range to see the best-scored muhurat slots from panchang, lagna and rahukaal rules.",
  robots: { index: false, follow: true },
};

export default function MuhuratRoutePage() {
  return <InteractiveApp />;
}