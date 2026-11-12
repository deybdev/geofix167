import LandingFooter from "../features/landing/components/LandingFooter";
import LandingHeader from "../features/landing/components/LandingHeader";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";
import AccomplishmentsSection from "../features/landing/components/AccomplishmentsSection";

export default function AccomplishmentsPage() {
  return <><LandingHeader /><BarangayStatusBanner /><main className="min-h-[65vh] pt-8"><AccomplishmentsSection /></main><LandingFooter /></>;
}
