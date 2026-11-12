import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Shield,
  AlertTriangle,
  House,
  Info,
  MapPin,
  Wrench,
  CheckCircle2,
  LogIn,
  ChevronRight,
  Phone,
  Radio,
} from "lucide-react";
import logoImg from "../../../assets/images/logo.png";
import { PATHS } from "../../../router/paths";

export default function LandingHeader({ onReportClick }) {
  const navigate = useNavigate();
  const reportAction = onReportClick ?? (() => navigate(PATHS.publicMap));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Prevent body scroll when mobile menu drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: "Home", href: PATHS.home, icon: House },
    { label: "About Us", href: PATHS.about, icon: Info },
    { label: "Live Map & Reports", href: PATHS.publicMap, icon: MapPin },
    { label: "Barangay Services", href: PATHS.services, icon: Wrench },
    { label: "Accomplishments", href: PATHS.accomplishments, icon: CheckCircle2 },
  ];

  const handleNavClick = (e, link) => {
    if (link.onClick) {
      link.onClick();
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-[#fdfefd]/95 shadow-[0_8px_30px_rgba(15,64,42,0.08)] backdrop-blur-xl transition-all">
        <div className="flex h-[76px] sm:h-[88px] w-full items-center justify-between px-4 sm:px-8 lg:px-10 xl:px-12">
          
          {/* Brand Logo & Name (Responsive) */}
          <Link to={PATHS.home} className="flex items-center gap-2 sm:gap-3 transition-opacity hover:opacity-90 min-w-0 mr-2">
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
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.label}
                to={link.href}
                onClick={(e) => handleNavClick(e, link)}
                end={link.href === PATHS.home}
                className={({ isActive }) => `relative py-2 text-[13px] font-bold transition-colors ${isActive ? "text-[#17633f] after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-[#2e8b57]" : "text-slate-600 hover:text-[#2E8B57]"}`}
              >
                {link.label}
              </NavLink>
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
              onClick={reportAction}
              className="group relative inline-flex h-9.5 items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-[#ea580c] to-[#dc2626] px-4.5 text-xs font-bold tracking-wide text-white shadow-md shadow-orange-500/25 transition-all hover:from-[#c2410c] hover:to-[#b91c1c] hover:shadow-orange-600/30 active:scale-[0.98]"
            >
              <AlertTriangle size={15} className="transition-transform group-hover:scale-110" />
              REPORT INCIDENT NOW
            </button>
          </div>

          {/* Mobile & Tablet Direct Actions */}
          <div className="flex items-center gap-2 md:hidden">
            
            {/* Direct Emergency Button on Phone / Tablet */}
            <button
              type="button"
              onClick={reportAction}
              aria-label="Report emergency incident immediately"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ea580c] to-[#dc2626] px-3 sm:px-3.5 text-xs font-bold text-white shadow-md shadow-orange-600/30 active:scale-95 transition-all"
            >
              <AlertTriangle size={14} className="shrink-0 animate-pulse" />
              <span>REPORT</span>
              <span className="hidden sm:inline">INCIDENT</span>
            </button>

            {/* Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 shadow-sm"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

          </div>
        </div>
      </header>

      {/* Modern Off-Canvas Drawer for Mobile/Tablet */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[9990] md:hidden">
          
          {/* Dark Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          />

          {/* Drawer Panel (Slides in from the right) */}
          <div className="fixed inset-y-0 right-0 w-full max-w-xs sm:max-w-sm bg-white shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250">
            
            {/* Drawer Top Header */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-900/10">
                    <img src={logoImg} alt="GeoFix 167" className="h-7 w-7 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#2E8B57] leading-tight">
                      GeoFix 167
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Barangay 167, Caloocan
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status Pill */}
              <div className="mx-4 mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 border border-emerald-100">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600"></span>
                  </span>
                  <span>Barangay 167 Online</span>
                </span>
                <Radio size={13} className="text-emerald-700 animate-pulse" />
              </div>

              {/* Navigation Links with Icons */}
              <nav className="mt-4 px-3 flex flex-col gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.label}
                      to={link.href}
                      onClick={(e) => handleNavClick(e, link)}
                      className="group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#2E8B57] transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#2E8B57] group-hover:text-white transition-colors">
                          <Icon size={14} />
                        </span>
                        <span>{link.label}</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-[#2E8B57] transition-colors" />
                    </NavLink>
                  );
                })}
              </nav>

              {/* Quick Portals & Authentication */}
              <div className="mt-5 px-4 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                  Access Portals
                </p>

                {/* Resident & Responder Login */}
                <Link
                  to={PATHS.login}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-10.5 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-sm hover:border-[#2E8B57] hover:bg-emerald-50/50 hover:text-[#2E8B57] transition active:scale-[0.99]"
                >
                  <LogIn size={15} />
                  <span>Resident & Responder Login</span>
                </Link>

                {/* BDRRMO Portal */}
                <Link
                  to={PATHS.adminLogin}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-10.5 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e3a8a] to-[#0f172a] text-xs font-bold text-white shadow-md hover:opacity-95 transition active:scale-[0.99]"
                >
                  <Shield size={15} />
                  <span>BDRRMO & Officials Portal</span>
                </Link>
              </div>
            </div>

            {/* Drawer Bottom Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between text-[11px] text-slate-600 mb-2">
                <span className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Phone size={13} className="text-[#2E8B57]" />
                  <span>Hotline: 668-338-3141</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400">24/7 Standby</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                <span className="font-medium">SDG 11: Sustainable Communities</span>
                <span className="font-bold text-[#2E8B57]">Capstone</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
