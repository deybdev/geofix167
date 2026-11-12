import { useEffect, useState } from "react";
import { useAuth } from "../../shared/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PATHS } from "../../router/paths";
import { getReportStats } from "../../services/residentService";
import ConfirmationDialog from "../../shared/components/ConfirmationDialog";
import { toast } from "../../shared/components/ui/toast";

const ACCOUNT_SETTINGS = [
  { icon: UserRound, label: "Edit Profile", description: "Update your name and profile details" },
  { icon: KeyRound, label: "Change Password", description: "Set a new account password" },
  { icon: Bell, label: "Notification Preferences", description: "Choose what alerts you receive" },
  { icon: ShieldCheck, label: "Privacy and Security", description: "Manage your account's safety" },
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    getReportStats()
      .then(({ data }) => {
        if (active) setStats(data.stats);
      })
      .catch(() => {
        if (active) setStats(null);
      });
    return () => {
      active = false;
    };
  }, []);

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

  function handleSettingClick(label) {
    toast.add({
      title: label,
      description: "This setting is coming soon.",
      type: "info",
    });
  }

  const initials = (user?.full_name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-xl font-bold text-slate-900">My Profile</h1>

      {/* Profile header */}
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-primary/5 py-8">
        <span className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary ring-4 ring-white">
          {initials || <UserRound size={40} className="text-primary" />}
        </span>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">{user?.full_name}</p>
          <p className="text-xs text-slate-500">Resident Account</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200">
            <BadgeCheck size={12} />
            Verified Account
          </span>
        </div>
      </div>

      {/* Account overview */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Account overview
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {stats ? stats.total : "—"}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Total Reports
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {stats ? stats.resolved : "—"}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Resolved Reports
            </p>
          </div>
        </div>
      </section>

      {/* Personal information */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Personal information
        </p>
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white p-1">
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-50">
              <UserRound size={16} className="text-slate-400" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Full name</p>
              <p className="truncate text-sm font-semibold text-slate-800">{user?.full_name ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-50">
              <Mail size={16} className="text-slate-400" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Email address</p>
              <p className="truncate text-sm font-semibold text-slate-800">{user?.email ?? "Not provided"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-50">
              <Phone size={16} className="text-slate-400" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Mobile number</p>
              <p className="truncate text-sm font-semibold text-slate-800">{user?.mobile_number ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-50">
              <MapPin size={16} className="text-slate-400" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Residential address</p>
              <p className="truncate text-sm font-semibold text-slate-800">Barangay 167, Caloocan City</p>
            </div>
          </div>
        </div>
      </section>

      {/* Account settings */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Account settings
        </p>
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white p-1">
          {ACCOUNT_SETTINGS.map(({ icon: Icon, label, description }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleSettingClick(label)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon size={16} className="text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{label}</span>
                <span className="block truncate text-[11px] text-slate-400">{description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </button>
          ))}
        </div>
      </section>

      {/* Log out */}
      <button
        type="button"
        onClick={() => setIsSignOutDialogOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
      >
        <LogOut size={16} />
        Log Out
      </button>

      <ConfirmationDialog
        open={isSignOutDialogOpen}
        onOpenChange={setIsSignOutDialogOpen}
        onConfirm={handleSignOut}
        title="Log out?"
        description="Are you sure you want to sign out of GeoFix 167?"
        confirmLabel="Log out"
        confirmVariant="destructive"
      />
    </div>
  );
}
