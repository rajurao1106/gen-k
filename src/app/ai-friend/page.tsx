import InteractiveApp from "../../components/InteractiveApp";
import SeoContent from "../../components/SeoContent";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("ai-friend");

export default function AiFriendLandingPage() {
  return (
    <>
      <SeoContent page="ai-friend" />
      <InteractiveApp />
    </>
  );
}
