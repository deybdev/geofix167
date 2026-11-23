import {
  ArrowLeft,
  Check,
  Circle,
  Info,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { setResponderMeta } from "./responderMeta";

const cardClass =
  "rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6";

function ProgressStep({ complete, label, detail }) {
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <div
        className={`flex size-12 items-center justify-center rounded-full ${
          complete
            ? "bg-primary text-white"
            : "border-2 border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        {complete ? <Check size={25} strokeWidth={3} /> : <Circle size={20} />}
      </div>
      <p className={`mt-3 text-[22px] font-bold ${complete ? "text-primary" : "text-slate-500"}`}>
        {label}
      </p>
      <p className="mt-1 text-[20px] text-slate-500">{detail}</p>
    </div>
  );
}

export default function ConfirmationAcceptance() {
  useEffect(() => {
    setResponderMeta("Assignment Accepted", "Your assignment acceptance is recorded and waiting for administrator dispatch confirmation.");
  }, []);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link to="/responder/acceptance" aria-label="Back to acceptance" className="text-primary">
            <ArrowLeft size={38} strokeWidth={1.8} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Assignment Accepted</h1>
          </div>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16 sm:text-2xl">R</span>
      </header>

      <main className="space-y-4 px-4 py-5 pb-10 sm:space-y-5 sm:px-7 sm:py-6">
        <section className="rounded-2xl bg-[#e2f2eb] p-5 text-primary sm:p-7">
          <div className="flex items-center gap-3">
            <Check size={28} strokeWidth={3} />
            <h2 className="text-2xl font-bold">Assignment accepted</h2>
          </div>
          <p className="mt-4 text-base leading-6 text-slate-800">
            Availability confirmed. Wait for administrator dispatch confirmation.
          </p>
        </section>

        <section className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-primary sm:text-lg">Report ID: GF-018</p>
            <span className="rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">
              Urgent
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold leading-tight sm:text-2xl">
            Road obstruction on Mabini Street
          </h2>
          <p className="mt-3 text-base text-slate-500">Category: Accident <span aria-hidden="true">•</span> Road obstruction</p>
          <span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-sm font-bold text-primary">
            Accepted
          </span>
        </section>

        <section className={cardClass}>
          <h2 className="text-xl font-bold text-primary">Acceptance record</h2>
          <p className="mt-4 text-base">Department: Traffic/Road Response</p>
          <p className="mt-3 text-lg font-bold">Traffic/Road Response Team A</p>
          <p className="mt-4 text-sm text-slate-500">Accepted April 23, 2026 <span aria-hidden="true">•</span> 10:17 AM</p>
          <p className="mt-2 text-sm text-slate-500">Offered April 23, 2026 <span aria-hidden="true">•</span> 10:15 AM</p>
        </section>

        <section className={cardClass}>
          <h2 className="text-xl font-bold text-primary">Assignment progress</h2>
          <div className="mt-5 flex">
            <ProgressStep complete label="Accepted" detail="Confirmed" />
            <ProgressStep label="Dispatched" detail="Pending" />
            <ProgressStep label="En Route" detail="Pending" />
          </div>
          <p className="mt-6 text-base leading-6">
            Dispatch: Awaiting administrator confirmation
            <br />
            En Route: Not started
          </p>
        </section>

        <div className="flex gap-3 rounded-2xl bg-[#e2f2eb] px-4 py-4 text-sm leading-5 text-primary">
          <Info size={22} className="mt-0.5 shrink-0" />
          <p>Do not depart before dispatch is confirmed. Record an authorized departure update as Responding / En Route.</p>
        </div>

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
