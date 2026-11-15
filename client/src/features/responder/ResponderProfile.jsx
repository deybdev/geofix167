import { LogOut, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";
import ConfirmationDialog from "../../shared/components/ConfirmationDialog";
import { useAuth } from "../../shared/hooks/useAuth";
import { toast } from "../../shared/components/ui/toast";

function getInitials(name) {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function ResponderProfile() {
  const { user, signOut } = useAuth();
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

  const fullName = user?.full_name || "Responder";
  const initials = getInitials(user?.full_name) || "R";
  const roleLabel = user?.role === "tanod" ? "Barangay Tanod" : "Responder";

  return (
    <div className="responder-profile-page w-full space-y-4">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <h1 className="truncate text-xl font-bold tracking-tight text-primary">Profile</h1>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
          {initials}
        </span>
      </header>

      <div className="responder-profile-content mx-auto w-full max-w-2xl space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">{fullName}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{roleLabel}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <ShieldCheck size={13} />
              Active account
            </span>
          </div>
        </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-bold text-slate-900">Contact details</h2>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-5">
            <UserRound className="shrink-0 text-slate-400" size={18} />
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Full name</p>
              <p className="truncate text-sm font-semibold text-slate-800">{fullName}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-5">
            <Phone className="shrink-0 text-slate-400" size={18} />
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Mobile number</p>
              <p className="truncate text-sm font-semibold text-slate-800">
                {user?.mobile_number || "Not provided"}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-5">
            <Mail className="shrink-0 text-slate-400" size={18} />
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Email address</p>
              <p className="truncate text-sm font-semibold text-slate-800">
                {user?.email || "Not provided"}
              </p>
            </div>
          </div>
        </div>
        </section>

        <button
          type="button"
          onClick={() => setIsSignOutDialogOpen(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          <LogOut size={20} />
          Sign out
        </button>
      </div>

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
}
