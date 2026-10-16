import InteractiveApp from "../components/InteractiveApp";
import SeoContent from "../components/SeoContent";
import { getPageMetadata } from "../lib/seo";

export const metadata = getPageMetadata("home");

export default function HomePage() {
  return (
    <>
      <SeoContent page="home" />
      <InteractiveApp />
    </>
  );
}
