import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{children || "Not recorded"}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export default function IncidentReportPrint() {
  const { id } = useParams();
  const [loadState, setLoadState] = useState({ id: null, snapshot: null, error: "", loading: true });
  const loading = loadState.id !== id || loadState.loading;
  const snapshot = loadState.id === id ? loadState.snapshot : null;
  const error = loadState.id === id ? loadState.error : "";

  useEffect(() => {
    let active = true;
    fetch(`/api/reports/${encodeURIComponent(id)}/report-snapshot`, { credentials: "include" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load the incident report.");
        return payload.snapshot;
      })
      .then((result) => {
        if (active) setLoadState({ id, snapshot: result, error: "", loading: false });
      })
      .catch((loadError) => {
        if (active) setLoadState({ id, snapshot: null, error: loadError instanceof Error ? loadError.message : "Could not load the incident report.", loading: false });
      });
    return () => { active = false; };
  }, [id]);

  const incident = snapshot?.incident;
  const timeline = incident?.timestamps ?? {};
  const location = incident?.location ?? {};
  const responders = snapshot?.responders?.assignments ?? [];
  const externalDispatches = snapshot?.responders?.external_dispatches ?? [];
  const history = snapshot?.status_history ?? [];
  const media = snapshot?.media ?? [];

  return (
    <div className="incident-print-page min-h-[calc(100dvh-54px)] bg-slate-50 px-4 py-6 text-slate-800 sm:px-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .incident-print-page, .incident-print-page * { visibility: visible !important; }
          .incident-print-page { position: absolute !important; inset: 0 !important; width: 100% !important; min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .incident-print-hide { display: none !important; }
          .incident-print-page section { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-5xl">
        <div className="incident-print-hide mb-4 flex items-center justify-between gap-3">
          <Link to="/admin/incident-reports" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800">
            <ArrowLeft size={14} /> Back to incident reports
          </Link>
          {!loading && snapshot && (
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">
              <Printer size={14} /> Print report
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading the certified incident record…</div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-white p-8">
            <h1 className="text-lg font-bold text-slate-900">Printable report unavailable</h1>
            <p className="mt-2 text-sm text-rose-700">{error}</p>
          </div>
        ) : incident ? (
          <article className="space-y-4">
            <header className="rounded-xl border border-emerald-900/10 bg-emerald-950 p-6 text-white sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">GeoFix 167 · Incident closure record</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">{incident.title}</h1>
                  <p className="mt-2 text-sm text-emerald-100">{incident.id} <span className="px-1.5 text-emerald-400">·</span> {incident.category}</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-200">{incident.status}</span>
              </div>
              <p className="mt-5 text-xs text-emerald-100">Generated {formatDate(snapshot.generated_at)} by {snapshot.generated_by?.name || "Authorized reviewer"}</p>
            </header>

            <Section title="Incident details">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Classification">{incident.classification}</Field>
                <Field label="Urgency">{incident.urgency}</Field>
                <Field label="Assigned team">{incident.assigned_team}</Field>
                <Field label="Reporter">{incident.reporter?.name} ({incident.reporter?.type})</Field>
                <Field label="Submitted">{formatDate(incident.submitted_at)}</Field>
                <Field label="Resolved">{formatDate(timeline.resolved_at)}</Field>
                <Field label="Location">{location.address}</Field>
                <Field label="Coordinates">{location.latitude != null && location.longitude != null ? `${location.latitude}, ${location.longitude}` : "Not recorded"}</Field>
                <Field label="Boundary check">{location.boundary}</Field>
                <Field label="GPS accuracy">{location.accuracy_meters == null ? "Not recorded" : `${location.accuracy_meters} m`}</Field>
              </dl>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{incident.description || "No description"}</dd>
              </div>
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Flags: {incident.flags?.outside_barangay_167 ? "Outside Barangay 167" : "Inside Barangay 167 or not flagged"}
                {incident.flags?.manually_adjusted_pin ? " · Pin adjusted by reporter" : ""}
              </p>
            </Section>

            <Section title="Incident timeline">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Submitted">{formatDate(timeline.submitted_at)}</Field>
                <Field label="Verified">{formatDate(timeline.verified_at)}</Field>
                <Field label="Dispatched">{formatDate(timeline.dispatched_at)}</Field>
                <Field label="Accepted">{formatDate(timeline.accepted_at)}</Field>
                <Field label="En route">{formatDate(timeline.en_route_at)}</Field>
                <Field label="On scene">{formatDate(timeline.on_scene_at)}</Field>
                <Field label="Handover">{formatDate(timeline.handover_at)}</Field>
                <Field label="Resolved">{formatDate(timeline.resolved_at)}</Field>
              </dl>
              {history.length > 0 && (
                <ol className="mt-5 space-y-2 border-l-2 border-emerald-100 pl-4">
                  {history.map((event, index) => (
                    <li key={`${event.status}-${event.created_at}-${index}`} className="text-xs">
                      <strong className="text-slate-800">{event.label || event.status}</strong>
                      <span className="ml-2 text-slate-500">{formatDate(event.created_at)}</span>
                      {event.actor_name && <span className="ml-2 text-slate-500">by {event.actor_name}</span>}
                      {event.note && <p className="mt-1 text-slate-600">{event.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title="Responders and units">
              {responders.length || externalDispatches.length ? (
                <div className="space-y-3">
                  {responders.map((assignment) => (
                    <div key={assignment.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-semibold">{assignment.responder}{assignment.unit ? ` · ${assignment.unit}` : ""}</p>
                      <p className="mt-1 text-xs text-slate-500">{assignment.status} · assigned {formatDate(assignment.assigned_at)} · accepted {formatDate(assignment.accepted_at)} · completed {formatDate(assignment.completed_at)}</p>
                    </div>
                  ))}
                  {externalDispatches.map((dispatch, index) => (
                    <div key={`${dispatch.unit}-${dispatch.dispatched_at}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-semibold">{dispatch.unit} · {dispatch.role}</p>
                      <p className="mt-1 text-xs text-slate-500">{dispatch.status} · dispatched {formatDate(dispatch.dispatched_at)} by {dispatch.dispatched_by || "Not recorded"}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No responder assignments were recorded.</p>}
            </Section>

            {snapshot.handover && (
              <Section title="Handover">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="Receiving organization">{snapshot.handover.hospital}</Field>
                  <Field label="Receiver">{snapshot.handover.receiver}</Field>
                  <Field label="Acknowledged">{formatDate(snapshot.handover.acknowledged_at)}</Field>
                  <Field label="Status">{snapshot.handover.status}</Field>
                </dl>
              </Section>
            )}

            <Section title="Resolution and evidence references">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{incident.resolution_notes || "No additional resolution notes recorded."}</p>
              {media.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                  {media.map((item) => (
                    <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
                      <span className="font-medium text-slate-800">{item.original_filename || item.media_type || "Evidence"}</span>
                      <span className="text-slate-500">{item.content_type || item.media_type} · added {formatDate(item.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!media.length && <p className="mt-3 text-xs text-slate-500">No photo or video references were recorded.</p>}
            </Section>

            <footer className="pb-4 text-center text-[10px] text-slate-400">GeoFix 167 · Barangay 167, Caloocan City · Official incident record</footer>
          </article>
        ) : null}
      </div>
    </div>
  );
}
