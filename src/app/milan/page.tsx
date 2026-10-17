import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("milan");

export default function MilanLandingPage() {
  return <InteractiveApp />;
}
