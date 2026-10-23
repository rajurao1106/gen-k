import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "Plans",
  robots: { index: false, follow: false },
};

export default function PlansRoute() {
  return <InteractiveApp />;
}
