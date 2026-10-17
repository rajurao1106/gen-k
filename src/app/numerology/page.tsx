import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("numerology");

export default function NumerologyLandingPage() {
  return <InteractiveApp />;
}
