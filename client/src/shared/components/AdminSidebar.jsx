import {
  BarChart3,
  BookOpen,
  CheckSquare,
  ClipboardList,
  Radio,
  Grid2X2,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";

const navigation = [
  { label: "Dashboard", icon: Grid2X2, path: PATHS.admin, section: "OVERVIEW" },
  { label: "Incident Reports", icon: ClipboardList, path: PATHS.adminIncidentReports, section: "OPERATIONS" },
  { label: "Dispatch", icon: Radio, path: PATHS.adminDispatch },
  { label: "Maintenance", icon: ShieldCheck, path: PATHS.adminMaintenanceTasks },
  { label: "Verification", icon: CheckSquare, path: PATHS.adminResolutionVerification },
  { label: "Residents & Access", icon: Users, path: PATHS.adminResidents, section: "COMMUNITY" },
  { label: "Announcements", icon: Megaphone, path: PATHS.adminAnnouncements },
  { label: "Analytics & Reports", icon: BarChart3, path: PATHS.adminReportsAnalytics, section: "INSIGHTS" },
  { label: "Accomplishments", icon: BookOpen, path: PATHS.adminAccomplishmentLog },
  { label: "Settings", icon: Settings, path: PATHS.adminSettings, section: "SYSTEM" },
];

export default function AdminSidebar({ open = false, onClose, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateTo = (path) => {
    navigate(path);
    if (window.matchMedia("(max-width: 767px)").matches) onClose?.();
  };

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-20 bg-slate-950/20 md:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 border-r border-[#e4e9ec] bg-white px-3 py-4 shadow-xl transition-[width,transform] duration-300 ${
          open
            ? "w-[250px] translate-x-0"
            : "w-[72px] -translate-x-full md:translate-x-0"
        }`}
      >
        <div className={`mb-6 ${open ? "relative flex items-center justify-between gap-2 px-1 py-1" : "flex flex-col items-center gap-4 px-0"}`}>
          {!open && <button
            type="button"
            className="rounded-lg p-2 text-slate-600 transition hover:bg-(--gf-green-soft) hover:text-(--gf-green) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green)"
            onClick={onToggle}
            aria-expanded={false}
            aria-label="Open menu"
          ><Menu size={19} /></button>}
          <div className={`flex items-center gap-2 ${open ? "" : "flex-col"}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[4px] border-(--gf-green) text-[11px] font-bold text-(--gf-green)" aria-label="GeoFix 167">G</div>
            <div className={`min-w-0 text-xs font-bold leading-tight text-(--gf-green) ${open ? "" : "md:hidden"}`}>
              GeoFix <span className="block text-[11px] font-medium">Barangay 167</span>
            </div>
          </div>
          {open && <button
            type="button"
            className="ml-auto shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-(--gf-green-soft) hover:text-(--gf-green) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green)"
            onClick={onToggle}
            aria-expanded={true}
            aria-label="Close menu"
          ><Menu size={19} /></button>}
        </div>
        <nav className="max-h-[calc(100dvh-142px)] space-y-1 overflow-y-auto pr-0.5">
          {navigation.map(({ label, icon: Icon, path, section }) => {
            const active = path && (path === PATHS.admin ? location.pathname === path : location.pathname.startsWith(path));
            return (
              <div key={label}>
                {section && open && (
                  <div className="mb-2 mt-4 px-3 text-[11px] font-semibold tracking-[0.08em] text-slate-400 first:mt-0">
                    {section}
                  </div>
                )}
                <button
                  type="button"
                  title={open ? undefined : label}
                  onClick={() => navigateTo(path)}
                  className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                    open ? "" : "md:justify-center md:px-0"
                  } ${
                    active
                      ? "bg-(--gf-green) text-white"
                      : "text-[#263246] hover:bg-(--gf-green-soft)"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span className={`min-w-0 flex-1 ${open ? "" : "md:hidden"}`}>{label}</span>
                  {!open && (
                    <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:md:block">
                      {label}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
        <div className={`absolute bottom-4 flex items-center gap-2 rounded-xl border border-[#e5eaed] bg-[#f8fafb] p-2 ${open ? "left-3 right-3" : "left-2 right-2 md:justify-center"}`}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-(--gf-green) text-[11px] font-bold text-white">
            BA
          </div>
          <div className={`min-w-0 text-[11px] ${open ? "" : "md:hidden"}`}>
            <strong className="block truncate">Barangay Administrator</strong>
            <span className="text-[11px] text-slate-400">
              Authorized Account
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
