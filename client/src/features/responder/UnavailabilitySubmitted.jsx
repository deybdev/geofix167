import { AlertTriangle, ArrowLeft, Check } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { setResponderMeta } from "./responderMeta";

export default function UnavailabilitySubmitted() {
  useEffect(() => {
    setResponderMeta("Unavailability Submitted", "Your unavailability notice was submitted and is waiting for administrator reassignment review.");
  }, []);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/responder/assignment-offer" aria-label="Back to assignment offer" className="shrink-0 text-primary"><ArrowLeft size={38} /></Link>
          <h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Unavailability Submitted</h1>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16">R</span>
      </header>
      <main className="space-y-4 px-4 py-5 sm:px-7 sm:py-6">
        <p className="text-base text-slate-500">GF-018 <span aria-hidden="true">•</span> Reassignment requested</p>
        <section className="rounded-2xl bg-[#e2f2eb] p-5 text-primary sm:p-7">
          <div className="flex items-center gap-3"><Check size={28} strokeWidth={3} /><h2 className="text-2xl font-bold">Reassignment review pending</h2></div>
          <p className="mt-4 text-base leading-6 text-slate-800">Unavailable for this assignment. Reassignment review pending.</p>
        </section>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="font-bold text-primary">Report ID: GF-018</p>
          <h2 className="mt-2 text-xl font-bold">Road obstruction on Mabini Street</h2>
          <span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 font-bold text-[#a66a00]">Unavailable</span>
          <p className="mt-3 text-lg font-bold">Awaiting Reassignment</p>
          <p className="mt-2 text-base text-slate-500">Submitted April 23, 2026 <span aria-hidden="true">•</span> 10:17 AM</p>
        </section>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold text-primary">Your notice</h2>
          <p className="mt-3 font-bold">Equipment unavailable</p>
          <p className="mt-2 text-base leading-6">Traffic-control equipment unavailable. Reassignment requested.</p>
          <p className="mt-3 text-base text-slate-500">Original offer: Traffic/Road Response Team A<br />April 23, 2026 <span aria-hidden="true">•</span> 10:15 AM</p>
        </section>
        <div className="flex gap-3 rounded-2xl bg-[#fff1c8] px-4 py-4 text-sm leading-5 text-[#a66a00]"><AlertTriangle className="shrink-0" size={22} /><p>Replacement not confirmed. An administrator must reassign the report. Do not depart.</p></div>
        <Link to="/responder/reassignment-pending" className="flex min-h-16 items-center justify-center rounded-2xl bg-primary px-4 text-lg font-bold text-white">View Reassignment Status</Link>
      </main>
    </div>
  );
}
