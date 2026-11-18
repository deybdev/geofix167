import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
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
  ChevronDown,
  Phone,
  Radio,
  Megaphone,
} from "lucide-react";
import logoImg from "../../../assets/images/logo.png";
import { PATHS } from "../../../router/paths";

export default function LandingHeader({ onReportClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const reportAction = onReportClick ?? (() => navigate(PATHS.publicMap));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef(null);
  const mobileServicesRef = useRef(null);
  useEffect(() => {
    const outside = (event) => { if (!servicesRef.current?.contains(event.target) && !mobileServicesRef.current?.contains(event.target)) setServicesOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setServicesOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);

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
      <header className="landing-header sticky top-0 z-40 h-[72px] shrink-0 border-b sm:h-[76px]">
        <div className="site-container flex h-full items-center justify-between">
          
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
              link.label === "Barangay Services" ? <div key={link.label} ref={servicesRef} className="relative">
                <button type="button" aria-label="Barangay services and announcements" aria-haspopup="menu" aria-expanded={servicesOpen} onClick={() => setServicesOpen((v) => !v)} className={`relative inline-flex items-center gap-1.5 py-2 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${location.pathname.startsWith(PATHS.services) || location.pathname.startsWith(PATHS.announcements) || servicesOpen ? "text-[#17633f] after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-[#2e8b57]" : "text-slate-600 hover:text-[#2E8B57]"}`}><span>{link.label}</span><ChevronDown size={13} className={`transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`} /></button>
                {servicesOpen && <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10">
                  <Link role="menuitem" to={PATHS.services} onClick={() => setServicesOpen(false)} className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100"><Wrench size={14} /></span><span className="flex-1">Barangay Services</span><ChevronRight size={13} className="text-slate-300 group-hover:text-emerald-700" /></Link>
                  <Link role="menuitem" to={PATHS.announcements} onClick={() => setServicesOpen(false)} className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800 group-hover:bg-amber-100"><Megaphone size={14} /></span><span className="flex-1">Barangay Announcements</span><ChevronRight size={13} className="text-slate-300 group-hover:text-emerald-700" /></Link>
                </div>}
              </div> :
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
              className="inline-flex h-9.5 items-center justify-center rounded-lg border border-[#9fb6a4] bg-transparent px-4 text-xs font-semibold tracking-wide text-[#174b37] transition-colors hover:border-[#174b37] hover:bg-[#edf3ec] active:scale-[0.98]"
            >
              LOGIN
            </Link>

            <button
              type="button"
              onClick={reportAction}
              className="group inline-flex h-9.5 items-center gap-1.5 rounded-lg bg-[#b42318] px-4.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-[#8f1d14] active:scale-[0.98]"
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#b42318] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#8f1d14] active:scale-95 sm:px-3.5"
            >
              <AlertTriangle size={14} className="shrink-0" />
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
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600"></span>
                  </span>
                  <span>Barangay 167 Online</span>
                </span>
                <Radio size={13} className="text-emerald-700" />
              </div>

              {/* Navigation Links with Icons */}
              <nav className="mt-4 px-3 flex flex-col gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  if (link.label === "Barangay Services") return <div key={link.label} ref={mobileServicesRef} className="rounded-xl">
                    <button type="button" onClick={() => setServicesOpen((v) => !v)} aria-haspopup="menu" aria-expanded={servicesOpen} className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-colors ${servicesOpen ? "bg-emerald-50 text-[#2E8B57]" : "text-slate-700 hover:bg-emerald-50 hover:text-[#2E8B57]"}`}><span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-[#2E8B57] group-hover:text-white"><Icon size={14} /></span>{link.label}</span><ChevronDown size={14} className={`text-slate-400 transition-transform group-hover:text-[#2E8B57] ${servicesOpen ? "rotate-180 text-[#2E8B57]" : ""}`} /></button>
                    {servicesOpen && <div role="menu" className="ml-11 mr-2 grid gap-1 border-l-2 border-emerald-100 py-1 pl-3"><Link role="menuitem" to={PATHS.services} onClick={() => { setMobileMenuOpen(false); setServicesOpen(false); }} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50"><Wrench size={13} className="text-sky-800" />Barangay Services</Link><Link role="menuitem" to={PATHS.announcements} onClick={() => { setMobileMenuOpen(false); setServicesOpen(false); }} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50"><Megaphone size={13} className="text-amber-700" />Barangay Announcements</Link></div>}
                  </div>;
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
                  className="flex h-10.5 items-center justify-center gap-2 rounded-lg bg-[#174b37] text-xs font-semibold text-white hover:bg-[#103b2b] transition-colors active:scale-[0.99]"
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
