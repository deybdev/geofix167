import { Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { PATHS } from "../../../router/paths";

export default function LandingFooter() {
  return (
    <footer className="border-t border-emerald-900/10 bg-white text-slate-600">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Phone size={14} className="text-[#2e8b57]" />
          <span>Barangay 167 Hotline: 668-338-3141</span>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <Link to={PATHS.privacy} className="transition hover:text-[#2e8b57]">Privacy</Link>
          <Link to={PATHS.terms} className="transition hover:text-[#2e8b57]">Terms</Link>
          <Link to={PATHS.adminLogin} className="font-semibold text-[#2e8b57] hover:text-[#17633f]">Admin portal</Link>
        </nav>
        <p className="text-[11px] text-slate-400">© {new Date().getFullYear()} GeoFix 167 · Barangay 167, Caloocan</p>
      </div>
    </footer>
  );
}
