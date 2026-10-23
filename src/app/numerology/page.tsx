import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";
import SeoContent from "../../components/SeoContent";

export const metadata = getPageMetadata("numerology");

export default function NumerologyLandingPage() {
  return <><InteractiveApp /><SeoContent page="numerology" /></>;
}
