import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = { title: "Mobile login", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <InteractiveApp />;
}
