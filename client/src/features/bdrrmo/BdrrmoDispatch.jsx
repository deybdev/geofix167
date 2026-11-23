import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, LayoutGrid, List, MapPin, Radio, Search, Truck, Users } from "lucide-react";
import { PATHS } from "../../router/paths";
import { Chip } from "./ui";
import { statusTone } from "./constants";
import { displayStatus, AVAILABILITY_STATUS, ASSIGNMENT_STATUS } from "./statusModel";
import { useBdrrmoDemo } from "./BdrrmoDemoContext";
import { IncidentDrawer } from "./BdrrmoIncidents";

function formatDuration(assignedAt) {
  if (!assignedAt) return "—";
  const ts = Date.parse(assignedAt);
  if (!Number.isFinite(ts)) return String(assignedAt);
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function statusAccent(availabilityStatus) {
  if (availabilityStatus === "AVAILABLE") return "border-l-emerald-500";
  if (availabilityStatus === "BUSY") return "border-l-rose-500";
  if (availabilityStatus === "UNAVAILABLE") return "border-l-amber-500";
  if (availabilityStatus === "OUT_OF_SERVICE") return "border-l-slate-400";
  return "border-l-slate-300";
}

const RESPONDER_STATUS_OPTIONS = ["ALL", "AVAILABLE", "BUSY", "UNAVAILABLE", "OUT_OF_SERVICE"];
const VEHICLE_STATUS_OPTIONS = ["ALL", "AVAILABLE", "BUSY", "OUT_OF_SERVICE"];

function matchesDepartment(item, department, type) {
  if (department === "ALL") return true;
  const haystack =
    type === "responder"
      ? `${item.name || ""} ${item.unit || ""} ${item.resourceType || ""} ${item.role || ""}`.toLowerCase()
      : `${item.name || ""} ${item.type || ""} ${item.plate || ""}`.toLowerCase();
  if (department === "TANOD") return haystack.includes("tanod") || haystack.includes("patrol") || haystack.includes("tricycle") || haystack.includes("transport");
  if (department === "BDRRMO") return haystack.includes("bdrrmo") || haystack.includes("command");
  if (department === "MEDICAL") return haystack.includes("medical") || haystack.includes("ambulance") || haystack.includes("ems");
  return true;
}

function KpiCard({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[#e2e8eb] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md cursor-pointer"
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#60738f]">{label}</span>
      <strong className="mt-2 block text-2xl font-extrabold text-[#263246]">{value}</strong>
    </button>
  );
}

function StatusPills({ options, value, onChange, counts, labelMap }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((status) => {
        const active = value === status;
        const label = labelMap?.[status] ?? (status === "ALL" ? "All" : displayStatus(AVAILABILITY_STATUS, status));
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={`rounded-lg border px-3.5 py-2 text-xs font-bold transition ${
              active
                ? "border-(--gf-green) bg-(--gf-green) text-white"
                : "border-[#dfe7ea] bg-white text-[#60738f] hover:border-(--gf-green) hover:text-(--gf-green)"
            }`}
          >
            {label} ({counts[status] ?? 0})
          </button>
        );
      })}
    </div>
  );
}

function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-[#dfe7ea] bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`rounded-md p-2 transition ${value === "grid" ? "bg-(--gf-green) text-white" : "text-[#60738f] hover:text-(--gf-green)"}`}
        aria-label="Grid view"
        aria-pressed={value === "grid"}
      >
        <LayoutGrid size={15} />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`rounded-md p-2 transition ${value === "list" ? "bg-(--gf-green) text-white" : "text-[#60738f] hover:text-(--gf-green)"}`}
        aria-label="List view"
        aria-pressed={value === "list"}
      >
        <List size={15} />
      </button>
    </div>
  );
}

function ActiveDeploymentsTab({ assignments, incidents, vehicles, onOpenIncident, onRelease }) {
  const active = useMemo(
    () => assignments.filter((a) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode)),
    [assignments],
  );

  const vehicleForIncident = (incident) => {
    if (!incident) return "—";
    const byLocation = vehicles.find((v) => v.availabilityStatus === "BUSY" && incident.location && v.location && incident.location.toLowerCase().includes(v.location.toLowerCase()));
    if (byLocation) return byLocation.name;
    const byReverse = vehicles.find((v) => v.availabilityStatus === "BUSY" && incident.location && v.location && v.location.toLowerCase().includes(incident.location.toLowerCase()));
    return byReverse?.name || "—";
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[#e2e8eb] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[10px] font-bold uppercase tracking-wider text-[#60738f]">
              {["Incident", "Responder Unit", "Vehicle", "Department", "Location / Purok", "Unit Status", "Dispatched", "Elapsed Time", "Action"].map((h) => (
                <th className="px-4 py-3.5" key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((a) => {
              const incident = incidents.find((i) => i.id === a.incidentId || i.incidentId === a.serverIncidentId);
              return (
                <tr key={a.id} className="border-b border-[#f1f4f6] last:border-b-0 hover:bg-(--gf-row-hover)">
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => incident && onOpenIncident(incident)}
                      className="font-bold text-(--gf-green) hover:underline disabled:cursor-default disabled:no-underline"
                      disabled={!incident}
                    >
                      {a.incidentId}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-[#263246]">{a.responderLabel || a.responderId}</td>
                  <td className="px-4 py-3.5 text-[#60738f]">{vehicleForIncident(incident)}</td>
                  <td className="px-4 py-3.5 uppercase text-[#60738f]">{a.role || "TANOD"}</td>
                  <td className="px-4 py-3.5 text-[#60738f]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={12} className="shrink-0 text-(--gf-green)" />
                      {incident?.location || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Chip className={statusTone(a.statusCode)}>{displayStatus(ASSIGNMENT_STATUS, a.statusCode)}</Chip>
                  </td>
                  <td className="px-4 py-3.5 text-[11px] text-[#60738f]">{a.assignedAt || "—"}</td>
                  <td className="px-4 py-3.5 text-[11px] font-semibold text-[#60738f]">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={12} className="text-(--gf-green)" />
                      {incident?.elapsed || formatDuration(a.assignedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onRelease(a.incidentId)}
                      className="rounded-md border border-[#dfe7ea] px-2.5 py-1.5 text-[11px] font-bold text-[#60738f] transition hover:border-(--gf-green) hover:text-(--gf-green)"
                    >
                      Release / Mark Clear
                    </button>
                  </td>
                </tr>
              );
            })}
            {!active.length && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-xs text-[#60738f]">No active deployed units right now.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommandCard({ title, subtitle, status, statusLabel, details, viewMode, footer }) {
  const accent = statusAccent(status);
  if (viewMode === "list") {
    return (
      <article className={`rounded-lg border border-[#e2e8eb] border-l-4 ${accent} bg-white p-3 shadow-sm`}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <strong className="block truncate text-sm font-bold text-[#263246]">{title}</strong>
            <p className="truncate text-[11px] text-[#60738f]">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#60738f]">
            {details.map(([k, v]) => (
              <span key={k}><span className="font-semibold text-[#7c8ba3]">{k}:</span> <span className="font-semibold text-[#263246]">{v}</span></span>
            ))}
          </div>
          <div className="justify-self-start sm:justify-self-end"><Chip className={statusTone(status)}>{statusLabel}</Chip></div>
        </div>
        {footer && <div className="mt-3 flex flex-wrap gap-2 border-t border-[#edf0f2] pt-3">{footer}</div>}
      </article>
    );
  }

  return (
    <article className={`flex flex-col rounded-xl border border-[#e2e8eb] border-l-4 ${accent} bg-white p-5 shadow-sm transition hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-[15px] font-bold text-[#263246]">{title}</strong>
          <p className="mt-0.5 text-xs text-[#60738f]">{subtitle}</p>
        </div>
        <Chip className={statusTone(status)}>{statusLabel}</Chip>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[#edf0f2] pt-4 text-xs">
        {details.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[#7c8ba3]">{k}</dt>
            <dd className="mt-1 text-sm font-semibold text-[#263246]">{v}</dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-4 flex flex-wrap gap-2 border-t border-[#edf0f2] pt-4">{footer}</div>}
    </article>
  );
}

function CardAction({ children, onClick, variant = "default" }) {
  const cls = variant === "primary"
    ? "border-(--gf-green) bg-(--gf-green-soft) text-(--gf-green) hover:bg-(--gf-green) hover:text-white"
    : "border-[#dfe7ea] text-[#60738f] hover:border-(--gf-green) hover:text-(--gf-green)";
  return (
    <button type="button" onClick={onClick} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition ${cls}`}>
      {children}
    </button>
  );
}



function DispatchView({ assignments, responders, vehicles, incidents, releaseAssignment, setResponderAvailability, setVehicleAvailability }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("deployments");
  const [rosterStatusFilter, setRosterStatusFilter] = useState("ALL");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("ALL");
  const [selectedIncident, setSelectedIncident] = useState(null);

  const activeDeployments = useMemo(
    () => assignments.filter((a) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode)),
    [assignments],
  );
  const activeResponderCount = responders.filter((r) => r.availabilityStatus === "AVAILABLE").length;
  const busyResponderCount = responders.filter((r) => r.availabilityStatus === "BUSY").length;
  const availableVehicleCount = vehicles.filter((v) => v.availabilityStatus === "AVAILABLE").length;
  const deployedVehicleCount = vehicles.filter((v) => v.availabilityStatus === "BUSY").length;

  const tabs = [
    { id: "deployments", label: "Active Deployments", icon: Radio, count: activeDeployments.length },
    { id: "roster", label: "Responder Roster", icon: Users, count: responders.length },
    { id: "vehicles", label: "Tanod Vehicles", icon: Truck, count: vehicles.length },
  ];

  const openRoster = (filter) => { setActiveTab("roster"); setRosterStatusFilter(filter); };
  const openVehicles = (filter) => { setActiveTab("vehicles"); setVehicleStatusFilter(filter); };

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Available Responders" value={activeResponderCount} onClick={() => openRoster("AVAILABLE")} />
        <KpiCard label="Busy Responders" value={busyResponderCount} onClick={() => openRoster("BUSY")} />
        <KpiCard label="Available Vehicles" value={availableVehicleCount} onClick={() => openVehicles("AVAILABLE")} />
        <KpiCard label="Deployed Vehicles" value={deployedVehicleCount} onClick={() => setActiveTab("deployments")} />
      </section>

      <section className="space-y-4">
        <div className="border-b border-[#e2e8eb]">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Responders tabs">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
                    active
                      ? "border-(--gf-green) text-(--gf-green)"
                      : "border-transparent text-[#60738f] hover:text-[#263246]"
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-(--gf-green-soft) text-(--gf-green)" : "bg-[#eef2f4] text-[#60738f]"}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {activeTab === "deployments" && (
            <ActiveDeploymentsTab
              assignments={assignments}
              incidents={incidents}
              vehicles={vehicles}
              onOpenIncident={setSelectedIncident}
              onRelease={releaseAssignment}
            />
          )}

          {activeTab === "roster" && (
            <ResponderRosterTabControlled
              assignments={assignments}
              responders={responders}
              incidents={incidents}
              statusFilter={rosterStatusFilter}
              setStatusFilter={setRosterStatusFilter}
              onOpenIncident={setSelectedIncident}
              onRelease={releaseAssignment}
              onSetAvailability={setResponderAvailability}
              navigate={navigate}
            />
          )}

          {activeTab === "vehicles" && (
            <TanodVehiclesTabControlled
              vehicles={vehicles}
              incidents={incidents}
              assignments={assignments}
              statusFilter={vehicleStatusFilter}
              setStatusFilter={setVehicleStatusFilter}
              onOpenIncident={setSelectedIncident}
              onSetAvailability={setVehicleAvailability}
            />
          )}
        </div>
      </section>

      {selectedIncident && (
        <IncidentDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onOpenHandover={(handover) => {
            setSelectedIncident(null);
            navigate(`${PATHS.bdrrmoHandoverCompletion}?incident=${encodeURIComponent(handover.incidentId)}`);
          }}
        />
      )}
    </div>
  );
}

function ResponderRosterTabControlled({ assignments, responders, incidents, statusFilter, setStatusFilter, onOpenIncident, onRelease, onSetAvailability, navigate }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [viewMode, setViewMode] = useState("grid");
  const statusCounts = useMemo(() => RESPONDER_STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = s === "ALL" ? responders.length : responders.filter((r) => r.availabilityStatus === s).length;
    return acc;
  }, {}), [responders]);

  const roster = responders.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || `${r.name} ${r.unit} ${r.id || ""}`.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" ? true : r.availabilityStatus === statusFilter;
    return matchesSearch && matchesStatus && matchesDepartment(r, department, "responder");
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusPills options={RESPONDER_STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} counts={statusCounts} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe7ea] bg-white px-3 sm:w-[260px]">
            <Search size={14} className="shrink-0 text-[#7c8ba3]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full text-xs text-[#263246] outline-none placeholder:text-[#94a3b8]" placeholder="Search responder or callsign..." aria-label="Search responders" />
          </label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 rounded-lg border border-[#dfe7ea] bg-white px-3 text-xs font-semibold text-[#263246] outline-none focus:border-(--gf-green)" aria-label="Filter by department">
            <option value="ALL">All Departments</option>
            <option value="TANOD">Tanod</option>
            <option value="BDRRMO">BDRRMO</option>
            <option value="MEDICAL">Medical</option>
          </select>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="rounded-xl border border-[#e2e8eb] bg-white p-10 text-center text-xs text-[#60738f]">No responders match the current filters.</div>
      ) : (
        <section className={viewMode === "list" ? "space-y-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"}>
          {roster.map((r) => {
            const activeAssign = assignments.find((a) => a.responderId === r.id && !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode));
            const incident = activeAssign ? incidents.find((i) => i.id === activeAssign.incidentId) : null;
            const footer = r.availabilityStatus === "AVAILABLE"
              ? [<CardAction key="assign" variant="primary" onClick={() => navigate(PATHS.bdrrmoIncidents)}>+ Assign Incident</CardAction>]
              : r.availabilityStatus === "BUSY"
                ? [<CardAction key="clear" onClick={() => activeAssign && onRelease(activeAssign.incidentId)}>Mark Clear</CardAction>]
                : [<CardAction key="available" variant="primary" onClick={() => onSetAvailability(r.id, "AVAILABLE")}>Set Available</CardAction>];

            return (
              <CommandCard
                key={r.id || r.unit}
                title={r.name}
                subtitle={r.unit}
                status={r.availabilityStatus}
                statusLabel={displayStatus(AVAILABILITY_STATUS, r.availabilityStatus)}
                viewMode={viewMode}
                details={[
                  ["Active Assignment", activeAssign ? (
                    <button key="a" type="button" onClick={() => incident && onOpenIncident(incident)} className="text-(--gf-green) hover:underline">
                      {activeAssign.incidentId} ↗
                    </button>
                  ) : "Standby"],
                  ["Last Update", r.updated || "—"],
                ]}
                footer={footer}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

function TanodVehiclesTabControlled({ vehicles, incidents, assignments, statusFilter, setStatusFilter, onOpenIncident, onSetAvailability }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const statusCounts = useMemo(() => VEHICLE_STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = s === "ALL" ? vehicles.length : vehicles.filter((v) => v.availabilityStatus === s).length;
    return acc;
  }, {}), [vehicles]);

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || `${v.name} ${v.type} ${v.plate} ${v.id || ""}`.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" ? true : v.availabilityStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const assignmentForVehicle = (vehicle) => {
    if (vehicle.availabilityStatus !== "BUSY") return null;
    const incident = incidents.find((i) => i.location && vehicle.location && (i.location.toLowerCase().includes(vehicle.location.toLowerCase()) || vehicle.location.toLowerCase().includes(i.location.toLowerCase())));
    if (!incident) return null;
    const active = assignments.find((a) => a.incidentId === incident.id && !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode));
    return active ? incident : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusPills options={VEHICLE_STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} counts={statusCounts} labelMap={{ OUT_OF_SERVICE: "Maintenance / Out of Service" }} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe7ea] bg-white px-3 sm:w-[260px]">
            <Search size={14} className="shrink-0 text-[#7c8ba3]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full text-xs text-[#263246] outline-none placeholder:text-[#94a3b8]" placeholder="Search vehicle or plate..." aria-label="Search vehicles" />
          </label>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#e2e8eb] bg-white p-10 text-center text-xs text-[#60738f]">No vehicles match the current filters.</div>
      ) : (
        <section className={viewMode === "list" ? "space-y-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
          {filtered.map((vehicle) => {
            const linkedIncident = assignmentForVehicle(vehicle);
            const footer = vehicle.availabilityStatus === "AVAILABLE"
              ? [<CardAction key="dispatch" variant="primary" onClick={() => onSetAvailability(vehicle.id, "BUSY")}>+ Dispatch Vehicle</CardAction>]
              : vehicle.availabilityStatus === "BUSY"
                ? [<CardAction key="clear" onClick={() => onSetAvailability(vehicle.id, "AVAILABLE")}>Mark Clear</CardAction>]
                : [<CardAction key="maint" onClick={() => onSetAvailability(vehicle.id, "OUT_OF_SERVICE")}>Log Maintenance</CardAction>, <CardAction key="available" variant="primary" onClick={() => onSetAvailability(vehicle.id, "AVAILABLE")}>Set Available</CardAction>];

            return (
              <CommandCard
                key={vehicle.id}
                title={vehicle.name}
                subtitle={`${vehicle.type} · ${vehicle.plate}`}
                status={vehicle.availabilityStatus}
                statusLabel={displayStatus(AVAILABILITY_STATUS, vehicle.availabilityStatus)}
                viewMode={viewMode}
                details={[
                  ["Assigned Crew", vehicle.capacity || "—"],
                  ["Active Assignment", linkedIncident ? (
                    <button key="a" type="button" onClick={() => onOpenIncident(linkedIncident)} className="text-(--gf-green) hover:underline">
                      {linkedIncident.id} ↗
                    </button>
                  ) : (vehicle.availabilityStatus === "BUSY" ? "Deployed" : "Stationed")],
                  ["Location", vehicle.location || "—"],
                  ["Last Update", vehicle.updated || "—"],
                ]}
                footer={footer}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

export default function BdrrmoDispatch() {
  const { assignments, responders, vehicles = [], incidents = [], releaseAssignment, setResponderAvailability, setVehicleAvailability } = useBdrrmoDemo();

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-(--gf-green-soft) p-3 text-(--gf-green)">
          <Radio size={20} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-[#263246]">Responders</h2>
          <p className="text-xs text-[#60738f]">Monitor active deployments, responder availability, and Tanod vehicle readiness.</p>
        </div>
      </div>

      <DispatchView
        assignments={assignments}
        responders={responders}
        vehicles={vehicles}
        incidents={incidents}
        releaseAssignment={releaseAssignment}
        setResponderAvailability={setResponderAvailability}
        setVehicleAvailability={setVehicleAvailability}
      />
    </div>
  );
}
