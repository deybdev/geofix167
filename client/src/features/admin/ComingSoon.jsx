import { ArrowLeft, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { PATHS } from "../../router/paths";

export default function ComingSoon({ title = "This module", description = "This admin module is being prepared." }) {
  return (
    <section className="mx-auto flex min-h-[min(62dvh,560px)] max-w-3xl items-center justify-center">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_12px_36px_rgba(15,23,42,0.06)] sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Clock3 size={22} />
        </div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">GeoFix 167 · Admin module</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
        <Link to={PATHS.admin} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </div>
    </section>
  );
}
