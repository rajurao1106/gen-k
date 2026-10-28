import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "Explore",
  robots: { index: false, follow: true },
};

export default function ExploreRoutePage() {
  return <InteractiveApp />;
}