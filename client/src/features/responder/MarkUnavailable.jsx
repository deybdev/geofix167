import { AlertTriangle, ArrowLeft, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setResponderMeta } from "./responderMeta";

const reasons = ["On another assignment", "Equipment unavailable", "Off duty", "Other"];

export default function MarkUnavailable() {
  const [reason, setReason] = useState("Equipment unavailable");
  const [explanation, setExplanation] = useState(
    "Traffic-control equipment unavailable. Reassignment requested.",
  );
  const navigate = useNavigate();

  useEffect(() => {
    setResponderMeta("Mark Unavailable", "Tell the administrator why you cannot accept this assignment and request reassignment.");
  }, []);

  function submitNotice(event) {
    event.preventDefault();
    navigate("/responder/unavailability-submitted");
  }

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/responder/assignment-offer" aria-label="Back to assignment offer" className="shrink-0 text-primary">
            <ArrowLeft size={38} />
          </Link>
          <h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Mark Unavailable</h1>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16">R</span>
      </header>

      <main className="space-y-4 px-4 py-5 sm:px-7 sm:py-6">
        <p className="text-base text-slate-500">GF-018 <span aria-hidden="true">•</span> Unavailable option</p>
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="font-bold text-primary">Report ID: GF-018</p>
          <h2 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">Road obstruction on Mabini Street</h2>
          <p className="mt-3 text-base text-slate-500">Traffic/Road Response <span aria-hidden="true">•</span> Team A</p>
          <p className="text-base text-slate-500">Offered April 23, 2026 <span aria-hidden="true">•</span> 10:15 AM</p>
          <span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-sm font-bold text-primary">Awaiting Acceptance</span>
        </section>

        <form onSubmit={submitNotice} className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Reason for unavailability <span aria-hidden="true">*</span></h2>
            <p className="mt-1 text-base text-slate-500">Select a reason, or choose Other and explain.</p>
          </div>
          <div className="grid gap-3">
            {reasons.map((item) => {
              const selected = reason === item;
              return (
                <button
                  type="button"
                  key={item}
                  onClick={() => setReason(item)}
                  aria-pressed={selected}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left text-base transition-colors ${
                    selected ? "border-primary bg-[#e2f2eb] font-bold" : "border-slate-200 bg-white"
                  }`}
                >
                  <Circle className={selected ? "fill-primary text-primary" : "text-slate-400"} size={22} />
                  {item}
                </button>
              );
            })}
          </div>
          <label className="block text-lg font-bold text-slate-900">
            Explanation <span className="font-normal text-slate-500">(required for Other)</span>
            <textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-2xl border-2 border-slate-200 bg-white p-4 text-base font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <div className="flex gap-3 rounded-2xl bg-[#fff1c8] px-4 py-4 text-sm leading-5 text-[#a66a00]">
            <AlertTriangle className="shrink-0" size={22} />
            <p>Request administrator reassignment. You cannot select a replacement. Dispatch not confirmed.</p>
          </div>
          <button type="submit" className="min-h-16 w-full rounded-2xl bg-primary px-4 text-lg font-bold text-white shadow-sm transition hover:shadow-md">
            Submit Unavailability Notice
          </button>
        </form>
      </main>
    </div>
  );
}
