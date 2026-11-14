import {
  BarChart3,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Grid2X2,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";

const navigation = [
  { label: "Dashboard", icon: Grid2X2, path: PATHS.admin, section: "MAIN MENU" },
  {
    label: "Incident Reports",
    icon: ClipboardList,
    path: PATHS.adminIncidentReports,
    children: [
      { label: "Pending Triage Queue", queue: "pending-triage" },
      { label: "Active Emergencies (BDRRMO)", queue: "active-emergencies" },
      { label: "External Agency Requests", queue: "external-agencies" },
      { label: "Infrastructure Reports", queue: "infrastructure" },
      { label: "Monitor Dispatch & Tracking", queue: "dispatch-tracking" },
    ],
  },
  {
    label: "Maintenance Tasks",
    icon: ShieldCheck,
    path: PATHS.adminMaintenanceTasks,
    children: [
      "Non-Emergency Intake",
      "Active Work Orders",
      "Awaiting Verification",
      "Completed & Logged",
    ],
  },
  {
    label: "Resolution & Verification",
    icon: CheckSquare,
    path: PATHS.adminResolutionVerification,
    children: [
      "Evidence Review",
      "QR Handover Reconciliation",
      "False-Report Controls",
    ],
  },
  {
    label: "Announcements & Broadcasts",
    icon: Megaphone,
    path: PATHS.adminAnnouncements,
    children: [
      "Create Advisory / Notice",
      "Geo-Fenced Broadcasts",
      "Active Broadcast Log",
      "Public Feed Curation",
    ],
  },
  {
    label: "Accomplishment Log",
    icon: BookOpen,
    path: PATHS.adminAccomplishmentLog,
    children: [
      "Public Ledger Preview",
      "Curation Queue",
      "Audit & Retention Trail",
    ],
  },
  {
    label: "Residents & Access",
    icon: Users,
    path: PATHS.adminResidents,
    children: [
      "Resident Directory",
      "Pending Verifications",
      "Account Recovery",
    ],
  },
  {
    label: "Reports & Analytics",
    icon: BarChart3,
    path: PATHS.adminReportsAnalytics,
    children: [
      "Incident Heatmaps & Trends",
      "Response-Time & SLA Metrics",
      "Resource Utilization",
      "Export Center",
    ],
  },
  {
    label: "Settings & Configuration",
    icon: Settings,
    path: PATHS.adminSettings,
    section: "UTILITIES",
    children: [
      "Categories & Zones",
      "Agency Contacts",
      "Hospital Capability Matrix",
      "Language Filters",
    ],
  },
];

export default function AdminSidebar({ open = false, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeGroup = navigation.find(
    ({ path }) => path && path !== PATHS.admin && location.pathname.startsWith(path),
  )?.label;
  const [expandedGroup, setExpandedGroup] = useState(activeGroup);

  useEffect(() => {
    if (activeGroup) setExpandedGroup(activeGroup);
  }, [activeGroup]);

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
        <div className={`mb-7 flex items-center gap-2 px-2 ${open ? "" : "md:justify-center md:px-0"}`}>
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-[4px] border-(--gf-green) text-[8px] font-bold text-(--gf-green)">
            G
          </div>
          <div className={`text-[11px] font-bold leading-tight text-(--gf-green) ${open ? "" : "md:hidden"}`}>
            GeoFix <span className="block text-[8px]">Barangay 167</span>
          </div>
          {open && (
            <button
              className="ml-auto text-slate-400 md:hidden"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={17} />
            </button>
          )}
        </div>
        <nav className="max-h-[calc(100vh-118px)] space-y-1 overflow-y-auto pr-0.5">
          {navigation.map(({ label, icon: Icon, path, children, section }) => {
            const active = path && (path === PATHS.admin ? location.pathname === path : location.pathname.startsWith(path));
            const expanded = expandedGroup === label;
            return (
              <div key={label}>
                {section && open && (
                  <div className="mb-2 mt-4 px-3 text-[9px] font-semibold tracking-[0.08em] text-slate-400 first:mt-0">
                    {section}
                  </div>
                )}
                <button
                  type="button"
                  title={open ? undefined : label}
                  onClick={() => {
                    if (children) {
                      setExpandedGroup(expanded ? null : label);
                      if (path) navigate(path);
                    } else if (path) {
                      navigateTo(path);
                    }
                  }}
                  aria-expanded={children ? expanded : undefined}
                  className={`group relative flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] font-medium transition-colors ${
                    open ? "" : "md:justify-center md:px-0"
                  } ${
                    active
                      ? "bg-(--gf-green) text-white"
                      : "text-[#263246] hover:bg-(--gf-green-soft)"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  <span className={`min-w-0 flex-1 ${open ? "" : "md:hidden"}`}>{label}</span>
                  {children && open && (
                    <ChevronDown
                      size={13}
                      className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                  )}
                  {!open && (
                    <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] text-white shadow-lg group-hover:md:block">
                      {label}
                    </span>
                  )}
                </button>
                {children && expanded && open && (
                  <div className="ml-5 border-l border-(--gf-green-border) py-1 pl-2">
                    {children.map((child) => {
                      const childLabel = typeof child === "string" ? child : child.label;
                      const childPath = typeof child === "string" ? path : `${path}?queue=${child.queue}`;
                      return (
                      <button
                        key={childLabel}
                        type="button"
                        onClick={() => navigateTo(childPath)}
                        className="block w-full rounded px-2 py-1.5 text-left text-[9px] leading-tight text-slate-500 hover:bg-(--gf-green-soft) hover:text-(--gf-green)"
                      >
                        {childLabel}
                      </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className={`absolute bottom-4 flex items-center gap-2 rounded-xl border border-[#e5eaed] bg-[#f8fafb] p-2 ${open ? "left-3 right-3" : "left-2 right-2 md:justify-center"}`}>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--gf-green) text-[9px] font-bold text-white">
            BA
          </div>
          <div className={`min-w-0 text-[9px] ${open ? "" : "md:hidden"}`}>
            <strong className="block truncate">Barangay Administrator</strong>
            <span className="text-[8px] text-slate-400">
              Authorized Account
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
