import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "Swa-Bodh: Self Discovery from your Kundali",
  description: "Understand your nature, emotions, relationships and purpose through a reflective reading of your Kundali.",
};

export default function SelfDiscoveryRoutePage() {
  return <InteractiveApp />;
}