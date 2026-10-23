import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";
import SeoContent from "../../components/SeoContent";

export const metadata = getPageMetadata("mahadasha");

export default function MahadashaLandingPage() {
  return <><InteractiveApp /><SeoContent page="mahadasha" /></>;
}
