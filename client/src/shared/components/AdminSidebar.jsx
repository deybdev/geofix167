import { useState } from "react";
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
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);

  const isNavItemActive = (item) => {
    if (item.children?.length) {
      return item.children.some(
        (child) =>
          location.pathname === child.path ||
          location.pathname.startsWith(`${child.path}/`),
      );
    }
    if (!item.path) return false;
    return item.path === PATHS.admin
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);
  };

  const [expandedMenus, setExpandedMenus] = useState(() =>
    Object.fromEntries(
      ADMIN_NAVIGATION.filter(
        (item) => item.children?.length && isNavItemActive(item),
      ).map((item) => [item.key, true]),
    ),
  );

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
          {ADMIN_NAVIGATION.map((item) => {
            const { key, label, icon: Icon, path, section, children } = item;
            const hasChildren = Boolean(children?.length);
            const active = isNavItemActive(item);
            const expanded = Boolean(expandedMenus[key]);
            return (
              <div key={key}>
                {section && open && (
                  <div className="mb-2 mt-4 px-3 text-[10px] font-semibold tracking-[0.08em] text-slate-400 first:mt-0">
                    {section}
                  </div>
                )}
                <div
                  className={
                    hasChildren && expanded && open
                      ? `rounded-xl p-1 transition-colors ${
                          active
                            ? "bg-(--gf-green-soft) ring-1 ring-inset ring-(--gf-green-border)"
                            : "bg-slate-50 ring-1 ring-inset ring-(--gf-line)"
                        }`
                      : ""
                  }
                >
                  <button
                    type="button"
                    title={label}
                    aria-expanded={hasChildren ? expanded : undefined}
                    aria-controls={hasChildren ? `sidebar-submenu-${key}` : undefined}
                    onClick={() => {
                      if (hasChildren) {
                        if (!open) {
                          onToggle?.();
                          setExpandedMenus((prev) => ({ ...prev, [key]: true }));
                        } else {
                          setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
                        }
                        return;
                      }
                      if (path) {
                        navigateTo(path);
                      }
                    }}
                    className={`group relative flex w-full items-center gap-2.5 rounded-lg text-left text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) ${
                      open
                        ? hasChildren && expanded
                          ? "px-2.5 py-2"
                          : "px-3 py-2.5"
                        : "py-2.5 md:justify-center md:px-0"
                    } ${
                      active
                        ? "bg-(--gf-green) text-white shadow-xs"
                        : hasChildren && expanded && open
                          ? "text-(--gf-ink) hover:bg-white"
                          : "text-(--gf-ink) hover:bg-(--gf-green-soft)"
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.8} className="shrink-0" />
                    <span className={`min-w-0 flex-1 truncate ${open ? "" : "md:hidden"}`}>{label}</span>
                    {hasChildren && open && (
                      <span
                        aria-hidden="true"
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors ${
                          active
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-(--gf-slate) group-hover:bg-(--gf-green-tint) group-hover:text-(--gf-green-dark)"
                        }`}
                      >
                        <ChevronDown
                          size={13}
                          className={`transition-transform duration-150 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                        />
                      </span>
                    )}
                    {!open && (
                      <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[12px] text-white shadow-lg group-hover:md:block">
                        {label}
                      </span>
                    )}
                  </button>
                  {hasChildren && expanded && open && (
                    <div
                      id={`sidebar-submenu-${key}`}
                      className="mt-1 space-y-1 pt-0.5"
                    >
                      {children.map((child) => {
                        const childActive = location.pathname === child.path;
                        const ChildIcon = child.icon;
                        return (
                          <button
                            key={child.key}
                            type="button"
                            onClick={() => navigateTo(child.path)}
                            aria-current={childActive ? "page" : undefined}
                            className={`group/sub flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] leading-snug transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--gf-green) ${
                              childActive
                                ? "bg-white font-semibold text-(--gf-green-dark) shadow-2xs ring-1 ring-inset ring-(--gf-green-border)"
                                : "font-medium text-(--gf-slate) hover:bg-white hover:text-(--gf-ink) hover:shadow-2xs"
                            }`}
                          >
                            {ChildIcon ? (
                              <ChildIcon
                                size={13}
                                strokeWidth={1.9}
                                aria-hidden="true"
                                className={`shrink-0 transition-colors ${
                                  childActive
                                    ? "text-(--gf-green)"
                                    : "text-slate-400 group-hover/sub:text-(--gf-green)"
                                }`}
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                                  childActive
                                    ? "bg-(--gf-green)"
                                    : "bg-slate-300 group-hover/sub:bg-(--gf-green)"
                                }`}
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-2 right-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--gf-green) text-[9px] font-bold text-white">{initials}</span>
            {open && <span className="min-w-0 truncate text-xs font-semibold" title={displayName}>{displayName}</span>}
          </div>
          <button type="button" title="Log out" aria-label="Log out" onClick={() => setIsSignOutDialogOpen(true)} className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-300">
            <LogOut size={14} />{open && "Log out"}
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
