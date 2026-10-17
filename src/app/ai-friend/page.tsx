import InteractiveApp from "../../components/InteractiveApp";
import { getPageMetadata } from "../../lib/seo";

export const metadata = getPageMetadata("ai-friend");

export default function AiFriendLandingPage() {
  return <InteractiveApp />;
}
