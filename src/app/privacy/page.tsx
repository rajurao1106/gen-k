import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Gen-K handles profile, birth, account and voice data.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="Draft policy for [BUSINESS NAME]. Replace all placeholders and review before launch."
      sections={[
        {
          title: "Information we store",
          content: <p>When you create an account, we store the mobile number you provide; it is not verified. If you use Gen-K tools, we store the profile details you submit, including name, date, time and place of birth, optional gender and saved report content. Account data is associated with your account.</p>,
        },
        {
          title: "Birth place and coordinates",
          content: (
            <>
              <p>Your place of birth affects the Lagna (ascendant) and houses of your chart, so we also save the coordinates (latitude, longitude) and time zone of that place with your profile. They come from the place you pick in search or, optionally, from coordinates you enter yourself under "Advanced". We round them to about 1 km before saving.</p>
              <p>Coordinates are used only to calculate your chart. They are not included in the text sent to the AI service, which receives your place name and the calculated chart facts. Our admin tools do not display exact coordinates.</p>
              <p>You can remove the saved coordinates at any time from your profile (your place name stays), or delete the profile or your whole account, which deletes them too.</p>
            </>
          ),
        },
        {
          title: "Voice data and consent",
          content: <p>If you use the optional voice feature, Gen-K stores your reference audio, display label, language and consent confirmation with your account. When you request speech, the reference audio and requested text are sent to Boson AI to generate speech. Voice replies are AI-generated. You can remove a saved voice from your profile settings.</p>,
        },
        {
          title: "Why and with whom data is shared",
          content: <p>We use data to provide account access, astrology reports and requested voice features. Birth details used for AI readings are sent to the configured Gemini service. Voice samples and speech requests are sent to Boson AI when you choose those features. Hosting, database and security providers may process data to operate the service. Do not use these tools for highly sensitive information.</p>,
        },
        {
          title: "Retention and deletion",
          content: <p>You can request deletion of your account and associated profile, guide, report and voice data from your account settings. Payment/order records may be retained in anonymized form for operational records. Contact [EMAIL] for privacy requests.</p>,
        },
        {
          title: "Contact",
          content: <p>[BUSINESS NAME]<br />[ADDRESS]<br />[EMAIL]</p>,
        },
      ]}
    />
  );
}