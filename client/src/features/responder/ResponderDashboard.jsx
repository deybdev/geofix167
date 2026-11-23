import { ArrowLeft, Bell, Check } from "lucide-react";
import { useState } from "react";

const cardClass =
  "rounded-[24px] border-2 border-slate-200 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.02)]";

export default function ResponderDashboard() {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-7 pb-5 pt-9">
        <div className="flex items-center gap-5">
          <button type="button" aria-label="Go back" className="text-primary">
            <ArrowLeft size={48} strokeWidth={1.8} />
          </button>
          <h1 className="text-[30px] font-bold tracking-tight text-primary">My Assignment</h1>
        </div>
        <button
          type="button"
          aria-label="Open profile"
          className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white"
        >
          R
        </button>
      </header>

      <div className="space-y-4 px-7 py-6">
        <section className="rounded-[20px] bg-[#e2f2eb] px-6 py-6 text-primary">
          <div className="flex items-center gap-4">
            <Bell size={34} strokeWidth={2.2} />
            <h2 className="text-[29px] font-bold">New dispatch assignment</h2>
          </div>
          <p className="mt-3 text-[22px]">Dispatch assignment details</p>
        </section>

        <section className={cardClass}>
          <div className="flex items-start justify-between gap-4">
            <p className="text-[25px] font-bold text-primary">GF-007</p>
            <span className="rounded-xl bg-[#fff1c8] px-4 py-2 text-[21px] font-bold text-[#a66a00]">
              Urgent
            </span>
          </div>
          <h2 className="mt-4 text-[31px] font-bold leading-tight">Fire on Rizal Street</h2>
          <p className="mt-5 text-[22px] text-slate-500">Incident / Emergency • Fire • Barangay 167</p>
          <div className="mt-5 flex items-center gap-4 text-[22px] text-slate-500">
            <span>Status</span>
            <span className="rounded-xl bg-[#e2f2eb] px-4 py-2 font-bold text-primary">
              {acknowledged ? "Acknowledged" : "Dispatched"}
            </span>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-[27px] font-bold text-primary">Assignment</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-[24px] font-bold text-slate-500">Assigned Department</dt>
              <dd className="mt-1 text-[27px] font-bold">Fire Response</dd>
            </div>
            <div>
              <dt className="text-[24px] font-bold text-slate-500">Team</dt>
              <dd className="mt-1 text-[27px] font-bold">Fire Response Team A</dd>
            </div>
          </dl>
          <p className="mt-5 text-[22px] text-primary">
            {acknowledged ? "Assignment acknowledged" : "Acknowledgment pending"}
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="text-[24px] font-bold text-slate-500">Incident Location</h2>
          <p className="mt-2 text-[27px] font-bold">Rizal Street, Barangay 167</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[23px] font-bold text-slate-500">Distance</p>
              <p className="mt-2 text-[27px] font-bold">1.2 km away</p>
            </div>
            <div>
              <p className="text-[23px] font-bold text-slate-500">Estimated Arrival Time</p>
              <p className="mt-2 text-[27px] font-bold">ETA: 5 min</p>
            </div>
          </div>
          <p className="mt-5 text-[21px] text-slate-500">Estimated arrival time may change.</p>
        </section>

        <button
          type="button"
          onClick={() => setAcknowledged(true)}
          disabled={acknowledged}
          className="flex h-[92px] w-full items-center justify-center gap-3 rounded-[20px] bg-primary text-[28px] font-bold text-white transition-opacity disabled:opacity-70"
        >
          {acknowledged && <Check size={30} />}
          {acknowledged ? "Assignment Acknowledged" : "Acknowledge Assignment"}
        </button>
      </div>
    </div>
  );
}
