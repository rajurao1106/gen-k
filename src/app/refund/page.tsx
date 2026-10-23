import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Gen-K development-mode refund and demo checkout information.",
  robots: { index: true, follow: true },
};

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund Policy"
      description="Draft policy for [BUSINESS NAME]. Replace placeholders before enabling real payments."
      sections={[
        { title: "Development demo checkout", content: <p>Gen-K is currently configured for demo payments. Demo checkout does not collect money, so there is no charge to refund. A demo refund action only updates test records and entitlements.</p> },
        { title: "Future paid purchases", content: <p>No live payment provider is enabled by this development flow. Before accepting real payments, [BUSINESS NAME] will publish applicable cancellation, refund timelines, eligibility and support steps in this section.</p> },
        { title: "Contact", content: <p>For questions about a demo order, contact [EMAIL].<br />[BUSINESS NAME]<br />[ADDRESS]</p> },
      ]}
    />
  );
}
