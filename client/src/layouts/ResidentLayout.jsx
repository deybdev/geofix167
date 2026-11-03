import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FileText, House, Map, Plus, UserRound, Bell } from "lucide-react";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "../router/paths";

const navigationItems = [
  { label: "Home", icon: House, path: PATHS.resident },
  { label: "Map", icon: Map, path: PATHS.map },
  { label: "Report", icon: Plus, featured: true, path: PATHS.report },
  { label: "My Reports", icon: FileText },
  { label: "Profile", icon: UserRound },
];

const ResidentLayout = ({ children }) => {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMapPage = location.pathname.startsWith(PATHS.map);
  const isPhotoPage = location.pathname.startsWith(PATHS.photoCapture);

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {!isMapPage && !isPhotoPage && (
        <header className="flex items-center justify-between border-b px-6 py-4">
          <button onClick={handleSignOut} className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
          <Bell size={25} className="text-muted-foreground hover:text-foreground" />
        </header>
      )}
      <main className={isMapPage || isPhotoPage ? "flex-1 p-6 pb-0" : "flex-1 p-6 pb-28"}>
        {children ?? <Outlet />}
      </main>

      {!isMapPage && !isPhotoPage && (
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
                  className={`flex min-w-14 flex-col items-center gap-1 py-1 text-[11px] font-medium transition-colors ${
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
    </div>
  );
};

export default ResidentLayout;
