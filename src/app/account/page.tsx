import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <InteractiveApp />;
}