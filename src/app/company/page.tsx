import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "Company / Griha Kundali",
  description: "Get a soft jyotish signal for a company or a home from the chart of its registration or construction-start moment.",
  robots: { index: false, follow: true },
};

export default function CompanyRoutePage() {
  return <InteractiveApp />;
}