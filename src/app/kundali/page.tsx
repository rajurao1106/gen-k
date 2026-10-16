import InteractiveApp from "../../components/InteractiveApp";
import SeoContent from "../../components/SeoContent";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("kundali");

export default function KundaliLandingPage() {
  return (
    <>
      <SeoContent page="kundali" />
      <InteractiveApp />
    </>
  );
}
