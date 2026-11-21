import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { setResponderMeta } from "./responderMeta";

const cardClass =
  "rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6";

export default function AssignmentOffer() {
  useEffect(() => {
    setResponderMeta(
      "Assignment Offer",
      "Review the assignment details, location, and response options before accepting or requesting reassignment.",
    );
  }, []);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link to="/responder/assignment" aria-label="Back to responder assignment" className="shrink-0 text-primary">
            <ArrowLeft size={38} strokeWidth={1.8} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Assignment Offer</h1>
          </div>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16 sm:text-2xl">R</span>
      </header>

      <main className="space-y-4 px-4 py-5 sm:space-y-5 sm:px-7 sm:py-6">
        <div>
          <p className="text-base text-slate-500">GF-018 <span aria-hidden="true">•</span> New assignment</p>
          <p className="mt-1 text-sm leading-5 text-slate-500">Review the offer carefully before confirming availability.</p>
        </div>

        <section className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-primary sm:text-lg">Report ID: GF-018</p>
            <span className="rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Urgent</span>
          </div>
          <h2 className="mt-3 text-xl font-bold leading-tight sm:text-2xl">Road obstruction on Mabini Street</h2>
          <p className="mt-3 text-base leading-6 text-slate-500">Category: Accident <span aria-hidden="true">•</span> Road obstruction</p>
          <span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-sm font-bold text-primary">Awaiting Acceptance</span>
        </section>

        <section className={cardClass}>
          <h2 className="text-xl font-bold text-primary">Assignment</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wide text-slate-500">Department</dt>
              <dd className="mt-1 text-base font-medium">Traffic/Road Response</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assigned team</dt>
              <dd className="mt-1 text-lg font-bold">Traffic/Road Response Team A</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-5 text-slate-500">Assigned by Admin Moreno<br />April 23, 2026 <span aria-hidden="true">•</span> 10:15 AM</p>
        </section>

        <section className={cardClass}>
          <h2 className="text-xl font-bold text-primary">Location and incident summary</h2>
          <p className="mt-3 text-lg font-bold">Mabini Street, Barangay 167</p>
          <p className="mt-3 text-base leading-6">A stalled delivery vehicle and debris block one lane. Traffic control and road clearance requested.</p>
        </section>

        <div className="flex gap-3 rounded-2xl bg-[#fff1c8] px-4 py-4 text-sm leading-5 text-[#a66a00]">
          <AlertTriangle size={22} className="mt-0.5 shrink-0" />
          <p><strong>Dispatch not confirmed.</strong> Review the offer and confirm availability. Do not depart.</p>
        </div>

        <Link to="/responder/acceptance" className="flex min-h-16 items-center justify-center rounded-2xl bg-primary px-4 text-lg font-bold text-white shadow-sm transition hover:shadow-md">
          Accept Assignment
        </Link>
        <Link to="/responder/mark-unavailable" className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-bold text-primary transition hover:border-primary">
          Mark Unavailable
        </Link>
      </main>
    </div>
  );
}
