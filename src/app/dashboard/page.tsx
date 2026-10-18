import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: true },
};

export default function DashboardPage() {
  return <InteractiveApp />;
}