import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ADMIN_NAVIGATION } from "../../router/adminNavigation";
import { PATHS } from "../../router/paths";
import { useAuth } from "../hooks/useAuth";
import ConfirmationDialog from "./ConfirmationDialog";
import { toast } from "./ui/toast";

export default function AdminSidebar({ open = false, onClose, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const accountRef = useRef(null);

  const displayName =
    user?.name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    "Barangay Administrator";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "BA";

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  async function handleSignOut() {
    try {
      await signOut();
      setIsSignOutDialogOpen(false);
      setAccountMenuOpen(false);
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

  const navigateTo = (path) => {
    navigate(path);
    if (window.matchMedia("(max-width: 767px)").matches) onClose?.();
  };

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-20 bg-slate-950/20 md:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 border-r border-[#e4e9ec] bg-white px-3 py-4 shadow-xl transition-[width,transform] duration-300 ${
          open
            ? "w-[250px] translate-x-0"
            : "w-[72px] -translate-x-full md:translate-x-0"
        }`}
      >
        <div className={`mb-6 ${open ? "relative flex items-center justify-between gap-2 px-1 py-1" : "flex flex-col items-center gap-4 px-0"}`}>
          {!open && <button
            type="button"
            className="rounded-lg p-2 text-slate-600 transition hover:bg-(--gf-green-soft) hover:text-(--gf-green) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green)"
            onClick={onToggle}
            aria-expanded={false}
            aria-label="Open menu"
          ><Menu size={19} /></button>}
          <div className={`flex items-center gap-2 ${open ? "" : "flex-col"}`}>
            <img
              src="/geofix167.png"
              alt="GeoFix 167"
              className="h-10 w-10 shrink-0 rounded-lg object-contain"
            />
            <div className={`min-w-0 text-[11px] font-bold leading-tight text-(--gf-green) ${open ? "" : "md:hidden"}`}>
              GeoFix <span className="block text-[8px]">Barangay 167</span>
            </div>
          </div>
          {open && <button
            type="button"
            className="ml-auto shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-(--gf-green-soft) hover:text-(--gf-green) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green)"
            onClick={onToggle}
            aria-expanded={true}
            aria-label="Close menu"
          ><Menu size={19} /></button>}
        </div>
        <nav className="max-h-[calc(100dvh-230px)] space-y-1 overflow-y-auto pr-0.5" aria-label="Admin navigation">
          {ADMIN_NAVIGATION.map(({ label, icon: Icon, path, section }) => {
            const active = path && (path === PATHS.admin ? location.pathname === path : location.pathname.startsWith(path));
            return (
              <div key={label}>
                {section && open && (
                  <div className="mb-2 mt-4 px-3 text-[10px] font-semibold tracking-[0.08em] text-slate-400 first:mt-0">
                    {section}
                  </div>
                )}
                <button
                  type="button"
                  title={open ? undefined : label}
                  onClick={() => {
                    if (path) {
                      navigateTo(path);
                    }
                  }}
                  className={`group relative flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium transition-colors ${
                    open ? "" : "md:justify-center md:px-0"
                  } ${
                    active
                      ? "bg-(--gf-green) text-white"
                      : "text-[#263246] hover:bg-(--gf-green-soft)"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  <span className={`min-w-0 flex-1 truncate ${open ? "" : "md:hidden"}`}>{label}</span>
                  {!open && (
                    <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[12px] text-white shadow-lg group-hover:md:block">
                      {label}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
        <div ref={accountRef} className={`absolute bottom-4 left-2 right-2`}>
          {accountMenuOpen && (
            <div
              role="menu"
              aria-label="Account options"
              className={`absolute bottom-[calc(100%+8px)] ${open ? "left-0 right-0" : "left-0 w-[220px]"} overflow-hidden rounded-xl border border-[#e5eaed] bg-white p-1.5 shadow-xl`}
            >
              <div className="px-2.5 py-2">
                <p className="truncate text-[11px] font-bold text-[#263246]">{displayName}</p>
                <p className="mt-0.5 truncate text-[9px] text-slate-400">System Administrator</p>
              </div>
              <div className="my-1 h-px bg-[#eef1f3]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountMenuOpen(false);
                  setIsSignOutDialogOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAccountMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            aria-label="Account menu"
            title={open ? undefined : displayName}
            className={`flex w-full items-center gap-2 rounded-xl border border-[#e5eaed] bg-[#f8fafb] p-2 text-left transition hover:border-(--gf-green-border) hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) ${open ? "" : "md:justify-center md:px-0"}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--gf-green) text-[9px] font-bold text-white">
              {initials}
            </span>
            <span className={`min-w-0 flex-1 ${open ? "" : "md:hidden"}`}>
              <strong className="block truncate text-[10px] text-[#263246]">{displayName}</strong>
              <span className="block text-[8px] text-slate-400">System Administrator</span>
            </span>
            {open && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${accountMenuOpen ? "rotate-180" : ""}`} />}
          </button>
        </div>
      </aside>
      <ConfirmationDialog
        open={isSignOutDialogOpen}
        onOpenChange={setIsSignOutDialogOpen}
        onConfirm={handleSignOut}
        title="Sign out?"
        description="Are you sure you want to sign out of the admin portal?"
        confirmLabel="Sign out"
        confirmVariant="destructive"
      />
    </>
  );
}
