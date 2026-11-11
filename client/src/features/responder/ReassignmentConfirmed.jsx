import { ArrowLeft, Check, Info } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { setResponderMeta } from "./responderMeta";

export default function ReassignmentConfirmed() {
  useEffect(() => {
    setResponderMeta("Reassignment Confirmed", "Review the confirmed reassignment and the replacement team's dispatch status.");
  }, []);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3"><Link to="/responder/reassignment-pending" aria-label="Back to reassignment pending" className="shrink-0 text-primary"><ArrowLeft size={38} /></Link><h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Reassignment Confirmed</h1></div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16">R</span>
      </header>
      <main className="space-y-4 px-4 py-5 sm:px-7 sm:py-6">
        <p className="text-base text-slate-500">GF-018 <span aria-hidden="true">•</span> Reassigned</p>
        <section className="rounded-2xl bg-[#e2f2eb] p-5 text-primary sm:p-7"><div className="flex items-center gap-3"><Check size={28} strokeWidth={3} /><h2 className="text-2xl font-bold">Reassignment confirmed</h2></div><p className="mt-4 text-base leading-6 text-slate-800">Admin Moreno reassigned this report to another available team. You are no longer assigned.</p></section>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm"><p className="font-bold text-primary">Report ID: GF-018</p><span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 font-bold text-primary">Reassigned</span><p className="mt-3 text-base text-slate-500">Confirmed April 23, 2026 <span aria-hidden="true">•</span> 10:24 AM</p></section>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold text-primary">Administrator-confirmed assignment</h2><p className="mt-3 text-base">Receiving department: Traffic/Road Response</p><p className="mt-3 text-lg font-bold">Traffic/Road Response Team B</p><p className="mt-3 text-base text-slate-500">Available team selected by Admin Moreno<br />Assigned April 23, 2026 <span aria-hidden="true">•</span> 10:24 AM</p><p className="mt-4 text-base">Replacement assignment status</p><span className="mt-2 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 font-bold text-[#a66a00]">Awaiting Acceptance</span><p className="mt-3 text-base">Dispatch: Not Confirmed</p></section>
        <div className="flex gap-3 rounded-2xl bg-[#e2f2eb] px-4 py-4 text-sm leading-5 text-primary"><Info className="shrink-0" size={22} /><p>The new team must accept the assignment before dispatch is confirmed.</p></div>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-primary">Your access to this report</h2><p className="mt-2 text-base leading-6">You can still view the incident details, acceptance, response updates, and routes access for this report.</p></section>
        <Link to="/responder" className="flex min-h-16 items-center justify-center rounded-2xl bg-primary px-4 text-lg font-bold text-white">Back to Assignments</Link>
      </main>
    </div>
  );
}
