import { ArrowLeft, MapPin, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const cardClass =
  "rounded-[22px] border-2 border-slate-200 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.02)]";

const mapsUrl =
  "https://www.google.com/maps/dir/?api=1&destination=Mabini+Street%2C+Barangay+167";

export default function ResponderAssignment() {
  const [status, setStatus] = useState("Dispatched");
  const [acknowledged, setAcknowledged] = useState(false);
  const [showStatusOptions, setShowStatusOptions] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-7 pb-5 pt-9">
        <div className="flex items-center gap-5">
          <Link to="/responder/new-dispatch" aria-label="Back to dispatch notification" className="text-primary">
            <ArrowLeft size={45} strokeWidth={1.8} />
          </Link>
          <h1 className="text-[30px] font-bold tracking-tight text-primary">My Assignment</h1>
        </div>
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
        </span>
      </header>

      <main className="space-y-3 px-7 py-6 pb-8">
        <section className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[25px] font-bold text-primary">Report ID: GF-018</p>
            <span className="rounded-xl bg-[#fff1c8] px-4 py-2 text-[20px] font-bold text-[#a66a00]">
              Urgent
            </span>
          </div>
          <h2 className="mt-4 text-[31px] font-bold leading-tight">Road obstruction on Mabini Street</h2>
          <p className="mt-4 text-[21px] text-slate-500">
            Incident/Emergency • Road obstruction • Barangay 167
          </p>
          <span className="mt-4 inline-flex rounded-xl bg-[#e2f2eb] px-4 py-2 text-[20px] font-bold text-primary">
            {status} • updated 10:15 AM
          </span>
        </section>

        <section className={cardClass}>
          <h2 className="text-[26px] font-bold text-primary">Assignment details</h2>
          <p className="mt-3 text-[22px]">Department: Traffic/Road Response</p>
          <p className="mt-2 text-[24px] font-bold">Traffic/Road Response Team A</p>
          <p className="mt-3 text-[20px] leading-6 text-slate-500">
            Assigned April 23, 2026, 10:15 AM
            <br />
            Barangay-confirmed dispatch
          </p>
          <p className="mt-3 text-[20px] text-primary">
            {acknowledged ? "Assignment receipt confirmed." : "Confirm receipt before reviewing the offer."}
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="text-[26px] font-bold text-primary">Incident location</h2>
          <p className="mt-2 text-[23px]">Mabini Street, Barangay 167</p>
          <div className="relative mt-3 h-24 overflow-hidden rounded-[20px] bg-[#e8e4da]">
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(28deg,transparent_45%,#c9c4b8_46%,#c9c4b8_48%,transparent_49%),linear-gradient(112deg,transparent_42%,#c9c4b8_43%,#c9c4b8_45%,transparent_46%)] [background-size:120px_90px,150px_100px]" />
            <MapPin className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#f6a500]" size={42} strokeWidth={3} />
          </div>
          <p className="mt-3 text-[20px] text-slate-500">Location confirmed by barangay</p>
        </section>

        <p className="pt-1 text-[20px] leading-6">A stalled delivery vehicle and debris block one lane.</p>

        {!acknowledged ? (
          <button
            type="button"
            onClick={() => {
              setAcknowledged(true);
              setStatus("Acknowledged");
            }}
            className="h-[84px] w-full rounded-[18px] bg-primary text-[27px] font-bold text-white"
          >
            Confirm Assignment Receipt
          </button>
        ) : (
          <Link
            to="/responder/assignment-offer"
            className="flex h-[84px] w-full items-center justify-center rounded-[18px] bg-primary text-[27px] font-bold text-white"
          >
            Continue to Assignment Offer
          </Link>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-[80px] w-full items-center justify-center rounded-[18px] border-2 border-slate-200 bg-white text-[25px] font-bold text-primary"
        >
          Open Emergency Route
        </a>
        <button type="button" onClick={() => setShowStatusOptions(true)} className="h-[84px] w-full rounded-[18px] bg-primary text-[27px] font-bold text-white">
          Update Response Status
        </button>
      </main>

      {showStatusOptions && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/30 px-4 pb-24">
          <div className="w-full max-w-[680px] rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-primary">Update response status</h2>
              <button type="button" aria-label="Close status options" onClick={() => setShowStatusOptions(false)} className="text-slate-500">
                <X />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              {["En route", "On scene", "Resolved"].map((nextStatus) => (
                <button
                  type="button"
                  key={nextStatus}
                  onClick={() => {
                    setStatus(nextStatus);
                    setShowStatusOptions(false);
                  }}
                  className="rounded-xl border-2 border-slate-200 px-4 py-3 text-left text-lg font-semibold hover:border-primary"
                >
                  {nextStatus}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
