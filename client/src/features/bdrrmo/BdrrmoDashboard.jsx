import { Activity, AlertTriangle, CheckSquare2, Clock3, Maximize2, Minimize2, Radio, ShieldAlert, UsersRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";
import MapViewer from "../../shared/components/MapViewer";
import { AVAILABILITY_STATUS, INCIDENT_STATUS, PRIORITY, displayStatus } from "./statusModel";
import { useBdrrmoDemo } from "./BdrrmoDemoContext";

const tone = {
  P1: "bg-[#fdecea] text-[#dc2626]",
  P2: "bg-[#fff1c6] text-[#e69500]",
  P3: "bg-[#eef2fb] text-[#4c6fbf]",
  P4: "bg-[#eef2f4] text-[#60738f]",
};

export default function BdrrmoDashboard() {
  const navigate = useNavigate();
  const [mapExpanded, setMapExpanded] = useState(false);
  const { incidents, assignments, handovers, responders } = useBdrrmoDemo();

  const metrics = [
    ["Active Incidents", incidents.filter((i) => ["ASSIGNED", "EN_ROUTE", "ON_SCENE"].includes(i.incidentStatusCode)).length, Activity, "text-[#dc2626] bg-[#fdecea]", PATHS.bdrrmoIncidents],
    ["Awaiting Dispatch", incidents.filter((i) => i.incidentStatusCode === "FORWARDED_TO_BDRRMO" && !assignments.some((a) => a.incidentId === i.id)).length, Radio, "text-[#e69500] bg-[#fff1c6]", PATHS.bdrrmoDispatchResponders],
    ["Available Units", responders.filter((r) => r.availabilityStatus === "AVAILABLE").length, UsersRound, "text-(--gf-green) bg-(--gf-green-soft)", PATHS.bdrrmoDispatchResponders],
    ["Busy Units", responders.filter((r) => r.availabilityStatus === "BUSY").length, ShieldAlert, "text-[#4c6fbf] bg-[#eef2fb]", PATHS.bdrrmoDispatchResponders],
    ["For Closure", incidents.filter((i) => i.incidentStatusCode === "FOR_CLOSURE_REVIEW").length, CheckSquare2, "text-[#e69500] bg-[#fff1c6]", PATHS.bdrrmoHandoverCompletion],
    ["QR Handovers", handovers.length, Clock3, "text-(--gf-green) bg-(--gf-green-soft)", PATHS.bdrrmoHandoverCompletion],
  ];

  const recentActivity = [
    ...incidents.slice(0, 5).map((inc) => ({
      id: `inc-${inc.id}`,
      ref: inc.id,
      summary: `${inc.category} — ${displayStatus(INCIDENT_STATUS, inc.incidentStatusCode)}`,
      when: inc.elapsed || inc.submittedAt,
    })),
    ...handovers.slice(0, 3).map((h) => ({
      id: `ho-${h.id}`,
      ref: h.incidentId,
      summary: `Hospital QR handover: ${h.qrStatusCode}`,
      when: h.createdAt,
    })),
  ].slice(0, 6);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value, Icon, color, path]) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(path)}
            className="rounded-xl border border-[#e2e8eb] bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-(--gf-green) hover:shadow-md motion-reduce:transform-none"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#60738f]">{label}</span>
              <span className={`rounded-lg p-2 ${color}`}><Icon size={15} /></span>
            </div>
            <strong className="mt-3 block text-2xl font-extrabold text-[#263246]">{value}</strong>
          </button>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <article className={`overflow-hidden rounded-xl border border-[#e2e8eb] bg-white shadow-sm ${mapExpanded ? "fixed inset-4 z-50 flex flex-col shadow-2xl" : ""}`}>
          <div className="flex items-center justify-between border-b border-[#edf0f2] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-(--gf-green)">Live operations map</h2>
              <p className="text-[10px] text-[#60738f]">Live Barangay 167 emergency positions</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigate(PATHS.bdrrmoIncidents)} className="text-xs font-bold text-(--gf-green) hover:underline">
                View incidents
              </button>
              <button type="button" onClick={() => setMapExpanded((v) => !v)} className="rounded-lg border border-[#dfe7ea] p-2 text-(--gf-green)" aria-label={mapExpanded ? "Minimize map" : "Maximize map"}>
                {mapExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>
          <div className={mapExpanded ? "min-h-0 flex-1" : ""}>
            <MapViewer incidents={incidents} compact />
          </div>
        </article>
        {mapExpanded && <button type="button" className="fixed inset-0 z-40 bg-slate-950/30" aria-label="Minimize map" onClick={() => setMapExpanded(false)} />}

        <article className="rounded-xl border border-[#e2e8eb] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-(--gf-green)">Priority queue</h2>
            <span className="rounded-md bg-[#fdecea] px-2 py-1 text-[10px] font-bold text-[#dc2626]">
              {incidents.filter((i) => i.priorityCode === "P1" && i.incidentStatusCode !== "CLOSED").length} P1 Active
            </span>
          </div>
          {incidents.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#60738f]">No live emergencies in the BDRRMO queue.</p>
          ) : (
            <div className="space-y-2">
              {incidents.slice(0, 5).map((item) => (
                <button
                  type="button"
                  onClick={() => navigate(`${PATHS.bdrrmoIncidents}?incident=${encodeURIComponent(item.id)}`)}
                  key={item.id}
                  className="w-full rounded-lg border border-[#edf0f2] p-3 text-left transition hover:border-(--gf-green) hover:bg-(--gf-green-soft)/50"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-xs text-(--gf-green)">{item.id}</strong>
                    <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${tone[item.priorityCode] || tone.P4}`}>
                      {item.priorityCode} · {displayStatus(PRIORITY, item.priorityCode)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#263246]">{item.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-[#60738f]">
                    <AlertTriangle size={11} />
                    {displayStatus(INCIDENT_STATUS, item.incidentStatusCode)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-xl border border-[#e2e8eb] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-(--gf-green)">Responder availability</h2>
          {responders.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#60738f]">No responder resources registered yet.</p>
          ) : (
            <div className="space-y-2">
              {responders.slice(0, 6).map((r) => (
                <div key={r.id || r.unit} className="flex items-center justify-between rounded-lg border border-[#edf0f2] bg-[#f8fafb] px-3 py-2">
                  <div>
                    <strong className="block text-xs text-[#263246]">{r.name}</strong>
                    <span className="text-[10px] text-[#60738f]">{r.unit}</span>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${r.availabilityStatus === "AVAILABLE" ? "bg-(--gf-green-tint-2) text-(--gf-green)" : "bg-[#fdecea] text-[#dc2626]"}`}>
                    {displayStatus(AVAILABILITY_STATUS, r.availabilityStatus)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-[#e2e8eb] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-(--gf-green)">Recent activity</h2>
          {recentActivity.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#60738f]">No recent emergency activity recorded.</p>
          ) : (
            <ol className="space-y-3 border-l-2 border-(--gf-green-tint-2) pl-4 text-xs">
              {recentActivity.map((act) => (
                <li key={act.id}>
                  <strong className="text-(--gf-green)">{act.ref}</strong>{" "}
                  <span className="text-[#263246]">{act.summary}</span>
                  <span className="block text-[10px] text-[#7c8ba3]">{act.when}</span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </div>
  );
}
