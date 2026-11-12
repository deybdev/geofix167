import AboutSection from "../features/landing/components/AboutSection";
import LandingFooter from "../features/landing/components/LandingFooter";
import LandingHeader from "../features/landing/components/LandingHeader";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";

export default function AboutPage() {
  return <><LandingHeader /><BarangayStatusBanner /><main className="min-h-[65vh] pt-8"><AboutSection /></main><LandingFooter /></>;
}
