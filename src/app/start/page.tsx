import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "Get started",
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return <InteractiveApp />;
}