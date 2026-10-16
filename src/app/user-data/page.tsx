import type { Metadata } from "next";
import InteractiveApp from "../../components/InteractiveApp";

export const metadata: Metadata = {
  title: "User Data",
  robots: { index: false, follow: false },
};

export default function UserDataPage() {
  return <InteractiveApp />;
}
