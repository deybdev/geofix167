import { AlertTriangle, ArrowLeft, Clock3 } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { setResponderMeta } from "./responderMeta";

export default function ReassignmentPending() {
  useEffect(() => {
    setResponderMeta("Reassignment Pending", "Track the administrator review while a replacement responder or team is selected.");
  }, []);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3"><Link to="/responder/unavailability-submitted" aria-label="Back to unavailability submitted" className="shrink-0 text-primary"><ArrowLeft size={38} /></Link><h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Reassignment Pending</h1></div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16">R</span>
      </header>
      <main className="space-y-4 px-4 py-5 sm:px-7 sm:py-6">
        <p className="text-base text-slate-500">GF-018 <span aria-hidden="true">•</span> Reassignment pending</p>
        <section className="rounded-2xl bg-[#fff1c8] p-5 text-[#a66a00] sm:p-7"><div className="flex items-center gap-3"><Clock3 size={28} /><h2 className="text-2xl font-bold">Awaiting reassignment</h2></div><p className="mt-4 text-base leading-6 text-slate-800">Administrator review pending. No replacement responder or team confirmed.</p></section>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="font-bold text-primary">Report ID: GF-018</p><span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 font-bold text-[#a66a00]">Unavailable</span><p className="mt-4 text-lg">Assignment: Awaiting Reassignment</p></section>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold text-primary">Reassignment status</h2><p className="mt-4 text-lg font-bold">Review pending</p><p className="mt-2 text-base text-slate-500">Notice: April 23, 2026 <span aria-hidden="true">•</span> 10:17 AM<br />Reason: Equipment unavailable</p><p className="mt-4 text-base">Original responder: Unavailable<br />Original team: Traffic/Road Response Team A</p><p className="mt-4 font-bold">Replacement: Not yet confirmed</p><p className="mt-2 text-base text-slate-500">Dispatch: Not Confirmed</p></section>
        <div className="flex gap-3 rounded-2xl bg-[#fff1c8] px-4 py-4 text-sm leading-5 text-[#a66a00]"><AlertTriangle className="shrink-0" size={22} /><p>Wait for administrator-confirmed reassignment. Route access and response updates are unavailable while you are marked unavailable.</p></div>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-primary">What happens next</h2><p className="mt-2 text-base leading-6">An administrator selects an available responder or team. Check Updates for reassignment.</p></section>
        <Link to="/responder/reassignment-confirmed" className="flex min-h-16 items-center justify-center rounded-2xl bg-primary px-4 text-lg font-bold text-white">View Reassignment Confirmation</Link>
        <Link to="/responder" className="block text-center text-sm text-slate-500">Back to Assignments</Link>
      </main>
    </div>
  );
}
