import { useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "../router/paths";
import AdminSidebar from "../shared/components/AdminSidebar";
import ConfirmationDialog from "../shared/components/ConfirmationDialog";
import { toast } from "../shared/components/ui/toast";

const pageTitles = {
  [PATHS.admin]: "Barangay 167 Operations Dashboard",
  [PATHS.adminAnnouncements]: "Announcements",
  [PATHS.adminIncidentReports]: "Incident Reports",
  [PATHS.adminMaintenanceTasks]: "Maintenance Tasks",
  [PATHS.adminResolutionVerification]: "Resolution Verification",
  [PATHS.adminAccomplishmentLog]: "Accomplishment Log",
  [PATHS.adminResidents]: "Residents",
  [PATHS.adminReportsAnalytics]: "Reports & Analytics",
  [PATHS.adminSettings]: "Settings",
};

const AdminLayout = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false,
  );
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);

  async function handleSignOut() {
    try {
      await signOut();
      setIsSignOutDialogOpen(false);
      toast.add({
        title: "Logout successful",
        description: "You have been safely logged out.",
        type: "success",
      });
      navigate(PATHS.adminLogin, { replace: true });
    } catch (error) {
      toast.add({
        title: "Logout failed",
        description: error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fa] text-[#263246]">
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={`transition-[margin] duration-300 ${sidebarOpen ? "md:ml-[250px]" : "md:ml-[72px]"}`}>
        <header className="flex h-[54px] items-center justify-between border-b border-[#e4e9ec] bg-white px-5 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1 text-slate-500 hover:bg-(--gf-green-soft) hover:text-(--gf-green)"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              <Menu size={19} />
            </button>
            <h1 className="text-[15px] font-bold text-primary">{pageTitles[location.pathname] || "Barangay 167 Operations Dashboard"}</h1>
            <span className="rounded bg-[#fff0c1] px-2 py-1 text-[8px] font-semibold text-[#d68d00]">System Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="hidden h-7 w-[194px] items-center gap-2 rounded-md border border-[#dfe5e8] px-2 text-[10px] text-slate-400 sm:flex">
              <Search size={14} />
              <input aria-label="Search report or location" placeholder="Search report or location..." className="w-full outline-none placeholder:text-slate-400" />
            </label>
            <button type="button" className="relative rounded-full border border-[#dfe5e8] p-1.5 text-(--gf-green)" aria-label="Notifications">
              <Bell size={14} />
              <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--gf-green) text-[8px] font-bold text-white">AM</div>
              <div className="text-[9px]"><strong className="block">Admin Moreno</strong><span className="text-slate-400">Brgy 167 Lead Officer</span></div>
            </div>
            <button type="button" onClick={() => setIsSignOutDialogOpen(true)} className="hidden text-[10px] text-slate-400 hover:text-(--gf-green) lg:block">Sign out</button>
          </div>
        </header>
        <main className="p-5 md:p-6"><Outlet /></main>
      </div>
      <ConfirmationDialog
        open={isSignOutDialogOpen}
        onOpenChange={setIsSignOutDialogOpen}
        onConfirm={handleSignOut}
        title="Sign out?"
        description="Are you sure you want to sign out of the admin portal?"
        confirmLabel="Sign out"
        confirmVariant="destructive"
      />
    </div>
  );
};

export default AdminLayout;
