import { ClipboardList, FileCheck2, Map, UserRound } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "../router/paths";

const ResponderLayout = () => {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <main className="mx-auto min-h-screen w-full max-w-[768px] pb-28">
        <Outlet />
      </main>
      <nav
        aria-label="Responder navigation"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white px-4 pb-4 pt-3"
      >
        <div className="mx-auto flex max-w-[680px] items-end justify-around">
          {[
            { label: "Assignments", icon: ClipboardList, path: PATHS.responder },
            { label: "Route", icon: Map, path: `${PATHS.responder}/route` },
            { label: "Updates", icon: FileCheck2 },
            { label: "Profile", icon: UserRound, action: handleSignOut },
          ].map(({ label, icon: Icon, path, action }) => {
            const active = path && location.pathname.startsWith(path);
            return (
              <button
                key={label}
                type="button"
                onClick={action ?? (path ? () => navigate(path) : undefined)}
                className={`flex min-w-16 flex-col items-center gap-1 text-[16px] font-medium transition-colors ${
                  active ? "text-primary" : "text-slate-500"
                }`}
              >
                <Icon size={34} strokeWidth={active ? 2.4 : 1.8} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default ResponderLayout;
