import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { setResponderMeta } from "./responderMeta";

const cardClass =
  "rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6";

export default function Acceptance() {
  useEffect(() => {
    setResponderMeta("Confirm Assignment", "Confirm your responder team's availability before dispatch is authorized.");
  }, []);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link to="/responder/assignment-offer" aria-label="Back to assignment offer" className="text-primary">
            <ArrowLeft size={38} strokeWidth={1.8} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responder dashboard</p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Confirm Assignment</h1>
          </div>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16 sm:text-2xl">R</span>
      </header>

      <main className="space-y-4 px-4 py-5 sm:space-y-5 sm:px-7 sm:py-6">
        <p className="text-base text-slate-500">GF-018 <span aria-hidden="true">•</span> Acceptance pending</p>
        <h2 className="text-2xl font-bold sm:text-3xl">Confirm your team&apos;s availability</h2>
        <p className="text-base leading-6">Confirm your team&apos;s availability for this assignment.</p>

        <section className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-primary sm:text-lg">Report ID: GF-018</p>
            <span className="rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Urgent</span>
          </div>
          <h3 className="mt-3 text-xl font-bold leading-tight sm:text-2xl">Road obstruction on Mabini Street</h3>
          <p className="mt-3 text-base text-slate-500">Category: Accident <span aria-hidden="true">•</span> Road obstruction</p>
          <span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-sm font-bold text-primary">Awaiting Acceptance</span>
        </section>

        <section className={cardClass}>
          <h3 className="text-xl font-bold text-primary">Assignment details</h3>
          <p className="mt-3 text-base">Department: Traffic/Road Response</p>
          <p className="mt-3 text-lg font-bold">Traffic/Road Response Team A</p>
          <p className="mt-3 text-sm leading-5 text-slate-500">Assigned by Admin Moreno<br />April 23, 2026 <span aria-hidden="true">•</span> 10:15 AM</p>
        </section>

        <section className={cardClass}>
          <h3 className="text-xl font-bold text-primary">Incident location</h3>
          <p className="mt-3 text-lg">Mabini Street, Barangay 167</p>
        </section>

        <div className="flex gap-3 rounded-2xl bg-[#fff1c8] px-4 py-4 text-sm leading-5 text-[#a66a00]">
          <AlertTriangle size={22} className="mt-0.5 shrink-0" />
          <p><strong>Dispatch not confirmed.</strong> Acceptance is not dispatch or departure. Wait for administrator confirmation.</p>
        </div>

        <Link to="/responder/confirmation" className="flex min-h-16 items-center justify-center rounded-2xl bg-primary px-4 text-lg font-bold text-white shadow-sm">
          Confirm Acceptance
        </Link>
      </main>
    </div>
  );
}
