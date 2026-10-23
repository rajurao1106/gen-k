import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";
import SeoContent from "../../components/SeoContent";

export const metadata = getPageMetadata("kundali");

export default function KundaliLandingPage() {
  return <><InteractiveApp /><SeoContent page="kundali" /></>;
}
