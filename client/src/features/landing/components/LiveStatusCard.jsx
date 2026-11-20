import { ArrowUpRight, CheckCircle2, MapPin, Radio, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { PATHS } from "../../../router/paths";
import { BRAND } from "../data/landingData";

const metrics = [
  { value: "24/7", label: "Dispatch", icon: Radio },
  { value: "3", label: "Units ready", icon: Users },
  { value: "QR", label: "Verified", icon: ShieldCheck },
];

export default function LiveStatusCard() {
  return <aside className="landing-live-card" aria-label="Live barangay status">
    <div className="flex items-center justify-between border-b border-white/15 pb-4"><div><p className="landing-eyebrow text-emerald-200">Live community status</p><h2 className="mt-1 text-xl font-semibold text-white">{BRAND.area} operations</h2></div><span className="landing-live-dot"><i />Online</span></div>
    <div className="grid grid-cols-3 divide-x divide-white/15 py-5">{metrics.map(({ value, label, icon: Icon }) => <div key={label} className="px-3 first:pl-0"><Icon size={16} className="mb-3 text-[#f2b705]"/><strong className="block text-2xl text-white">{value}</strong><span className="text-[10px] uppercase tracking-wider text-emerald-100/70">{label}</span></div>)}</div>
    <div className="border-t border-white/15 pt-4"><div className="flex items-start gap-3"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#f2b705]"/><div><p className="text-sm font-semibold text-white">Latest verified response</p><p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-100/75"><MapPin size={12}/>Drainage clearing · Molave St.</p></div></div></div>
    <Link to={PATHS.publicMap} className="mt-5 flex items-center justify-between border-t border-white/15 pt-4 text-xs font-bold uppercase tracking-wider text-white hover:text-[#f2b705]">Open live map <ArrowUpRight size={16}/></Link>
  </aside>;
}
