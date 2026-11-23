import HotlineLink from "../../../shared/components/HotlineLink";
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
  Megaphone,
  Wrench,
  CheckCircle2,
  LogIn,
  ChevronDown,
  ChevronRight,
  Phone,
  Radio,
} from "lucide-react";
import { PATHS } from "../../../router/paths";

export default function LandingHeader({ onReportClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const reportAction = onReportClick ?? (() => navigate(PATHS.publicMap));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesMenuOpen, setServicesMenuOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const servicesDropdownRef = useRef(null);

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

  useEffect(() => {
    if (!servicesMenuOpen) return undefined;
    const handleOutside = (event) => {
      if (!servicesDropdownRef.current?.contains(event.target)) {
        setServicesMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setServicesMenuOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [servicesMenuOpen]);

  const servicesSubLinks = [
    {
      label: "Barangay Services",
      description: "Community assistance & public requests",
      href: PATHS.services,
      icon: Wrench,
    },
    {
      label: "Barangay Announcements",
      description: "Official advisories, schedules & notices",
      href: PATHS.announcements,
      icon: Megaphone,
    },
  ];

  const isServicesGroupActive =
    location.pathname === PATHS.services ||
    location.pathname.startsWith(PATHS.announcements);

  const navLinks = [
    { label: "Home", href: PATHS.home, icon: House },
    { label: "About Us", href: PATHS.about, icon: Info },
    { label: "Live Map & Reports", href: PATHS.publicMap, icon: MapPin },
    { label: "Barangay Services", href: PATHS.services, icon: Wrench, children: servicesSubLinks },
    { label: "Accomplishments", href: PATHS.accomplishments, icon: CheckCircle2 },
  ];

  return (
    <>
      <header className="landing-header sticky top-0 z-40 h-[72px] shrink-0 border-b sm:h-[76px]">
        <div className="site-container flex h-full items-center justify-between">
          
          {/* Brand Logo & Name (Responsive) */}
          <Link to={PATHS.home} className="flex items-center gap-2 sm:gap-3 transition-opacity hover:opacity-90 min-w-0 mr-2">
            <img src="/geofix167.png" alt="GeoFix 167 Logo" className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 object-contain" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight text-[#2E8B57] truncate">
                  GeoFix 167
                </span>

              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-slate-500 uppercase truncate">
                Barangay 167<span className="hidden sm:inline"> · Caloocan City</span>
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => {
              if (link.children) {
                return (
                  <div key={link.label} ref={servicesDropdownRef} className="relative">
                    <button
                      type="button"
                      aria-expanded={servicesMenuOpen}
                      aria-haspopup="menu"
                      onClick={() => setServicesMenuOpen((current) => !current)}
                      className={`relative inline-flex items-center gap-1.5 whitespace-nowrap py-2 text-[13px] font-bold transition-colors ${
                        isServicesGroupActive || servicesMenuOpen
                          ? "text-(--public-action) after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-(--gf-green)"
                          : "text-slate-600 hover:text-(--public-action)"
                      }`}
                    >
                      <span>{link.label}</span>
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
                          servicesMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div
                      role="menu"
                      aria-label="Barangay Services and Announcements"
                      aria-hidden={!servicesMenuOpen}
                      inert={!servicesMenuOpen ? "" : undefined}
                      className={`absolute left-1/2 top-full z-50 mt-3 w-76 -translate-x-1/2 overflow-hidden rounded-xl border border-(--gf-border) bg-white shadow-[0_16px_38px_-12px_rgb(15_23_42/0.2)] transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none ${
                        servicesMenuOpen
                          ? "visible translate-y-0 opacity-100"
                          : "invisible -translate-y-1.5 opacity-0 pointer-events-none"
                      }`}
                    >
                      <div className="border-b border-(--gf-line) bg-(--gf-surface) px-3.5 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-(--gf-slate)">
                          Barangay 167 Directory
                        </p>
                      </div>
                      <div className="space-y-1 p-2">
                        {link.children.map((sub) => {
                          const SubIcon = sub.icon;
                          const subActive =
                            sub.href === PATHS.announcements
                              ? location.pathname.startsWith(PATHS.announcements)
                              : location.pathname === sub.href;
                          return (
                            <Link
                              key={sub.href}
                              to={sub.href}
                              role="menuitem"
                              onClick={() => {
                                setServicesMenuOpen(false);
                                setMobileMenuOpen(false);
                              }}
                              className={`group/item flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                                subActive
                                  ? "bg-(--gf-green-soft) ring-1 ring-inset ring-(--gf-green-border)"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
                                  subActive
                                    ? "bg-(--public-action) text-white"
                                    : "bg-(--gf-green-soft) text-(--public-action) group-hover/item:bg-(--public-action) group-hover/item:text-white"
                                }`}
                              >
                                <SubIcon size={16} strokeWidth={2} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span
                                  className={`block whitespace-nowrap text-[13px] font-bold leading-snug ${
                                    subActive
                                      ? "text-(--public-action)"
                                      : "text-(--gf-ink) group-hover/item:text-(--public-action)"
                                  }`}
                                >
                                  {sub.label}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] font-medium text-(--gf-slate)">
                                  {sub.description}
                                </span>
                              </span>
                              <ChevronRight
                                size={14}
                                aria-hidden="true"
                                className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
                                  subActive
                                    ? "text-(--public-action)"
                                    : "text-slate-300 group-hover/item:translate-x-0.5 group-hover/item:text-(--public-action)"
                                }`}
                              />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <NavLink
                  key={link.label}
                  to={link.href}
                  onClick={() => {
                    setServicesMenuOpen(false);
                    setMobileMenuOpen(false);
                  }}
                  end={link.href === PATHS.home}
                  className={({ isActive }) => `relative whitespace-nowrap py-2 text-[13px] font-bold transition-colors ${isActive ? "text-(--public-action) after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-(--gf-green)" : "text-slate-600 hover:text-(--public-action)"}`}
                >
                  {link.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              to={PATHS.login}
              className="inline-flex h-9.5 items-center justify-center rounded-lg bg-(--public-action) text-white hover:bg-(--public-action-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--public-action) active:brightness-90 px-4 text-xs font-semibold tracking-wide transition-colors active:scale-[0.98]"
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
                  <img src="/geofix167.png" alt="GeoFix 167" className="h-9 w-9 shrink-0 object-contain" />
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
                  if (link.children) {
                    return (
                      <div key={link.label}>
                        <button
                          type="button"
                          aria-expanded={mobileServicesOpen}
                          onClick={() => setMobileServicesOpen((current) => !current)}
                          className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all active:scale-[0.99] ${
                            isServicesGroupActive
                              ? "bg-(--gf-green-soft) text-(--public-action)"
                              : "text-slate-700 hover:bg-emerald-50 hover:text-(--public-action)"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                                isServicesGroupActive
                                  ? "bg-(--gf-green) text-white"
                                  : "bg-slate-100 text-slate-600 group-hover:bg-(--gf-green) group-hover:text-white"
                              }`}
                            >
                              <Icon size={14} />
                            </span>
                            <span>{link.label}</span>
                          </div>
                          <ChevronDown
                            size={14}
                            aria-hidden="true"
                            className={`text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                              mobileServicesOpen ? "rotate-180 text-(--public-action)" : ""
                            }`}
                          />
                        </button>
                        {mobileServicesOpen && (
                          <div className="ml-6 mt-1 space-y-1 border-l-2 border-(--gf-green-border) py-1 pl-3">
                            {link.children.map((sub) => {
                              const SubIcon = sub.icon;
                              return (
                                <NavLink
                                  key={sub.href}
                                  to={sub.href}
                                  onClick={() => {
                                    setMobileMenuOpen(false);
                                    setMobileServicesOpen(false);
                                  }}
                                  className={({ isActive }) =>
                                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                      isActive
                                        ? "bg-(--gf-green-tint) text-(--gf-green-dark)"
                                        : "text-slate-600 hover:bg-(--gf-green-soft) hover:text-(--gf-green-dark)"
                                    }`
                                  }
                                >
                                  <SubIcon size={13} className="shrink-0" />
                                  <span>{sub.label}</span>
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <NavLink
                      key={link.label}
                      to={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-(--public-action) transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-(--gf-green) group-hover:text-white transition-colors">
                          <Icon size={14} />
                        </span>
                        <span>{link.label}</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-(--public-action) transition-colors" />
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
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition bg-(--public-action) text-white hover:bg-(--public-action-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--public-action) active:brightness-90"
                >
                  <LogIn size={15} />
                  <span>Resident & Responder Login</span>
                </Link>

                {/* BDRRMO Portal */}
                <Link
                  to={PATHS.adminLogin}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition bg-(--public-accent) text-(--public-text-strong) hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--public-action) active:brightness-90"
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
                  <HotlineLink>Hotline: </HotlineLink>
                </span>
                <span className="text-[10px] font-semibold text-slate-400">24/7 Standby</span>
              </div>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
