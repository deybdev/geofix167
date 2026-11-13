import { ArrowLeft, Bell } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { setResponderMeta } from "./responderMeta";

const cardClass =
  "rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6";

export default function NewDispatchNotif() {
  useEffect(() => {
    setResponderMeta("Dispatch Assignment", "Review the latest responder dispatch, assignment details, and estimated arrival information.");
  }, []);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link to="/responder" aria-label="Back to assignments" className="text-primary">
            <ArrowLeft size={38} strokeWidth={1.8} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Dispatch Assignment</h1>
          </div>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16 sm:text-2xl">R</span>
      </header>

      <main className="space-y-4 px-4 py-5 sm:space-y-5 sm:px-7 sm:py-6">
        <section className="rounded-2xl bg-[#e2f2eb] p-5 text-primary sm:p-6">
          <div className="flex items-center gap-3">
            <Bell size={28} strokeWidth={2.2} />
            <h2 className="text-xl font-bold sm:text-2xl">New dispatch assignment</h2>
          </div>
          <p className="mt-2 text-base">Review the latest assignment before confirming receipt.</p>
        </section>

        <section className={cardClass}>
          <div className="flex items-start justify-between gap-4">
            <p className="font-bold text-primary sm:text-lg">Report ID: GF-018</p>
            <span className="rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">
              Urgent
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold leading-tight sm:text-2xl">Road obstruction on Mabini Street</h2>
          <p className="mt-3 text-base leading-6 text-slate-500">
            Incident / Emergency <span aria-hidden="true">•</span> Road obstruction <span aria-hidden="true">•</span> Barangay 167
          </p>
          <div className="mt-3 flex items-center gap-3 text-base text-slate-500">
            <span>Status</span>
            <span className="rounded-lg bg-[#e2f2eb] px-3 py-2 font-bold text-primary">
              Dispatched
            </span>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-xl font-bold text-primary">Assignment</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assigned department</dt>
              <dd className="mt-1 text-base font-medium">Traffic/Road Response</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wide text-slate-500">Team</dt>
              <dd className="mt-1 text-lg font-bold">Traffic/Road Response Team A</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm font-medium text-primary">Acknowledgment pending</p>
        </section>

        <section className={cardClass}>
          <h2 className="text-xl font-bold text-primary">Location</h2>
          <p className="mt-2 text-lg font-bold">Mabini Street, Barangay 167</p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Distance</p>
              <p className="mt-2 text-base font-bold">1.2 km away</p>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Estimated arrival</p>
              <p className="mt-2 text-base font-bold">ETA: 5 min</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">Estimated arrival time may change.</p>
        </section>

        <Link
          to="/responder/assignment"
          className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-primary px-4 text-lg font-bold text-white shadow-sm"
        >
          View Assignment
        </Link>
      </main>
    </div>
  );
}
