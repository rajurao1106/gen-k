import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Contact Gen-K",
  description: "Contact Gen-K support and privacy inquiries.",
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      description="Support and privacy contact details for [BUSINESS NAME]."
      sections={[
        { title: "Support", content: <p>Email: [EMAIL]<br />Business: [BUSINESS NAME]<br />Postal address: [ADDRESS]</p> },
        { title: "Privacy and account deletion", content: <p>Use the account settings to delete your account and data. For privacy questions or issues with that request, email [EMAIL].</p> },
      ]}
    />
  );
}
