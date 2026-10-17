import LandingPage from "../components/LandingPage";
import SeoContent from "../components/SeoContent";
import { getPageMetadata } from "../lib/seo";

export const metadata = getPageMetadata("home");

export default function HomePage() {
  return (
    <LandingPage>
      <SeoContent page="home" />
    </LandingPage>
  );
}
