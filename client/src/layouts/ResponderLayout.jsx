import { ClipboardList, FileCheck2, Map, UserRound } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { PATHS } from "../router/paths";

const ResponderLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
    <div className="responder-shell flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-slate-50">
      <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6">
        <div className="responder-page min-w-0">
          <Outlet />
        </div>
      </main>
      <nav
        aria-label="Responder navigation"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] sm:px-4 sm:pt-3"
      >
        <div className="mx-auto grid max-w-[680px] grid-cols-4 gap-0.5">
          {navItems.map(({ label, icon: Icon, path, isActive }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(path)}
              aria-current={isActive ? "page" : undefined}
              className={`responder-nav-item flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs transition-colors sm:min-h-16 sm:gap-1 sm:text-sm ${
                isActive ? "font-bold text-primary" : "font-medium text-slate-500"
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default ResponderLayout;
