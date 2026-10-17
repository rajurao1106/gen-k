import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("kundali");

export default function KundaliLandingPage() {
  return <InteractiveApp />;
}
