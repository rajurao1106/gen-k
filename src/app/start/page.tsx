import type { Metadata } from "next";
import Onboarding from "../../components/Onboarding";

export const metadata: Metadata = {
  title: "Get started",
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return <Onboarding />;
}