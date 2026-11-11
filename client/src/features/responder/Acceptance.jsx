import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const cardClass =
  "rounded-[22px] border-2 border-slate-200 bg-white px-6 py-5";

export default function Acceptance() {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-7 pb-5 pt-9">
        <div className="flex items-center gap-5">
          <Link to="/responder/assignment-offer" aria-label="Back to assignment offer" className="text-primary">
            <ArrowLeft size={45} strokeWidth={1.8} />
          </Link>
          <h1 className="text-[30px] font-bold tracking-tight text-primary">Assignment Decision</h1>
        </div>
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">R</span>
      </header>

      <main className="space-y-4 px-7 py-6">
        <p className="text-[21px] text-slate-500">GF-018 • Acceptance pending</p>
        <h2 className="text-[30px] font-bold">Confirm your availability?</h2>
        <p className="text-[21px]">Confirm your team&apos;s availability for this assignment.</p>

        <section className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[25px] font-bold text-primary">Report ID: GF-018</p>
            <span className="rounded-xl bg-[#fff1c8] px-4 py-2 text-[20px] font-bold text-[#a66a00]">Urgent</span>
          </div>
          <h3 className="mt-4 text-[31px] font-bold leading-tight">Road obstruction on Mabini Street</h3>
          <p className="mt-3 text-[21px] text-slate-500">Category: Accident / Road obstruction</p>
          <span className="mt-3 inline-flex rounded-xl bg-[#e2f2eb] px-4 py-2 text-[20px] font-bold text-primary">Awaiting Acceptance</span>
        </section>

        <section className={cardClass}>
          <h3 className="text-[26px] font-bold text-primary">Assignment offer</h3>
          <p className="mt-3 text-[22px]">Department: Traffic/Road Response</p>
          <p className="mt-3 text-[24px] font-bold">Traffic/Road Response Team A</p>
          <p className="mt-3 text-[20px] leading-6 text-slate-500">Assigned by Admin Moreno<br />April 23, 2026 • 10:15 AM</p>
        </section>

        <section className={cardClass}>
          <h3 className="text-[26px] font-bold text-primary">Incident location</h3>
          <p className="mt-3 text-[22px]">Mabini Street, Barangay 167</p>
        </section>

        <div className="flex gap-3 rounded-[16px] bg-[#fff1c8] px-5 py-4 text-[19px] leading-6 text-[#a66a00]">
          <AlertTriangle size={25} className="mt-0.5 shrink-0" />
          <p>Dispatch not confirmed. Acceptance is not dispatch or departure. Wait for administrator dispatch confirmation.</p>
        </div>

        <Link to="/responder/confirmation" className="flex h-[84px] items-center justify-center rounded-[18px] bg-primary text-[27px] font-bold text-white">
          Confirm Acceptance
        </Link>
      </main>
    </div>
  );
}
