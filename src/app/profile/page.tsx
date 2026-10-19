import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };

export default function ProfileRoute() {
  return <InteractiveApp />;
}
