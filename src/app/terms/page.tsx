import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Draft terms for using Gen-K astrology and AI features.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      description="Draft terms for [BUSINESS NAME]. Have the final terms reviewed before launch."
      sections={[
        { title: "Using Gen-K", content: <p>Use the service lawfully and only with information you are entitled to provide. Keep your account credentials secure. You are responsible for obtaining permission before submitting another person's voice recording.</p> },
        { title: "Astrology and AI content", content: <p>Astrology readings, calculations and AI-generated responses are informational and for reflection or entertainment. They are not guaranteed predictions or professional advice.</p> },
        { title: "Plans and demo mode", content: <p>During development, checkout is simulated and no real money is charged. Demo plans and access may be reset. Any future commercial terms and payment conditions must be published before a live payment service is enabled.</p> },
        { title: "Availability and changes", content: <p>Features may change or be temporarily unavailable while the service is developed. We may suspend access to protect the service or comply with applicable law.</p> },
        { title: "Contact", content: <p>[BUSINESS NAME]<br />[ADDRESS]<br />[EMAIL]</p> },
      ]}
    />
  );
}
