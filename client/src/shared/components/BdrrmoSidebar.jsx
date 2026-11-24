import { BarChart3, ClipboardList, Grid2X2, Handshake, LogOut, Menu, Radio, Settings, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";

const items = [
  ["Dashboard", Grid2X2, PATHS.bdrrmo],
  ["Incidents", ClipboardList, PATHS.bdrrmoIncidents],
  ["Responders", Radio, PATHS.bdrrmoDispatchResponders],
  ["Hospital Handovers", Handshake, PATHS.bdrrmoHandoverCompletion],
  ["Reports & Analytics", BarChart3, PATHS.bdrrmoReportsAnalytics],
  ["Profile & Settings", Settings, PATHS.bdrrmoSettings],
];

export default function BdrrmoSidebar({ open, onClose, onToggle, officerName = "BDRRMO Officer", onSignOut, counts = {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-20 bg-slate-950/30 backdrop-blur-[1px] md:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-30 border-r border-slate-200 bg-white px-3 py-4 shadow-xl transition-[width,transform] duration-300 motion-reduce:transition-none ${open ? "w-[260px] translate-x-0" : "w-[76px] -translate-x-full md:translate-x-0"}`}>
        <div className={`mb-6 flex items-center ${open ? "justify-between px-2" : "flex-col gap-3"}`}>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-800 text-xs font-black text-white">G167</span>
            {open && <div><strong className="block text-sm text-emerald-900">BDRRMO</strong><span className="text-[10px] text-slate-500">Emergency Operations</span></div>}
          </div>
          <button onClick={onToggle} aria-label={open ? "Collapse navigation" : "Expand navigation"} className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-800">{open ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
        <nav className="max-h-[calc(100dvh-230px)] space-y-1 overflow-y-auto" aria-label="BDRRMO navigation">
          {items.map(([label, Icon, path]) => {
            const active = path === PATHS.bdrrmo ? location.pathname === path : location.pathname.startsWith(path);
            const count = counts[path];
            const showCount = typeof count === "number" ? count > 0 : Boolean(count);
            return (
              <button key={path} title={!open ? label : undefined} onClick={() => { navigate(path); onClose?.(); }} className={`group relative flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-semibold transition-colors ${!open ? "justify-center" : ""} ${active ? "bg-emerald-800 text-white" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"}`}>
                <Icon size={17} />
                <span className={open ? "flex-1" : "hidden"}>{label}</span>
                {open && showCount && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${active ? "bg-white/20" : "bg-red-100 text-red-700"}`}>{count}</span>}
                {!open && <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:md:block">{label}</span>}
              </button>
            );
          })}
        </nav>
        <div className={`absolute bottom-3 left-3 right-3 border-t border-slate-200 pt-3 ${open ? "" : "flex flex-col items-center"}`}>
          <button onClick={() => navigate(PATHS.bdrrmoSettings)} className={`flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-emerald-50 ${open ? "" : "justify-center"}`} title={open ? undefined : officerName}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-[10px] font-bold text-white">BD</span>
            {open && <span className="min-w-0"><strong className="block truncate text-xs">{officerName}</strong><small className="text-[9px] text-slate-500">BDRRMO Operations</small></span>}
          </button>
          <button onClick={onSignOut} className={`mt-1 flex w-full items-center gap-2 rounded-lg p-2 text-xs font-bold text-red-700 hover:bg-red-50 ${open ? "" : "justify-center"}`} title={open ? undefined : "Sign out"}><LogOut size={16} />{open && "Sign out"}</button>
        </div>
      </aside>
    </>
  );
}
