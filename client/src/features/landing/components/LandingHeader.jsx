import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Shield, AlertTriangle } from "lucide-react";
import logoImg from "../../../assets/images/logo.png";
import { PATHS } from "../../../router/paths";

export default function LandingHeader({ onReportClick }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { label: "Home", href: "#top" },
    { label: "About", href: "#about" },
    { label: "Report", href: "#map-section", onClick: onReportClick },
    { label: "Services", href: "#services" },
    { label: "Accomplishments", href: "#accomplishments" },
  ];

  const handleNavClick = (e, link) => {
    if (link.onClick) {
      link.onClick();
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Name (Responsive for all screens) */}
        <a href="#top" className="flex items-center gap-2 sm:gap-3 transition-opacity hover:opacity-90 min-w-0 mr-2">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-900/10">
            <img src={logoImg} alt="GeoFix 167 Logo" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight text-[#2E8B57] truncate">
                GeoFix 167
              </span>
              <span className="hidden xs:inline rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-emerald-800 shrink-0">
                CAPSTONE
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-slate-500 uppercase truncate">
              Barangay 167<span className="hidden sm:inline"> · Caloocan City</span>
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link)}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#2E8B57]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop Action Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            to={PATHS.login}
            className="inline-flex h-9.5 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold tracking-wide text-slate-700 transition hover:border-[#2E8B57] hover:bg-emerald-50/50 hover:text-[#2E8B57]"
          >
            LOGIN
          </Link>

          <button
            type="button"
            onClick={onReportClick}
            className="group relative inline-flex h-9.5 items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-[#ea580c] to-[#dc2626] px-4.5 text-xs font-bold tracking-wide text-white shadow-md shadow-orange-500/25 transition-all hover:from-[#c2410c] hover:to-[#b91c1c] hover:shadow-orange-600/30 active:scale-[0.98]"
          >
            <AlertTriangle size={15} className="transition-transform group-hover:scale-110" />
            REPORT INCIDENT NOW
          </button>
        </div>

        {/* Mobile & Tablet Direct Actions (NEVER hidden behind hamburger menu!) */}
        <div className="flex items-center gap-2 md:hidden">
          
          {/* Direct Emergency Button on Phone / Tablet */}
          <button
            type="button"
            onClick={onReportClick}
            aria-label="Report emergency incident immediately"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ea580c] to-[#dc2626] px-3 sm:px-3.5 text-xs font-bold text-white shadow-md shadow-orange-600/30 active:scale-95 transition-all"
          >
            <AlertTriangle size={14} className="shrink-0 animate-pulse" />
            <span>REPORT</span>
            <span className="hidden sm:inline">INCIDENT</span>
          </button>

          {/* Hamburger Menu Toggle for navigation & login */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 py-4 md:hidden animate-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col gap-2.5">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#2E8B57] transition"
              >
                {link.label}
              </a>
            ))}
            
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Link
                to={PATHS.login}
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                LOGIN
              </Link>
              
              <Link
                to={PATHS.adminLogin}
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-800 text-xs font-bold text-white hover:bg-slate-900"
              >
                <Shield size={15} />
                BDRRMO & OFFICIALS DASHBOARD
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
