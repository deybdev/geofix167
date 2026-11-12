import LandingFooter from "../features/landing/components/LandingFooter";
import LandingHeader from "../features/landing/components/LandingHeader";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";
import ServicesSection from "../features/landing/components/ServicesSection";

export default function ServicesPage() {
  return <><LandingHeader /><BarangayStatusBanner /><main className="min-h-[65vh] pt-8"><ServicesSection /></main><LandingFooter /></>;
}
