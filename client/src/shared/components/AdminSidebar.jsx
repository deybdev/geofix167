import {
  BarChart3,
  BookOpen,
  CheckSquare,
  ClipboardList,
  Grid2X2,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";

const navigation = [
  { label: "Dashboard", icon: Grid2X2, path: PATHS.admin },
  { label: "Announcements", icon: Megaphone, path: PATHS.adminAnnouncements },
  { label: "Incident Reports", icon: ClipboardList, path: PATHS.adminIncidentReports },
  { label: "Maintenance Tasks", icon: ShieldCheck, path: PATHS.adminMaintenanceTasks },
  { label: "Resolution Verification", icon: CheckSquare, path: PATHS.adminResolutionVerification },
  { label: "Accomplishment Log", icon: BookOpen, path: PATHS.adminAccomplishmentLog },
  { label: "Residents", icon: Users, path: PATHS.adminResidents },
  { label: "Reports & Analytics", icon: BarChart3, path: PATHS.adminReportsAnalytics },
  { label: "Settings", icon: Settings, path: PATHS.adminSettings },
];

export default function AdminSidebar({ open = false, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();

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
        className={`fixed inset-y-0 left-0 z-30 w-[178px] border-r border-[#e4e9ec] bg-white px-3 py-4 transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-7 flex items-center gap-2 px-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-[4px] border-(--gf-green) text-[8px] font-bold text-(--gf-green)">
            G
          </div>
          <div className="text-[11px] font-bold leading-tight text-(--gf-green)">
            GeoFix <span className="block text-[8px]">Barangay 167</span>
          </div>
          <button
            className="ml-auto text-slate-400 md:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={17} />
          </button>
        </div>
        <nav className="space-y-1">
          {navigation.map(({ label, icon: Icon, path }) => {
            const active = path && (path === PATHS.admin ? location.pathname === path : location.pathname.startsWith(path));
            return (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (path) navigate(path);
                onClose?.();
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[10px] font-medium ${
                active
                  ? "bg-(--gf-green) text-white"
                  : "text-[#263246] hover:bg-(--gf-green-soft)"
              }`}
            >
              <Icon size={14} strokeWidth={1.8} /> {label}
            </button>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-3 right-3 flex items-center gap-2 rounded-md border border-[#e5eaed] bg-[#f8fafb] p-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--gf-green) text-[9px] font-bold text-white">
            BA
          </div>
          <div className="min-w-0 text-[9px]">
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
