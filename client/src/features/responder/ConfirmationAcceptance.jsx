import {
  ArrowLeft,
  Check,
  Circle,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";

const cardClass =
  "rounded-[22px] border-2 border-slate-200 bg-white px-6 py-6";

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
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-7 pb-5 pt-9">
        <div className="flex items-center gap-5">
          <Link to="/responder/acceptance" aria-label="Back to acceptance" className="text-primary">
            <ArrowLeft size={45} strokeWidth={1.8} />
          </Link>
          <h1 className="text-[30px] font-bold tracking-tight text-primary">
            Acceptance Confirmation
          </h1>
        </div>
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
          R
        </span>
      </header>

      <main className="space-y-4 px-7 py-6 pb-10">
        <section className="rounded-[20px] bg-[#e2f2eb] px-8 py-8 text-primary">
          <div className="flex items-center gap-5">
            <Check size={34} strokeWidth={3} />
            <h2 className="text-[30px] font-bold">Assignment accepted</h2>
          </div>
          <p className="mt-5 text-[22px] leading-8 text-slate-800">
            Availability confirmed. Wait for administrator dispatch confirmation.
          </p>
        </section>

        <section className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[25px] font-bold text-primary">Report ID: GF-018</p>
            <span className="rounded-xl bg-[#fff1c8] px-4 py-2 text-[20px] font-bold text-[#a66a00]">
              Urgent
            </span>
          </div>
          <h2 className="mt-5 text-[31px] font-bold leading-tight">
            Road obstruction on Mabini Street
          </h2>
          <p className="mt-4 text-[22px] text-slate-500">Category: Accident / Road obstruction</p>
          <span className="mt-4 inline-flex rounded-xl bg-[#e2f2eb] px-4 py-2 text-[20px] font-bold text-primary">
            Accepted
          </span>
        </section>

        <section className={cardClass}>
          <h2 className="text-[27px] font-bold text-primary">Acceptance record</h2>
          <p className="mt-5 text-[23px]">Department: Traffic/Road Response</p>
          <p className="mt-4 text-[25px] font-bold">Traffic/Road Response Team A</p>
          <p className="mt-5 text-[21px] text-slate-500">Accepted April 23, 2026 • 10:17 AM</p>
          <p className="mt-3 text-[21px] text-slate-500">Offered April 23, 2026 • 10:15 AM</p>
        </section>

        <section className={cardClass}>
          <h2 className="text-[27px] font-bold text-primary">Assignment progress</h2>
          <div className="mt-6 flex">
            <ProgressStep complete label="Accepted" detail="Confirmed" />
            <ProgressStep label="Dispatched" detail="Pending" />
            <ProgressStep label="En Route" detail="Pending" />
          </div>
          <p className="mt-7 text-[22px] leading-7">
            Dispatch: Awaiting administrator confirmation
            <br />
            En Route: Not started
          </p>
        </section>

        <div className="flex gap-4 rounded-[16px] bg-[#e2f2eb] px-5 py-5 text-[20px] leading-7 text-primary">
          <Info size={30} className="mt-0.5 shrink-0" />
          <p>Do not depart before dispatch is confirmed. Record an authorized departure update as Responding / En Route.</p>
        </div>

        <Link
          to="/responder/assignment"
          className="flex h-[86px] w-full items-center justify-center rounded-[18px] bg-primary text-[27px] font-bold text-white"
        >
          View Assignment
        </Link>
      </main>
    </div>
  );
}
