import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "../router/paths";
import ConfirmationDialog from "../shared/components/ConfirmationDialog";
import { toast } from "../shared/components/ui/toast";

const AdminLayout = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    setIsSignOutDialogOpen(false);
    toast.add({
      title: "Logout successful",
      description: "You have been safely logged out.",
      type: "success",
    });
    navigate(PATHS.adminLogin, { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-medium">GeoFix 167 — Admin</span>
        <button
          onClick={() => setIsSignOutDialogOpen(true)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
      <ConfirmationDialog
        open={isSignOutDialogOpen}
        onOpenChange={setIsSignOutDialogOpen}
        onConfirm={handleSignOut}
        title="Sign out?"
        description="Are you sure you want to sign out of the admin portal?"
        confirmLabel="Sign out"
      />
    </div>
  );
};

export default AdminLayout;
