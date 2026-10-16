import InteractiveApp from "../../components/InteractiveApp";
import SeoContent from "../../components/SeoContent";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("milan");

export default function MilanLandingPage() {
  return (
    <>
      <SeoContent page="milan" />
      <InteractiveApp />
    </>
  );
}
