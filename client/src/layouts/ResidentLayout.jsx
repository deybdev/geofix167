import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, FileText, House, Map, Plus, UserRound, Bell } from "lucide-react";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "../router/paths";
import { useEffect, useRef, useState } from "react";
import { getNotifications } from "../services/residentService";
import ConfirmationDialog from "../shared/components/ConfirmationDialog";
import { toast } from "../shared/components/ui/toast";

const SOS_TAPS = 5;
const SOS_WINDOW_MS = 2000;

function SosButton({ onTriggered }) {
  const tapsRef = useRef([]);
  const [progress, setProgress] = useState(0);

  function handlePress() {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current, now].filter(
      (t) => now - t <= SOS_WINDOW_MS,
    );
    const count = tapsRef.current.length;
    setProgress(count);

    if (count >= SOS_TAPS) {
      tapsRef.current = [];
      setProgress(0);
      onTriggered();
      return;
    }

    setTimeout(() => {
      setProgress(() => {
        const fresh = tapsRef.current.filter((t) => Date.now() - t <= SOS_WINDOW_MS);
        return fresh.length;
      });
    }, SOS_WINDOW_MS);
  }

  const pct = (progress / SOS_TAPS) * 100;
  const r = 22;
  const circ = 2 * Math.PI * r;

  return (
    <button
      type="button"
      aria-label="SOS Emergency — tap 5 times"
      onClick={handlePress}
      className="relative flex size-14 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/40 active:scale-95 transition-transform"
    >
      <svg
        className="absolute inset-0"
        width="56"
        height="56"
        viewBox="0 0 56 56"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ - (circ * pct) / 100}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.15s ease" }}
        />
      </svg>
      <span className="relative text-[11px] font-black tracking-widest">SOS</span>
      {progress > 0 && progress < SOS_TAPS && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-red-600">
          {progress}
        </span>
      )}
      <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-30" />
    </button>
  );
}

const SUB_PAGES = {
  [PATHS.myReports]: "My Reports",
  [PATHS.alerts]: "Notifications",
  [PATHS.emergency]: "Emergency Request",
};

const ResidentLayout = ({ children }) => {
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

  const isMapPage      = location.pathname.startsWith(PATHS.map);
  const isPhotoPage    = location.pathname.startsWith(PATHS.photoCapture);
  const isReportPage   = location.pathname.startsWith(PATHS.report);
  const isEmergencyPage = location.pathname.startsWith(PATHS.emergency);

  const subTitle = Object.entries(SUB_PAGES).find(([p]) =>
    location.pathname.startsWith(p),
  )?.[1] ?? null;

  const isSubPage = Boolean(subTitle);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getNotifications()
      .then(({ data }) => setUnreadCount(data.unread_count ?? 0))
      .catch(() => {});
  }, [location.pathname]);

  const navigationItems = [
    { label: "Home",       icon: House,     path: PATHS.resident },
    { label: "Map",        icon: Map,       path: PATHS.map },
    { label: "Report",     icon: Plus,      featured: true, path: PATHS.report },
    { label: "My Reports", icon: FileText,  path: PATHS.myReports },
    { label: "Profile",    icon: UserRound, path: PATHS.profile },
  ];

  const showHeader = !isMapPage && !isPhotoPage && !isReportPage && !isSubPage;
  const showNav    = !isMapPage && !isPhotoPage && !isReportPage && !isSubPage;
  const showSos    = !isReportPage && !isPhotoPage && !isSubPage;

  const mainClass = isSubPage
    ? "flex-1 p-3"
    : isMapPage || isPhotoPage || isEmergencyPage
    ? "flex-1"
    : "flex-1 p-3 pb-28";

  return (
    <div className="flex h-screen flex-col">

      {/* Standard header */}
      {showHeader && (
        <header className="flex items-center justify-between border-b px-6 py-4">
          <button
            type="button"
            onClick={() => setIsSignOutDialogOpen(true)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => navigate(PATHS.alerts)}
            className="relative text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell size={25} />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </header>
      )}

      {/* Sub-page header: back + title */}
      {isSubPage && (
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-primary hover:text-primary"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-base font-bold text-slate-900">{subTitle}</h1>
        </header>
      )}

      <main className={mainClass}>
        {children ?? <Outlet />}
      </main>

      {/* SOS button */}
      {showSos && (
        <div className="fixed bottom-24 right-4 z-[1100]">
          <SosButton onTriggered={() => navigate(PATHS.emergency)} />
        </div>
      )}

      {/* Bottom nav */}
      {showNav && (
        <nav
          aria-label="Resident navigation"
          className="fixed inset-x-0 bottom-0 z-[1000] rounded-t-[28px] border-t border-slate-100 bg-white px-3 pb-3 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
        >
          <div className="mx-auto flex max-w-lg items-end justify-around">
            {navigationItems.map(({ label, icon: Icon, path, featured }) => {
              const isActive =
                Boolean(path) &&
                (path === PATHS.resident
                  ? location.pathname === path
                  : location.pathname.startsWith(path));

              return featured ? (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  onClick={path ? () => navigate(path) : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className="relative -mt-7 flex flex-col items-center gap-1 text-[11px] font-semibold text-primary"
                >
                  <span className="flex size-13 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30">
                    <Icon size={25} strokeWidth={2.5} />
                  </span>
                  <span>{label}</span>
                </button>
              ) : (
                <button
                  key={label}
                  type="button"
                  onClick={path ? () => navigate(path) : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex min-w-14 flex-col items-center gap-1 py-1 text-[11px] font-medium transition-colors ${
                    isActive ? "text-primary" : "text-slate-400 hover:text-primary"
                  }`}
                >
                  <Icon size={23} strokeWidth={2} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
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

export default ResidentLayout;
