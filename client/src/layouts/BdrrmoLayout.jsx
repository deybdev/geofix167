import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Menu, RefreshCw, Search } from "lucide-react";
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
  const [notificationsOpen,setNotificationsOpen]=useState(false);const {unreadCount,sync,refresh,assignments}=useBdrrmoDemo();
  const activeDeploymentsCount = assignments.filter((a) => !["COMPLETED","CANCELLED","DECLINED"].includes(a.statusCode)).length;
  useEffect(()=>{const interval=window.setInterval(()=>{if(document.visibilityState==="visible")refresh()},60_000);return()=>window.clearInterval(interval)},[refresh]);
  async function logout(){try{await signOut();navigate(PATHS.login,{replace:true})}catch{toast.add({type:"error",title:"Logout failed",description:"Please try again."})}}
  const name = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "BDRRMO Officer";
  return <div className="min-h-screen bg-[#f6f8f9] text-slate-800"><BdrrmoSidebar open={open} officerName={name} onSignOut={()=>setLogoutOpen(true)} onToggle={() => setOpen(v => !v)} onClose={() => { if (window.matchMedia("(max-width: 767px)").matches) setOpen(false); }} counts={{ [PATHS.bdrrmoDispatchResponders]: activeDeploymentsCount }} /><div className={`transition-[margin] duration-300 motion-reduce:transition-none ${open ? "md:ml-[260px]" : "md:ml-[76px]"}`}>
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6"><div className="flex min-w-0 items-center gap-3"><button className="rounded-lg border border-slate-200 p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={18} /></button><div className="min-w-0"><h1 className="truncate text-sm font-bold text-emerald-900 sm:text-base">{titles[location.pathname] || "BDRRMO Operations"}</h1><p className="hidden text-[10px] text-slate-500 sm:block">Barangay 167 emergency command workspace</p></div><span className="rounded bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-800">DEMO DATA</span></div>
    <div className="flex items-center gap-2"><div className="hidden items-center gap-2 text-[9px] text-slate-500 xl:flex">{sync.state==="syncing"?<RefreshCw size={12} className="animate-spin"/>:<CheckCircle2 size={12} className="text-emerald-700"/>}<span>{sync.state==="syncing"?"Syncing…":`Updated ${sync.lastUpdated}`}</span><Tooltip label="Refresh" placement="bottom"><button onClick={refresh} disabled={sync.state==="syncing"} className="rounded-lg border p-2 disabled:opacity-50" aria-label="Refresh records"><RefreshCw size={14}/></button></Tooltip></div><form onSubmit={(event) => { event.preventDefault(); navigate(PATHS.bdrrmoIncidents); }} className="hidden h-9 w-52 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-400 lg:flex"><Search size={14} /><input aria-label="Search incidents" className="w-full outline-none" placeholder="Search incidents..." /></form>{notificationsOpen?<button onClick={()=>setNotificationsOpen(false)} className="relative rounded-lg border border-slate-200 bg-emerald-50 p-2 text-emerald-800" aria-label="Close notifications"><Bell size={16}/>{unreadCount>0&&<span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[8px] font-bold text-white">{unreadCount}</span>}</button>:<Tooltip label="Notifications" placement="bottom"><button onClick={()=>setNotificationsOpen(true)} className="relative rounded-lg border border-slate-200 p-2 text-emerald-800" aria-label="Open notifications"><Bell size={16}/>{unreadCount>0&&<span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[8px] font-bold text-white">{unreadCount}</span>}</button></Tooltip>}</div></header>
    <main className="p-4 md:p-6"><div key={location.pathname} className="animate-[bdrrmo-enter_180ms_ease-out] motion-reduce:animate-none"><Outlet /></div></main></div>
    <ConfirmationDialog open={logoutOpen} onOpenChange={setLogoutOpen} onConfirm={logout} title="Sign out?" description="End your current BDRRMO dashboard session?" confirmLabel="Sign out" confirmVariant="destructive"/>
    <BdrrmoNotifications open={notificationsOpen} onClose={()=>setNotificationsOpen(false)} onOpenIncident={(incidentId)=>navigate(`${PATHS.bdrrmoIncidents}?incident=${encodeURIComponent(incidentId)}&highlight=1`)}/>
  </div>;
}
