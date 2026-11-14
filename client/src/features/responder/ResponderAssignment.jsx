import { ArrowLeft, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useEffect } from "react";
import { setResponderMeta } from "./responderMeta";
import MapViewer from "../../shared/components/MapViewer";

const cardClass =
  "rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6";

const mapsUrl =
  "https://www.google.com/maps/dir/?api=1&destination=Mabini+Street%2C+Barangay+167";
const assignmentIncident = {
  id: "GF-018",
  title: "Road obstruction on Mabini Street",
  category: "infrastructure",
  status: "ongoing",
  lat: 14.733586,
  lng: 121.013336,
};

export default function ResponderAssignment() {
  const [status, setStatus] = useState("Dispatched");
  const [acknowledged, setAcknowledged] = useState(false);
  const [showStatusOptions, setShowStatusOptions] = useState(false);

  useEffect(() => {
    setResponderMeta("Assignment Details", "View the active responder assignment, location, status, and route options.");
  }, []);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link to="/responder/new-dispatch" aria-label="Back to dispatch notification" className="text-primary">
            <ArrowLeft size={38} strokeWidth={1.8} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">Assignment Details</h1>
          </div>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16 sm:text-2xl">R</span>
      </header>

      <main className="space-y-4 px-4 py-5 pb-8 sm:space-y-5 sm:px-7 sm:py-6">
        <section className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-primary sm:text-lg">Report ID: GF-018</p>
            <span className="rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">
              Urgent
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold leading-tight sm:text-2xl">Road obstruction on Mabini Street</h2>
          <p className="mt-3 text-base leading-6 text-slate-500">
            Incident/Emergency <span aria-hidden="true">•</span> Road obstruction <span aria-hidden="true">•</span> Barangay 167
          </p>
          <span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-sm font-bold text-primary">
            {status} • updated 10:15 AM
          </span>
        </section>

        <section className={cardClass}>
          <h2 className="text-xl font-bold text-primary">Assignment</h2>
          <p className="mt-3 text-base">Department: Traffic/Road Response</p>
          <p className="mt-2 text-lg font-bold">Traffic/Road Response Team A</p>
          <p className="mt-3 text-sm leading-5 text-slate-500">
            Assigned April 23, 2026, 10:15 AM
            <br />
            Barangay-confirmed dispatch
          </p>
          <p className="mt-3 text-sm font-medium text-primary">
            {acknowledged ? "Assignment receipt confirmed." : "Confirm receipt before reviewing the offer."}
          </p>
        </section>

        <section className={cardClass}>
          <div className="flex items-start gap-4">
            <h2 className="shrink-0 text-xl font-bold text-primary">Location</h2>
            <div className="min-w-0 border-l border-slate-200 pl-4">
              <p className="truncate text-lg font-semibold">Mabini Street</p>
              <p className="truncate text-sm font-medium text-slate-500">Barangay 167, Caloocan</p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <MapViewer compact showBackButton={false} expandPath={null}
              incidents={[assignmentIncident]} selectedIncident={assignmentIncident}
              highlightBoundary mapHeight="h-[220px] sm:h-[260px]" hideMapLabel />
          </div>
          <p className="mt-3 text-sm text-slate-500">Location confirmed by Barangay 167</p>
        </section>

        <p className="pt-1 text-base leading-6">A stalled delivery vehicle and debris block one lane.</p>

        {!acknowledged ? (
          <button
            type="button"
            onClick={() => {
              setAcknowledged(true);
              setStatus("Acknowledged");
            }}
            className="min-h-16 w-full rounded-2xl bg-primary px-4 text-lg font-bold text-white"
          >
            Confirm Assignment Receipt
          </button>
        ) : (
          <Link
            to="/responder/assignment-offer"
            className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-primary px-4 text-lg font-bold text-white"
          >
            Continue to Assignment Offer
          </Link>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-base font-bold text-primary"
        >
          Open Emergency Route
        </a>
        <button type="button" onClick={() => setShowStatusOptions(true)} className="min-h-16 w-full rounded-2xl bg-primary px-4 text-lg font-bold text-white">
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
