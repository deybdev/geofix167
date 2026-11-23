import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { PATHS } from "../router/paths";
import AdminSidebar from "../shared/components/AdminSidebar";
import AdminNotifications from "../features/admin/AdminNotifications";
import { useAuth } from "../shared/hooks/useAuth";

const pageTitles = {
  [PATHS.admin]: "Barangay 167 Operations Dashboard",
  [PATHS.adminAnnouncements]: "Announcements",
  [PATHS.adminIncidentReports]: "Active Emergency",
  [PATHS.adminDispatch]: "Dispatch Responders",
  [PATHS.adminMaintenanceTasks]: "Maintenance Tasks",
  [PATHS.adminResolutionVerification]: "Resolution Verification",
  [PATHS.adminAccomplishmentLog]: "Accomplishment Log",
  [PATHS.adminBdrrmoAccomplishments]: "BDRRMO Completed Tasks",
  [PATHS.adminResidents]: "Residents",
  "/admin/registrations": "Registration Verification",
  [PATHS.adminReportsAnalytics]: "Reports & Analytics",
  [PATHS.adminSettings]: "Settings",
};

const AdminLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false,
  );

  return (
    <div className="admin-portal min-h-screen bg-[#f7f9fa] text-[#263246]">
      <AdminSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((open) => !open)}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={`transition-[margin] duration-300 ${sidebarOpen ? "md:ml-[250px]" : "md:ml-[72px]"}`}>
        <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between gap-3 border-b border-[#e4e9ec] bg-white/95 px-5 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open admin navigation" aria-expanded={sidebarOpen} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 md:hidden"><Menu size={17} /></button>
            <div className="min-w-0">
              <p className="hidden text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:block">
                Barangay 167 · Admin Portal
              </p>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-bold text-primary">
                  {location.pathname.endsWith("/report") ? "Printable Incident Report" : pageTitles[location.pathname] || "Barangay 167 Operations Dashboard"}
                </h1>
                <span className="hidden shrink-0 rounded bg-[#fff0c1] px-2 py-1 text-[8px] font-semibold text-[#d68d00] sm:inline">System Admin</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <label className="hidden h-8 w-[210px] items-center gap-2 rounded-lg border border-[#dfe5e8] px-2.5 text-[10px] text-slate-400 transition focus-within:border-(--gf-green-border) sm:flex">
              <Search size={14} />
              <input aria-label="Search report or location" placeholder="Search report or location..." className="w-full outline-none placeholder:text-slate-400" />
            </label>
            <AdminNotifications key={user.id} />
          </div>
        </header>
        <main className="p-5 md:p-6"><Outlet /></main>
      </div>
    </div>
  );
};

export default AdminLayout;
