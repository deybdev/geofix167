import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { formatTimestamp, parseTimestamp } from "../../utils";

const labels = {
  DISPATCHED: "Team dispatched", OFFERED: "Team dispatched", ACCEPTED: "Accepted",
  EN_ROUTE: "En route", ON_SCENE: "On scene", COMPLETED: "Assignment completed",
  DECLINED: "Declined", CANCELLED: "Cancelled",
};
const teamsFor = (report) => report.dispatchedUnits.filter((unit) => unit.dispatcher_role === "bdrrmo");

function assignmentState(report, teams) {
  if (report.statusCode === "CLOSED") return "Resolved";
  if (report.history.some((event) => /handover generated|handover submitted/i.test(event.note))) return "Handover submitted";
  for (const code of ["ON_SCENE", "EN_ROUTE", "ACCEPTED", "DISPATCHED", "OFFERED", "COMPLETED"]) {
    if (teams.some((team) => team.status === code)) return labels[code];
  }
  return "Awaiting BDRRMO dispatch";
}

function TrackingDetail({ report, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  const teams = teamsFor(report);
  const points = [];
  if (Number.isFinite(report.lat) && Number.isFinite(report.lng)) {
    points.push({ id: "incident", name: report.title, color: "#b42318", position: [report.lat, report.lng] });
  }
  for (const team of teams) {
    if (team.location) points.push({ id: team.id, name: team.name, color: "#17633f", position: [team.location.lat, team.location.lng] });
  }
  const timeline = [
    ...report.history.map((event) => ({ id: event.id, at: event.created_at, text: event.note || event.status })),
    ...teams.map((team) => ({ id: team.id, at: team.dispatched_at, text: team.dispatched_by + " dispatched " + team.name })),
  ].sort((a, b) => parseTimestamp(a.at) - parseTimestamp(b.at));
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="tracked-report" className="fixed inset-0 m-auto max-h-[90dvh] w-[min(42rem,94vw)] overflow-y-auto rounded-xl bg-white p-4 shadow-xl backdrop:bg-black/50">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div><h2 id="tracked-report" className="font-bold">{report.id} · {report.title}</h2><p>{assignmentState(report, teams)}</p></div>
        <button type="button" autoFocus className="gf-btn" onClick={onClose}>Close</button>
      </header>
      {points.length > 0 && <MapContainer key={points.map((point) => point.id).join(",")} bounds={points.map((point) => point.position)} boundsOptions={{ padding: [24, 24], maxZoom: 16 }} className="h-64">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
        {points.map((point) => <CircleMarker key={point.id} center={point.position} radius={9} pathOptions={{ color: point.color, fillOpacity: 0.85 }}>
          <Tooltip>{point.id === "incident" ? "Incident" : "Responder"} · {point.name}</Tooltip>
        </CircleMarker>)}
      </MapContainer>}
      <p className="my-2 text-sm">{report.location}</p>
      {!teams.length && <p>No live location yet</p>}
      {teams.map((team) => <div key={team.id} className="my-2 rounded border p-3">
        <strong>{team.name}</strong> · {labels[team.status] || team.status}
        <p>{[team.responder, team.contact].filter(Boolean).join(" · ")}</p>
        <p>Dispatched by {team.dispatched_by} · {formatTimestamp(team.dispatched_at)}</p>
        <p>{team.location ? "Last updated " + Math.max(0, Math.floor((report.fetchedAt - parseTimestamp(team.location.updated_at)) / 1000)) + "s ago" : "No live location yet"}</p>
      </div>)}
      <h3 className="mt-4 font-bold">Status timeline</h3>
      <ol className="mt-2 space-y-2">{timeline.map((entry) => <li key={entry.id}><time>{formatTimestamp(entry.at)}</time> · {entry.text}</li>)}</ol>
    </dialog>
  );
}

export default function TrackingBoard({ reports }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = reports.find((report) => report.id === selectedId);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-bold">Monitor Dispatch &amp; Tracking ({reports.length})</h2>
      {!reports.length && <p>No emergencies forwarded yet.</p>}
      <div className="grid gap-3 lg:grid-cols-2">{reports.map((report) => {
        const teams = teamsFor(report);
        return <article key={report.id} className="rounded-lg border border-slate-200 p-3">
          <h3 className="font-bold">{report.id} · {report.title}</h3>
          <p>{report.displayUrgency} urgency · {report.forwardedAt ? "Forwarded " + formatTimestamp(report.forwardedAt) : "Forwarding time unavailable"}</p>
          <p className="my-2 font-semibold">{assignmentState(report, teams)}</p>
          {teams.map((team) => <p key={team.id}>{team.name} · {team.dispatched_by} · {formatTimestamp(team.dispatched_at)}</p>)}
          <button type="button" className="gf-btn gf-btn--primary mt-2" onClick={() => setSelectedId(report.id)}>Track</button>
        </article>;
      })}</div>
      {selected && <TrackingDetail report={selected} onClose={() => setSelectedId(null)} />}
    </section>
  );
}
