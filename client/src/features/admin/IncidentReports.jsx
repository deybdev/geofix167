import { useEffect, useMemo, useState } from "react";
import {
  Ambulance, Camera, CheckCircle2, ChevronDown, Download, Eye, FileUp,
  Flame, RotateCcw, ScanLine, Search, Siren, TriangleAlert, Video, Wrench, X,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import { PATHS } from "../../router/paths";
import MapViewer from "../../shared/components/MapViewer";
import {
  FACILITY_PIN_CATEGORY,
  RESPONSE_FACILITIES,
  STAGE_PROGRESS,
  distanceKm,
  facilityInfo,
  pointAtFraction,
  routePoints,
} from "../../shared/utils/dispatch";

const initialReports = [
  {
    id: "GF-001", title: "Vehicular Accident on Rizal Street", category: "Incident / Emergency", urgency: "Critical", accident: true,
    location: "Rizal Street", reporter: "Marvin Navarrete", date: "April 22, 2026", team: "BDRRMO Response",
    status: "In Progress", lat: 14.6538, lng: 121.0325, evidence: ["photo", "video"],
    medical: { injuries: "Driver — head laceration; two passengers — minor bruises", hospital: "Rizal Medical Center", route: "Rizal St → Quezon Ave → Del Pilar Rd (4 mins)" },
    qr: { hospital: "Rizal Medical Center", description: "Two-vehicle collision near the barangay hall; one driver admitted for observation.", contact: "Marvin Navarrete • 0917-555-0167" },
    external: ["Fire Station: Confirmed • Unit: FT-02 • ETA: 5 mins", "Police Station: Requested"],
  },
  { id: "GF-002", title: "Broken Streetlight Pole", category: "Electrical", urgency: "Non-Emergency", location: "Quezon Avenue", reporter: "Rain Opinion", date: "April 21, 2026", team: "Engineering Crew B", status: "In Progress", lat: 14.7321, lng: 121.0192, evidence: ["photo"] },
  { id: "GF-003", title: "Clogged Drainage Canal", category: "Sanitation", urgency: "Non-Emergency", location: "Magsaysay Boulevard", reporter: "Ellyz Gomez", date: "April 20, 2026", team: "Barangay Sanitizers", status: "Verified Fixed", lat: 14.7269, lng: 121.0174, evidence: ["photo"] },
  {
    id: "GF-004", title: "Exposed Power Lines", category: "Electrical", urgency: "Emergency",
    location: "Roxas Boulevard", reporter: "Cataluna Jhone", date: "April 19, 2026", team: "BDRRMO Response",
    status: "Reported", lat: 14.7307, lng: 121.0138, evidence: ["photo", "video"],
    medical: { injuries: "One resident treated on-site for minor electric shock", hospital: "Rizal Medical Center", route: "Roxas Blvd → Rizal St (6 mins)" },
    qr: null,
  },
  { id: "GF-005", title: "Cracked Sidewalk Path", category: "Road Damage", urgency: "Non-Emergency", location: "Bonifacio Street", reporter: "Rain Santiago", date: "April 18, 2026", team: "Barangay Public Works", status: "Verified Fixed", lat: 14.7292, lng: 121.0161, evidence: ["photo"] },
  {
    id: "GF-006", title: "Vandalized Water Main", category: "Incident / Emergency", urgency: "Critical",
    location: "Magsaysay Boulevard", reporter: "Efren Cahilig", date: "April 17, 2026", team: "BDRRMO Response",
    status: "In Progress", lat: 14.7269, lng: 121.0174, evidence: ["photo"],
    medical: { injuries: "No injuries reported", hospital: "Barangay Health Station", route: "Magsaysay Blvd → Health Station (2 mins)" },
    qr: { hospital: "Barangay Health Station", description: "Damaged water main flooding the roadside near the market.", contact: "Efren Cahilig • 0918-442-7781" },
    external: ["Police Station: Confirmed • Unit: PN-07 • ETA: 8 mins"],
  },
];

const statuses = ["All Statuses", "Reported", "In Progress", "Verified Fixed"];
const categories = ["All Categories", "Road Damage", "Electrical", "Sanitation", "Incident / Emergency"];
const locations = ["All Locations", "Rizal Street", "Quezon Avenue", "Magsaysay Boulevard", "Roxas Boulevard", "Bonifacio Street"];

const URGENCY_STYLES = { Critical: "bg-[#fdecea] text-[#dc2626]", Emergency: "bg-[#fff1c6] text-[#e69500]", "Non-Emergency": "bg-[#dcefe5] text-[#2e8b57]" };
const STATUS_STYLES = { Reported: "bg-[#fff1c6] text-[#e69500]", "In Progress": "bg-[#dcefe5] text-[#2e8b57]", "Verified Fixed": "bg-[#d9f7e4] text-[#2e8b57]" };

const BTN_CANCEL = "rounded-md border border-[#dfe7ea] bg-white px-4 py-2 text-[10px] font-bold text-[#60738f]";
const BTN_PRIMARY = "rounded-md bg-[#2e8b57] px-4 py-2 text-[10px] font-bold text-white hover:bg-[#26764a]";

const ROUTES = [["BDRRMO (Emergency)", Siren], ["Barangay Maintenance (Infrastructure)", Wrench]];

/* External units requestable through BDRRMO dispatch. Hospitals are only
   offered for accident incidents. unit/eta simulate the confirming response. */
const EXTERNAL_AGENCIES = {
  police: { label: "Nearest Police Station", confirmed: "Police Station", icon: Siren, unit: "PN-07", eta: "8 mins" },
  fire: { label: "Nearest Fire Station", confirmed: "Fire Station", icon: Flame, unit: "FT-02", eta: "5 mins" },
  hospital: { label: "Nearest Hospital", confirmed: "Hospital", icon: Ambulance, unit: "AMB-03", eta: "6 mins", accidentOnly: true },
};
const agenciesFor = (report) => Object.entries(EXTERNAL_AGENCIES).filter(([, agency]) => !agency.accidentOnly || report.accident);
const TEAM_OPTIONS = ["BDRRMO Response", "Maintenance Team A", "Engineering Crew B", "Barangay Sanitizers", "Meralco Dispatch", "Barangay Public Works"];

/* Mocked road-status advisories surfaced during unit tracking so dispatch can
   anticipate slowdowns on the responder's route. */
const ROAD_CLOSURES = {
  police: [
    { road: "Quezon Ave", section: "Between Del Pilar Rd & Rizal St", note: "Pipe-laying works — single-lane alternating" },
    { road: "Rizal St Ext.", section: "Length of Barangay 167", note: "Clear, no obstructions" },
  ],
  fire: [
    { road: "Rizal St Ext.", section: "Near public market", note: "Market congestion — expect slowdown" },
    { road: "Sampaguita St", section: "Rail-side segment", note: "Partial closure for drainage repair" },
  ],
  hospital: [
    { road: "Magsaysay Blvd", section: "Approach to Health Station", note: "Road repair — reduced to one lane" },
    { road: "Barangay Road 3", section: "School frontage", note: "Clear, no obstructions" },
  ],
};

const isEmergency = (report) => report.urgency === "Critical" || report.urgency === "Emergency";

function SelectFilter({ value, options, onChange }) {
  return (
    <label className="relative min-w-[112px] flex-1">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-full appearance-none rounded-md border border-[#dfe5e8] bg-white px-2.5 pr-7 text-[9px] text-[#2e8b57] outline-none focus:border-[#2e8b57]">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2e8b57]" />
    </label>
  );
}

function Badge({ label, styles }) {
  return <span className={`inline-flex rounded px-2 py-1 text-[8px] font-bold ${styles}`}>{label}</span>;
}

/* Shared dialog shell: overlay + centered panel + header with close. */
function ModalShell({ title, subtitle, labelledBy, onClose, children, footer, width = "max-w-[430px]", backdrop = "z-[70]", panel = "z-[80]" }) {
  return (
    <>
      <button type="button" onClick={onClose} aria-label={`Close ${title} dialog`} className={`fixed inset-0 ${backdrop} bg-slate-950/35 backdrop-blur-sm`} />
      <section role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={`fixed left-1/2 top-1/2 ${panel} flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] ${width} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#dfe7ea] bg-white shadow-[0_20px_60px_rgba(27,52,70,0.22)]`}>
        <div className="flex shrink-0 items-start justify-between border-b border-[#e7ecef] px-4 py-4">
          <div><h2 id={labelledBy} className="text-[15px] font-bold text-[#2e8b57]">{title}</h2><p className="mt-1 text-[10px] text-[#60738f]">{subtitle}</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-0.5 text-[#60738f] hover:text-[#2e8b57]"><X size={14} /></button>
        </div>
        {children}
        {footer}
      </section>
    </>
  );
}

function ModalSection({ title, children }) {
  return (
    <section className="border-b border-[#edf0f2] pb-4 last:border-0">
      <h4 className="mb-2 text-[10px] font-bold uppercase text-[#60738f]">{title}</h4>
      {children}
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between border-b border-[#edf0f2] py-2.5 last:border-0">
      <span className="shrink-0 text-[10px] text-[#7184a0]">{label}</span>
      <strong className="text-right text-[10px] leading-3 text-[#60738f]">{value}</strong>
    </div>
  );
}

function RowList({ rows }) {
  return <div className="overflow-hidden rounded-lg border border-[#e0e7eb] px-3">{rows.map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</div>;
}

/* View → Incident intake, geotagged location, evidence, on-scene medical tracking,
   QR follow-up data, and a resolution mechanism gated by an uploaded proof file. */
function IncidentDetailsModal({ report, onClose, onResolve, onSaved }) {
  const [proof, setProof] = useState(null);
  const emergency = isEmergency(report);
  const resolved = report.status === "Verified Fixed";

  function resolve() {
    if (!proof) return;
    onResolve(report.id, { status: "Verified Fixed" });
    onClose();
    onSaved({ ...report, status: "Verified Fixed" }, "resolve");
  }

  return (
    <ModalShell title="Incident Details & Resolution" labelledBy="incident-details-title"
      subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[1000px]"
      footer={<footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e7ecef] bg-[#f3faf6] px-5 py-3">
        {resolved ? <p className="min-w-0 flex-1 text-[9px] text-[#2e8b57]"><CheckCircle2 size={12} className="mr-1 inline" />Resolution already verified.</p>
          : <p className="min-w-0 flex-1 text-[9px] text-[#7184a0]">Proof of response/repair must be uploaded before resolution can be marked.</p>}
        <button type="button" disabled={!proof || resolved} onClick={resolve} aria-disabled={!proof || resolved}
          className={`shrink-0 rounded-md px-4 py-2 text-[10px] font-bold ${proof && !resolved ? BTN_PRIMARY : `${BTN_PRIMARY} cursor-not-allowed opacity-50`}`}>
          Mark as Resolved
        </button>
      </footer>}>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4">
        <ModalSection title="Initial Intake & Location">
          <RowList rows={[["Report ID", report.id], ["Reporter", report.reporter], ["Date Reported", report.date], ["Urgency", report.urgency], ["Location", `${report.location}, Barangay 167`]]} />
          {/* Geotagged map (shared MapViewer) showing where the incident happened */}
          <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="h-[340px]">
              <MapViewer compact incidents={[{ id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng }]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} expandPath={PATHS.adminMapView} />
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-[9px] font-bold text-[#60738f]">
              <span>{report.location}, Barangay 167</span>
              <span>{report.lat.toFixed(4)} N, {report.lng.toFixed(4)} E</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {report.evidence.includes("photo") && (
              <div className="flex h-[140px] items-center justify-center gap-1 rounded-lg border border-[#dfe7ea] bg-[linear-gradient(150deg,#efe9dd_0%,#cdbfa8_55%,#8f8168_100%)] text-[#5c5343]"><Camera size={18} /><span className="text-[9px] font-bold">photo-evidence.jpg</span></div>
            )}
            {report.evidence.includes("video") && (
              <div className="flex h-[140px] items-center justify-center gap-1 rounded-lg border border-[#dfe7ea] bg-[linear-gradient(150deg,#33312c_0%,#6b665a_60%,#a39c8d_100%)] text-[#f3faf6]"><Video size={18} /><span className="text-[9px] font-bold">clip-evidence.mp4 • 0:42</span></div>
            )}
          </div>
        </ModalSection>

        {emergency && report.medical && (
          <ModalSection title="On-Scene & Medical Tracking (BDRRMO)">
            <RowList rows={[["Identified Injuries", report.medical.injuries], ["Recommended Hospital", report.medical.hospital], ["Route to Hospital", report.medical.route]]} />
          </ModalSection>
        )}

        {report.external?.length > 0 && (
          <ModalSection title="External Unit Status">
            <div className="grid gap-1.5">
              {report.external.map((unit) => <p key={unit} className="rounded-md border border-[#d9e8df] bg-[#f3faf6] px-2.5 py-2 text-[9px] font-medium text-[#60738f]"><Siren size={11} className="mr-1 inline text-[#2e8b57]" />{unit}</p>)}
            </div>
          </ModalSection>
        )}

        <ModalSection title="QR Follow-up Data">
          {report.qr ? (
            <RowList rows={[["Admitting Hospital", report.qr.hospital], ["Incident Description", report.qr.description], ["Contact Person", report.qr.contact]]} />
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-[#d5dee3] p-3 text-[9px] text-[#60738f]"><ScanLine size={14} className="text-[#2e8b57]" />Awaiting on-site QR code follow-up submission.</p>
          )}
        </ModalSection>

        <ModalSection title="Resolution Verification">
          {resolved ? (
            <p className="text-[9px] text-[#2e8b57]"><CheckCircle2 size={12} className="mr-1 inline" />This report has been verified as fixed.</p>
          ) : (
            <>
              <label htmlFor="proof-upload" className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-[#c9d8ce] bg-[#f8fafb] p-4 text-center hover:border-[#2e8b57]">
                <FileUp size={18} className="text-[#2e8b57]" />
                <span className="text-[10px] font-bold text-[#263246]">Upload Proof of Response/Repair</span>
                <span className="text-[9px] text-[#60738f]">Photos or video of the completed repair or response.</span>
                <input id="proof-upload" type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => event.target.files[0] && setProof(event.target.files[0].name)} />
              </label>
              {proof && <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-[#2e8b57]"><CheckCircle2 size={12} />{proof} uploaded.</p>}
            </>
          )}
        </ModalSection>
      </div>
    </ModalShell>
  );
}

/* Assign → triage routing between BDRRMO and barangay maintenance, including
   multi-agency requests with simulated external unit confirmations. */
function DispatchModal({ report, onClose, onDispatch, onTransaction }) {
  const [routedTo, setRoutedTo] = useState(isEmergency(report) ? ROUTES[0][0] : ROUTES[1][0]);
  const [team, setTeam] = useState(isEmergency(report) ? "BDRRMO Response" : report.team);
  const [requests, setRequests] = useState({});
  /* Hospitals are only requestable for accident incidents. */
  const agencies = useMemo(() => agenciesFor(report), [report]);
  const maintenance = routedTo === ROUTES[1][0];

  /* Simulate external agencies confirming their unit a few seconds after a request. */
  useEffect(() => {
    if (!agencies.some(([key]) => requests[key] === "requested")) return;
    const timer = setTimeout(() => setRequests((current) => Object.fromEntries(
      agencies.map(([key, agency]) => [key, current[key] === "requested" ? { unit: agency.unit, eta: agency.eta } : current[key]]),
    )), 1600);
    return () => clearTimeout(timer);
  }, [requests, agencies]);

  function confirm() {
    const units = agencies
      .flatMap(([key, agency]) => {
        const state = requests[key];
        if (!state) return [];
        const info = facilityInfo(key, report);
        return [{ key, confirmed: agency.confirmed, station: info.name, via: info.via, km: info.km, unit: state.unit ?? "—", eta: state.eta ?? info.eta, status: state === "requested" ? "Requested" : "Confirmed" }];
      })
      .sort((a, b) => a.km - b.km)
      .map((unit, index) => ({ ...unit, nearest: index === 0 }));
    const external = units.map((unit) => unit.status === "Confirmed" ? `${unit.confirmed}: Confirmed • Unit: ${unit.unit} • ETA: ${unit.eta}` : `${unit.confirmed}: Requested`);
    const changes = { routedTo, team: maintenance ? team : "BDRRMO Response", status: "In Progress", external: [...report.external ?? [], ...external] };
    onDispatch(report.id, changes);
    onClose();
    onTransaction({ ...report, ...changes }, units, maintenance);
  }

  return (
    <ModalShell title="Assign: Triage & Dispatch" labelledBy="dispatch-modal-title" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[920px]"
      footer={<footer className="flex shrink-0 justify-end gap-2 border-t border-[#e7ecef] bg-[#f3faf6] px-5 py-3"><button type="button" onClick={onClose} className={BTN_CANCEL}>Cancel</button><button type="button" onClick={confirm} className={BTN_PRIMARY}>Confirm Dispatch</button></footer>}>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4">
        <ModalSection title="Workflow Routing">
          <div className="grid grid-cols-2 gap-2">
            {ROUTES.map(([route, Icon]) => (
              <button key={route} type="button" aria-pressed={routedTo === route} onClick={() => setRoutedTo(route)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[9px] font-bold transition-colors ${routedTo === route ? "border-[#2e8b57] bg-[#f3faf6] text-[#2e8b57]" : "border-[#e0e7eb] text-[#60738f] hover:border-[#2e8b57]/60"}`}>
                <Icon size={14} /> {route}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-[#7184a0]">Auto-suggested from the incident urgency ({report.urgency}). {isEmergency(report) ? "Emergency incidents are routed to BDRRMO." : "Infrastructure reports are handled by barangay maintenance."}</p>
        </ModalSection>

        {!maintenance && (
          <ModalSection title="Nearest Response Facilities">
            {/* Inherited MapViewer: accident pin + hospital/fire/police stations so the
                admin can see distances and ETAs before requesting a response. */}
            <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
              <div className="h-[320px]">
                <MapViewer compact incidents={[
                  { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                  ...agencies.map(([key]) => { const facility = RESPONSE_FACILITIES[key]; return { id: `facility-${key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[key], status: "Ready", lat: facility.lat, lng: facility.lng }; }),
                ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} expandPath={PATHS.adminMapView} />
              </div>
              <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Pulsing pin = accident location. Station icons mark the requestable units below.</div>
            </div>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {agencies.map(([key, agency]) => {
                const info = facilityInfo(key, report);
                return (
                  <li key={key} className="flex items-center justify-between gap-2 rounded-md border border-[#e0e7eb] px-2.5 py-2 text-[9px]">
                    <span className="flex min-w-0 items-center gap-2 font-bold text-[#263246]"><agency.icon size={12} className="shrink-0 text-[#2e8b57]" />{info.name}</span>
                    <span className="shrink-0 font-medium text-[#60738f]">{info.km} km • ETA ~{info.eta} via {info.via}</span>
                  </li>
                );
              })}
            </ul>
          </ModalSection>
        )}

        <ModalSection title={maintenance ? "Assigned Maintenance Team" : "Multi-Agency Dispatch"}>
          {maintenance ? (
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Assigned Team
              <select id="dispatch-team" value={team} onChange={(event) => setTeam(event.target.value)} className="h-9 rounded-md border border-[#d5dee3] bg-white px-2 text-[11px] outline-none focus:border-[#2e8b57]">
                {TEAM_OPTIONS.slice(1).map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {agencies.map(([key, agency]) => {
                const state = requests[key];
                const Icon = agency.icon;
                return (
                  <div key={key} className="rounded-lg border border-[#e0e7eb] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-[#263246]"><Icon size={13} className="text-[#2e8b57]" /> {agency.label}</span>
                      <button type="button" disabled={Boolean(state)} aria-label={`Request ${agency.confirmed}`} onClick={() => setRequests((r) => ({ ...r, [key]: "requested" }))}
                        className={`rounded-md border px-2 py-1 text-[9px] font-semibold ${state ? "border-[#e0e7eb] text-[#a0b0c0]" : "border-[#d9e8df] text-[#2e8b57] hover:bg-[#f3faf6]"}`}>
                        {state ? "Requested ✓" : "Request"}
                      </button>
                    </div>
                    <p className="mt-2 text-[9px] text-[#60738f]" aria-live="polite">
                      {!state && "No external unit requested."}
                      {state === "requested" && <span className="text-[#e69500]">{agency.confirmed}: Requested — awaiting confirmation…</span>}
                      {state && state !== "requested" && <span className="text-[#2e8b57]">{agency.confirmed}: Confirmed | Unit: {state.unit} | ETA: {state.eta}</span>}
                    </p>
                  </div>
                );
              })}
              {report.accident && <p className="text-[9px] text-[#7184a0]">The nearest hospital appears because this is an accident incident; the responding unit carries patient transport.</p>}
            </div>
          )}
        </ModalSection>
      </div>
    </ModalShell>
  );
}

function SuccessModal({ report, onClose }) {
  return (
    <ModalShell title="Resolution Verified" labelledBy="action-success-title" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[620px]" backdrop="z-[90]" panel="z-[100]"
      footer={<footer className="flex shrink-0 justify-end border-t border-[#e7ecef] bg-[#f3faf6] px-6 py-4"><button type="button" onClick={onClose} className="rounded-md bg-[#2e8b57] px-5 py-2.5 text-[11px] font-bold text-white hover:bg-[#26764a]">Done</button></footer>}>
      <div className="px-6 py-7">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f4ed] text-[#2e8b57]"><span className="text-[28px] leading-none">✓</span></div>
          <h3 id="action-success-title" className="mt-4 text-[18px] font-bold text-[#3d3d3d]">Report Marked as Resolved</h3>
          <p className="mt-1 text-[11px] text-[#60738f]">Proof of response/repair is recorded and the report details were updated.</p>
        </div>
        <div className="mt-5">
          <RowList rows={[["Report ID", report.id], ["Status", <Badge key="status" label={report.status} styles={STATUS_STYLES[report.status]} />], ["Category", report.category], ["Urgency", report.urgency], ["Location", `${report.location}, Barangay 167`], ["Assigned Team", report.team]]} />
        </div>
      </div>
    </ModalShell>
  );
}

/* Shown right after a dispatch is confirmed: transaction receipt with the
   routed workflow, requested units, their stations, and travel info. */
function DispatchTransactionModal({ data, onClose, onTrack }) {
  const { report, units, maintenance, transactionId, time } = data;
  return (
    <ModalShell title="Dispatch Transaction" labelledBy="dispatch-transaction-title" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[780px]" backdrop="z-[90]" panel="z-[100]"
      footer={<footer className="flex shrink-0 justify-end gap-2 border-t border-[#e7ecef] bg-[#f3faf6] px-5 py-3">
        <button type="button" onClick={onClose} className={BTN_CANCEL}>Done</button>
        <button type="button" disabled={maintenance} onClick={onTrack}
          className={`${BTN_PRIMARY} ${maintenance ? "cursor-not-allowed opacity-50" : ""}`}>Track Unit Responses</button>
      </footer>}>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4">
        <ModalSection title="Transaction Summary">
          <RowList rows={[["Transaction ID", transactionId], ["Logged At", time], ["Routed Workflow", report.routedTo], ["Assigned Team", report.team], ["Status", report.status]]} />
        </ModalSection>
        <ModalSection title="Where Responses Are Heading">
          <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="h-[320px]">
              <MapViewer compact incidents={[
                { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                ...units.map((unit) => { const facility = RESPONSE_FACILITIES[unit.key]; return { id: `facility-${unit.key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[unit.key], status: "Ready", lat: facility.lat, lng: facility.lng }; }),
              ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} expandPath={PATHS.adminMapView} />
            </div>
            <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Pulsing pin = incident location{units.length ? ". Station icons mark the dispatched units." : "."}</div>
          </div>
          {units.length > 0 && (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {units.map((unit) => (
                <li key={unit.key} className="rounded-md border border-[#e0e7eb] px-2.5 py-2 text-[9px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-bold text-[#263246]">{unit.nearest && <span className="rounded bg-[#2e8b57] px-1.5 py-0.5 text-[8px] font-bold text-white">Nearest</span>}{unit.confirmed} → {unit.station}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold ${unit.status === "Confirmed" ? "bg-[#d9f7e4] text-[#2e8b57]" : "bg-[#fff1c6] text-[#e69500]"}`}>{unit.status}</span>
                  </div>
                  <p className="mt-1 text-[#60738f]">Unit: {unit.unit} | {unit.km} km | ETA: {unit.eta} | Route: {report.location} → {unit.station} ({unit.via})</p>
                </li>
              ))}
            </ul>
          )}
        </ModalSection>
      </div>
    </ModalShell>
  );
}

/* Follow-up tracking panel: external units advance from Requested to En route
   to On site once dispatched, with a live route map (responder position along
   the route), travel distance, and possible road closures to expect. */
const TRACK_STAGES = ["Requested", "En route", "On site"];

function UnitTrackModal({ units, report, onClose }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= TRACK_STAGES.length - 1) return;
    const timer = setTimeout(() => setStage((current) => current + 1), 1400);
    return () => clearTimeout(timer);
  }, [stage]);

  /* Per-unit route geometry (station → scene) and the responder icon's current
     position along it; the agency category renders its glyph on the badge. */
  const routes = useMemo(() => units.map((unit) => ({ id: `route-${unit.key}`, key: unit.key, points: routePoints(unit.key, report) })), [units, report]);
  const trackers = useMemo(() => routes.map((route) => ({
    id: `tracker-${route.key}`,
    category: route.key,
    ...pointAtFraction(route.points, STAGE_PROGRESS[stage]),
  })), [routes, stage]);

  /* Drop-off: where each unit delivers its passengers/payload — the hospital
     when an accident ambulance transports a patient, the scene otherwise.
     Identical coordinates collapse into a single pin. */
  const dropOffs = useMemo(() => {
    const seen = new Set();
    return units.map((unit) => {
      const point = report.accident && unit.key === "hospital" ? RESPONSE_FACILITIES.hospital : { lat: report.lat, lng: report.lng };
      return { id: `dropoff-${unit.key}`, title: RESPONSE_FACILITIES.hospital.name, ...point };
    }).filter((drop) => {
      const key = `${drop.lat.toFixed(5)}|${drop.lng.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [units, report]);

  return (
    <ModalShell title="Track Unit Responses" labelledBy="unit-track-title" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[1000px]" backdrop="z-[105]" panel="z-[110]"
      footer={<footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e7ecef] bg-[#f3faf6] px-5 py-3">
        <span className={`text-[9px] font-bold ${stage === 2 ? "text-[#2e8b57]" : "text-[#e69500]"}`} aria-live="polite">{stage === 2 ? "All units are on site." : `Live update: ${TRACK_STAGES[stage]}…`}</span>
        <button type="button" onClick={onClose} className={BTN_PRIMARY}>Done</button>
      </footer>}>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4">
        <ModalSection title="Live Responder Routes">
          {/* Incident + station pins, dashed station→scene routes, badgeed
              responder icons advancing with the tracking stages, and the
              drop-off destination where passengers/payload are delivered. */}
          <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="h-[320px]">
              <MapViewer compact incidents={[
                { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                ...routes.map((route) => { const facility = RESPONSE_FACILITIES[route.key]; return { id: `facility-${route.key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[route.key], status: "Ready", lat: facility.lat, lng: facility.lng }; }),
              ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} routes={routes} trackers={trackers} dropOffs={dropOffs} expandPath={PATHS.adminMapView} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[9px] font-medium text-[#60738f]">
              <span>Pulsing pin = incident location. Dashed lines are station → scene routes; moving agency icons are responding units en route; the green arrow pin marks the drop-off.</span>
              <span>{stage === 2 ? "All units have arrived." : TRACK_STAGES[stage] === "En route" ? "Units are moving toward the scene." : "Units called — standing by to roll out."}</span>
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Unit Tracking & Road Status">
          <div className="grid gap-2 sm:grid-cols-2">
            {units.map((unit) => (
              <div key={unit.key} className={`rounded-lg border p-3 ${stage === 2 ? "border-[#2e8b57] bg-[#f3faf6]" : "border-[#e0e7eb]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#263246]">{unit.nearest && <span className="rounded bg-[#2e8b57] px-1.5 py-0.5 text-[8px] font-bold text-white">Nearest</span>}{unit.confirmed} — {unit.station}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold ${stage === 2 ? "bg-[#d9f7e4] text-[#2e8b57]" : "bg-[#fff1c6] text-[#e69500]"}`}>{TRACK_STAGES[stage]}</span>
                </div>
                <p className="mt-1 text-[9px] text-[#60738f]">Unit: {unit.unit} | Distance: {unit.km} km | ETA: {unit.eta} | Route: {report.location} → {unit.station} via {unit.via}</p>
                <div className="mt-2 rounded-md border border-[#f3e3c2] bg-[#fffbf2] px-2.5 py-2">
                  <p className="flex items-center gap-1 text-[9px] font-bold text-[#b45309]"><TriangleAlert size={11} />Possible Road Closures</p>
                  <ul className="mt-1 grid gap-1">
                    {(ROAD_CLOSURES[unit.key] ?? []).map((closure) => (
                      <li key={closure.road} className="text-[#7184a0]" aria-label={`Road status: ${closure.road}`}>
                        <span className="font-semibold text-[#263246]">{closure.road}</span> — {closure.section} • {closure.note}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}

export default function IncidentReports() {
  const [reports, setReports] = useState(initialReports);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [category, setCategory] = useState("All Categories");
  const [location, setLocation] = useState("All Locations");
  const [month, setMonth] = useState("April 2026");
  const [selectedReport, setSelectedReport] = useState(null);
  const [dispatchReport, setDispatchReport] = useState(null);
  const [savedReport, setSavedReport] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [trackOpen, setTrackOpen] = useState(false);

  function beginTransaction(updated, units, maintenance) {
    setTrackOpen(false);
    setTransaction({
      report: updated,
      units,
      maintenance,
      transactionId: `DSP-${updated.id.replace("GF-", "")}-${String(Date.now()).slice(-4)}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  const filteredReports = useMemo(() => reports.filter((report) => {
    const search = query.trim().toLowerCase();
    const matchesQuery = !search || Object.values(report).join(" ").toLowerCase().includes(search);
    return matchesQuery && (status === "All Statuses" || report.status === status) && (category === "All Categories" || report.category === category) && (location === "All Locations" || report.location === location);
  }), [category, location, query, reports, status]);

  function resetFilters() {
    setQuery(""); setStatus("All Statuses"); setCategory("All Categories"); setLocation("All Locations"); setMonth("April 2026");
  }

  function updateReportData(id, changes) {
    setReports((current) => current.map((report) => report.id === id ? { ...report, ...changes } : report));
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-white p-2">
        <label className="flex h-7 min-w-[210px] flex-1 items-center gap-2 rounded-md border border-[#dfe5e8] px-2 text-slate-400">
          <Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports..." className="w-full text-[9px] outline-none placeholder:text-slate-400" />
        </label>
        <SelectFilter value={status} options={statuses} onChange={setStatus} />
        <SelectFilter value={category} options={categories} onChange={setCategory} />
        <SelectFilter value={location} options={locations} onChange={setLocation} />
        <SelectFilter value={month} options={["April 2026", "March 2026", "February 2026"]} onChange={setMonth} />
        <button type="button" onClick={resetFilters} className="flex items-center gap-1 px-2 text-[9px] text-[#60738f] hover:text-[#2e8b57]"><RotateCcw size={11} /> Reset</button>
      </section>
      <section className="rounded-lg border border-[#e2e8eb] bg-white p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[12px] font-bold text-[#2e8b57]">Infrastructure Reports ({filteredReports.length})</h2><button type="button" onClick={() => toast.add({ title: "Export ready", description: "CSV export is available for the filtered reports.", type: "success" })} className="flex items-center gap-1 rounded-md border border-[#d9e8df] px-2 py-1.5 text-[9px] font-semibold text-[#2e8b57]"><Download size={11} /> Export CSV</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-[9px]">
            <thead className="bg-[#f5f8fa] text-[8px] font-bold text-[#60738f]"><tr>{["ID", "Incident Details", "Category", "Urgency", "Location", "Reporter", "Date Reported", "Assigned Team", "Status", "Action"].map((heading) => <th key={heading} className="px-2 py-2 first:rounded-l-md last:rounded-r-md">{heading}</th>)}</tr></thead>
            <tbody>{filteredReports.map((report) => <tr key={report.id} className="border-b border-[#e7ecef] last:border-0">
              <td className="px-2 py-3 font-bold text-[#2e8b57]">{report.id}</td><td className="px-2 py-3 font-semibold text-[#263246]">{report.title}</td><td className="px-2 py-3 text-[#60738f]">{report.category}</td><td className="px-2 py-3"><Badge label={report.urgency} styles={URGENCY_STYLES[report.urgency]} /></td><td className="px-2 py-3 text-[#60738f]">{report.location}</td><td className="px-2 py-3">{report.reporter}</td><td className="px-2 py-3 text-[#60738f]">{report.date}</td><td className="px-2 py-3 font-medium text-[#2e8b57]">{report.team}</td><td className="px-2 py-3"><Badge label={report.status} styles={STATUS_STYLES[report.status]} /></td>
              <td className="px-2 py-3"><div className="flex gap-1"><button type="button" onClick={() => setSelectedReport(report)} className="flex items-center gap-1 rounded bg-[#2e8b57] px-2 py-1 text-[8px] font-bold text-white"><Eye size={10} /> View</button><button type="button" onClick={() => setDispatchReport(report)} className="rounded border border-[#d9e8df] px-2 py-1 text-[8px] font-semibold text-[#2e8b57]">Assign</button></div></td>
            </tr>)}</tbody>
          </table>
          {filteredReports.length === 0 && <p className="py-8 text-center text-xs text-[#60738f]">No reports match the selected filters.</p>}
        </div>
      </section>
      {selectedReport && <IncidentDetailsModal key={selectedReport.id} report={selectedReport} onClose={() => setSelectedReport(null)} onResolve={updateReportData} onSaved={setSavedReport} />}
      {dispatchReport && <DispatchModal key={dispatchReport.id} report={dispatchReport} onClose={() => setDispatchReport(null)} onDispatch={updateReportData} onTransaction={beginTransaction} />}
      {savedReport && <SuccessModal key={savedReport.id} report={savedReport} onClose={() => setSavedReport(null)} />}
      {transaction && <DispatchTransactionModal key={`txn-${transaction.transactionId}`} data={transaction} onClose={() => setTransaction(null)} onTrack={() => setTrackOpen(true)} />}
      {transaction && trackOpen && <UnitTrackModal key={`trk-${transaction.transactionId}`} units={transaction.units} report={transaction.report} onClose={() => setTrackOpen(false)} />}
    </div>
  );
}
