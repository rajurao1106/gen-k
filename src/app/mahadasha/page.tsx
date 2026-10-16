import InteractiveApp from "../../components/InteractiveApp";
import SeoContent from "../../components/SeoContent";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("mahadasha");

export default function MahadashaLandingPage() {
  return (
    <>
      <SeoContent page="mahadasha" />
      <InteractiveApp />
    </>
  );
}
