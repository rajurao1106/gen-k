import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Astrology and AI Disclaimer",
  description: "Important limitations of Gen-K astrology and AI-generated readings.",
  robots: { index: true, follow: true },
};

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Astrology and AI Disclaimer"
      description="Please read this disclaimer before using Gen-K."
      sections={[
        { title: "Guidance, not professional advice", content: <p>Astrology, numerology, charts and AI replies are for guidance, reflection and entertainment only. They are not medical, legal, financial or mental-health advice and must not replace advice from a qualified professional.</p> },
        { title: "No guaranteed outcomes", content: <p>Calculations and generated interpretations can be incomplete or inaccurate, especially when birth details are approximate or missing. Do not rely on them for important decisions or treat them as guaranteed predictions.</p> },
        { title: "AI-generated voice", content: <p>Voice replies are AI-generated. Use voice recordings only when they are your own or you have clear permission from the person recorded.</p> },
      ]}
    />
  );
}
