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
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Name */}
        <a href="#top" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-900/10">
            <img src={logoImg} alt="GeoFix 167 Logo" className="h-10 w-10 object-contain" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight text-[#2E8B57]">
                GeoFix 167
              </span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                CAPSTONE
              </span>
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Barangay 167 · Caloocan City
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

        {/* Right Action Buttons */}
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
            className="group relative inline-flex h-9.5 items-center gap-1.5 overflow-hidden rounded-lg bg-[#ea580c] px-4.5 text-xs font-bold tracking-wide text-white shadow-md shadow-orange-500/25 transition-all hover:bg-[#c2410c] hover:shadow-orange-600/30 active:scale-[0.98]"
          >
            <AlertTriangle size={15} className="transition-transform group-hover:scale-110" />
            REPORT INCIDENT NOW
          </button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#2E8B57]"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Link
                to={PATHS.login}
                className="flex h-10 items-center justify-center rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
              >
                LOGIN
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onReportClick?.();
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ea580c] text-xs font-bold text-white shadow"
              >
                <AlertTriangle size={15} />
                REPORT INCIDENT NOW
              </button>
              <Link
                to={PATHS.adminLogin}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-800 text-xs font-bold text-white"
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

