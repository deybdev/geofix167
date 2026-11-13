import { ClipboardList, FileCheck2, Map, UserRound } from "lucide-react";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "../router/paths";
import ConfirmationDialog from "../shared/components/ConfirmationDialog";
import { toast } from "../shared/components/ui/toast";

const ResponderLayout = () => {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
      navigate(PATHS.login, { replace: true });
    } catch (error) {
      toast.add({
        title: "Logout failed",
        description: error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    }
  }

  const navItems = [
    {
      label: "Assignments",
      icon: ClipboardList,
      path: PATHS.responder,
      isActive:
        location.pathname === PATHS.responder ||
        location.pathname === `${PATHS.responder}/dashboard` ||
        location.pathname.startsWith(`${PATHS.responder}/assignment`) ||
        location.pathname.startsWith(`${PATHS.responder}/acceptance`) ||
        location.pathname.startsWith(`${PATHS.responder}/confirmation`) ||
        location.pathname.startsWith(`${PATHS.responder}/new-dispatch`) ||
        location.pathname.startsWith(`${PATHS.responder}/mark-unavailable`) ||
        location.pathname.startsWith(`${PATHS.responder}/unavailability-submitted`) ||
        location.pathname.startsWith(`${PATHS.responder}/reassignment-`),
    },
    {
      label: "Route",
      icon: Map,
      path: `${PATHS.responder}/route`,
      isActive:
        location.pathname.startsWith(`${PATHS.responder}/route`) ||
        location.pathname.startsWith(`${PATHS.responder}/scene-assessment`) ||
        location.pathname.startsWith(`${PATHS.responder}/incident-not-located`) ||
        location.pathname.startsWith(`${PATHS.responder}/emergency-support`) ||
        location.pathname.startsWith(`${PATHS.responder}/non-emergency-support`),
    },
    {
      label: "Updates",
      icon: FileCheck2,
      path: `${PATHS.responder}/updates`,
      isActive: location.pathname.startsWith(`${PATHS.responder}/updates`),
    },
    {
      label: "Profile",
      icon: UserRound,
      path: `${PATHS.responder}/profile`,
      isActive: location.pathname.startsWith(`${PATHS.responder}/profile`),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-medium">GeoFix 167 — Responder</span>
        <button
          type="button"
          onClick={() => setIsSignOutDialogOpen(true)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 p-6 pb-24">
        <Outlet />
      </main>
      <nav
        aria-label="Tanod navigation"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
      >
        <div className="mx-auto grid max-w-[680px] grid-cols-4 gap-1">
          {navItems.map(({ label, icon: Icon, path, isActive }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(path)}
              aria-current={isActive ? "page" : undefined}
              className={`responder-nav-item flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-sm transition-colors ${
                isActive ? "font-bold text-primary" : "font-medium text-slate-500"
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </nav>
      <ConfirmationDialog
        open={isSignOutDialogOpen}
        onOpenChange={setIsSignOutDialogOpen}
        onConfirm={handleSignOut}
        title="Sign out?"
        description="Are you sure you want to sign out of GeoFix 167?"
        confirmLabel="Sign out"
        confirmVariant="destructive"
      />
    </div>
  );
};

export default ResponderLayout;
