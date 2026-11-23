import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  Flame,
  Handshake,
  Lock,
  MapPin,
  MapPinned,
  Maximize2,
  Minimize2,
  Navigation,
  Radio,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  TriangleAlert,
  Truck,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import MapViewer from "../../shared/components/MapViewer";
import {
  ASSIGNMENT_STATUS,
  AVAILABILITY_STATUS,
  INCIDENT_STATUS,
  PRIORITY,
  QR_STATUS,
  activeIncidentCodes,
  displayStatus,
} from "./statusModel";
import ReportBuilder from "./ReportBuilder";
import { useAuth } from "../../shared/hooks/useAuth";
import { validateHandover, validateIncident } from "./validation";
import { useBdrrmoDemo } from "./BdrrmoDemoContext";
import ConfirmationDialog from "../../shared/components/ConfirmationDialog";
import { useSearchParams } from "react-router-dom";

/* ----------------------------------------------------------------------- */
/* Views & Streamlined Tabs (only meaningful live operational views)       */
/* ----------------------------------------------------------------------- */

const views = {
  incidents: {
    title: "Incidents",
    subtitle: "Manage forwarded emergencies from dispatch to coordinated closure.",
    icon: Activity,
    tabs: ["All", "Unassigned", "Active", "For Closure", "Closed"],
  },
  dispatch: {
    title: "Dispatch & Responders",
    subtitle: "Coordinate multi-agency dispatch and live responder availability.",
    icon: Radio,
    tabs: ["Pending Dispatch", "Active Units", "Responder Roster"],
  },
  handover: {
    title: "Handover & Completion",
    subtitle: "Verify field completion, hospital QR handovers, and authorize closure.",
    icon: Handshake,
    tabs: ["For Closure", "Hospital Handovers", "Closed"],
  },
  analytics: {
    title: "Reports & Analytics",
    subtitle: "Live Barangay 167 emergency metrics and printable operational reports.",
    icon: BarChart3,
  },
  settings: {
    title: "Profile & Settings",
    subtitle: "Manage BDRRMO dashboard preferences and session details.",
    icon: Settings,
  },
};

/* ----------------------------------------------------------------------- */
/* Maintenance-matched UI Primitives                                       */
/* ----------------------------------------------------------------------- */

function Chip({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold leading-none ${className}`}
    >
      {children}
    </span>
  );
}

const statusTone = (code = "") => {
  if (["ACCEPTED", "AVAILABLE", "CLOSED", "COMPLETED"].includes(code)) {
    return "bg-(--gf-green-tint-2) text-(--gf-green)";
  }
  if (
    ["PENDING_ACCEPTANCE", "NEEDS_CORRECTION", "FOR_CLOSURE_REVIEW", "FORWARDED_TO_BDRRMO", "OFFERED", "DISPATCHED"].includes(code)
  ) {
    return "bg-[#fff1c6] text-[#e69500]";
  }
  if (["BUSY", "UNAVAILABLE", "OUT_OF_SERVICE", "DECLINED", "CANCELLED"].includes(code)) {
    return "bg-[#fdecea] text-[#dc2626]";
  }
  return "bg-[#eef2fb] text-[#4c6fbf]";
};

const priorityTone = (code = "") => {
  if (code === "P1") return "bg-[#fdecea] text-[#dc2626]";
  if (code === "P2") return "bg-[#fff1c6] text-[#e69500]";
  if (code === "P3") return "bg-[#eef2fb] text-[#4c6fbf]";
  return "bg-[#eef2f4] text-[#60738f]";
};

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#f1f4f6] py-1.5 last:border-b-0">
      <span className="shrink-0 text-[9px] font-semibold text-[#7184a0]">{label}</span>
      <span className="text-right text-[10px] font-semibold text-[#263246]">{children}</span>
    </div>
  );
}

function DrawerSection({ title, icon: Icon, children, last = false, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`pb-4 ${last ? "" : "border-b border-[#edf0f2]"}`}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mb-2 flex w-full items-center justify-between gap-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#60738f] hover:text-(--gf-green)"
        >
          <span className="flex items-center gap-1.5">
            {Icon && <Icon size={11} className="text-(--gf-green)" />}
            {title}
          </span>
          <span className="text-[9px] font-semibold text-[#7c8ba3]">
            {open ? "▲ Hide" : "▼ Show"}
          </span>
        </button>
      ) : (
        <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#60738f]">
          {Icon && <Icon size={11} className="text-(--gf-green)" />}
          {title}
        </h3>
      )}
      {(!collapsible || open) && children}
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Main Workspace                                                          */
/* ----------------------------------------------------------------------- */

export default function BdrrmoWorkspace({ view }) {
  const { incidents, assignments, handovers } = useBdrrmoDemo();
  const meta = views[view];
  const [rawTab, setTab] = useState(meta.tabs?.[0]);
  const tab = meta.tabs?.includes(rawTab) ? rawTab : meta.tabs?.[0];
  const [query, setQuery] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedHandover, setSelectedHandover] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightedId, setHighlightedId] = useState(null);

  useEffect(() => {
    if (view !== "incidents") return;
    const incidentId = searchParams.get("incident");
    if (!incidentId) return;
    const match = incidents.find((item) => item.id === incidentId);
    if (match) {
      const frame = window.requestAnimationFrame(() => {
        setSelectedIncident(match);
        setHighlightedId(incidentId);
        document
          .getElementById(`incident-${incidentId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      const timer = window.setTimeout(() => {
        setHighlightedId(null);
        setSearchParams({}, { replace: true });
      }, 3500);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }
  }, [view, searchParams, incidents, setSearchParams]);

  const tabCounts = useMemo(() => {
    if (view === "incidents") {
      return {
        All: incidents.length,
        Unassigned: incidents.filter(
          (i) => i.incidentStatusCode === "FORWARDED_TO_BDRRMO" && !(i.dispatchedUnits?.length > 0),
        ).length,
        Active: incidents.filter((i) => activeIncidentCodes.includes(i.incidentStatusCode)).length,
        "For Closure": incidents.filter((i) => i.incidentStatusCode === "FOR_CLOSURE_REVIEW").length,
        Closed: incidents.filter((i) => i.incidentStatusCode === "CLOSED").length,
      };
    }
    if (view === "handover") {
      return {
        "For Closure": incidents.filter((i) => i.incidentStatusCode === "FOR_CLOSURE_REVIEW").length,
        "Hospital Handovers": handovers.length,
        Closed: incidents.filter((i) => i.incidentStatusCode === "CLOSED").length,
      };
    }
    if (view === "dispatch") {
      return {
        "Pending Dispatch": incidents.filter((i) => i.incidentStatusCode !== "CLOSED").length,
        "Active Units": assignments.filter((a) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode)).length,
      };
    }
    return {};
  }, [view, incidents, assignments, handovers]);

  const filtered = useMemo(
    () =>
      incidents.filter((item) => {
        const matchesQuery = `${item.id} ${item.title} ${item.category} ${item.location}`
          .toLowerCase()
          .includes(query.toLowerCase());
        if (!matchesQuery || view !== "incidents") return matchesQuery;
        if (tab === "Unassigned") {
          return item.incidentStatusCode === "FORWARDED_TO_BDRRMO" && !(item.dispatchedUnits?.length > 0);
        }
        if (tab === "Active") return activeIncidentCodes.includes(item.incidentStatusCode);
        if (tab === "For Closure") return item.incidentStatusCode === "FOR_CLOSURE_REVIEW";
        if (tab === "Closed") return item.incidentStatusCode === "CLOSED";
        return true;
      }),
    [query, tab, view, incidents],
  );

  if (view === "analytics") {
    return (
      <Analytics
        meta={meta}
        rows={filtered}
        onOpen={setSelectedIncident}
        selected={selectedIncident}
      />
    );
  }
  if (view === "settings") return <SettingsView meta={meta} />;

  return (
    <div className="space-y-5">
      <Header meta={meta} />
      <Tabs tabs={meta.tabs} value={tab} onChange={setTab} counts={tabCounts} />

      {view === "incidents" && (
        <>
          <SearchBar query={query} setQuery={setQuery} />
          <IncidentTable
            rows={filtered}
            onOpen={setSelectedIncident}
            highlightedId={highlightedId}
            emptyLabel="No emergencies match this filter."
          />
        </>
      )}

      {view === "dispatch" && (
        <DispatchView tab={tab} onOpen={setSelectedIncident} />
      )}

      {view === "handover" && (
        <HandoverView
          tab={tab}
          onOpen={setSelectedHandover}
          onIncident={setSelectedIncident}
        />
      )}

      {selectedIncident && (
        <IncidentDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}

      {selectedHandover && (
        <HandoverDrawer
          record={selectedHandover}
          onClose={() => setSelectedHandover(null)}
          onIncident={() => {
            const linked = incidents.find(
              (i) => i.incidentId === selectedHandover.incidentId || i.id === selectedHandover.incidentId,
            );
            setSelectedHandover(null);
            if (linked) setSelectedIncident(linked);
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Shared Header, Tabs, Search, Table                                      */
/* ----------------------------------------------------------------------- */

function Header({ meta }) {
  const Icon = meta.icon;
  return (
    <header className="flex items-start gap-3">
      <span className="rounded-xl bg-(--gf-green-soft) p-3 text-(--gf-green)">
        <Icon size={20} />
      </span>
      <div>
        <h2 className="text-lg font-bold text-[#263246]">{meta.title}</h2>
        <p className="text-xs text-[#60738f]">{meta.subtitle}</p>
      </div>
    </header>
  );
}

function Tabs({ tabs, value, onChange, counts = {} }) {
  return (
    <div className="overflow-x-auto">
      <div
        className="inline-flex min-w-full gap-1 rounded-xl border border-[#e2e8eb] bg-white p-1 sm:min-w-0"
        role="tablist"
      >
        {tabs.map((item) => {
          const active = value === item;
          const count = counts[item];
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                active
                  ? "bg-(--gf-green) text-white shadow-sm"
                  : "text-[#60738f] hover:bg-(--gf-green-soft) hover:text-(--gf-green)"
              }`}
            >
              <span>{item}</span>
              {typeof count === "number" && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/20 text-white" : "bg-[#eef2f4] text-[#60738f]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchBar({ query, setQuery }) {
  return (
    <section className="flex gap-2 rounded-xl border border-[#e2e8eb] bg-white p-3">
      <label className="flex flex-1 items-center gap-2 rounded-lg border border-[#dfe7ea] px-3 focus-within:border-(--gf-green)">
        <Search size={14} className="text-[#7c8ba3]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full text-xs text-[#263246] outline-none"
          placeholder="Search incident ID, category, title, or location..."
        />
      </label>
      <button
        type="button"
        onClick={() => setQuery("")}
        className="flex items-center gap-1.5 rounded-lg border border-[#dfe7ea] px-3 text-xs font-bold text-[#60738f] hover:border-(--gf-green) hover:text-(--gf-green)"
      >
        <RotateCcw size={13} />
        Reset
      </button>
    </section>
  );
}

function IncidentTable({ rows, onOpen, highlightedId, emptyLabel = "No incidents found." }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <section
        className={`overflow-hidden rounded-xl border border-[#e2e8eb] bg-white shadow-sm ${
          expanded ? "fixed inset-4 z-50 flex flex-col shadow-2xl" : ""
        }`}
      >
        <header className="flex items-center justify-between border-b border-[#edf0f2] px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-[#263246]">Incident records</h3>
            <p className="text-[10px] text-[#60738f]">{rows.length} matching records</p>
          </div>
          <button
            type="button"
            title={expanded ? "Minimize" : "Maximize"}
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-[#dfe7ea] p-2 text-(--gf-green)"
            aria-label={expanded ? "Minimize table" : "Maximize table"}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </header>

        <div className={`overflow-x-auto ${expanded ? "min-h-0 flex-1" : ""}`}>
          <table className="w-full min-w-[920px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[10px] font-bold uppercase tracking-wider text-[#60738f]">
                {["Incident", "Category", "Location", "Priority", "Status", "Dispatched Units", "Elapsed", "Action"].map(
                  (h) => (
                    <th className="px-4 py-3.5" key={h}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const units = item.dispatchedUnits || [];
                const hasBackupAlert = item.backupAlerts?.length > 0;
                return (
                  <tr
                    id={`incident-${item.id}`}
                    key={item.id}
                    className={`border-b border-[#f1f4f6] transition-colors last:border-b-0 hover:bg-(--gf-row-hover) ${
                      highlightedId === item.id ? "bg-[#fff1c6]/50 ring-2 ring-inset ring-[#e69500]" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-(--gf-green)">{item.id}</span>
                      <div className="mt-0.5 text-[12px] font-semibold text-[#263246]">{item.title}</div>
                      {hasBackupAlert && (
                        <div className="mt-1">
                          <Chip className="bg-[#fdecea] text-[#dc2626]">
                            <AlertTriangle size={9} /> Backup Requested
                          </Chip>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Chip className="bg-[#eef2f4] text-[#60738f]">{item.category}</Chip>
                    </td>
                    <td className="px-4 py-3.5 text-[#60738f]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} className="shrink-0 text-(--gf-green)" />
                        {item.location}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Chip className={priorityTone(item.priorityCode)}>
                        {item.priorityCode} · {displayStatus(PRIORITY, item.priorityCode).split(",")[0]}
                      </Chip>
                    </td>
                    <td className="px-4 py-3.5">
                      <Chip className={statusTone(item.incidentStatusCode)}>
                        {displayStatus(INCIDENT_STATUS, item.incidentStatusCode)}
                      </Chip>
                    </td>
                    <td className="px-4 py-3.5">
                      {units.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {units.map((u) => (
                            <Chip key={u.id} className={statusTone(u.status)}>
                              {u.role.toUpperCase()} · {u.status}
                            </Chip>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] italic text-[#94a3b8]">Unassigned</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#60738f]">
                      <Clock3 size={11} className="mr-1 inline" />
                      {item.elapsed}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[11px] font-bold text-white transition hover:-translate-y-px hover:bg-(--gf-green-dark) focus-visible:outline-2 focus-visible:outline-(--gf-green)"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-[#60738f]">
                    {emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {expanded && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/30"
          aria-label="Minimize table"
          onClick={() => setExpanded(false)}
        />
      )}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Dispatch & Responders View                                              */
/* ----------------------------------------------------------------------- */

function DispatchView({ tab, onOpen }) {
  const { incidents, assignments, responders } = useBdrrmoDemo();
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");

  if (tab === "Active Units") {
    const active = assignments.filter((a) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode));
    return (
      <section className="overflow-hidden rounded-xl border border-[#e2e8eb] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[10px] font-bold uppercase tracking-wider text-[#60738f]">
                {["Incident", "Responder Unit", "Department", "Unit Status", "Dispatched", "Action"].map((h) => (
                  <th className="px-4 py-3.5" key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((a) => {
                const linked = incidents.find((i) => i.id === a.incidentId);
                return (
                  <tr key={a.id} className="border-b border-[#f1f4f6] last:border-b-0 hover:bg-(--gf-row-hover)">
                    <td className="px-4 py-3.5 font-bold text-(--gf-green)">{a.incidentId}</td>
                    <td className="px-4 py-3.5 font-semibold text-[#263246]">{a.responderLabel || a.responderId}</td>
                    <td className="px-4 py-3.5 uppercase text-[#60738f]">{a.role || "TANOD"}</td>
                    <td className="px-4 py-3.5">
                      <Chip className={statusTone(a.statusCode)}>
                        {displayStatus(ASSIGNMENT_STATUS, a.statusCode)}
                      </Chip>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-[#60738f]">{a.assignedAt}</td>
                    <td className="px-4 py-3.5">
                      {linked && (
                        <button
                          type="button"
                          onClick={() => onOpen(linked)}
                          className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark)"
                        >
                          Manage
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!active.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-[#60738f]">
                    No active deployed units right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (tab === "Responder Roster") {
    const roster = responders.filter((r) =>
      availabilityFilter === "ALL" ? true : r.availabilityStatus === availabilityFilter,
    );
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {["ALL", "AVAILABLE", "BUSY", "UNAVAILABLE"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setAvailabilityFilter(status)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                availabilityFilter === status
                  ? "border-(--gf-green) bg-(--gf-green) text-white"
                  : "border-[#dfe7ea] bg-white text-[#60738f] hover:border-(--gf-green)"
              }`}
            >
              {status === "ALL" ? `All (${responders.length})` : displayStatus(AVAILABILITY_STATUS, status)}
            </button>
          ))}
        </div>

        {roster.length === 0 ? (
          <div className="rounded-xl border border-[#e2e8eb] bg-white p-10 text-center text-xs text-[#60738f]">
            No responders match this availability filter.
          </div>
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roster.map((r) => {
              const activeAssign = assignments.find(
                (a) => a.responderId === r.id && !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode),
              );
              const linked = activeAssign ? incidents.find((i) => i.id === activeAssign.incidentId) : null;
              return (
                <article
                  key={r.id || r.unit}
                  className="flex flex-col rounded-xl border border-[#e2e8eb] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="text-sm text-[#263246]">{r.name}</strong>
                      <p className="text-xs text-[#60738f]">{r.unit}</p>
                    </div>
                    <Chip className={statusTone(r.availabilityStatus)}>
                      {displayStatus(AVAILABILITY_STATUS, r.availabilityStatus)}
                    </Chip>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-[#7c8ba3]">Active Assignment</dt>
                      <dd className="font-semibold text-[#263246]">{activeAssign?.incidentId ?? "Standby"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#7c8ba3]">Last Update</dt>
                      <dd className="font-semibold text-[#263246]">{r.updated}</dd>
                    </div>
                  </dl>
                  {linked && (
                    <button
                      type="button"
                      onClick={() => onOpen(linked)}
                      className="mt-4 w-full rounded-md bg-(--gf-green) py-2 text-xs font-bold text-white transition hover:bg-(--gf-green-dark)"
                    >
                      Manage {linked.id}
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <IncidentTable
        rows={incidents.filter((i) => i.incidentStatusCode !== "CLOSED")}
        onOpen={onOpen}
        emptyLabel="No open emergencies waiting for dispatch."
      />
      <aside className="h-fit rounded-xl border border-[#e2e8eb] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-(--gf-green)">Available Responders</h3>
        <p className="mt-0.5 text-[10px] text-[#60738f]">Live availability from responder roster.</p>
        <div className="mt-3 space-y-2">
          {responders.filter((r) => r.availabilityStatus === "AVAILABLE").length === 0 ? (
            <p className="py-4 text-center text-xs text-[#60738f]">No responders currently available.</p>
          ) : (
            responders
              .filter((r) => r.availabilityStatus === "AVAILABLE")
              .map((r) => (
                <div
                  key={r.id || r.unit}
                  className="flex items-center justify-between rounded-lg border border-[#edf0f2] bg-[#f8fafb] px-3 py-2.5 text-xs"
                >
                  <div>
                    <strong className="block text-[#263246]">{r.name}</strong>
                    <span className="text-[10px] text-[#60738f]">{r.unit}</span>
                  </div>
                  <Chip className="bg-(--gf-green-tint-2) text-(--gf-green)">AVAILABLE</Chip>
                </div>
              ))
          )}
        </div>
      </aside>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Handover & Completion View                                              */
/* ----------------------------------------------------------------------- */

function HandoverView({ tab, onOpen, onIncident }) {
  const { incidents, handovers } = useBdrrmoDemo();

  if (tab === "For Closure" || tab === "Closed") {
    const rows = incidents.filter((i) =>
      tab === "For Closure" ? i.incidentStatusCode === "FOR_CLOSURE_REVIEW" : i.incidentStatusCode === "CLOSED",
    );
    return (
      <IncidentTable
        rows={rows}
        onOpen={onIncident}
        emptyLabel={tab === "For Closure" ? "No incidents awaiting closure review." : "No closed incidents yet."}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#e2e8eb] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[10px] font-bold uppercase tracking-wider text-[#60738f]">
              {["Record", "Incident", "Receiver", "Method", "QR Status", "Created", "Action"].map((h) => (
                <th className="px-4 py-3.5" key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {handovers.map((h) => (
              <tr key={h.id} className="border-b border-[#f1f4f6] last:border-b-0 hover:bg-(--gf-row-hover)">
                <td className="px-4 py-3.5 font-bold text-(--gf-green)">{h.id}</td>
                <td className="px-4 py-3.5 font-semibold text-[#263246]">{h.incidentId}</td>
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-[#263246]">{h.receiver}</span>
                  <span className="block text-[10px] text-[#7c8ba3]">{h.receiverType}</span>
                </td>
                <td className="px-4 py-3.5 text-[#60738f]">{h.method}</td>
                <td className="px-4 py-3.5">
                  <Chip className={statusTone(h.qrStatusCode)}>
                    {displayStatus(QR_STATUS, h.qrStatusCode)}
                  </Chip>
                </td>
                <td className="px-4 py-3.5 text-[11px] text-[#60738f]">{h.createdAt}</td>
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => onOpen(h)}
                    className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark)"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {!handovers.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-[#60738f]">
                  No hospital QR handover records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Incident Manage Drawer (Admin Maintenance Review UI Aesthetic)          */
/* ----------------------------------------------------------------------- */

function IncidentDrawer({ incident: initialIncident, onClose }) {
  const {
    incidents,
    handovers,
    responders,
    batchDispatch,
    broadcastNote,
    verifyClosureForAdmin,
    closeServerIncident,
  } = useBdrrmoDemo();

  const incident = incidents.find((i) => i.id === initialIncident.id) ?? initialIncident;

  const fireLocked = Boolean(incident.lockedDepartments?.fire);
  const policeLocked = Boolean(incident.lockedDepartments?.police);

  const [includeFire, setIncludeFire] = useState(fireLocked);
  const [includePolice, setIncludePolice] = useState(policeLocked);
  const [selectedTanodId, setSelectedTanodId] = useState("");
  const [tacticalNoteDraft, setTacticalNoteDraft] = useState("");
  const [showLiveTrackingMap, setShowLiveTrackingMap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [verifiedComplete, setVerifiedComplete] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  useEffect(() => {
    if (!incident.incidentId) return undefined;
    let active = true;
    const loadChat = async () => {
      try {
        const res = await fetch(`/api/reports/${encodeURIComponent(incident.incidentId)}/messages`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
        }
      } catch {
        // Ignore transient chat poll errors
      }
    };
    void loadChat();
    const timer = window.setInterval(loadChat, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [incident.incidentId]);

  async function handleSendChatMessage() {
    if (!incident.incidentId || !chatDraft.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(incident.incidentId)}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: chatDraft.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not send message.");
      if (data?.message) {
        setChatMessages((prev) => [...prev, data.message]);
      }
      setChatDraft("");
    } catch (err) {
      toast.add({ type: "error", title: "Message failed", description: err.message });
    } finally {
      setSendingChat(false);
    }
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const availableTanods = responders.filter(
    (r) =>
      !["UNAVAILABLE", "OUT_OF_SERVICE"].includes(r.availabilityStatus) &&
      (!r.resourceType || r.resourceType === "TANOD"),
  );
  const dispatchedUnits = incident.dispatchedUnits || [];
  const linkedHandovers = handovers.filter(
    (h) => h.incidentId === incident.incidentId || h.incidentId === incident.id,
  );

  // Live validations
  const incidentErrors = validateIncident(incident);
  const selectedTanod = responders.find((r) => r.id === selectedTanodId) || null;
  const dispatchErrors = [];
  if (!(includeFire || fireLocked || includePolice || policeLocked || selectedTanodId)) {
    dispatchErrors.push("Select at least one department (BFP / Police) or a Tanod.");
  }
  if (selectedTanod && ["UNAVAILABLE", "OUT_OF_SERVICE"].includes(selectedTanod.availabilityStatus)) {
    dispatchErrors.push("Selected Tanod is offline or out of service.");
  }
  const canBatchDispatch = dispatchErrors.length === 0 && incident.incidentStatusCode !== "CLOSED";

  const pendingUnits = dispatchedUnits.filter(
    (u) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(u.status),
  );
  const closureWarnings = [];
  if (dispatchedUnits.length === 0) {
    closureWarnings.push("No responder units have been dispatched yet.");
  }
  if (pendingUnits.length > 0) {
    closureWarnings.push(`${pendingUnits.length} dispatched unit(s) are still active on this incident.`);
  }
  if (linkedHandovers.some((h) => h.qrStatusCode === "PENDING_ACCEPTANCE")) {
    closureWarnings.push("A hospital QR handover is still pending acceptance.");
  }

  const hasCoordinates = Number.isFinite(Number(incident.lat)) && Number.isFinite(Number(incident.lng));
  const liveTrackers = dispatchedUnits
    .filter((u) => u.location && Number.isFinite(u.location.lat) && Number.isFinite(u.location.lng))
    .map((u) => ({
      id: u.id,
      lat: u.location.lat,
      lng: u.location.lng,
      category: u.role === "fire" ? "fire" : u.role === "police" ? "crime" : "incident",
      label: u.label,
    }));

  async function handleBatchDispatch() {
    if (!canBatchDispatch || submitting) return;
    setSubmitting(true);
    try {
      const departments = [];
      if (includeFire || fireLocked) departments.push("fire");
      if (includePolice || policeLocked) departments.push("police");
      await batchDispatch(incident.incidentId, {
        departments,
        tanod_unit_id: selectedTanodId || null,
        tactical_note: tacticalNoteDraft.trim() || undefined,
      });
      setTacticalNoteDraft("");
      setSelectedTanodId("");
      toast.add({
        type: "success",
        title: "Dispatch sent",
        description: `${incident.id} dispatched to selected responders.`,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Dispatch failed", description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBroadcastNote() {
    if (!tacticalNoteDraft.trim() || submitting) return;
    setSubmitting(true);
    try {
      await broadcastNote(incident.incidentId, tacticalNoteDraft.trim());
      setTacticalNoteDraft("");
      toast.add({
        type: "success",
        title: "Tactical note sent",
        description: "Broadcast to all dispatched units on this incident.",
      });
    } catch (err) {
      toast.add({ type: "error", title: "Failed to send note", description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyForAdmin() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await verifyClosureForAdmin(incident.incidentId);
      toast.add({
        type: "success",
        title: "Verified & forwarded to Admin",
        description: `${incident.id} resolution verified by BDRRMO and sent to Admin for final closure.`,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Verification failed", description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAuthorizeClosure() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await closeServerIncident(incident.incidentId);
      setConfirmCloseOpen(false);
      toast.add({
        type: "success",
        title: "Incident closed",
        description: `${incident.id} closed and synced to Admin.`,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Closure failed", description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close emergency drawer"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default border-0 bg-slate-900/40 backdrop-blur-[2px] [animation:gf-fade-in_0.18s_ease-out]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Manage emergency ${incident.id}`}
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-[#e2e8eb] bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.25)] [animation:gf-drawer-in_0.22s_ease-out] sm:w-[44%] sm:min-w-[520px] sm:max-w-[700px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf0f2] bg-(--gf-green-soft) px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold text-(--gf-green)">{incident.id}</h2>
              <Chip className={statusTone(incident.incidentStatusCode)}>
                {displayStatus(INCIDENT_STATUS, incident.incidentStatusCode)}
              </Chip>
              <Chip className={priorityTone(incident.priorityCode)}>
                {incident.priorityCode}
              </Chip>
              <Chip className="bg-[#eef2f4] text-[#60738f]">{incident.category}</Chip>
            </div>
            <p className="mt-1 truncate text-[11px] font-semibold text-[#263246]">
              {incident.title} • {incident.location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#60738f] transition hover:bg-white hover:text-(--gf-green)"
          >
            <X size={16} />
          </button>
        </header>

        <div className="gf-drawer-body">
          {incidentErrors.length > 0 && <ValidationErrors errors={incidentErrors} />}

          <DrawerSection title="Incident Lifecycle Timeline" icon={Clock3} collapsible defaultOpen={false}>
            <IncidentTimeline incident={incident} dispatchedUnits={dispatchedUnits} />
          </DrawerSection>

          <DrawerSection title="Emergency Report & Reporter" icon={ShieldCheck}>
            <div>
              <InfoRow label="Incident ID">{incident.id}</InfoRow>
              <InfoRow label="Category">{incident.category}</InfoRow>
              <InfoRow label="Priority">
                {incident.priorityCode} · {displayStatus(PRIORITY, incident.priorityCode)}
              </InfoRow>
              <InfoRow label="Reporter">
                {incident.reporterName || "Guest Reporter"}
                {incident.reporterPhone ? ` · ${incident.reporterPhone}` : ""}
              </InfoRow>
              <InfoRow label="Submitted">{incident.submittedAt}</InfoRow>
              <InfoRow label="Dispatched Units">
                {dispatchedUnits.length ? `${dispatchedUnits.length} unit(s)` : "None yet"}
              </InfoRow>
            </div>
            {incident.description && (
              <p className="mt-2 rounded-md border border-[#e0e7eb] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#42506a]">
                <span className="font-bold text-[#263246]">Report description:</span> {incident.description}
              </p>
            )}
          </DrawerSection>

          {incident.backupAlerts?.length > 0 && (
            <DrawerSection title="Field Backup / Transport Alerts" icon={TriangleAlert}>
              <div className="space-y-2">
                {incident.backupAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-[#f3d3d3] bg-[#fdecea] p-3 text-[11px] text-[#991b1b]">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={13} />
                      <span>{alert.note.replace("[BACKUP REQUEST] ", "")}</span>
                    </div>
                    <p className="mt-1 text-[9px] text-[#b91c1c]">{alert.created_at}</p>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}

          {incident.incidentStatusCode !== "CLOSED" && (
            <DrawerSection title="Single / Batch Dispatch (BFP, Police & Tanod Transport)" icon={UserCheck}>
              <div
                className={`space-y-3 rounded-lg border border-[#e0e7eb] bg-[#f8fafb] p-3.5 ${
                  incident.bdrrmoVerified ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-[11px] font-bold transition ${
                      fireLocked
                        ? "cursor-not-allowed border-[#f3d3d3] bg-[#fdecea] text-[#dc2626]"
                        : includeFire
                          ? "border-(--gf-green) bg-(--gf-green-soft) text-(--gf-green)"
                          : "border-[#dfe7ea] bg-white text-[#263246]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={includeFire || fireLocked}
                        disabled={fireLocked}
                        onChange={(e) => setIncludeFire(e.target.checked)}
                      />
                      <Flame size={13} className="text-[#dc2626]" />
                      BFP (Fire)
                    </span>
                    {fireLocked && <Lock size={12} title="Auto-locked for Fire incidents" />}
                  </label>

                  <label
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-[11px] font-bold transition ${
                      policeLocked
                        ? "cursor-not-allowed border-[#cbd5f5] bg-[#eef2fb] text-[#4c6fbf]"
                        : includePolice
                          ? "border-(--gf-green) bg-(--gf-green-soft) text-(--gf-green)"
                          : "border-[#dfe7ea] bg-white text-[#263246]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={includePolice || policeLocked}
                        disabled={policeLocked}
                        onChange={(e) => setIncludePolice(e.target.checked)}
                      />
                      <Shield size={13} className="text-[#4c6fbf]" />
                      Police (PNP)
                    </span>
                    {policeLocked && <Lock size={12} title="Auto-locked for Crime incidents" />}
                  </label>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                    Assign Available Tanod (Emergency Patient Transport)
                  </label>
                  <select
                    value={selectedTanodId}
                    onChange={(e) => setSelectedTanodId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-[#dfe7ea] bg-white px-2.5 text-[11px] font-semibold text-[#263246] outline-none focus:border-(--gf-green)"
                  >
                    <option value="">— Optional: No Tanod transport assigned —</option>
                    {availableTanods.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.unit}) — {t.availabilityStatus}
                      </option>
                    ))}
                  </select>
                </div>

                {dispatchErrors.length > 0 && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-[#e69500]">
                    <TriangleAlert size={11} />
                    {dispatchErrors[0]}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!canBatchDispatch || submitting}
                  onClick={handleBatchDispatch}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-(--gf-green) py-2.5 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Truck size={14} />
                  {submitting ? "Dispatching..." : "Dispatch / Batch Dispatch Selected Units"}
                </button>
              </div>
            </DrawerSection>
          )}

          <DrawerSection title="Geotagged Location & Live Unit Tracking" icon={MapPinned}>
            <div className="mb-2.5 flex items-center justify-between rounded-lg border border-[#e0e7eb] bg-white px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[#263246]">
                <Navigation size={13} className="text-(--gf-green)" />
                <span>Show Live Responder Tracking Map ({liveTrackers.length} live GPS)</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showLiveTrackingMap}
                onClick={() => setShowLiveTrackingMap((v) => !v)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  showLiveTrackingMap ? "bg-(--gf-green)" : "bg-[#c8d2da]"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    showLiveTrackingMap ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {showLiveTrackingMap && hasCoordinates && (
              <div className="mb-3 overflow-hidden rounded-lg border border-[#dfe7ea]">
                <div className="h-[220px]">
                  <MapViewer
                    compact
                    incidents={[
                      {
                        id: incident.id,
                        title: incident.title,
                        category: fireLocked ? "fire" : policeLocked ? "crime" : "emergency",
                        status: incident.incidentStatusCode,
                        lat: Number(incident.lat),
                        lng: Number(incident.lng),
                      },
                    ]}
                    selectedIncident={{ id: incident.id, lat: Number(incident.lat), lng: Number(incident.lng) }}
                    trackers={liveTrackers}
                    allowOutsideBounds
                    allowOutsideIncidents
                  />
                </div>
                <div className="flex items-center justify-between bg-[#f8fafb] px-3 py-2 text-[9px] font-bold text-[#60738f]">
                  <span>{incident.location}, Barangay 167</span>
                  <span>
                    {Number(incident.lat).toFixed(4)} N, {Number(incident.lng).toFixed(4)} E
                  </span>
                </div>
              </div>
            )}

            {dispatchedUnits.length > 0 ? (
              <div className="space-y-1.5">
                {dispatchedUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between rounded-lg border border-[#e0e7eb] bg-white px-3 py-2 text-[11px]"
                  >
                    <div>
                      <strong className="text-[#263246]">{unit.label}</strong>
                      <p className="text-[9px] text-[#7c8ba3]">
                        {unit.location
                          ? `Live GPS: ${unit.location.lat.toFixed(4)}, ${unit.location.lng.toFixed(4)}`
                          : "Awaiting live GPS ping"}
                      </p>
                    </div>
                    <Chip className={statusTone(unit.status)}>{unit.status}</Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#7c8ba3]">No units dispatched to this emergency yet.</p>
            )}
          </DrawerSection>

          <DrawerSection title="Direct Emergency Chat (Resident & Field Units)" icon={Send} collapsible defaultOpen={false}>
            <div className="space-y-2 rounded-lg border border-[#e0e7eb] bg-[#f8fafb] p-3">
              {chatMessages.length === 0 ? (
                <p className="py-2 text-center text-[10px] text-[#7c8ba3]">
                  No messages yet. Send a message below to chat directly with the reporting Resident and assigned units.
                </p>
              ) : (
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {chatMessages.map((msg) => {
                    const isDispatcher = ["bdrrmo", "admin"].includes(String(msg.sender_role || "").toLowerCase());
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                          isDispatcher
                            ? "ml-6 bg-(--gf-green) text-white"
                            : "mr-6 border border-[#dfe7ea] bg-white text-[#263246]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[9px] font-bold opacity-80">
                          <span>
                            {msg.sender_name || "User"} ({String(msg.sender_role || "resident").toUpperCase()})
                          </span>
                          <span>
                            {msg.sent_at
                              ? new Date(msg.sent_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                              : ""}
                          </span>
                        </div>
                        <p className="mt-0.5 leading-snug">{msg.body}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {incident.incidentStatusCode !== "CLOSED" && (
                <div className="flex gap-2 pt-1">
                  <input
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendChatMessage();
                      }
                    }}
                    placeholder="Message the Resident reporter or field units..."
                    className="h-9 flex-1 rounded-md border border-[#dfe7ea] bg-white px-3 text-[11px] text-[#263246] outline-none focus:border-(--gf-green)"
                  />
                  <button
                    type="button"
                    disabled={!chatDraft.trim() || sendingChat}
                    onClick={handleSendChatMessage}
                    className="flex items-center gap-1 rounded-md bg-(--gf-green) px-3 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:opacity-40"
                  >
                    <Send size={12} />
                    {sendingChat ? "..." : "Reply"}
                  </button>
                </div>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Shared Tactical Dispatch Notes" icon={Send} collapsible defaultOpen={false}>
            <div className="flex gap-2">
              <input
                value={tacticalNoteDraft}
                onChange={(e) => setTacticalNoteDraft(e.target.value)}
                placeholder="e.g. Road blocked on Rizal St — use Magsaysay Blvd..."
                className="h-9 flex-1 rounded-md border border-[#dfe7ea] bg-white px-3 text-[11px] text-[#263246] outline-none focus:border-(--gf-green)"
              />
              <button
                type="button"
                disabled={!tacticalNoteDraft.trim() || submitting}
                onClick={handleBroadcastNote}
                className="flex items-center gap-1 rounded-md bg-(--gf-green) px-3 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:opacity-40"
              >
                <Send size={12} />
                Send
              </button>
            </div>
            {incident.tacticalNotes?.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {incident.tacticalNotes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border border-[#dfe7ea] bg-(--gf-green-soft)/60 px-3 py-2 text-[11px] text-[#263246]"
                  >
                    {n.note.replace("[BDRRMO NOTE] ", "")}
                    <span className="ml-2 text-[9px] text-[#60738f]">{n.created_at}</span>
                  </li>
                ))}
              </ul>
            )}
          </DrawerSection>

          {incident.agencyReports?.length > 0 && (
            <DrawerSection title="Submitted Field Resolution Reports" icon={CheckCircle2}>
              <ul className="space-y-2">
                {incident.agencyReports.map((rep) => (
                  <li
                    key={rep.id}
                    className="rounded-lg border border-(--gf-green-tint-2) bg-(--gf-green-soft) p-3 text-[11px] text-[#263246]"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-(--gf-green)">
                      <CheckCircle2 size={13} />
                      <span>{rep.note.replace("[AGENCY REPORT] ", "")}</span>
                    </div>
                    <p className="mt-1 text-[9px] text-[#60738f]">{rep.created_at}</p>
                  </li>
                ))}
              </ul>
            </DrawerSection>
          )}

          <DrawerSection title="Evidence & Responder Completion Proof Photos" icon={Camera} last>
            {incident.photos?.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {incident.photos.map((photo, idx) => {
                  const fname = String(photo.filename || "");
                  const label = /^fire-/i.test(fname)
                    ? "BFP Completion Proof"
                    : /^police-/i.test(fname)
                      ? "Police Completion Proof"
                      : /^tanod-/i.test(fname)
                        ? "Tanod Transport Proof"
                        : photo.by_staff
                          ? `Responder Proof #${idx + 1}`
                          : `Reporter Photo #${idx + 1}`;
                  return (
                    <a
                      key={photo.id}
                      href={`/api/reports/${encodeURIComponent(incident.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block h-[120px] overflow-hidden rounded-lg border border-[#dfe7ea] bg-slate-100"
                    >
                      <img
                        src={`/api/reports/${encodeURIComponent(incident.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                        alt={photo.filename}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[8px] font-bold text-white">
                        {label}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-[#7c8ba3]">No photos uploaded yet.</p>
            )}
          </DrawerSection>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf0f2] bg-(--gf-green-soft) px-5 py-3">
          {incident.incidentStatusCode === "CLOSED" ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-(--gf-green)">
              <CheckCircle2 size={12} /> Incident is closed and synced to Admin.
            </span>
          ) : incident.bdrrmoVerified ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-(--gf-green)">
              <CheckCircle2 size={12} /> Verified by BDRRMO — forwarded to Admin for final closure.
            </span>
          ) : closureWarnings.length > 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[#e69500]">
              <TriangleAlert size={11} /> {closureWarnings[0]}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-(--gf-green)">
              <CheckCircle2 size={12} /> All units completed — ready for BDRRMO verification & closure.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#dfe7ea] bg-white px-3 py-2 text-[10px] font-bold text-[#60738f] transition hover:text-(--gf-green)"
            >
              Close
            </button>
            {incident.incidentStatusCode !== "CLOSED" && !incident.bdrrmoVerified && (
              verifiedComplete ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleVerifyForAdmin}
                  className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Sending..." : "Send Back to Admin for Final Closure"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setVerifiedComplete(true)}
                  className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Verify Complete
                </button>
              )
            )}
          </div>
        </footer>
      </aside>

      <ConfirmationDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        onConfirm={handleAuthorizeClosure}
        title="Authorize coordinated closure?"
        description={
          closureWarnings.length > 0
            ? `${incident.id}: ${closureWarnings.join(" ")} Close this incident anyway and sync to Admin?`
            : `${incident.id} will be marked CLOSED and synced to Admin.`
        }
        confirmLabel="Authorize Closure"
      />
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Handover Manage Drawer                                                  */
/* ----------------------------------------------------------------------- */

function HandoverDrawer({ record, onClose, onIncident }) {
  const errors = validateHandover(record, { correctionReason: record.remarks });

  return (
    <>
      <button
        type="button"
        aria-label="Close handover drawer"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default border-0 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Handover ${record.id}`}
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-[#e2e8eb] bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.25)] sm:w-[40%] sm:min-w-[460px] sm:max-w-[600px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf0f2] bg-(--gf-green-soft) px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold text-(--gf-green)">Handover {record.id}</h2>
              <Chip className={statusTone(record.qrStatusCode)}>
                {displayStatus(QR_STATUS, record.qrStatusCode)}
              </Chip>
            </div>
            <p className="mt-0.5 text-[10px] text-[#60738f]">Incident {record.incidentId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#60738f] transition hover:bg-white hover:text-(--gf-green)"
          >
            <X size={16} />
          </button>
        </header>

        <div className="gf-drawer-body">
          {errors.length > 0 && <ValidationErrors errors={errors} />}
          <DrawerSection title="Hospital QR Handover Details" icon={Handshake}>
            <InfoRow label="Incident">{record.incidentId}</InfoRow>
            <InfoRow label="Receiver">{record.receiver}</InfoRow>
            <InfoRow label="Receiving Officer">{record.officer}</InfoRow>
            <InfoRow label="Method">{record.method}</InfoRow>
            <InfoRow label="Created">{record.createdAt}</InfoRow>
            <InfoRow label="Accepted">{record.acceptedAt ?? "Pending scan"}</InfoRow>
            <InfoRow label="Expires">{record.expiresAt ?? "—"}</InfoRow>
          </DrawerSection>
          <DrawerSection title="Remarks" icon={ShieldCheck} last>
            <p className="text-[11px] leading-relaxed text-[#42506a]">{record.remarks}</p>
          </DrawerSection>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#edf0f2] bg-(--gf-green-soft) px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#dfe7ea] bg-white px-3 py-2 text-[10px] font-bold text-[#60738f]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onIncident}
            className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[10px] font-bold text-white hover:bg-(--gf-green-dark)"
          >
            Open Linked Incident
          </button>
        </footer>
      </aside>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Analytics & Settings Views                                              */
/* ----------------------------------------------------------------------- */

function Analytics({ meta, rows, onOpen, selected }) {
  const { incidents, assignments, supportRequests, handovers } = useBdrrmoDemo();
  const [section, setSection] = useState("Overview");

  function exportCsv() {
    if (!incidents.length) {
      toast.add({ type: "error", title: "Nothing to export", description: "No live incidents available." });
      return;
    }
    const headers = ["ID", "Title", "Category", "Location", "Priority", "Status", "Submitted"];
    const lines = [
      headers.join(","),
      ...incidents.map((i) =>
        [i.id, i.title, i.category, i.location, i.priorityCode, i.incidentStatusCode, i.submittedAt]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bdrrmo-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <Header meta={meta} />
      <Tabs tabs={["Overview", "Report Builder"]} value={section} onChange={setSection} />

      {section === "Report Builder" ? (
        <ReportBuilder />
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-md bg-(--gf-green) px-3.5 py-2 text-xs font-bold text-white transition hover:bg-(--gf-green-dark)"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Emergencies", incidents.length],
              ["Awaiting Dispatch", incidents.filter((i) => i.incidentStatusCode === "FORWARDED_TO_BDRRMO").length],
              ["Active Units", assignments.filter((a) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode)).length],
              ["For Closure", incidents.filter((i) => i.incidentStatusCode === "FOR_CLOSURE_REVIEW").length],
            ].map(([label, value]) => (
              <article key={label} className="rounded-xl border border-[#e2e8eb] bg-white p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#60738f]">{label}</span>
                <strong className="mt-2 block text-2xl font-extrabold text-[#263246]">{value}</strong>
              </article>
            ))}
          </section>
          <section className="grid gap-5 lg:grid-cols-2">
            <Chart
              title="Records by Stage"
              labels={["Incidents", "Dispatches", "Backup Alerts", "QR Handovers"]}
              values={[incidents.length, assignments.length, supportRequests.length, handovers.length]}
            />
            <Chart
              title="Incidents by Status"
              labels={["Forwarded", "Active", "For Closure", "Closed"]}
              values={[
                incidents.filter((i) => i.incidentStatusCode === "FORWARDED_TO_BDRRMO").length,
                incidents.filter((i) => activeIncidentCodes.includes(i.incidentStatusCode)).length,
                incidents.filter((i) => i.incidentStatusCode === "FOR_CLOSURE_REVIEW").length,
                incidents.filter((i) => i.incidentStatusCode === "CLOSED").length,
              ]}
            />
          </section>
          <IncidentTable rows={rows} onOpen={onOpen} emptyLabel="No emergency records available." />
        </>
      )}

      {selected && <IncidentDrawer incident={selected} onClose={() => onOpen(null)} />}
    </div>
  );
}

function SettingsView({ meta }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [compact, setCompact] = useState(false);

  return (
    <div className="space-y-5">
      <Header meta={meta} />
      <section className="max-w-3xl rounded-xl border border-[#e2e8eb] bg-white p-5 shadow-sm">
        <h3 className="font-bold text-[#263246]">Account</h3>
        <div className="mt-3 rounded-lg bg-[#f8fafb] p-4">
          <strong className="text-sm text-[#263246]">
            {user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "BDRRMO Officer"}
          </strong>
          <p className="text-xs text-[#60738f]">Role: {user?.role || "bdrrmo"}</p>
        </div>
        <h3 className="mt-6 font-bold text-[#263246]">Dashboard preferences</h3>
        <Toggle label="Operational notifications" value={notifications} setValue={setNotifications} />
        <Toggle label="Compact table density" value={compact} setValue={setCompact} />
        <button
          type="button"
          onClick={() => toast.add({ type: "success", title: "Preferences saved", description: "Your BDRRMO workspace preferences have been updated." })}
          className="mt-5 rounded-md bg-(--gf-green) px-4 py-2 text-xs font-bold text-white hover:bg-(--gf-green-dark)"
        >
          Save preferences
        </button>
      </section>
    </div>
  );
}

function Toggle({ label, value, setValue }) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-[#edf0f2] pt-4">
      <span className="text-sm font-semibold text-[#263246]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => setValue(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-(--gf-green)" : "bg-[#c8d2da]"}`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

function Chart({ title, labels, values }) {
  const max = Math.max(1, ...values);
  return (
    <div className="rounded-xl border border-[#e2e8eb] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-(--gf-green)">{title}</h3>
      <div className="mt-6 flex h-36 items-end gap-4">
        {values.map((v, i) => (
          <div key={labels[i]} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#263246]">{v}</span>
            <span
              className="w-full rounded-t bg-(--gf-green)"
              style={{ height: `${Math.max(8, (v / max) * 100)}px` }}
            />
            <span className="text-[10px] text-[#60738f]">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValidationErrors({ errors }) {
  return (
    <div role="alert" className="rounded-lg border border-[#f3d3d3] bg-[#fdecea] p-3 text-[11px] text-[#991b1b]">
      <strong>Validation issues:</strong>
      <ul className="mt-1.5 list-disc pl-5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function IncidentTimeline({ incident, dispatchedUnits = [] }) {
  const earliestDispatch = dispatchedUnits
    .map((u) => u.dispatched_at)
    .filter(Boolean)
    .sort()[0];
  const anyOnScene =
    incident.incidentStatusCode === "ON_SCENE" ||
    dispatchedUnits.some((u) => ["ON_SCENE", "COMPLETED"].includes(u.status));
  const anyResolved =
    ["FOR_CLOSURE_REVIEW", "CLOSED"].includes(incident.incidentStatusCode) ||
    (incident.agencyReports?.length || 0) > 0;
  const isClosed = incident.incidentStatusCode === "CLOSED";

  const steps = [
    { key: "Submitted", done: true, timestamp: incident.submittedAt || "Recorded" },
    { key: "Forwarded", done: true, timestamp: incident.submittedAt || "Escalated to BDRRMO" },
    { key: "Dispatched", done: dispatchedUnits.length > 0 || anyOnScene || anyResolved || isClosed, timestamp: earliestDispatch || "Pending dispatch" },
    { key: "On Scene", done: anyOnScene || anyResolved || isClosed, timestamp: anyOnScene ? "Unit arrived on scene" : "Awaiting arrival" },
    { key: "Resolved", done: anyResolved || isClosed, timestamp: incident.agencyReports?.[0]?.created_at || (anyResolved ? "Field proof submitted" : "Pending resolution") },
    { key: "Closed", done: isClosed, timestamp: isClosed ? "Authorized & synced to Admin" : "Pending BDRRMO closure" },
  ];

  const activeIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {steps.map((step, idx) => {
          const isCurrent = idx === activeIdx;
          return (
            <span
              key={step.key}
              className={`gf-stage ${
                isCurrent ? "text-[#e69500]" : step.done ? "text-(--gf-green)" : "text-[#a0b0c0]"
              }`}
            >
              <span
                className={`gf-stage-dot ${
                  step.done ? "gf-stage-dot--done" : isCurrent ? "gf-stage-dot--active" : "gf-stage-dot--locked"
                }`}
              >
                {step.done ? "✓" : ""}
              </span>
              {step.key}
            </span>
          );
        })}
      </div>

      <ol className="mt-2 space-y-1.5 border-l-2 border-[#e2e8eb] pl-3">
        {steps.map((step, idx) => {
          const isCurrent = idx === activeIdx;
          return (
            <li key={step.key} className="flex items-center justify-between gap-2 text-[10px]">
              <span
                className={`font-bold ${
                  step.done ? "text-(--gf-green)" : isCurrent ? "text-[#e69500]" : "text-[#94a3b8]"
                }`}
              >
                {step.key}
              </span>
              <span className="text-right text-[9px] text-[#60738f]">{step.timestamp}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
