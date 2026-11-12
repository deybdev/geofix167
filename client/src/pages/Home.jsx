import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MapPinned } from "lucide-react";
import LandingHeader from "../features/landing/components/LandingHeader";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";
import GetInvolvedSection from "../features/landing/components/GetInvolvedSection";
import LandingFooter from "../features/landing/components/LandingFooter";
import QuickReportModal from "../features/landing/components/QuickReportModal";
import { PATHS } from "../router/paths";

export default function HomePage() {
  const navigate = useNavigate();
  const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);
  return <div className="min-h-screen bg-slate-50 font-sans text-slate-900"><LandingHeader onReportClick={() => setIsQuickReportOpen(true)} /><BarangayStatusBanner />
    <main>
      <section className="relative isolate overflow-hidden bg-[#0d2d20] px-5 py-20 text-white sm:px-10 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_20%,rgba(46,139,87,.5),transparent_45%)]" />
        <div className="mx-auto max-w-6xl"><p className="text-xs font-bold uppercase tracking-[.24em] text-emerald-300">Barangay 167 · Caloocan City</p><h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">A better way to care for our community.</h1><p className="mt-5 max-w-2xl text-base leading-relaxed text-emerald-50/80 sm:text-lg">GeoFix 167 connects residents and barangay responders through clear reporting, coordinated services, and visible community progress.</p><div className="mt-8 flex flex-wrap gap-3"><Link to={PATHS.publicMap} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-900 shadow-lg transition hover:-translate-y-0.5">Explore live map <MapPinned size={17} /></Link><Link to={PATHS.about} className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">Discover GeoFix <ArrowRight size={17} /></Link></div></div>
      </section>
      <GetInvolvedSection onQuickReportClick={() => setIsQuickReportOpen(true)} onAccomplishmentClick={() => navigate(PATHS.accomplishments)} />
    </main><LandingFooter /><QuickReportModal isOpen={isQuickReportOpen} onClose={() => setIsQuickReportOpen(false)} defaultCoordinates={null} />
  </div>;
}
