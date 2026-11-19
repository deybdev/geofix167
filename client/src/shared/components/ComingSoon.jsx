import { ArrowRight, Clock3 } from "lucide-react";

export default function ComingSoon({ title, description }) {
  return (
    <section className="mx-auto flex min-h-[320px] max-w-3xl flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
        <Clock3 size={21} />
      </span>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">Coming soon</p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">{description}</p>
      <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <span>Workflow in preparation</span><ArrowRight size={13} />
      </div>
    </section>
  );
}
