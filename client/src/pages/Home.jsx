import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MapPinned } from "lucide-react";
import GetInvolvedSection from "../features/landing/components/GetInvolvedSection";
import QuickReportModal from "../features/landing/components/QuickReportModal";
import { PATHS } from "../router/paths";

export default function HomePage() {
  const navigate = useNavigate();
  const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);

  useEffect(() => {
    const openQuickReport = () => setIsQuickReportOpen(true);
    window.addEventListener("geofix:open-report", openQuickReport);
    return () => window.removeEventListener("geofix:open-report", openQuickReport);
  }, []);

  return <div className="landing-page font-sans text-slate-900">
      <section className="landing-hero">
        <div className="site-container landing-hero__inner">
          <div className="landing-hero__copy">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-200">Barangay 167 · Caloocan City</p>
            <h1 className="landing-display mt-5">A better way to care for our <span className="text-emerald-200">community.</span></h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-emerald-50/90 sm:text-lg">GeoFix 167 connects residents and barangay responders through clear reporting, coordinated services, and visible community progress.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={PATHS.publicMap} className="inline-flex items-center gap-2 rounded-lg bg-[#fffefa] px-5 py-3 text-sm font-semibold text-[#174b37] transition-colors hover:bg-[#edf3ec]">Explore live map <MapPinned size={17} /></Link>
              <Link to={PATHS.about} className="inline-flex items-center gap-2 rounded-lg border border-white/35 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10">Discover GeoFix <ArrowRight size={17} /></Link>
            </div>
          </div>
        </div>
      </section>
      <GetInvolvedSection onQuickReportClick={() => setIsQuickReportOpen(true)} onAccomplishmentClick={() => navigate(PATHS.accomplishments)} />
    <QuickReportModal isOpen={isQuickReportOpen} onClose={() => setIsQuickReportOpen(false)} defaultCoordinates={null} />
  </div>;
}
