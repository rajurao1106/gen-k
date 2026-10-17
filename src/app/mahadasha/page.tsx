import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("mahadasha");

export default function MahadashaLandingPage() {
  return <InteractiveApp />;
}
