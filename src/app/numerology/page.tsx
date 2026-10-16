import InteractiveApp from "../../components/InteractiveApp";
import SeoContent from "../../components/SeoContent";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("numerology");

export default function NumerologyLandingPage() {
  return (
    <>
      <SeoContent page="numerology" />
      <InteractiveApp />
    </>
  );
}
