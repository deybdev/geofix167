import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Menu, RefreshCw, Search, X } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "../router/paths";
import BdrrmoSidebar from "../shared/components/BdrrmoSidebar";
import { toast } from "../shared/components/ui/toast";
import ConfirmationDialog from "../shared/components/ConfirmationDialog";
import BdrrmoNotifications from "../shared/components/BdrrmoNotifications";
import Tooltip from "../shared/components/Tooltip";
import { BdrrmoDemoProvider, useBdrrmoDemo } from "../features/bdrrmo/BdrrmoDemoContext";

const titles = { [PATHS.bdrrmo]: "Emergency Operations Dashboard", [PATHS.bdrrmoIncidents]: "Incidents", [PATHS.bdrrmoDispatchResponders]: "Responders", [PATHS.bdrrmoHandoverCompletion]: "Hospital Handovers", [PATHS.bdrrmoReportsAnalytics]: "Reports & Analytics", [PATHS.bdrrmoSettings]: "Profile & Settings" };

export default function BdrrmoLayout(){return <BdrrmoDemoProvider><BdrrmoShell/></BdrrmoDemoProvider>}
function BdrrmoShell() {
  const { user, signOut } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  const [logoutOpen,setLogoutOpen]=useState(false);
  const {sync,refresh,assignments,incidents}=useBdrrmoDemo();
  const [alertMinimized, setAlertMinimized] = useState(false);
  const prevEmergencyCountRef = useRef(0);
  const pendingEmergencies = useMemo(
    () => (incidents || []).filter((inc) => inc.incidentStatusCode === "FORWARDED_TO_BDRRMO" && !(inc.dispatchedUnits?.length > 0)),
    [incidents]
  );
  useEffect(() => {
    if (pendingEmergencies.length > prevEmergencyCountRef.current) {
      setAlertMinimized(false);
    }
    prevEmergencyCountRef.current = pendingEmergencies.length;
  }, [pendingEmergencies.length]);
  const activeDeploymentsCount = assignments.filter((a) => !["COMPLETED","CANCELLED","DECLINED"].includes(a.statusCode)).length;
  useEffect(()=>{const interval=window.setInterval(()=>{if(document.visibilityState==="visible")refresh()},60_000);return()=>window.clearInterval(interval)},[refresh]);
  async function logout(){try{await signOut();navigate(PATHS.login,{replace:true})}catch{toast.add({type:"error",title:"Logout failed",description:"Please try again."})}}
  const name = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "BDRRMO Officer";
  return <div className="min-h-screen bg-[#f6f8f9] text-slate-800"><BdrrmoSidebar open={open} officerName={name} onSignOut={()=>setLogoutOpen(true)} onToggle={() => setOpen(v => !v)} onClose={() => { if (window.matchMedia("(max-width: 767px)").matches) setOpen(false); }} counts={{ [PATHS.bdrrmoDispatchResponders]: activeDeploymentsCount }} /><div className={`transition-[margin] duration-300 motion-reduce:transition-none ${open ? "md:ml-[260px]" : "md:ml-[76px]"}`}>
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6"><div className="flex min-w-0 items-center gap-3"><button className="rounded-lg border border-slate-200 p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={18} /></button><div className="min-w-0"><h1 className="truncate text-sm font-bold text-emerald-900 sm:text-base">{titles[location.pathname] || "BDRRMO Operations"}</h1><p className="hidden text-[10px] text-slate-500 sm:block">Barangay 167 emergency command workspace</p></div></div>
    <div className="flex items-center gap-2"><div className="hidden items-center gap-2 text-[9px] text-slate-500 xl:flex">{sync.state==="syncing"?<RefreshCw size={12} className="animate-spin"/>:<CheckCircle2 size={12} className="text-emerald-700"/>}<span>{sync.state==="syncing"?"Syncing…":`Updated ${sync.lastUpdated}`}</span><Tooltip label="Refresh" placement="bottom"><button onClick={refresh} disabled={sync.state==="syncing"} className="rounded-lg border p-2 disabled:opacity-50" aria-label="Refresh records"><RefreshCw size={14}/></button></Tooltip></div><form onSubmit={(event) => { event.preventDefault(); navigate(PATHS.bdrrmoIncidents); }} className="hidden h-9 w-52 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-400 lg:flex"><Search size={14} /><input aria-label="Search incidents" className="w-full outline-none" placeholder="Search incidents..." /></form><BdrrmoNotifications onOpenIncident={(incidentId)=>navigate(`${PATHS.bdrrmoIncidents}?incident=${encodeURIComponent(incidentId)}&highlight=1`)}/></div></header>
    <main className="p-4 md:p-6"><div key={location.pathname} className="animate-[bdrrmo-enter_180ms_ease-out] motion-reduce:animate-none"><Outlet /></div></main></div>
    <ConfirmationDialog open={logoutOpen} onOpenChange={setLogoutOpen} onConfirm={logout} title="Sign out?" description="End your current BDRRMO dashboard session?" confirmLabel="Sign out" confirmVariant="destructive"/>
    {pendingEmergencies.length > 0 && (
      <aside
        aria-live="assertive"
        className="fixed bottom-5 right-5 z-40 max-w-[calc(100vw-2rem)]"
      >
        {alertMinimized ? (
          <button
            type="button"
            onClick={() => setAlertMinimized(false)}
            className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg ring-4 ring-red-600/25 transition hover:bg-red-700"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            <AlertTriangle size={14} />
            <span>
              {pendingEmergencies.length} Active {pendingEmergencies.length === 1 ? "Emergency" : "Emergencies"}
            </span>
          </button>
        ) : (
          <div className="w-80 overflow-hidden rounded-xl border border-red-200 bg-white shadow-2xl ring-2 ring-red-500/20">
            <div className="flex items-center justify-between bg-red-600 px-3.5 py-2.5 text-white">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                <AlertTriangle size={15} />
                <span className="text-xs font-bold tracking-wide">
                  {pendingEmergencies.length} {pendingEmergencies.length === 1 ? "EMERGENCY ALERT" : "EMERGENCY ALERTS"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAlertMinimized(true)}
                aria-label="Minimize emergency alert"
                className="rounded p-1 text-white/80 hover:bg-white/15 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
              {pendingEmergencies.slice(0, 3).map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => navigate(`${PATHS.bdrrmoIncidents}?incident=${encodeURIComponent(inc.id)}&highlight=1`)}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition hover:bg-red-50/70"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-red-700">{inc.id}</span>
                      <span className="truncate rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                        {inc.category || "Emergency"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-slate-700">
                      {inc.location || "Barangay 167"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Awaiting dispatch • {inc.elapsed || "Just now"}
                    </p>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-red-500" />
                </button>
              ))}
            </div>
            {pendingEmergencies.length > 3 && (
              <button
                type="button"
                onClick={() => navigate(PATHS.bdrrmoIncidents)}
                className="w-full border-t border-slate-100 bg-slate-50 py-2 text-center text-[11px] font-semibold text-red-700 hover:bg-red-50"
              >
                View all {pendingEmergencies.length} pending emergencies
              </button>
            )}
          </div>
        )}
      </aside>
    )}
  </div>;
}
