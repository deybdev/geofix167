import { ChevronDown, Menu } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ADMIN_NAVIGATION } from "../../router/adminNavigation";
import { PATHS } from "../../router/paths";

export default function AdminSidebar({ open = false, onClose, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeGroup = ADMIN_NAVIGATION.find(
    ({ path }) => path && path !== PATHS.admin && location.pathname.startsWith(path),
  )?.label;
  const [expansion, setExpansion] = useState({ pathname: location.pathname, label: activeGroup });
  const expandedGroup = expansion.pathname === location.pathname ? expansion.label : activeGroup;

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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[4px] border-(--gf-green) text-[10px] font-bold text-(--gf-green)" aria-label="GeoFix 167">G</div>
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
        <nav className="max-h-[calc(100dvh-142px)] space-y-1 overflow-y-auto pr-0.5">
          {ADMIN_NAVIGATION.map(({ label, icon: Icon, path, children, section, comingSoon }) => {
            const active = path && (path === PATHS.admin ? location.pathname === path : location.pathname.startsWith(path));
            const expanded = expandedGroup === label;
            return (
              <div key={label}>
                {section && open && (
                  <div className="mb-2 mt-4 px-3 text-[9px] font-semibold tracking-[0.08em] text-slate-400 first:mt-0">
                    {section}
                  </div>
                )}
                <button
                  type="button"
                  title={comingSoon ? `${label} · Coming soon` : open ? undefined : label}
                  onClick={() => {
                    if (children) {
                      setExpansion({ pathname: location.pathname, label: expanded ? null : label });
                      if (path) navigate(path);
                    } else if (path) {
                      navigateTo(path);
                    }
                  }}
                  aria-expanded={children ? expanded : undefined}
                  className={`group relative flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] font-medium transition-colors ${
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
                    <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] text-white shadow-lg group-hover:md:block">
                      {comingSoon ? `${label} · Coming soon` : label}
                    </span>
                  )}
                  {open && <span aria-hidden="true" className="ml-auto flex w-[68px] shrink-0 items-center justify-end gap-1.5">
                    {comingSoon && <span className="rounded-full bg-amber-50 px-1.5 py-1 text-center text-[7px] font-semibold leading-none text-amber-700">Coming soon</span>}
                    {children && <ChevronDown size={13} className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />}
                  </span>}
                </button>
                {children && expanded && open && (
                  <div className="ml-5 border-l border-(--gf-green-border) py-1 pl-2">
                    {children.map((child) => {
                      const childLabel = typeof child === "string" ? child : child.label;
                      const childPath = typeof child === "string" ? path : `${path}?queue=${child.queue}`;
                      return (
                      <button
                        key={childLabel}
                        type="button"
                        onClick={() => navigateTo(childPath)}
                        className="block w-full rounded px-2 py-1.5 text-left text-[9px] leading-tight text-slate-500 hover:bg-(--gf-green-soft) hover:text-(--gf-green)"
                      >
                        {childLabel}
                      </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className={`absolute bottom-4 flex items-center gap-2 rounded-xl border border-[#e5eaed] bg-[#f8fafb] p-2 ${open ? "left-3 right-3" : "left-2 right-2 md:justify-center"}`}>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--gf-green) text-[9px] font-bold text-white">
            BA
          </div>
          <div className={`min-w-0 text-[9px] ${open ? "" : "md:hidden"}`}>
            <strong className="block truncate">Barangay Administrator</strong>
            <span className="text-[8px] text-slate-400">
              Authorized Account
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
