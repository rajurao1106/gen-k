import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";
import SeoContent from "../../components/SeoContent";

export const metadata = getPageMetadata("milan");

export default function MilanLandingPage() {
  return <><InteractiveApp /><SeoContent page="milan" /></>;
}
