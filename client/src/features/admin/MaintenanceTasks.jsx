import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera, CheckCircle2, Clock, Download, FileText, FileUp, History, Link2,
  Lock, MapPinned, Plus, RotateCcw, Search, Share2, ShieldCheck, TriangleAlert, UserCheck,
  Video, Wrench, X,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import MapViewer from "../../shared/components/MapViewer";
import { ModalShell, SelectFilter, stamp } from "../../shared/components/GovernanceUi";

/* ----------------------------------------------------------------------- */
/* Constants                                                               */
/* ----------------------------------------------------------------------- */

const TEAMS = ["Barangay Sanitizers", "Engineering Crew B", "Maintenance Team A", "Barangay Public Works", "Meralco Dispatch"];
const PRIORITIES = ["High", "Medium", "Low"];
const ZONES = ["Zone 1 — Rizal St / Quezon Ave", "Zone 2 — Magsaysay Blvd", "Zone 3 — Roxas Blvd", "Zone 4 — Bonifacio St / Del Pilar Rd"];
const CATEGORIES = ["Sanitation", "Electrical", "Road Damage", "Structural", "Waterways"];

/* Strict lifecycle: only these transitions are allowed, forward one step. */
const STAGE_ORDER = ["Pending", "Assigned", "In Progress", "Awaiting Verification", "Verified Fixed"];
const STAGE_ACTIONS = { Pending: "Assign crew", Assigned: "Begin work", "In Progress": "Mark work complete" };

const ACTIVE_STATUSES = ["Pending", "Assigned", "In Progress"];

const PRIORITY_BADGE = {
  High: "bg-[#fdecea] text-[#dc2626]",
  Medium: "bg-[#fff1c6] text-[#e69500]",
  Low: "bg-[#eef2f4] text-[#60738f]",
};
const STATUS_BADGE = {
  Pending: "bg-[#eef2f4] text-[#60738f]",
  Assigned: "bg-[#fff1c6] text-[#e69500]",
  "In Progress": "bg-(--gf-green-tint-2) text-(--gf-green)",
  "Awaiting Verification": "bg-[#fff1c6] text-[#e69500]",
  "Verified Fixed": "bg-(--gf-green-tint-2) text-(--gf-green)",
};

/* ----------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ----------------------------------------------------------------------- */

const daysAgo = (d) => Date.now() - d * 86400000;
const NOW = () => Date.now();
const fmtWhen = (t) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDue = (t) => (t ? new Date(t).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "—");

function nextTaskId(existing) {
  const max = existing.reduce((m, t) => Math.max(m, Number(t.id.replace(/\D/g, "")) || 0), 0);
  return `TASK-167-${String(max + 1).padStart(2, "0")}`;
}

function toDateInput(t) {
  const d = new Date(t ?? Date.now());
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Privacy-safe summary for the public accomplishment log: street-level
   location only; reporter names, addresses and identifiers are stripped. */
function privacySummary(task) {
  return `${task.category} task at ${task.location} (${task.zone}) completed by ${task.team}. Reporter details and exact household addresses are intentionally excluded.`;
}

const isOverdue = (task, now) => task.status !== "Verified Fixed" && now > (task.deadline ?? Infinity);

/* ----------------------------------------------------------------------- */
/* Seed data                                                               */
/* ----------------------------------------------------------------------- */

const initialTasks = () => [
  {
    id: "TASK-167-01", issue: "Pothole Repair — Rizal Street", source: "report", originReportId: "GF-005",
    reporter: { name: "Rain Santiago", type: "guest", token: "GV-7D92K1" },
    category: "Road Damage", location: "Rizal Street", zone: ZONES[0],
    lat: 14.6538, lng: 121.0325,
    geotag: { source: "Device GPS", accuracy: "±4 m", landmark: "Rizal St frontage, Barangay 167" },
    evidence: ["photo"],
    narration: "Potholes widened by this week's rains; two-wheelers swerve into the next lane to avoid them.",
    team: TEAMS[3], priority: "Medium", dateSubmitted: daysAgo(7), deadline: daysAgo(1),
    status: "Verified Fixed",
    metrics: { submittedAt: daysAgo(7), assignedAt: daysAgo(6), startedAt: daysAgo(5), verifiedAt: daysAgo(2) },
    reassignments: [{ from: TEAMS[2], to: TEAMS[3], at: fmtWhen(daysAgo(6)), by: "Admin — N. Villanueva" }],
    workNotes: [
      { at: fmtWhen(daysAgo(2)), by: "Crew — Bgry Public Works", note: "Cold asphalt patch compacted; cone cleared area after 48h cure." },
      { at: fmtWhen(daysAgo(4)), by: "Crew — Bgry Public Works", note: "Site delay: downpour washed out the first pass; crew resumed 07:30 the next morning." },
    ],
    closure: { proof: "patch-photos.zip", closedBy: "Admin — N. Villanueva", closedAt: fmtWhen(daysAgo(2)), outcome: "Potholes filled with cold asphalt and layered; surface regraded to drain.", remarks: "Whole section patched and reopened to traffic after inspection." },
    notified: true,
    published: { at: fmtWhen(daysAgo(2)), summary: "Road Damage task at Rizal Street completed — potholes patched and road reopened." },
  },
  {
    id: "TASK-167-02", issue: "Streetlight Pole Repair — Pole 14", source: "report", originReportId: "GF-002",
    reporter: { name: "Rain Opinion", type: "resident" },
    category: "Electrical", location: "Quezon Avenue", zone: ZONES[0],
    lat: 14.7321, lng: 121.0192,
    geotag: { source: "Device GPS", accuracy: "±6 m", landmark: "Quezon Ave, Barangay 167" },
    evidence: ["photo"],
    narration: "Pole 14 leans after the storm; one lamp dark, wiring sagged toward the sidewalk.",
    team: TEAMS[1], priority: "High", dateSubmitted: daysAgo(3), deadline: daysAgo(1),
    status: "In Progress",
    metrics: { submittedAt: daysAgo(3), assignedAt: daysAgo(2), startedAt: daysAgo(1) },
    reassignments: [],
    workNotes: [
      { at: fmtWhen(daysAgo(1)), by: "Crew — Engineering Crew B", note: "Braces installed overnight; Meralco coordination booked for line re-termination." },
    ],
  },
  {
    id: "TASK-167-03", issue: "Canal Desilting — Market Stretch", source: "manual", originReportId: null,
    reporter: null,
    category: "Waterways", location: "Magsaysay Boulevard", zone: ZONES[1],
    lat: 14.7269, lng: 121.0174,
    geotag: { source: "Internal survey", accuracy: "±3 m", landmark: "Magsaysay Blvd canal mouth" },
    evidence: [],
    narration: "Scheduled preventive work order before the monsoon window.",
    team: TEAMS[0], priority: "Medium", dateSubmitted: daysAgo(2), deadline: daysAgo(-2),
    status: "Awaiting Verification",
    metrics: { submittedAt: daysAgo(2), assignedAt: daysAgo(2), startedAt: daysAgo(1) },
    reassignments: [],
    workNotes: [
      { at: fmtWhen(daysAgo(1)), by: "Crew — Barangay Sanitizers", note: "Equipment deployed: pump rig PR-4 and grab truck. 2.5 m³ silt hauled." },
    ],
  },
  {
    id: "TASK-167-04", issue: "Scheduled Streetsweep — Market Frontage", source: "manual", originReportId: null,
    reporter: null,
    category: "Sanitation", location: "Magsaysay Boulevard", zone: ZONES[1],
    lat: 14.7271, lng: 121.0178,
    geotag: { source: "Internal survey", accuracy: "±5 m", landmark: "Public market frontage" },
    evidence: [],
    narration: "Weekly preventive sweep; does not originate from a resident report.",
    team: TEAMS[0], priority: "Low", dateSubmitted: daysAgo(1), deadline: daysAgo(-1),
    status: "Pending",
    metrics: { submittedAt: daysAgo(1) },
    reassignments: [], workNotes: [],
  },
  {
    id: "TASK-167-05", issue: "Tilting Basketball Ring — Covered Court", source: "report", originReportId: "GF-006",
    reporter: { name: "Guest M. Dizon", type: "guest", token: "GV-2PXK44" },
    category: "Structural", location: "Bonifacio Street", zone: ZONES[3],
    lat: 14.7300, lng: 121.0150,
    geotag: { source: "Device GPS", accuracy: "±7 m", landmark: "Covered court, Bonifacio St" },
    evidence: ["photo"],
    narration: "Ring mount rusted through and tilts over the free-throw lane; kids still play under it.",
    team: TEAMS[3], priority: "High", dateSubmitted: daysAgo(5), deadline: daysAgo(0),
    status: "Awaiting Verification",
    metrics: { submittedAt: daysAgo(5), assignedAt: daysAgo(4), startedAt: daysAgo(2) },
    reassignments: [],
    workNotes: [
      { at: fmtWhen(daysAgo(2)), by: "Crew — Bgry Public Works", note: "Mount plate replaced and ring re-leveled to 3.05 m; awaiting paint cure before sign-off." },
    ],
  },
];

/* Non-emergency reports sitting in the ingestion queue, routed straight to
   the maintenance queue with no external department accounts or approvals. */
const initialQueue = () => [
  {
    queueId: "Q-01", reportId: "GF-008", issue: "Garbage pile beside the covered court",
    reporter: { name: "Guest V. Reyes", type: "guest", token: "GV-3FM7BX" },
    location: "Del Pilar Road", zone: ZONES[3], lat: 14.7315, lng: 121.0145, category: "Sanitation",
    geotag: { source: "Device GPS", accuracy: "±4 m", landmark: "Covered court side lane, Del Pilar Rd" },
    evidence: ["photo", "video"],
    narration: "Un-collected pile has been there for three days; animals are scattering it across the lane.",
    submitted: fmtWhen(daysAgo(1)),
  },
  {
    queueId: "Q-02", reportId: "GF-009", issue: "Tilting fence at the daycare frontage",
    reporter: { name: "Liza Maranan", type: "resident" },
    location: "Bonifacio Street", zone: ZONES[3], lat: 14.7292, lng: 121.0161, category: "Structural",
    geotag: { source: "Pin drag adjusted", accuracy: "±9 m", landmark: "Daycare frontage, Bonifacio St" },
    evidence: ["photo"],
    narration: "Chain-link section leans toward the walkway where the kids queue in the morning.",
    submitted: fmtWhen(daysAgo(2)),
  },
];

const seededAudit = () => [
  { key: "s1", taskId: "TASK-167-01", actor: "Admin — N. Villanueva", system: false, at: fmtWhen(daysAgo(2)), action: "Resolution verified with proof", detail: "Proof patch-photos.zip recorded; reporter notified with a read-only status update." },
  { key: "s2", taskId: "TASK-167-01", actor: "Admin — N. Villanueva", system: false, at: fmtWhen(daysAgo(2)), action: "Accomplishment summary published", detail: "Privacy-safe summary posted to the public accomplishment log." },
  { key: "s3", taskId: "TASK-167-03", actor: "Admin — N. Villanueva", system: false, at: fmtWhen(daysAgo(1)), action: "Status change", detail: "In Progress → Awaiting Verification." },
];

/* ----------------------------------------------------------------------- */
/* Small presentational bits                                               */
/* ----------------------------------------------------------------------- */

function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[8px] font-bold leading-none ${className}`}>
      {children}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return <Chip className={PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.Low}>{priority}</Chip>;
}

function StatusBadge({ status }) {
  return <Chip className={STATUS_BADGE[status] ?? STATUS_BADGE.Pending}>{status}</Chip>;
}

function OriginChip({ task }) {
  return task.originReportId
    ? <Chip className="bg-[#eef2f4] text-[#60738f]"><Link2 size={8} />{task.originReportId}</Chip>
    : <Chip className="bg-[#eef2f4] text-[#60738f]">manual WO</Chip>;
}

function EvidenceChips({ evidence, small = false }) {
  if (!evidence?.length) {
    return <Chip className="bg-[#eef2f4] text-[#60738f]">no media attached</Chip>;
  }
  const items = [
    evidence.includes("photo") && { key: "photo", icon: Camera, label: "photos" },
    evidence.includes("video") && { key: "video", icon: Video, label: "video" },
  ].filter(Boolean);
  return (
    <span className="flex flex-wrap gap-1">
      {items.map(({ key, icon: Icon, label }) => (
        <Chip key={key} className="bg-(--gf-green-tint) text-(--gf-green)">
          <Icon size={9} />
          {label}
          {small ? "" : " carried from intake"}
        </Chip>
      ))}
    </span>
  );
}

function StageRail({ status }) {
  const activeIndex = STAGE_ORDER.indexOf(status);
  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGE_ORDER.map((stage, index) => (
        <span key={stage} className={`gf-stage ${index === activeIndex ? "text-[#e69500]" : index < activeIndex ? "text-(--gf-green)" : "text-[#a0b0c0]"}`}>
          <span className={`gf-stage-dot ${index < activeIndex ? "gf-stage-dot--done" : index === activeIndex ? "gf-stage-dot--active" : "gf-stage-dot--locked"}`}>{index < activeIndex ? "✓" : ""}</span>
          {stage}
        </span>
      ))}
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#f1f4f6] py-1.5 last:border-b-0">
      <span className="shrink-0 text-[9px] font-semibold text-[#7184a0]">{label}</span>
      <span className="text-right text-[10px] font-semibold text-[#263246]">{children}</span>
    </div>
  );
}

function DrawerSection({ title, icon: Icon, children, last = false }) {
  return (
    <section className={`pb-4 ${last ? "" : "border-b border-[#edf0f2]"}`}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#60738f]">
        {Icon && <Icon size={11} className="text-(--gf-green)" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e0e7eb] bg-white px-3 py-2">
      <span className="text-[10px] font-semibold text-[#263246]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-(--gf-green)" : "bg-[#c8d2da]"}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, alert = false, hint, onClick }) {
  const clickable = typeof onClick === "function";
  const Tag = clickable ? "button" : "div";
  return (
    <Tag
      {...(clickable ? { type: "button", onClick } : {})}
      className={`flex items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition ${alert ? "border-[#f3d3d3]" : "border-[#e2e8eb]"} ${clickable ? "cursor-pointer hover:border-(--gf-green) hover:shadow-md focus-visible:outline-2 focus-visible:outline-(--gf-green)" : ""}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${alert ? "bg-[#fdecea] text-[#dc2626]" : "bg-(--gf-green-soft) text-(--gf-green)"}`}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-bold uppercase tracking-wide text-[#60738f]">{label}</span>
        <span className={`block text-xl font-extrabold leading-tight ${alert ? "text-[#dc2626]" : "text-[#263246]"}`}>{value}</span>
        {hint && <span className="block text-[8px] font-medium text-[#a8b6c6]">{hint}</span>}
      </span>
    </Tag>
  );
}

function IntakeCard({ item, onIngest }) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-[#e0e7eb] bg-white p-4 transition hover:border-(--gf-green) hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip className="bg-(--gf-green-tint-2) text-(--gf-green)">{item.reportId}</Chip>
            <Chip className="bg-[#eef2f4] text-[#60738f]">{item.category}</Chip>
          </div>
          <h3 className="mt-1 text-[11px] font-bold leading-snug text-[#263246]">{item.issue}</h3>
        </div>
        <Chip className="mt-0.5 shrink-0 rounded-full bg-[#fff1c6] text-[#e69500]">new</Chip>
      </div>
      <p className="flex items-start gap-1 text-[9px] text-[#60738f]">
        <MapPinned size={11} className="mt-px shrink-0 text-(--gf-green)" />
        {item.location} • {item.zone}
      </p>
      <p className="text-[9px] text-[#a8b6c6]">GPS {item.geotag.source} ({item.geotag.accuracy}) • {item.geotag.landmark}</p>
      <p className="text-[9px] italic leading-relaxed text-[#60738f]">“{item.narration}”</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {item.reporter.type === "guest"
          ? <Chip className="bg-[#eef2fb] text-[#4c6fbf]"><Link2 size={8} />Guest link {item.reporter.token}</Chip>
          : <Chip className="bg-(--gf-green-tint) text-(--gf-green)"><ShieldCheck size={8} />Verified Resident</Chip>}
        <EvidenceChips evidence={item.evidence} small />
        <span className="ml-auto text-[8px] font-medium text-[#a8b6c6]">{item.submitted}</span>
      </div>
      <button
        type="button"
        onClick={() => onIngest(item.queueId)}
        className="mt-auto w-full rounded-md bg-(--gf-green) px-3 py-2 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark) focus-visible:outline-2 focus-visible:outline-(--gf-green)"
      >
        Ingest to Work Order
      </button>
    </article>
  );
}

/* ----------------------------------------------------------------------- */
/* Work-order data table (shared by tabs 2, 3, 4)                          */
/* ----------------------------------------------------------------------- */

const TABLE_HEADINGS = ["Task ID", "Issue", "Location", "Assigned Team", "Priority", "Deadline", "Status", "Action"];

function TaskTable({ tasks, emptyLabel, actionLabel, onOpen, nowTs }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[8px] font-bold uppercase tracking-wider text-[#60738f]">
            {TABLE_HEADINGS.map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task, nowTs);
            return (
              <tr key={task.id} className="border-b border-[#f1f4f6] transition-colors last:border-b-0 hover:bg-(--gf-row-hover)">
                <td className="px-3 py-3">
                  <span className="font-bold text-(--gf-green)">{task.id}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <OriginChip task={task} />
                    {task.published && <Chip className="bg-(--gf-green-tint-2) text-(--gf-green)">published</Chip>}
                    {task.notified && !task.published && <Chip className="bg-(--gf-green-tint) text-(--gf-green)">reporter notified</Chip>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="font-semibold text-[#263246]">{task.issue}</span>
                  <div className="text-[8px] text-[#a8b6c6]">{task.category}</div>
                </td>
                <td className="px-3 py-3 text-[#60738f]">
                  {task.location}
                  <div className="text-[8px] text-[#a8b6c6]">{task.zone}</div>
                </td>
                <td className="px-3 py-3 font-semibold text-(--gf-green)">
                  {task.team || <span className="italic text-[#a0b0c0]">Unassigned</span>}
                </td>
                <td className="px-3 py-3"><PriorityBadge priority={task.priority} /></td>
                <td className={`whitespace-nowrap px-3 py-3 ${overdue ? "font-bold text-[#dc2626]" : "text-[#60738f]"}`}>
                  {fmtDue(task.deadline)}
                  {overdue && <div className="mt-0.5"><Chip className="bg-[#fdecea] text-[#dc2626]">overdue</Chip></div>}
                </td>
                <td className="px-3 py-3"><StatusBadge status={task.status} /></td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(task.id)}
                    className="rounded-md bg-(--gf-green) px-2.5 py-1.5 text-[9px] font-bold text-white transition hover:bg-(--gf-green-dark) focus-visible:outline-2 focus-visible:outline-(--gf-green)"
                  >
                    {actionLabel}
                  </button>
                </td>
              </tr>
            );
          })}
          {!tasks.length && (
            <tr><td colSpan={TABLE_HEADINGS.length} className="px-3 py-10 text-center text-[#60738f]">{emptyLabel}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Task management slide-over drawer                                       */
/* ----------------------------------------------------------------------- */

function TaskDrawer({ task, onClose, onNextStage, onCloseTask, onReassign, onUpdate, onAddNote, onPublish, onOpenAudit }) {
  const [proof, setProof] = useState(null);
  const [publishIntent, setPublishIntent] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");

  /* Escape closes the drawer; page scroll is locked while it is open. */
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const verifying = task.status === "Awaiting Verification";
  const resolved = task.status === "Verified Fixed";
  const stageAction = STAGE_ACTIONS[task.status];

  function changeTeam(value) {
    if (value && value !== task.team) onReassign(task.id, value);
  }

  function changePriority(value) {
    if (value !== task.priority) onUpdate(task.id, { priority: value }, `Priority set to ${value} from the task drawer.`);
  }

  function changeDeadline(event) {
    if (!event.target.value) return;
    const next = new Date(`${event.target.value}T12:00:00`).getTime();
    if (next !== task.deadline) onUpdate(task.id, { deadline: next }, `Deadline updated to ${fmtDue(next)} from the task drawer.`);
  }

  function addNote() {
    if (!noteDraft.trim()) return;
    onAddNote(task.id, noteDraft.trim());
    setNoteDraft("");
  }

  function approve() {
    if (!proof) return;
    onCloseTask(task.id, {
      proof,
      closedBy: "Admin — N. Villanueva",
      closedAt: stamp(true),
      outcome: "Admin reviewed the uploaded proof of repair and confirmed the site is restored.",
      remarks: "Approved from the task drawer after proof review.",
    }, publishIntent);
  }

  const dateInputId = `drawer-deadline-${task.id}`;

  return (
    <>
      <button
        type="button"
        aria-label="Close task drawer"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default border-0 bg-slate-900/40 backdrop-blur-[2px] [animation:gf-fade-in_0.18s_ease-out]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Manage task ${task.id}`}
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-[#e2e8eb] bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.25)] [animation:gf-drawer-in_0.22s_ease-out] sm:w-[40%] sm:min-w-[500px] sm:max-w-[680px]"
      >
        {/* Drawer header */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf0f2] bg-(--gf-green-soft) px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold text-(--gf-green)">{task.id}</h2>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
            <p className="mt-0.5 truncate text-[10px] text-[#60738f]">{task.issue} • {task.category}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenAudit(task.id)}
              className="rounded-md border border-[#dfe7ea] bg-white px-2 py-1.5 text-[9px] font-bold text-[#60738f] transition hover:border-(--gf-green) hover:text-(--gf-green)"
            >
              <History size={11} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-[#60738f] transition hover:bg-white hover:text-(--gf-green)"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Drawer body */}
        <div className="gf-drawer-body">
          <DrawerSection title="Origin Report & Reporter" icon={ShieldCheck}>
            <div>
              <InfoRow label="Source">
                {task.source === "manual"
                  ? "Manual work order (no resident report)"
                  : `Auto-routed from intake report ${task.originReportId}`}
              </InfoRow>
              <InfoRow label="Reporter">
                {task.reporter
                  ? (
                    <span className="inline-flex items-center gap-1">
                      {task.reporter.type === "guest"
                        ? <Chip className="bg-[#eef2fb] text-[#4c6fbf]"><Link2 size={8} />Guest — 7-day tracking link</Chip>
                        : <Chip className="bg-(--gf-green-tint) text-(--gf-green)"><ShieldCheck size={8} />Verified Resident</Chip>}
                      {task.reporter.name}
                    </span>
                  )
                  : "Internal admin work order"}
              </InfoRow>
              {task.reporter?.type === "guest" && (
                <InfoRow label="Guest token">
                  <span className="font-mono">{task.reporter.token}</span> — receives read-only status updates on resolution
                </InfoRow>
              )}
              <InfoRow label="Submitted">{fmtWhen(task.metrics.submittedAt)}</InfoRow>
            </div>
            {task.narration && (
              <p className="mt-2 rounded-md border border-[#e0e7eb] bg-white px-2.5 py-2 text-[10px] text-[#60738f]">
                <span className="font-bold text-[#263246]">Carried narration:</span> {task.narration}
              </p>
            )}
          </DrawerSection>

          <DrawerSection title="Location & Initial Evidence" icon={MapPinned}>
            <div className="gf-note gf-note--soft">
              <MapPinned size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
              <span><strong>{task.geotag.source}</strong> • accuracy {task.geotag.accuracy} • landmark: {task.geotag.landmark}</span>
            </div>
            <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
              <div className="h-[200px]">
                <MapViewer
                  compact
                  incidents={[{ id: task.id, title: task.issue, category: "infrastructure", status: task.status, lat: task.lat, lng: task.lng }]}
                  selectedIncident={{ id: task.id, lat: task.lat, lng: task.lng }}
                />
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-[9px] font-bold text-[#60738f]">
                <span>{task.location}, Barangay 167</span>
                <span>{task.lat.toFixed(4)} N, {task.lng.toFixed(4)} E</span>
              </div>
            </div>
            <div className="mt-2"><EvidenceChips evidence={task.evidence} /></div>
          </DrawerSection>

          <DrawerSection title="Assignment Controls" icon={Wrench}>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                Assigned Team
                <select
                  aria-label="Change assigned team"
                  className="h-8 w-full appearance-none rounded-md border border-[#dfe7ea] bg-white px-2 pr-7 text-[10px] font-semibold text-(--gf-green) outline-none focus:border-(--gf-green)"
                  value={task.team || ""}
                  onChange={(e) => changeTeam(e.target.value)}
                >
                  <option value="">— unassigned —</option>
                  {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                Priority
                <select
                  aria-label="Change priority"
                  className="h-8 w-full appearance-none rounded-md border border-[#dfe7ea] bg-white px-2 pr-7 text-[10px] font-semibold text-(--gf-green) outline-none focus:border-(--gf-green)"
                  value={task.priority}
                  onChange={(e) => changePriority(e.target.value)}
                >
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                Deadline
                <input
                  id={dateInputId}
                  type="date"
                  aria-label="Change deadline"
                  value={toDateInput(task.deadline)}
                  onChange={changeDeadline}
                  className="h-8 rounded-md border border-[#dfe7ea] bg-white px-2 text-[10px] font-semibold text-(--gf-green) outline-none focus:border-(--gf-green)"
                />
              </label>
            </div>
            {task.reassignments.length > 0 && (
              <ul className="mt-2 grid gap-1">
                {task.reassignments.map((r, i) => (
                  <li key={`${r.to}-${i}`} className="rounded-md border border-[#e0e7eb] bg-white px-2.5 py-1.5 text-[9px] text-[#60738f]">
                    <strong className="text-[#263246]">{r.from} → {r.to}</strong> • {r.at} • by {r.by}
                  </li>
                ))}
              </ul>
            )}
          </DrawerSection>

          <DrawerSection title="Lifecycle & Resolution" icon={CheckCircle2}>
            <StageRail status={task.status} />
            {stageAction && (
              <p className="mt-2 text-[9px] text-[#7184a0]">
                Lifecycle advances one strict step at a time: <strong className="text-[#263246]">{task.status} → {STAGE_ORDER[STAGE_ORDER.indexOf(task.status) + 1]}</strong>. Reopening earlier states is not permitted.
              </p>
            )}
            {verifying && (
              <div className="mt-3 grid gap-2">
                <label
                  htmlFor="drawer-proof"
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-5 text-center transition ${proof ? "border-(--gf-green) bg-(--gf-green-soft)" : "border-[#d5dee3] bg-[#f8fafb] hover:border-(--gf-green)"}`}
                >
                  <FileUp size={20} className="text-(--gf-green)" />
                  <span className="text-[10px] font-bold text-[#263246]">Upload Proof of Repair (Photo/Video)</span>
                  <span className="text-[9px] text-[#60738f]">Verification stays blocked until proof is attached.</span>
                  <input
                    id="drawer-proof"
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    onChange={(event) => setProof(event.target.files?.[0]?.name ?? null)}
                  />
                </label>
                {proof ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-2.5 py-1.5">
                    <span className="flex min-w-0 items-center gap-1 text-[9px] font-bold text-(--gf-green)">
                      <CheckCircle2 size={12} shrink-0 />
                      <span className="truncate">{proof}</span>
                    </span>
                    <button type="button" onClick={() => setProof(null)} className="flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-[#60738f] hover:text-[#dc2626]">
                      <X size={10} />Remove
                    </button>
                  </div>
                ) : (
                  <p className="flex items-center gap-1 text-[9px] font-semibold text-[#dc2626]">
                    <TriangleAlert size={11} />Approval is disabled until proof of repair is uploaded.
                  </p>
                )}
                <Switch checked={publishIntent} onChange={setPublishIntent} label="Publish to Public Accomplishment Log?" />
              </div>
            )}
            {resolved && task.closure && (
              <div className="mt-3 grid gap-2">
                <div>
                  <InfoRow label="Closure mode">{task.closure.proof ? "Proof uploaded" : "Fallback — documented"}</InfoRow>
                  <InfoRow label="Proof">{task.closure.proof ?? "—"}</InfoRow>
                  <InfoRow label="Outcome summary">{task.closure.outcome}</InfoRow>
                  <InfoRow label="Remarks">{task.closure.remarks}</InfoRow>
                  <InfoRow label="Closed by">{task.closure.closedBy} • {task.closure.closedAt}</InfoRow>
                  <InfoRow label="Reporter notified">
                    {task.notified
                      ? <Chip className="bg-(--gf-green-tint-2) text-(--gf-green)"><UserCheck size={8} />Read-only status update pushed</Chip>
                      : "—"}
                  </InfoRow>
                  <InfoRow label="Publishing">
                    {task.published ? `Published ${task.published.at}` : "Not yet published to the public log"}
                  </InfoRow>
                </div>
                {!task.published && <Switch checked={publishIntent} onChange={setPublishIntent} label="Publish to Public Accomplishment Log?" />}
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Internal Work-Notes Log" icon={FileText} last>
            <div className="flex items-end gap-1.5">
              <textarea
                rows={2}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a work note — materials, equipment, site delays…"
                className="min-w-0 flex-1 rounded-md border border-[#d5dee3] px-2 py-1.5 text-[10px] outline-none focus:border-(--gf-green)"
              />
              <button
                type="button"
                disabled={!noteDraft.trim()}
                onClick={addNote}
                className="shrink-0 rounded-md bg-(--gf-green) px-3 py-2 text-[9px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add note
              </button>
            </div>
            {task.workNotes.length > 0 && (
              <ol className="mt-2 grid gap-1.5">
                {task.workNotes.map((note, i) => (
                  <li key={`${note.at}-${i}`} className="gf-audit-item">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-[#263246]">{note.by}</strong>
                      <span className="gf-audit-time">{note.at}</span>
                    </div>
                    <p className="mt-0.5">{note.note}</p>
                  </li>
                ))}
              </ol>
            )}
          </DrawerSection>
        </div>

        {/* Drawer footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#edf0f2] bg-(--gf-green-soft) px-5 py-3">
          {verifying && !proof && (
            <span className="mr-auto flex items-center gap-1 text-[9px] font-semibold text-[#dc2626]">
              <TriangleAlert size={10} />Proof-gated: upload a photo or video to unlock approval.
            </span>
          )}
          {stageAction && !verifying && !resolved && (
            <button
              type="button"
              onClick={() => onNextStage(task.id)}
              className="rounded-md bg-(--gf-green) px-3 py-2 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark)"
            >
              {stageAction}
            </button>
          )}
          {resolved && !task.published && (
            <button
              type="button"
              disabled={!publishIntent}
              onClick={() => onPublish(task.id)}
              className="flex items-center gap-1 rounded-md border border-(--gf-green-border) bg-white px-3 py-2 text-[10px] font-bold text-(--gf-green) transition hover:bg-(--gf-green-soft) disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Share2 size={11} />Publish to Public Log
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#dfe7ea] bg-white px-3 py-2 text-[10px] font-bold text-[#60738f] transition hover:text-(--gf-green)"
          >
            Close
          </button>
          {verifying && (
            <button
              type="button"
              disabled={!proof}
              onClick={approve}
              className="flex items-center gap-1 rounded-md bg-(--gf-green) px-3 py-2 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 size={11} />Approve & Mark as Verified Fixed
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Manual work-order creation modal                                        */
/* ----------------------------------------------------------------------- */

function WorkOrderModal({ onClose, onCreate }) {
  const [draft, setDraft] = useState({ issue: "", category: CATEGORIES[0], zone: ZONES[1], team: TEAMS[0], priority: "Medium", deadline: "", notes: "" });

  function create() {
    onCreate({
      issue: draft.issue.trim(),
      category: draft.category,
      location: draft.zone.split(" — ")[1],
      zone: draft.zone,
      team: draft.team,
      priority: draft.priority,
      deadline: draft.deadline ? new Date(`${draft.deadline}T12:00:00`).getTime() : daysAgo(-7),
      notes: draft.notes.trim(),
    });
    setDraft({ issue: "", category: CATEGORIES[0], zone: ZONES[1], team: TEAMS[0], priority: "Medium", deadline: "", notes: "" });
  }

  return (
    <ModalShell title="Create Manual Work Order" subtitle="Internal maintenance task — does not originate from a resident report" onClose={onClose} width="max-w-[520px]"
      footer={<footer className="gf-modal-foot">
        <button type="button" onClick={onClose} className="gf-btn gf-btn--cancel">Cancel</button>
        <button type="button" disabled={!draft.issue.trim()} onClick={create} className="gf-btn gf-btn--primary">Create & Assign</button>
      </footer>}>
      <div className="gf-modal-body">
        <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Issue title
          <input value={draft.issue} onChange={(e) => setDraft((d) => ({ ...d, issue: e.target.value }))} placeholder="e.g. Scheduled street sweep — school frontage" className="rounded-md border border-[#d5dee3] px-2 py-2 text-[10px] outline-none focus:border-(--gf-green)" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Category
            <select className="gf-select" style={{ color: "#42506a", height: 34 }} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Location zone
            <select className="gf-select" style={{ color: "#42506a", height: 34 }} value={draft.zone} onChange={(e) => setDraft((d) => ({ ...d, zone: e.target.value }))}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Internal team
            <select className="gf-select" style={{ color: "#42506a", height: 34 }} value={draft.team} onChange={(e) => setDraft((d) => ({ ...d, team: e.target.value }))}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Priority
            <select className="gf-select" style={{ color: "#42506a", height: 34 }} value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Target deadline
            <input type="date" value={draft.deadline} onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))} className="rounded-md border border-[#d5dee3] px-2 py-2 text-[10px] outline-none focus:border-(--gf-green)" />
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Initial notes (optional)
            <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Scope, crew size, special equipment…" className="rounded-md border border-[#d5dee3] px-2 py-2 text-[10px] outline-none focus:border-(--gf-green)" />
          </label>
        </div>
        <div className="gf-note gf-note--soft">
          <Wrench size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
          <span>Manual work orders enter the queue as <strong>Pending</strong> with source “manual” — no external department accounts or multi-level approvals are involved.</span>
        </div>
      </div>
    </ModalShell>
  );
}

/* ----------------------------------------------------------------------- */
/* Audit trail                                                             */
/* ----------------------------------------------------------------------- */

function AuditTrailModal({ log, filter, onFilter, onClose }) {
  const entries = log.filter((entry) => filter === "All tasks" || entry.taskId === filter);
  return (
    <ModalShell title="Task Audit Trail" subtitle="Append-only history: status changes, edits, proofs and closures" onClose={onClose} width="max-w-[760px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="flex items-center gap-1 text-[9px] text-[#7184a0]"><Lock size={10} />Retention: 5 years (3–5-year policy) — proof files and edit logs included; entries can never be edited or deleted.</span>
        <button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Close</button>
      </footer>}>
      <div className="gf-modal-body">
        <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]" style={{ maxWidth: 280 }}>Filter
          <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={filter} onChange={(e) => onFilter(e.target.value)}>
            <option>All tasks</option>
            {[...new Set(log.map((entry) => entry.taskId))].map((id) => <option key={id}>{id}</option>)}
          </select>
        </label>
        <div className="gf-audit">
          {entries.map((entry) => (
            <article key={entry.key} className="gf-audit-item">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="gf-badge gf-badge--duplicate">{entry.taskId}</span>
                  <strong className="text-[#263246]">{entry.action}</strong>
                  <span className="gf-badge gf-badge--guest">{entry.system ? "system" : "user"}</span>
                </span>
                <span className="gf-audit-time">{entry.at}</span>
              </div>
              <p className="mt-1">{entry.detail}</p>
            </article>
          ))}
          {!entries.length && <p className="py-6 text-center text-[10px] text-[#60738f]">No entries for this task yet.</p>}
        </div>
      </div>
    </ModalShell>
  );
}

/* ----------------------------------------------------------------------- */
/* Main page                                                               */
/* ----------------------------------------------------------------------- */

const TABS = [
  { key: "intake", label: "Intake Queue", icon: ShieldCheck },
  { key: "active", label: "Active Work Orders", icon: Wrench },
  { key: "verify", label: "Awaiting Verification", icon: TriangleAlert },
  { key: "resolved", label: "Resolved & Logged", icon: CheckCircle2 },
];

export default function MaintenanceTasks() {
  const [tasks, setTasks] = useState(initialTasks);
  const [queue, setQueue] = useState(initialQueue);
  const [tab, setTab] = useState("intake");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All Priorities");
  const [team, setTeam] = useState("All Teams");
  const [zone, setZone] = useState("All Zones");
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [audit, setAudit] = useState({ open: false, taskId: "All tasks" });
  const [auditLog, setAuditLog] = useState(seededAudit);
  const [nowTs] = useState(() => NOW());

  const logAudit = useCallback((entry) => {
    setAuditLog((log) => [{ key: `${log.length + 1}-${NOW()}-${entry.taskId}`, at: stamp(true), ...entry }, ...log]);
  }, []);

  function updateTask(id, changes) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...changes } : task)));
  }

  function onUpdate(id, changes, detail) {
    updateTask(id, changes);
    if (detail) logAudit({ taskId: id, actor: "Admin — N. Villanueva", action: "Task updated", detail });
  }

  /* 1 — Direct non-emergency ingestion: one click, no external dept accounts,
     no multi-level approval. Geotag, landmark and media carry over. */
  function ingest(queueId) {
    const item = queue.find((q) => q.queueId === queueId);
    if (!item) return;
    const id = nextTaskId(tasks);
    const time = NOW();
    const task = {
      id, issue: item.issue, source: "report", originReportId: item.reportId,
      reporter: item.reporter, category: item.category,
      location: item.location, zone: item.zone, lat: item.lat, lng: item.lng,
      geotag: item.geotag, evidence: item.evidence, narration: item.narration,
      team: "", priority: "Medium", dateSubmitted: time,
      deadline: time + 7 * 86400000,
      status: "Pending", metrics: { submittedAt: time },
      reassignments: [], workNotes: [],
    };
    setTasks((current) => [task, ...current]);
    setQueue((current) => current.filter((q) => q.queueId !== queueId));
    logAudit({ taskId: id, actor: "System — Routing", system: true, action: "Ingested from intake", detail: `${item.reportId} auto-routed straight into the maintenance queue with geotag, landmark and ${item.evidence.length} media file(s). No external approvals required.` });
    toast.add({ type: "info", title: `Ingested ${item.reportId}`, description: `${id} created with geotag and evidence — assign a crew to start the lifecycle.` });
  }

  /* 2 — Manual work-order creation. */
  function createWorkOrder(draft) {
    const id = nextTaskId(tasks);
    const task = {
      id, issue: draft.issue, source: "manual", originReportId: null, reporter: null,
      category: draft.category, location: draft.location, zone: draft.zone,
      lat: 14.7285, lng: 121.0168 + Math.random() * 0.002,
      geotag: { source: "Internal survey", accuracy: "±5 m", landmark: `${draft.location} — admin-placed pin` },
      evidence: [], narration: draft.notes || "Internal preventive/scheduled work order.",
      team: draft.team, priority: draft.priority, dateSubmitted: NOW(),
      deadline: draft.deadline, status: "Pending", metrics: { submittedAt: NOW() },
      reassignments: [],
      workNotes: draft.notes ? [{ at: stamp(true), by: "Admin — N. Villanueva", note: draft.notes }] : [],
    };
    setTasks((current) => [task, ...current]);
    setCreateOpen(false);
    logAudit({ taskId: id, actor: "Admin — N. Villanueva", action: "Manual work order created", detail: `${draft.issue} — ${draft.team}, ${draft.priority} priority, deadline ${fmtDue(draft.deadline)}. Not sourced from a resident report.` });
    toast.add({ type: "success", title: "Work order created", description: `${id} filed as Pending for ${draft.team}.` });
  }

  /* 3 — Strict lifecycle transitions. */
  function nextStage(id) {
    const task = tasks.find((t) => t.id === id);
    const to = STAGE_ORDER[STAGE_ORDER.indexOf(task.status) + 1];
    if (!to) return;
    const metrics = {
      assignedAt: to === "Assigned" && !task.metrics.assignedAt ? NOW() : task.metrics.assignedAt,
      startedAt: to === "In Progress" && !task.metrics.startedAt ? NOW() : task.metrics.startedAt,
    };
    updateTask(id, { status: to, metrics: { ...task.metrics, ...metrics } });
    logAudit({ taskId: id, actor: "Admin — N. Villanueva", action: "Status change", detail: `${task.status} → ${to}${to === "In Progress" ? " — progress monitoring live" : ""}.` });
    toast.add({ type: "info", title: `Task ${id}`, description: `Lifecycle advanced: ${task.status} → ${to}.` });
  }

  /* 4 — Proof-gated closure; optionally publishes the privacy-safe summary. */
  function closeTask(id, closure, publishIntent = false) {
    const task = tasks.find((t) => t.id === id);
    const at = stamp(true);
    const updates = {
      status: "Verified Fixed",
      closure,
      metrics: { ...task.metrics, verifiedAt: NOW() },
      notified: true,
    };
    if (publishIntent) updates.published = { at, summary: privacySummary(task) };
    updateTask(id, updates);
    logAudit({ taskId: id, actor: closure.closedBy, action: "Resolution verified with proof", detail: `Proof ${closure.proof} uploaded — outcome: ${closure.outcome}` });
    logAudit({ taskId: id, actor: "System — Notifications", system: true, action: "Reporter notified", detail: `Read-only status update pushed${task.reporter?.type === "guest" ? ` to guest link ${task.reporter.token}` : ` to ${task.reporter?.name}`}.` });
    if (publishIntent) logAudit({ taskId: id, actor: "Admin — N. Villanueva", action: "Accomplishment summary published", detail: "Privacy-safe summary pushed to the public accomplishment log — reporter identifiers and exact addresses stripped." });
    toast.add({ type: "success", title: `${id} verified fixed`, description: publishIntent ? "Proof recorded; privacy-safe summary published to the public log." : "Proof recorded; the reporter was notified automatically." });
  }

  function reassign(id, reassignTo) {
    const task = tasks.find((t) => t.id === id);
    const firstAssignment = !task.team;
    updateTask(id, {
      team: reassignTo,
      status: firstAssignment && task.status === "Pending" ? "Assigned" : task.status,
      metrics: firstAssignment && !task.metrics.assignedAt ? { ...task.metrics, assignedAt: NOW() } : task.metrics,
      reassignments: [...task.reassignments, { from: task.team || "— unassigned —", to: reassignTo, at: stamp(true), by: "Admin — N. Villanueva" }],
    });
    logAudit({
      taskId: id,
      actor: "Admin — N. Villanueva",
      action: firstAssignment ? "Task assigned" : "Team reassigned",
      detail: firstAssignment ? `${reassignTo} picked up the task; lifecycle advanced Pending → Assigned.` : `${task.team} → ${reassignTo}`,
    });
    toast.add({ type: "info", title: firstAssignment ? "Crew assigned" : "Team reassigned", description: `${id} → ${reassignTo}.` });
  }

  function addNote(id, note) {
    const task = tasks.find((t) => t.id === id);
    updateTask(id, { workNotes: [{ at: stamp(true), by: "Admin — N. Villanueva", note }, ...task.workNotes] });
    logAudit({ taskId: id, actor: "Admin — N. Villanueva", action: "Work note added", detail: note });
  }

  /* 5 — One-click privacy-safe publish to the public accomplishment log. */
  function publish(id) {
    const task = tasks.find((t) => t.id === id);
    const at = stamp(true);
    updateTask(id, { published: { at, summary: privacySummary(task) } });
    logAudit({ taskId: id, actor: "Admin — N. Villanueva", action: "Accomplishment summary published", detail: "Privacy-safe summary pushed to the public accomplishment log — reporter identifiers and exact addresses stripped." });
    toast.add({ type: "success", title: "Published", description: "Privacy-safe summary is now on the public accomplishment log." });
  }

  function resetFilters() {
    setQuery("");
    setPriority("All Priorities");
    setTeam("All Teams");
    setZone("All Zones");
  }

  const stats = useMemo(() => ({
    intake: queue.length,
    active: tasks.filter((t) => ACTIVE_STATUSES.includes(t.status)).length,
    verifying: tasks.filter((t) => t.status === "Awaiting Verification").length,
    overdue: tasks.filter((t) => isOverdue(t, nowTs)).length,
  }), [tasks, queue, nowTs]);

  const filtered = useMemo(() => tasks.filter((task) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || `${task.id} ${task.issue} ${task.location} ${task.team} ${task.originReportId ?? ""}`.toLowerCase().includes(search);
    const matchesFilters = (priority === "All Priorities" || task.priority === priority)
      && (team === "All Teams" || task.team === team)
      && (zone === "All Zones" || task.zone === zone);
    const matchesTab = tab === "active" ? ACTIVE_STATUSES.includes(task.status)
      : tab === "verify" ? task.status === "Awaiting Verification"
      : tab === "resolved" ? task.status === "Verified Fixed"
      : true;
    return matchesSearch && matchesFilters && matchesTab;
  }), [tasks, query, priority, team, zone, tab]);

  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) : null;

  const tabCounts = {
    intake: stats.intake,
    active: stats.active,
    verify: stats.verifying,
    resolved: tasks.filter((t) => t.status === "Verified Fixed").length,
  };

  const actionLabel = tab === "verify" ? "Review" : "Manage";

  return (
    <div className="space-y-3">
      {/* 1 — KPI summary banner */}
      <section aria-label="Maintenance KPI summary" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Intake" value={stats.intake} icon={FileText} hint="auto-routed reports awaiting work orders" onClick={() => setTab("intake")} />
        <StatCard label="Active Tasks" value={stats.active} icon={Wrench} hint="ongoing repairs in the field" onClick={() => setTab("active")} />
        <StatCard label="Awaiting Verification" value={stats.verifying} icon={ShieldCheck} hint="crew done — needs admin proof-review" onClick={() => setTab("verify")} />
        <StatCard label="Overdue Tasks" value={stats.overdue} icon={Clock} hint="past deadline — escalate now" alert onClick={() => setTab("active")} />
      </section>

      {/* 2 — Tabbed workspaces */}
      <section className="rounded-lg border border-[#e2e8eb] bg-white shadow-sm">
        <div role="tablist" aria-label="Maintenance workspaces" className="flex flex-wrap gap-1 border-b border-[#e2e8eb] px-3">
          {TABS.map(({ key, label, icon: Icon }) => {
            const count = tabCounts[key];
            const alerting = (key === "intake" || key === "verify") && count > 0;
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={active}
                aria-controls={`panel-${key}`}
                onClick={() => setTab(key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-3 text-[11px] font-bold transition ${active ? "border-(--gf-green) text-(--gf-green)" : "border-transparent text-[#60738f] hover:text-(--gf-green)"}`}
              >
                <Icon size={12} />
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${alerting ? "bg-[#fff1c6] text-[#e69500]" : "bg-[#eef2f4] text-[#60738f]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-4">
          {tab === "intake" ? (
            queue.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {queue.map((item) => <IntakeCard key={item.queueId} item={item} onIngest={ingest} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ShieldCheck size={28} className="text-(--gf-green)" />
                <p className="text-[11px] font-bold text-[#263246]">Intake queue is clear</p>
                <p className="text-[10px] text-[#60738f]">No non-emergency reports are awaiting ingestion right now.</p>
              </div>
            )
          ) : (
            <>
              {/* Top bar: search + filters + record actions */}
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-(--gf-surface) p-2">
                <label className="gf-search">
                  <Search size={14} />
                  <input
                    aria-label="Search tasks"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search tasks, teams, zones, origin reports..."
                    className="w-full text-[10px] outline-none placeholder:text-[#a0b0c0]"
                  />
                </label>
                <SelectFilter value={priority} options={["All Priorities", ...PRIORITIES]} onChange={setPriority} ariaLabel="Filter priority" />
                <SelectFilter value={team} options={["All Teams", ...TEAMS]} onChange={setTeam} ariaLabel="Filter team" />
                <SelectFilter value={zone} options={["All Zones", ...ZONES]} onChange={setZone} ariaLabel="Filter zone" />
                <button type="button" onClick={resetFilters} className="flex items-center gap-1 px-2 text-[9px] text-[#60738f] hover:text-(--gf-green)"><RotateCcw size={11} /> Reset</button>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setAudit({ open: true, taskId: "All tasks" })} className="gf-btn gf-btn--chip"><History size={11} />Audit Trail</button>
                  <button type="button" onClick={() => toast.add({ title: "Export ready", description: "CSV of the filtered maintenance records is prepared.", type: "success" })} className="gf-btn gf-btn--chip"><Download size={11} /> Export CSV</button>
                  <button type="button" onClick={() => toast.add({ title: "Export ready", description: "PDF export of the filtered maintenance records is prepared for archiving.", type: "success" })} className="gf-btn gf-btn--chip"><Download size={11} /> Export PDF</button>
                  <button type="button" onClick={() => setCreateOpen(true)} className="gf-btn gf-btn--primary"><Plus size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 3 }} />Create Work Order</button>
                </div>
              </div>

              <p className="mb-2 text-[9px] font-semibold text-[#7184a0]">
                {tab === "active" && `Showing ${filtered.length} pending / in-progress work order(s)`}
                {tab === "verify" && `Showing ${filtered.length} submission(s) awaiting admin proof-review`}
                {tab === "resolved" && `Showing ${filtered.length} verified, logged resolution(s)`}
              </p>

              <TaskTable
                tasks={filtered}
                nowTs={nowTs}
                actionLabel={actionLabel}
                onOpen={setSelectedId}
                emptyLabel={tab === "active"
                  ? "No active work orders match the selected filters."
                  : tab === "verify"
                    ? "Nothing to verify — crews have no pending completion claims."
                    : "No resolved tasks logged yet."}
              />
            </>
          )}
        </div>
      </section>

      {selectedTask && (
        <TaskDrawer
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedId(null)}
          onNextStage={nextStage}
          onCloseTask={closeTask}
          onReassign={reassign}
          onUpdate={onUpdate}
          onAddNote={addNote}
          onPublish={publish}
          onOpenAudit={(taskId) => { setSelectedId(null); setAudit({ open: true, taskId }); }}
        />
      )}
      {createOpen && <WorkOrderModal onClose={() => setCreateOpen(false)} onCreate={createWorkOrder} />}
      {audit.open && <AuditTrailModal log={auditLog} filter={audit.taskId} onFilter={(taskId) => setAudit((a) => ({ ...a, taskId }))} onClose={() => setAudit({ open: false, taskId: "All tasks" })} />}
    </div>
  );
}
