import ReportCategories from "../../shared/components/ReportCategories";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera, CheckCircle2, Clock, Download, Eye, EyeOff, FileText, FileUp, History, Languages, Link2,
  Lock, MapPinned, Plus, RotateCcw, Search, Share2, ShieldCheck, Trash2, TriangleAlert, UserCheck,
  Video, Wrench, X,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import MapViewer from "../../shared/components/MapViewer";
import { ModalShell, SelectFilter, stamp } from "../../shared/components/GovernanceUi";
import reportCatalog from "../../../../server/src/shared/reportCatalog.json";

function formatPhTimestamp(value) {
  if (!value) return "—";
  const text = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text.replace(" ", "T") + "Z" : text;
  const ms = Date.parse(iso);
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })
    : text;
}

function FalseReportsPanel({ reports, loading, onUpdateAccount }) {
  const [busyId, setBusyId] = useState("");

  async function toggleSuspend(report) {
    const userId = report.reporter?.user_id;
    if (!userId || busyId) return;
    const isSuspended = Number(report.reporter?.account_status_id) === 2;
    const action = isSuspended ? "Restore" : "Suspend";
    setBusyId(report.incident_id);
    try {
      await onUpdateAccount(userId, action, `False report control (${report.reference_number})`);
    } finally {
      setBusyId("");
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-xs text-slate-500">Loading rejected &amp; false reports…</p>;
  }
  if (!reports.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center">
        <ShieldCheck size={28} className="mx-auto text-slate-300" />
        <p className="mt-2 text-sm font-bold text-slate-700">No rejected or false reports</p>
        <p className="mt-1 text-xs text-slate-500">
          Reports rejected or flagged as false by Admin or BDRRMO will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e2e8eb]">
      <table className="w-full min-w-[820px] border-collapse text-left text-xs">
        <thead className="border-b border-[#e2e8eb] bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <tr>
            {["Reference", "Report & Description", "Reporter", "Flag / Reason", "Flagged (PH)", "Action"].map((h) => (
              <th key={h} className="px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {reports.map((r) => {
            const isSuspended = Number(r.reporter?.account_status_id) === 2;
            const isRevoked = Number(r.reporter?.account_status_id) === 3;
            return (
              <tr key={r.incident_id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 align-top">
                  <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-extrabold text-slate-800">
                    {r.reference_number}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold text-slate-500">{r.report_type}</span>
                </td>
                <td className="max-w-[240px] px-4 py-3 align-top">
                  <p className="font-bold text-slate-900">{r.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{r.location}</p>
                  {r.description ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{r.description}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-bold text-slate-800">{r.reporter?.name || "Guest"}</p>
                  <p className="text-[11px] text-slate-500">
                    {r.reporter?.phone || r.reporter?.email || (r.reporter?.type === "guest" ? "Guest reporter" : "—")}
                  </p>
                  {r.reporter?.user_id ? (
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${isRevoked ? "bg-rose-100 text-rose-700" : isSuspended ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                      {isRevoked ? "Revoked" : isSuspended ? "Suspended" : "Active Account"}
                    </span>
                  ) : (
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Guest
                    </span>
                  )}
                </td>
                <td className="max-w-[220px] px-4 py-3 align-top">
                  <span className="inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                    Flagged Report
                  </span>
                  <p className="mt-1 text-[11px] text-slate-700">{r.reason}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">By {r.rejected_by}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-[11px] text-slate-500">
                  {formatPhTimestamp(r.rejected_at)}
                </td>
                <td className="px-4 py-3 align-top">
                  {r.reporter?.user_id && !isRevoked ? (
                    <button
                      type="button"
                      disabled={busyId === r.incident_id}
                      onClick={() => void toggleSuspend(r)}
                      className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                        isSuspended
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                    >
                      {busyId === r.incident_id ? "Saving…" : isSuspended ? "Restore Account" : "Suspend Reporter"}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">No account action</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Constants                                                               */
/* ----------------------------------------------------------------------- */

const TEAMS = [
  "Tanod R. Villa",
  "Tanod J. Pascual",
  "Tanod A. Bueno",
  "Barangay Sanitizers",
  "Engineering Crew B",
  "Maintenance Team A",
  "Barangay Public Works",
];
const PRIORITIES = ["Urgent", "Standard", "High", "Medium", "Low"];
const URGENCY_OPTIONS = ["Urgent", "Standard"];
const ZONES = ["Zone 1 — Rizal St / Quezon Ave", "Zone 2 — Magsaysay Blvd", "Zone 3 — Roxas Blvd", "Zone 4 — Bonifacio St / Del Pilar Rd"];
const CATEGORIES = reportCatalog.categories.maintenance;

/* Strict lifecycle: only these transitions are allowed, forward one step. */
const STAGE_ORDER = ["Pending", "Assigned", "In Progress", "Awaiting Verification", "Verified Fixed"];

const ACTIVE_STATUSES = ["Pending", "Assigned", "In Progress", "For Funding"];

const PRIORITY_BADGE = {
  Urgent: "bg-[#fdecea] text-[#dc2626]",
  Standard: "bg-[#fff1c6] text-[#e69500]",
  High: "bg-[#fdecea] text-[#dc2626]",
  Medium: "bg-[#fff1c6] text-[#e69500]",
  Low: "bg-[#eef2f4] text-[#60738f]",
};
const STATUS_BADGE = {
  Pending: "bg-[#eef2f4] text-[#60738f]",
  Assigned: "bg-[#fff1c6] text-[#e69500]",
  "In Progress": "bg-(--gf-green-tint-2) text-(--gf-green)",
  "For Funding": "bg-[#fef3c7] text-[#b45309]",
  "Awaiting Verification": "bg-[#fff1c6] text-[#e69500]",
  "Verified Fixed": "bg-(--gf-green-tint-2) text-(--gf-green)",
};

/* ----------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ----------------------------------------------------------------------- */

const NOW = () => Date.now();
const fmtWhen = (t) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDue = (t) => (t ? new Date(t).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "—");

function normalizeTaskId(rawId) {
  return String(rawId || "").replace(/^TASK-167-(?:167)+/i, "TASK-167-");
}

function nextTaskId(existing) {
  const max = existing.reduce((m, t) => {
    const clean = normalizeTaskId(t.id);
    const trailing = clean.replace(/^TASK-167-/i, "").match(/(\d+)$/)?.[1] || "";
    return Math.max(m, Number(trailing) || 0);
  }, 0);
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
  return `${task.category} task at ${task.location}${task.zone ? ` (${task.zone})` : ""} completed by ${task.team}. Reporter details and exact household addresses are intentionally excluded.`;
}

const isOverdue = (task, now) => task.status !== "Verified Fixed" && now > (task.deadline ?? Infinity);

const FLAG_PATTERNS = [
  /\bg+\s*ag+[oa]\b/gi, /\bputang(?:\s+ina)?\b/gi, /\bwalang\s+hiya\b/gi,
  /\bpunyeta\b/gi, /\btarantado\b/gi, /\bbobo\b/gi,
  /\bstupid\b/gi, /\bidiot(?:ic)?\b/gi, /\bfu+c?k+(?:ing)?\b/gi, /\bsh+i+t*\b/gi,
];

function languageScan(text) {
  const flaggedTerms = [];
  let sanitized = String(text ?? "");
  for (const re of FLAG_PATTERNS) {
    sanitized = sanitized.replace(re, (m) => {
      flaggedTerms.push(m);
      return "*".repeat(Math.min(8, Math.max(3, m.length)));
    });
  }
  return { flaggedTerms, sanitized: sanitized.replace(/\s{3,}/g, "  ").trim() };
}

/* ----------------------------------------------------------------------- */
/* Small presentational bits                                               */
/* ----------------------------------------------------------------------- */

function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold leading-none ${className}`}>
      {children}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return <Chip className={PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.Standard}>{priority}</Chip>;
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
  const allCompleted = status === "Verified Fixed";
  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGE_ORDER.map((stage, index) => {
        const isDone = allCompleted || index < activeIndex;
        const isCurrent = !isDone && index === activeIndex;
        return (
          <span key={stage} className={`gf-stage ${isCurrent ? "text-[#e69500]" : isDone ? "text-(--gf-green)" : "text-[#a0b0c0]"}`}>
            <span className={`gf-stage-dot ${isDone ? "gf-stage-dot--done" : isCurrent ? "gf-stage-dot--active" : "gf-stage-dot--locked"}`}>{isDone ? "✓" : ""}</span>
            {stage}
          </span>
        );
      })}
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
      className={`flex min-h-[112px] items-center gap-4 rounded-xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${alert ? "border-[#f3d3d3] hover:border-[#efa9a1] hover:shadow-md" : "border-[#e2e8eb] hover:border-(--gf-green) hover:shadow-md"} ${clickable ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-(--gf-green)" : ""}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${alert ? "bg-[#fdecea] text-[#dc2626]" : "bg-(--gf-green-soft) text-(--gf-green)"}`}>
        <Icon size={21} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-[#60738f]">{label}</span>
        <span className={`block text-3xl font-extrabold leading-tight ${alert ? "text-[#dc2626]" : "text-[#263246]"}`}>{value}</span>
        {hint && <span className="mt-1 block text-[10px] font-medium leading-snug text-[#7c8ba3]">{hint}</span>}
      </span>
    </Tag>
  );
}

function IntakeCard({ item, onReview }) {
  return (
    <article className="flex min-h-[310px] flex-col gap-3 rounded-xl border border-[#e0e7eb] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-(--gf-green) hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip className="bg-(--gf-green-tint-2) text-(--gf-green)">{item.reportId}</Chip>
            <Chip className="bg-[#eef2f4] text-[#60738f]"><ReportCategories report={item} /></Chip>
          </div>
          <h3 className="mt-2 text-[15px] font-bold leading-snug text-[#263246]">{item.issue}</h3>
        </div>
        <Chip className="mt-0.5 shrink-0 rounded-full bg-[#fff1c6] text-[#e69500]">new</Chip>
      </div>
      <p className="flex items-start gap-1.5 text-[12px] text-[#60738f]">
        <MapPinned size={14} className="mt-px shrink-0 text-(--gf-green)" />
        {item.location}{item.zone ? ` - ${item.zone}` : ""}
      </p>
      <p className="text-[11px] text-[#7c8ba3]">GPS {item.geotag.source} ({item.geotag.accuracy}) • {item.geotag.landmark}</p>
      <p className="text-[12px] italic leading-relaxed text-[#60738f]">“{item.narration}”</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {item.reporter.type === "guest"
          ? <Chip className="bg-[#eef2fb] text-[#4c6fbf]"><Link2 size={8} />{item.reporter.token ? `Guest link ${item.reporter.token}` : `Guest · ${item.reporter.name || "Reporter"}`}</Chip>
          : <Chip className="bg-(--gf-green-tint) text-(--gf-green)"><ShieldCheck size={8} />Verified Resident · {item.reporter.name}</Chip>}
        {item.outsideBarangay && <Chip className="bg-[#fdecea] text-[#dc2626]">Outside Barangay 167</Chip>}
        <EvidenceChips evidence={item.evidence} small />
        <span className="ml-auto text-[10px] font-medium text-[#7c8ba3]">{item.submitted}</span>
      </div>
      <button
        type="button"
        onClick={() => onReview(item)}
        className="mt-auto w-full rounded-md bg-(--gf-green) px-4 py-3 text-[12px] font-bold text-white transition hover:-translate-y-px hover:bg-(--gf-green-dark) focus-visible:outline-2 focus-visible:outline-(--gf-green)"
      >
        Review
      </button>
    </article>
  );
}

/* ----------------------------------------------------------------------- */
/* Stage 1: Intake Review / Triage Drawer (No Evidence Closure shown here) */
/* ----------------------------------------------------------------------- */

function IntakeReviewDrawer({ item, tanods, onClose, onConfirmIngest, onFlagIntake, logAudit }) {
  const [urgency, setUrgency] = useState("Standard");
  const [showRaw, setShowRaw] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);
  const language = useMemo(() => languageScan(item.narration ?? ""), [item.narration]);
  const availableTanod = useMemo(
    () => tanods.find((t) => t.availability_status === "AVAILABLE") || tanods[0],
    [tanods],
  );
  const [selectedTanodId, setSelectedTanodId] = useState(availableTanod?.id || "");
  const [deadlineDate, setDeadlineDate] = useState(() => toDateInput(Date.now() + 3 * 86400000));

  function toggleRaw() {
    const next = !showRaw;
    setShowRaw(next);
    if (next && logAudit) {
      logAudit({
        taskId: item.reportId,
        actor: "Admin — N. Villanueva",
        system: false,
        action: "Unfiltered text view",
        detail: "Admin viewed the original un-sanitized maintenance report text during intake review.",
      });
    }
  }

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const selectedTanod = tanods.find((t) => t.id === selectedTanodId) || null;
  const hasCoordinates = Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng));
  const canIngest = Boolean(
    urgency
    && selectedTanod
    && !["UNAVAILABLE", "OUT_OF_SERVICE"].includes(selectedTanod.availability_status)
    && deadlineDate
    && deadlineDate.trim().length > 0,
  );

  function handleIngest() {
    if (!canIngest) return;
    const deadlineTs = new Date(`${deadlineDate}T12:00:00`).getTime();
    onConfirmIngest(item.queueId, {
      urgency,
      tanod: selectedTanod,
      deadline: Number.isFinite(deadlineTs) ? deadlineTs : Date.now() + 3 * 86400000,
    });
  }

  async function handleConfirmFlag() {
    if (!onFlagIntake || flagging) return;
    setFlagging(true);
    try {
      await onFlagIntake(item, flagReason.trim());
    } finally {
      setFlagging(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close review drawer"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default border-0 bg-slate-900/40 backdrop-blur-[2px] [animation:gf-fade-in_0.18s_ease-out]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Review maintenance report ${item.reportId}`}
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-[#e2e8eb] bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.25)] [animation:gf-drawer-in_0.22s_ease-out] sm:w-[40%] sm:min-w-[500px] sm:max-w-[680px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf0f2] bg-(--gf-green-soft) px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold text-(--gf-green)">{item.reportId}</h2>
              <Chip className="bg-[#fff1c6] text-[#e69500]">Intake Review</Chip>
              <Chip className="bg-[#eef2f4] text-[#60738f]"><ReportCategories report={item} /></Chip>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-[#60738f]">{item.issue} • {item.location}</p>
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
          <DrawerSection title="Intake Report & Reporter" icon={ShieldCheck}>
            <div>
              <InfoRow label="Report ID">{item.reportId}</InfoRow>
              <InfoRow label="Category"><ReportCategories report={item} /></InfoRow>
              <InfoRow label="Reporter">
                <span className="inline-flex items-center gap-1">
                  {item.reporter.type === "guest"
                    ? <Chip className="bg-[#eef2fb] text-[#4c6fbf]"><Link2 size={8} />Guest</Chip>
                    : <Chip className="bg-(--gf-green-tint) text-(--gf-green)"><ShieldCheck size={8} />Verified Resident</Chip>}
                  {item.reporter.name}
                </span>
              </InfoRow>
              {item.reporter?.token && (
                <InfoRow label="Guest token">
                  <span className="font-mono">{item.reporter.token}</span>
                </InfoRow>
              )}
              <InfoRow label="Submitted">{item.submitted}</InfoRow>
            </div>
            {item.narration && (
              <p className="mt-2 rounded-md border border-[#e0e7eb] bg-white px-2.5 py-2 text-[10px] text-[#60738f]">
                <span className="font-bold text-[#263246]">Report description:</span> {language.sanitized}
              </p>
            )}
          </DrawerSection>

          <DrawerSection title="Report Language (Auto-Sanitized)" icon={Languages}>
            <div className="gf-note gf-note--soft" style={{ alignItems: "center" }}>
              <Languages size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
              <span>
                Submission was never blocked or delayed.{" "}
                {language.flaggedTerms.length
                  ? "Flagged terms were masked for all staff views:"
                  : "No flagged language detected."}
              </span>
            </div>
            {language.flaggedTerms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {language.flaggedTerms.map((term, i) => (
                  <span key={`${term}-${i}`} className="gf-badge gf-badge--alert">
                    {term.trim()} → masked
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 rounded-lg border border-[#e0e7eb] bg-white p-3 text-[10px] leading-4 text-[#42506a]">
              <p className="mb-1 text-[8px] font-bold uppercase text-[#7184a0]">Sanitized copy (default view)</p>
              <p>{language.sanitized}</p>
            </div>
            <div className="mt-1.5 rounded-lg border border-dashed border-[#e7c9c9] bg-[#fffafa] p-3 text-[10px] leading-4 text-[#7a3040]">
              <p className="mb-1 flex items-center gap-1 text-[8px] font-bold uppercase text-[#b04646]">
                <button
                  type="button"
                  onClick={toggleRaw}
                  aria-pressed={showRaw}
                  className="flex items-center gap-1 uppercase"
                  style={{ fontSize: 8 }}
                >
                  {showRaw ? <EyeOff size={9} /> : <Eye size={9} />}
                  {showRaw ? "Hide" : "Show"} unfiltered view (admin only)
                </button>
              </p>
              {showRaw ? (
                <p>{item.narration}</p>
              ) : (
                <p className="text-[#b9c6d2]">
                  Hidden. Every unfiltered view is written to the immutable audit trail.
                </p>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Geotagged Location & Intake Media" icon={MapPinned}>
            <div className="gf-note gf-note--soft">
              <MapPinned size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
              <span><strong>{item.geotag.source}</strong> • accuracy {item.geotag.accuracy} • landmark: {item.geotag.landmark}</span>
            </div>
            {hasCoordinates ? (
              <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
                <div className="h-[200px]">
                  <MapViewer
                    compact
                    incidents={[{ id: item.reportId, title: item.issue, category: "infrastructure", status: "Pending", lat: Number(item.lat), lng: Number(item.lng) }]}
                    selectedIncident={{ id: item.reportId, lat: Number(item.lat), lng: Number(item.lng) }}
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-[9px] font-bold text-[#60738f]">
                  <span>{item.location}, Barangay 167</span>
                  <span>{Number(item.lat).toFixed(4)} N, {Number(item.lng).toFixed(4)} E</span>
                </div>
              </div>
            ) : (
              <div className="gf-note gf-note--soft mt-2">
                <MapPinned size={14} />
                <span>Location note: {item.location}</span>
              </div>
            )}
            <div className="mt-2"><EvidenceChips evidence={item.evidence} /></div>
            {item.incidentId && item.photos?.length > 0 && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {item.photos.map((photo, idx) => {
                  const photoId = typeof photo === "string" ? photo : photo.id;
                  return (
                    <a
                      key={photoId || idx}
                      href={`/api/reports/${encodeURIComponent(item.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block h-[120px] overflow-hidden rounded-lg border border-[#dfe7ea] bg-slate-100"
                    >
                      <img
                        src={`/api/reports/${encodeURIComponent(item.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                        alt={`Reporter maintenance photo ${idx + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[8px] font-bold text-white">
                        Reporter Photo #{idx + 1}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Urgency & Classification" icon={Wrench}>
            <div className="grid grid-cols-2 gap-2">
              {URGENCY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={urgency === option}
                  onClick={() => setUrgency(option)}
                  className={`gf-option ${urgency === option ? "gf-option--active" : ""}`}
                >
                  {option === "Urgent" ? <TriangleAlert size={13} /> : <Wrench size={13} />}
                  <span>{option}</span>
                </button>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection title="Assign Tanod & Inspection Deadline" icon={UserCheck} last>
            <div className="grid gap-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                Assign Tanod (with Availability Status) *
              </p>

              <div className="grid gap-1.5">
                {tanods.map((t) => {
                  const isSelectable = !["UNAVAILABLE", "OUT_OF_SERVICE"].includes(t.availability_status);
                  const isAvailable = t.availability_status === "AVAILABLE";
                  const isSelected = t.id === selectedTanodId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!isSelectable}
                      onClick={() => setSelectedTanodId(t.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[10px] transition ${
                        isSelected
                          ? "border-(--gf-green) bg-(--gf-green-soft)"
                          : "border-[#e0e7eb] bg-white hover:border-(--gf-green)"
                      } ${!isSelectable ? "cursor-not-allowed opacity-55" : ""}`}
                    >
                      <div>
                        <span className="font-bold text-[#263246]">{t.display_name || t.responder_name}</span>
                        {t.beat && <span className="ml-1.5 text-[9px] text-[#60738f]">• {t.beat}</span>}
                      </div>
                      <Chip className={isAvailable ? "bg-(--gf-green-tint-2) text-(--gf-green)" : "bg-[#fff1c6] text-[#e69500]"}>
                        {t.availability_status}
                      </Chip>
                    </button>
                  );
                })}
              </div>

              <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                On-Site Inspection Deadline *
                <input
                  type="date"
                  aria-label="On-site inspection deadline"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="h-9 rounded-md border border-[#dfe7ea] bg-white px-2.5 text-[10px] font-semibold text-(--gf-green) outline-none focus:border-(--gf-green)"
                />
                <span className="text-[8px] font-normal normal-case text-[#7184a0]">
                  Target date by which the assigned Tanod must inspect the maintenance report on-site.
                </span>
              </label>

              {onFlagIntake && (
                <div className="border-t border-[#e2e8eb] pt-3">
                  {flagOpen ? (
                    <div className="space-y-2 rounded-md border border-[#f3d3d3] bg-[#fdecea]/60 p-2.5">
                      <p className="text-[10px] font-bold text-[#991b1b]">Flag Maintenance Report</p>
                      <input
                        value={flagReason}
                        onChange={(e) => setFlagReason(e.target.value)}
                        placeholder="Reason for flagging this report (optional)..."
                        className="h-8 w-full rounded border border-[#f3d3d3] bg-white px-2.5 text-[11px] text-[#263246] outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setFlagOpen(false); setFlagReason(""); }}
                          className="flex-1 rounded border border-[#dfe7ea] bg-white py-1.5 text-[10px] font-bold text-[#60738f]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={flagging}
                          onClick={handleConfirmFlag}
                          className="flex-1 rounded bg-[#dc2626] py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                        >
                          {flagging ? "Flagging..." : "Confirm Flag Report"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFlagOpen(true)}
                      className="w-full rounded-md border border-[#f3d3d3] bg-[#fdecea] py-2 text-[10px] font-bold text-[#dc2626] transition hover:bg-[#dc2626] hover:text-white"
                    >
                      Flag Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </DrawerSection>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf0f2] bg-(--gf-green-soft) px-5 py-3">
          {!canIngest ? (
            <span className="flex items-center gap-1 text-[9px] font-semibold text-[#dc2626]">
              <TriangleAlert size={11} />Select urgency, an AVAILABLE Tanod, and a deadline to ingest.
            </span>
          ) : (
            <span className="text-[9px] font-semibold text-(--gf-green)">
              Ready to dispatch to {selectedTanod?.display_name || selectedTanod?.responder_name}.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#dfe7ea] bg-white px-3 py-2 text-[10px] font-bold text-[#60738f] transition hover:text-(--gf-green)"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canIngest}
              onClick={handleIngest}
              className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ingest to Work Order
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Work-order data table (shared by tabs 2, 3, 4)                          */
/* ----------------------------------------------------------------------- */

const TABLE_HEADINGS = ["Task ID", "Issue", "Location", "Assigned Tanod", "Priority", "Deadline", "Status", "Action"];

function TaskTable({ tasks, emptyLabel, actionLabel, onOpen, nowTs }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#edf0f2]">
      <table className="w-full min-w-[1120px] border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[10px] font-bold uppercase tracking-wider text-[#60738f]">
            {TABLE_HEADINGS.map((h) => <th key={h} className="px-4 py-3.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task, nowTs);
            return (
              <tr key={task.id} className="border-b border-[#f1f4f6] transition-colors last:border-b-0 hover:bg-(--gf-row-hover)">
                <td className="px-4 py-4">
                  <span className="font-bold text-(--gf-green)">{task.id}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <OriginChip task={task} />
                    {task.published && <Chip className="bg-(--gf-green-tint-2) text-(--gf-green)">published</Chip>}
                    {task.notified && !task.published && <Chip className="bg-(--gf-green-tint) text-(--gf-green)">reporter notified</Chip>}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-[12px] font-semibold text-[#263246]">{task.issue}</span>
                  <div className="mt-1 text-[10px] text-[#7c8ba3]">{task.category}</div>
                </td>
                <td className="px-4 py-4 text-[12px] text-[#60738f]">
                  {task.location}
                  <div className="mt-1 text-[10px] text-[#7c8ba3]">{task.zone}</div>
                </td>
                <td className="px-4 py-4 text-[12px] font-semibold text-(--gf-green)">
                  {task.team || <span className="italic text-[#a0b0c0]">Unassigned</span>}
                </td>
                <td className="px-4 py-4"><PriorityBadge priority={task.priority} /></td>
                <td className={`whitespace-nowrap px-4 py-4 ${overdue ? "font-bold text-[#dc2626]" : "text-[#60738f]"}`}>
                  {fmtDue(task.deadline)}
                  {overdue && <div className="mt-0.5"><Chip className="bg-[#fdecea] text-[#dc2626]">overdue</Chip></div>}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={task.status} />
                    {task.fastTrackPending && (
                      <Chip className="bg-[#fff1c6] text-[#e69500]">Pending Verification</Chip>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onOpen(task.id)}
                    className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[11px] font-bold text-white transition hover:-translate-y-px hover:bg-(--gf-green-dark) focus-visible:outline-2 focus-visible:outline-(--gf-green)"
                  >
                    {task.fastTrackPending ? "Manage (Pending)" : actionLabel}
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
/* Task management slide-over drawer (Stages 2, 3, 4)                      */
/* ----------------------------------------------------------------------- */

function TaskDrawer({ task, onClose, onCompleteCheck, onToggleForFunding, onCloseTask, onRejectProof, onUpdateInspectionPhotos, onUpdateRepairPhotos, onAddNote, onPublish, onOpenAudit }) {
  const [publishIntent, setPublishIntent] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [rejectStage, setRejectStage] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  async function handleConfirmRejectProof() {
    if (!onRejectProof || !rejectStage || rejecting) return;
    setRejecting(true);
    try {
      await onRejectProof(task.id, rejectStage, rejectReason.trim());
      setRejectStage(null);
      setRejectReason("");
    } finally {
      setRejecting(false);
    }
  }

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

  const isActiveOrder = ACTIVE_STATUSES.includes(task.status);
  const verifying = task.status === "Awaiting Verification";
  const resolved = task.status === "Verified Fixed";

  const inspectionPhotos = task.inspectionPhotos || [];
  const repairPhotos = task.repairPhotos || [];

  const canCompleteCheck = Boolean(
    task.team
    && task.priority
    && inspectionPhotos.length > 0,
  );

  const canApproveRepair = Boolean(
    task.team
    && task.priority
    && repairPhotos.length > 0,
  );

  function addNote() {
    if (!noteDraft.trim()) return;
    onAddNote(task.id, noteDraft.trim());
    setNoteDraft("");
  }

  function handleAddInspectionFiles(event) {
    const files = Array.from(event.target.files || []).map((f) => f.name);
    if (!files.length) return;
    onUpdateInspectionPhotos(task.id, [...inspectionPhotos, ...files]);
    event.target.value = "";
  }

  function handleRemoveInspectionPhoto(index) {
    onUpdateInspectionPhotos(
      task.id,
      inspectionPhotos.filter((_, i) => i !== index),
    );
  }

  function handleAddRepairFiles(event) {
    const files = Array.from(event.target.files || []).map((f) => f.name);
    if (!files.length) return;
    onUpdateRepairPhotos(task.id, [...repairPhotos, ...files]);
    event.target.value = "";
  }

  function handleRemoveRepairPhoto(index) {
    onUpdateRepairPhotos(
      task.id,
      repairPhotos.filter((_, i) => i !== index),
    );
  }

  function approve() {
    if (!canApproveRepair) return;
    onCloseTask(task.id, {
      proof: repairPhotos.join(", "),
      closedBy: "Admin — N. Villanueva",
      closedAt: stamp(true),
      outcome: "Admin reviewed the uploaded finalizing proof of repair and confirmed the site is restored.",
      remarks: "Approved from the task drawer after final repair proof review.",
    }, publishIntent);
  }

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
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-[#e2e8eb] bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.25)] [animation:gf-drawer-in_0.22s_ease-out] sm:w-[48%] sm:min-w-[680px] sm:max-w-[820px]"
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
            {Number.isFinite(Number(task.lat)) && Number.isFinite(Number(task.lng)) && (
              <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
                <div className="h-[200px]">
                  <MapViewer
                    compact
                    incidents={[{ id: task.id, title: task.issue, category: "infrastructure", status: task.status, lat: Number(task.lat), lng: Number(task.lng) }]}
                    selectedIncident={{ id: task.id, lat: Number(task.lat), lng: Number(task.lng) }}
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-[9px] font-bold text-[#60738f]">
                  <span>{task.location}, Barangay 167</span>
                  <span>{Number(task.lat).toFixed(4)} N, {Number(task.lng).toFixed(4)} E</span>
                </div>
              </div>
            )}
            <div className="mt-2"><EvidenceChips evidence={task.evidence} /></div>
            {task.incidentId && task.reporterPhotos?.length > 0 && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {task.reporterPhotos.map((photo, idx) => {
                  const photoId = typeof photo === "string" ? photo : photo.id;
                  return (
                    <a
                      key={photoId || idx}
                      href={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block h-[120px] overflow-hidden rounded-lg border border-[#dfe7ea] bg-slate-100"
                    >
                      <img
                        src={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                        alt={`Reporter maintenance photo ${idx + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[8px] font-bold text-white">
                        Reporter Photo #{idx + 1}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Assignment Controls (Locked)" icon={Wrench}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                <span className="flex items-center gap-1"><Lock size={10} />Assigned Tanod</span>
                <div className="flex h-8 items-center justify-between rounded-md border border-[#dfe7ea] bg-[#f8fafb] px-2.5 text-[10px] font-bold text-(--gf-green)">
                  <span>{task.team || "Tanod R. Villa"}</span>
                  <Chip className="bg-[#eef2f4] text-[#60738f]">Locked</Chip>
                </div>
              </div>
              <div className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                <span className="flex items-center gap-1"><Lock size={10} />Priority</span>
                <div className="flex h-8 items-center justify-between rounded-md border border-[#dfe7ea] bg-[#f8fafb] px-2.5 text-[10px] font-bold text-[#263246]">
                  <PriorityBadge priority={task.priority || "Standard"} />
                  <Chip className="bg-[#eef2f4] text-[#60738f]">Locked</Chip>
                </div>
              </div>
            </div>
          </DrawerSection>

          {isActiveOrder && (
            <DrawerSection title="Multimedia Evidence (Tanod Arrival & On-Site Inspection)" icon={Camera}>
              {(task.inspectionDone || inspectionPhotos.length > 0) && (
                <div className="mb-2.5 rounded-lg border border-(--gf-green-border) bg-(--gf-green-soft) p-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-(--gf-green)">
                    <CheckCircle2 size={13} />
                    Inspection by Tanod is successful
                  </p>
                  {task.inspectionNote && (
                    <p className="mt-1 text-[9px] text-[#263246]">
                      <strong>Tanod Note:</strong> {task.inspectionNote}
                    </p>
                  )}
                </div>
              )}
              {task.fastTrackPending && (
                <div className="mb-2.5 rounded-lg border border-[#f5d488] bg-[#fff9e6] p-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#b45309]">
                    <TriangleAlert size={13} />
                    Pending: Tanod also submitted Proof of Repair ahead of Admin check review
                  </p>
                  <p className="mt-0.5 text-[9px] text-[#78350f]">
                    Verify the inspection proof below and click <strong>Complete Check</strong> to pass this directly to <strong>Awaiting Verification</strong> and then <strong>Resolved & Logged</strong>.
                  </p>
                </div>
              )}
              <p className="mb-2 text-[9px] text-[#60738f]">
                Proof that the assigned Tanod arrived and inspected the area (useful for repairs requiring budget or long-term materials). Admin can freely add or modify inspection photos below.
              </p>
              <label
                htmlFor={`inspection-proof-${task.id}`}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-center transition ${
                  inspectionPhotos.length ? "border-(--gf-green) bg-(--gf-green-soft)" : "border-[#d5dee3] bg-[#f8fafb] hover:border-(--gf-green)"
                }`}
              >
                <FileUp size={18} className="text-(--gf-green)" />
                <span className="text-[10px] font-bold text-[#263246]">Add / Modify On-Site Inspection Photos</span>
                <span className="text-[9px] text-[#60738f]">Required to unlock the Complete Check button.</span>
                <input
                  id={`inspection-proof-${task.id}`}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="sr-only"
                  onChange={handleAddInspectionFiles}
                />
              </label>

              {inspectionPhotos.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {task.incidentId && task.serverInspectionPhotoIds?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {task.serverInspectionPhotoIds.map((photoId, idx) => (
                        <a
                          key={photoId}
                          href={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="relative block h-[110px] overflow-hidden rounded-lg border border-[#dfe7ea] bg-slate-100"
                        >
                          <img
                            src={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                            alt={`Tanod inspection proof ${idx + 1}`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[8px] font-bold text-white">
                            Tanod Inspection #{idx + 1}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                  {inspectionPhotos.map((fileName, idx) => (
                    <div
                      key={`${fileName}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-2.5 py-1.5"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold text-(--gf-green)">
                        <Camera size={12} />
                        <span className="truncate">Inspection Photo #{idx + 1}: {fileName}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveInspectionPhoto(idx)}
                        className="flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-[#60738f] hover:text-[#dc2626]"
                      >
                        <Trash2 size={10} />Remove
                      </button>
                    </div>
                  ))}
                  {onRejectProof && (
                    <div className="pt-1">
                      {rejectStage === "inspection" ? (
                        <div className="space-y-2 rounded-md border border-[#f3d3d3] bg-[#fdecea]/60 p-2.5">
                          <p className="text-[10px] font-bold text-[#991b1b]">Reject Tanod Inspection Photo</p>
                          <input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejecting inspection photo (sent to Tanod)..."
                            className="h-8 w-full rounded border border-[#f3d3d3] bg-white px-2.5 text-[11px] text-[#263246] outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setRejectStage(null); setRejectReason(""); }}
                              className="flex-1 rounded border border-[#dfe7ea] bg-white py-1.5 text-[10px] font-bold text-[#60738f]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={rejecting}
                              onClick={handleConfirmRejectProof}
                              className="flex-1 rounded bg-[#dc2626] py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                            >
                              {rejecting ? "Rejecting..." : "Confirm Reject Inspection"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setRejectStage("inspection"); setRejectReason(""); }}
                          className="w-full rounded-md border border-[#f3d3d3] bg-[#fdecea] py-1.5 text-[10px] font-bold text-[#dc2626] transition hover:bg-[#dc2626] hover:text-white"
                        >
                          Reject Inspection Photo (Request Retake from Tanod)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-[#dc2626]">
                  <TriangleAlert size={11} />Complete Check stays locked until arrival & inspection evidence is added.
                </p>
              )}
            </DrawerSection>
          )}

          <DrawerSection title="Lifecycle & Resolution" icon={CheckCircle2}>
            <StageRail status={task.status} />
            {verifying && (
              <div className="mt-3 grid gap-2">
                <p className="text-[9px] text-[#60738f]">
                  Upload or modify the <strong>finalizing / proof of repair photos</strong> below (kept separate from the earlier on-site inspection photos).
                </p>
                <label
                  htmlFor={`repair-proof-${task.id}`}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-5 text-center transition ${
                    repairPhotos.length ? "border-(--gf-green) bg-(--gf-green-soft)" : "border-[#d5dee3] bg-[#f8fafb] hover:border-(--gf-green)"
                  }`}
                >
                  <FileUp size={20} className="text-(--gf-green)" />
                  <span className="text-[10px] font-bold text-[#263246]">Upload / Edit Final Proof of Repair (Photos)</span>
                  <span className="text-[9px] text-[#60738f]">Separate from inspection photos. Verification stays locked until repair proof is attached.</span>
                  <input
                    id={`repair-proof-${task.id}`}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="sr-only"
                    onChange={handleAddRepairFiles}
                  />
                </label>

                {repairPhotos.length > 0 ? (
                  <div className="grid gap-2">
                    {task.incidentId && task.serverRepairPhotoIds?.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {task.serverRepairPhotoIds.map((photoId, idx) => (
                          <a
                            key={photoId}
                            href={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="relative block h-[110px] overflow-hidden rounded-lg border border-[#dfe7ea] bg-slate-100"
                          >
                            <img
                              src={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                              alt={`Tanod repair proof ${idx + 1}`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[8px] font-bold text-white">
                              Tanod Repair Proof #{idx + 1}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                    {task.repairNote && (
                      <p className="rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-2.5 py-1.5 text-[9px] text-[#263246]">
                        <strong>Tanod Repair Note:</strong> {task.repairNote}
                      </p>
                    )}
                    {repairPhotos.map((fileName, idx) => (
                      <div
                        key={`${fileName}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-2.5 py-1.5"
                      >
                        <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold text-(--gf-green)">
                          <CheckCircle2 size={12} />
                          <span className="truncate">Final Repair Photo #{idx + 1}: {fileName}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRepairPhoto(idx)}
                          className="flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-[#60738f] hover:text-[#dc2626]"
                        >
                          <Trash2 size={10} />Remove
                        </button>
                      </div>
                    ))}
                    {onRejectProof && (
                      <div className="pt-1">
                        {rejectStage === "repair" ? (
                          <div className="space-y-2 rounded-md border border-[#f3d3d3] bg-[#fdecea]/60 p-2.5">
                            <p className="text-[10px] font-bold text-[#991b1b]">Reject Tanod Proof of Repair</p>
                            <input
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for rejecting proof of repair (sent to Tanod)..."
                              className="h-8 w-full rounded border border-[#f3d3d3] bg-white px-2.5 text-[11px] text-[#263246] outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { setRejectStage(null); setRejectReason(""); }}
                                className="flex-1 rounded border border-[#dfe7ea] bg-white py-1.5 text-[10px] font-bold text-[#60738f]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={rejecting}
                                onClick={handleConfirmRejectProof}
                                className="flex-1 rounded bg-[#dc2626] py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                              >
                                {rejecting ? "Rejecting..." : "Confirm Reject Proof of Repair"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setRejectStage("repair"); setRejectReason(""); }}
                            className="w-full rounded-md border border-[#f3d3d3] bg-[#fdecea] py-1.5 text-[10px] font-bold text-[#dc2626] transition hover:bg-[#dc2626] hover:text-white"
                          >
                            Reject Proof of Repair (Request Retake from Tanod)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="flex items-center gap-1 text-[9px] font-semibold text-[#dc2626]">
                    <TriangleAlert size={11} />Approval is disabled until final proof of repair is uploaded.
                  </p>
                )}
                <Switch checked={publishIntent} onChange={setPublishIntent} label="Publish to Public Accomplishment Log?" />
              </div>
            )}
            {resolved && (
              <div className="mt-3 grid gap-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#e0e7eb] bg-[#f8fafb] p-2.5">
                    <p className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#60738f]">
                      <Camera size={11} className="text-(--gf-green)" />
                      Stage 1: On-Site Inspection Proof
                    </p>
                    {task.incidentId && task.serverInspectionPhotoIds?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {task.serverInspectionPhotoIds.map((photoId, idx) => (
                          <a
                            key={photoId}
                            href={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="relative block h-[96px] overflow-hidden rounded-md border border-[#dfe7ea] bg-slate-100"
                          >
                            <img
                              src={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                              alt={`Inspection proof ${idx + 1}`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[8px] font-bold text-white">
                              Inspection #{idx + 1}
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : inspectionPhotos.length > 0 ? (
                      <div className="space-y-1">
                        {inspectionPhotos.map((fileName, idx) => (
                          <div key={`${fileName}-${idx}`} className="flex items-center gap-1.5 rounded border border-(--gf-green-border) bg-(--gf-green-soft) px-2 py-1 text-[9px] font-bold text-(--gf-green)">
                            <Camera size={11} />
                            <span className="truncate">Inspection #{idx + 1}: {fileName}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-[#7c8ba3]">Inspection verified on file.</p>
                    )}
                    {task.inspectionNote && (
                      <p className="mt-1.5 text-[9px] text-[#263246]">
                        <strong>Note:</strong> {task.inspectionNote}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#e0e7eb] bg-[#f8fafb] p-2.5">
                    <p className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#60738f]">
                      <CheckCircle2 size={11} className="text-(--gf-green)" />
                      Stage 2: Final Repair Proof
                    </p>
                    {task.incidentId && task.serverRepairPhotoIds?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {task.serverRepairPhotoIds.map((photoId, idx) => (
                          <a
                            key={photoId}
                            href={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="relative block h-[96px] overflow-hidden rounded-md border border-[#dfe7ea] bg-slate-100"
                          >
                            <img
                              src={`/api/reports/${encodeURIComponent(task.incidentId)}/photos/${encodeURIComponent(photoId)}`}
                              alt={`Repair proof ${idx + 1}`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[8px] font-bold text-white">
                              Repair Proof #{idx + 1}
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : repairPhotos.length > 0 ? (
                      <div className="space-y-1">
                        {repairPhotos.map((fileName, idx) => (
                          <div key={`${fileName}-${idx}`} className="flex items-center gap-1.5 rounded border border-(--gf-green-border) bg-(--gf-green-soft) px-2 py-1 text-[9px] font-bold text-(--gf-green)">
                            <CheckCircle2 size={11} />
                            <span className="truncate">Repair Proof #{idx + 1}: {fileName}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-[#7c8ba3]">Repair proof verified on file.</p>
                    )}
                    {task.repairNote && (
                      <p className="mt-1.5 text-[9px] text-[#263246]">
                        <strong>Note:</strong> {task.repairNote}
                      </p>
                    )}
                  </div>
                </div>

                {task.closure && (
                  <div>
                    <InfoRow label="Closure mode">{task.closure.proof ? "Proof uploaded" : "Fallback — documented"}</InfoRow>
                    <InfoRow label="Final Repair Proof">{task.closure.proof ?? "—"}</InfoRow>
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
                )}
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
                placeholder="Add a work note — inspection findings, budget needed, materials, site delays…"
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
          {isActiveOrder && !canCompleteCheck && (
            <span className="mr-auto flex items-center gap-1 text-[9px] font-semibold text-[#dc2626]">
              <TriangleAlert size={10} />Locked: attach on-site arrival & inspection photo(s) to complete check.
            </span>
          )}
          {verifying && !canApproveRepair && (
            <span className="mr-auto flex items-center gap-1 text-[9px] font-semibold text-[#dc2626]">
              <TriangleAlert size={10} />Proof-gated: upload final repair photo(s) to unlock approval.
            </span>
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
          {isActiveOrder && canCompleteCheck && (
            <button
              type="button"
              onClick={() => onToggleForFunding(task.id)}
              className={`flex items-center gap-1 rounded-md border px-3 py-2 text-[10px] font-bold transition ${
                task.status === "For Funding"
                  ? "border-[#d97706] bg-[#fef3c7] text-[#b45309]"
                  : "border-[#f5d488] bg-[#fffbeb] text-[#b45309] hover:bg-[#fef3c7]"
              }`}
            >
              <Clock size={11} />
              {task.status === "For Funding" ? "For Funding (Active)" : "Set Status: For Funding"}
            </button>
          )}
          {isActiveOrder && (
            <button
              type="button"
              disabled={!canCompleteCheck}
              onClick={() => onCompleteCheck(task.id)}
              className="flex items-center gap-1 rounded-md bg-(--gf-green) px-3 py-2 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 size={11} />Complete Check
            </button>
          )}
          {verifying && (
            <button
              type="button"
              disabled={!canApproveRepair}
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
  const [draft, setDraft] = useState({ issue: "", category: CATEGORIES[0], zone: ZONES[1], team: TEAMS[0], priority: "Standard", deadline: "", notes: "" });

  const canCreate = Boolean(
    draft.issue.trim()
    && draft.category
    && draft.zone
    && draft.team
    && draft.priority
    && draft.deadline,
  );

  function create() {
    if (!canCreate) return;
    onCreate({
      issue: draft.issue.trim(),
      category: draft.category,
      location: draft.zone.split(" — ")[1],
      zone: draft.zone,
      team: draft.team,
      priority: draft.priority,
      deadline: new Date(`${draft.deadline}T12:00:00`).getTime(),
      notes: draft.notes.trim(),
    });
    setDraft({ issue: "", category: CATEGORIES[0], zone: ZONES[1], team: TEAMS[0], priority: "Standard", deadline: "", notes: "" });
  }

  return (
    <ModalShell title="Create Manual Work Order" subtitle="Internal maintenance task — does not originate from a resident report" onClose={onClose} width="max-w-[520px]"
      footer={<footer className="gf-modal-foot">
        <button type="button" onClick={onClose} className="gf-btn gf-btn--cancel">Cancel</button>
        <button type="button" disabled={!canCreate} onClick={create} className="gf-btn gf-btn--primary disabled:cursor-not-allowed disabled:opacity-40">Create & Assign</button>
      </footer>}>
      <div className="gf-modal-body">
        <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Issue title *
          <input value={draft.issue} onChange={(e) => setDraft((d) => ({ ...d, issue: e.target.value }))} placeholder="e.g. Scheduled street sweep — school frontage" className="rounded-md border border-[#d5dee3] px-2 py-2 text-[10px] outline-none focus:border-(--gf-green)" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Category *
            <select className="gf-select" style={{ color: "#42506a", height: 34 }} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Location zone *
            <select className="gf-select" style={{ color: "#42506a", height: 34 }} value={draft.zone} onChange={(e) => setDraft((d) => ({ ...d, zone: e.target.value }))}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Assign Tanod *
            <select className="gf-select" style={{ color: "#42506a", height: 34 }} value={draft.team} onChange={(e) => setDraft((d) => ({ ...d, team: e.target.value }))}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Priority *
            <select className="gf-select" style={{ color: "#42506a", height: 34 }} value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}>{URGENCY_OPTIONS.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Target deadline *
            <input type="date" value={draft.deadline} onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))} className="rounded-md border border-[#d5dee3] px-2 py-2 text-[10px] outline-none focus:border-(--gf-green)" />
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Initial notes (optional)
            <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Scope, crew size, special equipment…" className="rounded-md border border-[#d5dee3] px-2 py-2 text-[10px] outline-none focus:border-(--gf-green)" />
          </label>
        </div>
        <div className="gf-note gf-note--soft">
          <Wrench size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
          <span>Manual work orders enter Active Work Orders with locked Tanod & priority once created.</span>
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
  { key: "integrity", label: "False-Report Controls", icon: ShieldCheck },
];

export default function MaintenanceTasks() {
  const [tasks, setTasks] = useState([]);
  const [queue, setQueue] = useState([]);
  const [tanods, setTanods] = useState([]);
  const [reviewingIntakeItem, setReviewingIntakeItem] = useState(null);
  const [dismissedIntakeIds, setDismissedIntakeIds] = useState(() => new Set());
  const [tab, setTab] = useState("intake");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All Priorities");
  const [team, setTeam] = useState("All Teams");
  const [zone, setZone] = useState("All Zones");
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [audit, setAudit] = useState({ open: false, taskId: "All tasks" });
  const [falseReports, setFalseReports] = useState([]);
  const [falseReportsLoading, setFalseReportsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadFalseReports = async () => {
      try {
        const res = await fetch("/api/admin/maintenance/false-reports", { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.reports)) {
          setFalseReports(data.reports);
        }
      } catch {
        // Keep current list on transient error
      } finally {
        if (active) setFalseReportsLoading(false);
      }
    };
    void loadFalseReports();
    const timer = window.setInterval(loadFalseReports, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function handleFalseReportAccountAction(userId, action, reason) {
    try {
      const res = await fetch(`/api/admin/registrations/residents/${encodeURIComponent(userId)}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update reporter account.");
      setFalseReports((prev) =>
        prev.map((r) =>
          r.reporter?.user_id === userId
            ? { ...r, reporter: { ...r.reporter, account_status_id: data.account_status_id } }
            : r,
        ),
      );
      toast.add({
        type: action === "Restore" ? "success" : "warning",
        title: action === "Restore" ? "Reporter restored" : "Reporter suspended",
        description: reason,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Account action failed", description: err.message });
    }
  }
  const [auditLog, setAuditLog] = useState([]);
  const [nowTs] = useState(() => NOW());

  useEffect(() => {
    let active = true;
    const loadTanodUnits = async () => {
      try {
        const response = await fetch("/api/admin/dispatch/units", { credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!active || !Array.isArray(data.units)) return;
        const tanodUnits = data.units.filter((u) => u.resource_type === "TANOD");
        setTanods(tanodUnits);
      } catch {
        // Ignore network errors while loading tanod units
      }
    };
    void loadTanodUnits();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadMaintenanceIntake = async () => {
      try {
        const response = await fetch("/api/admin/maintenance/intake", { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error("Maintenance intake could not be loaded.");
        const data = await response.json();
        if (!active || !Array.isArray(data.reports)) return;
        const serverItems = data.reports.map((report) => {
          const accuracy = report.accuracy_meters == null ? null : Number(report.accuracy_meters);
          const location = String(report.location ?? "").trim()
            || (report.within_barangay_boundary === 0 ? "Pinned outside Barangay 167" : "Pinned location, Barangay 167");
          return {
            queueId: report.incident_id,
            incidentId: report.incident_id,
            serverBacked: true,
            reportId: report.report_id,
            issue: report.title || `${report.category || "Maintenance"} report`,
            reporter: {
              name: report.reporter_name || "Guest",
              type: report.reporter_type === "resident" ? "resident" : "guest",
            },
            location,
            zone: "",
            lat: report.latitude == null ? null : Number(report.latitude),
            lng: report.longitude == null ? null : Number(report.longitude),
            category: report.category || "Maintenance",
            categories: report.categories,
            geotag: {
              source: report.pin_manually_adjusted ? "Pin adjusted" : "GPS pin",
              accuracy: accuracy == null ? "Not available" : `±${Math.round(accuracy)} m`,
              landmark: location,
            },
            outsideBarangay: report.within_barangay_boundary === 0 || report.within_barangay_boundary === false,
            photos: Array.isArray(report.photos) ? report.photos : [],
            evidence: Array.isArray(report.photos) && report.photos.length > 0 ? ["photo"] : [],
            narration: String(report.description || "").trim() || "No description. See photo evidence.",
            submitted: fmtWhen(report.submitted_at),
          };
        }).filter((item) => !dismissedIntakeIds.has(item.incidentId));
        const serverReportIds = new Set(serverItems.map((item) => item.reportId));
        setQueue((current) => [
          ...serverItems,
          ...current.filter((item) => !item.serverBacked && !serverReportIds.has(item.reportId)),
        ]);
      } catch (error) {
        console.error("Unable to load maintenance reports:", error);
      }
    };
    void loadMaintenanceIntake();
    const timer = window.setInterval(loadMaintenanceIntake, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [dismissedIntakeIds]);

  useEffect(() => {
    let active = true;
    const loadServerMaintenanceTasks = async () => {
      try {
        const res = await fetch("/api/admin/maintenance/tasks", { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !Array.isArray(data.tasks)) return;

        setTasks((current) => {
          const byAssignmentId = new Map(current.filter((t) => t.assignmentId).map((t) => [t.assignmentId, t]));
          const byId = new Map(current.map((t) => [t.id, t]));
          const syncedIds = new Set();

          const serverMapped = data.tasks.map((st) => {
            const existing = byAssignmentId.get(st.assignment_id) || byId.get(st.id);
            if (existing) syncedIds.add(existing.id);
            const serverInspectionLabels = (st.inspection_photo_ids || []).map((pid) => `tanod-inspection-${String(pid).slice(0, 6)}.jpg`);
            const serverRepairLabels = (st.repair_photo_ids || []).map((pid) => `tanod-repair-${String(pid).slice(0, 6)}.jpg`);
            const mergedInspection = st.inspection_done
              ? (existing?.inspectionPhotos?.length
                ? Array.from(new Set([...serverInspectionLabels, ...existing.inspectionPhotos]))
                : serverInspectionLabels)
              : serverInspectionLabels;
            const mergedRepair = st.repair_done
              ? (existing?.repairPhotos?.length
                ? Array.from(new Set([...serverRepairLabels, ...existing.repairPhotos]))
                : serverRepairLabels)
              : serverRepairLabels;
            const submittedMs = Date.parse(st.submitted_at) || NOW();

            const notesList = existing?.workNotes ? [...existing.workNotes] : [];
            if (st.inspection_note && !notesList.some((n) => n.note === st.inspection_note)) {
              notesList.unshift({ at: fmtWhen(st.inspection_at || NOW()), by: st.team, note: st.inspection_note });
            }
            if (st.repair_note && !notesList.some((n) => n.note === st.repair_note)) {
              notesList.unshift({ at: fmtWhen(st.repair_at || NOW()), by: st.team, note: st.repair_note });
            }

            return {
              ...(existing || {}),
              id: existing?.id || st.id,
              assignmentId: st.assignment_id,
              incidentId: st.incident_id,
              issue: st.issue,
              source: "report",
              originReportId: st.originReportId,
              reporter: st.reporter,
              category: st.category,
              categories: st.categories,
              location: st.location,
              zone: existing?.zone || ZONES[0],
              lat: st.lat,
              lng: st.lng,
              geotag: existing?.geotag || { source: "GPS pin", accuracy: "±5 m", landmark: st.location },
              reporterPhotos: (st.reporter_photo_ids || []).length > 0
                ? st.reporter_photo_ids
                : (existing?.reporterPhotos || []),
              evidence: (st.reporter_photo_ids || []).length > 0 ? ["photo"] : (existing?.evidence || []),
              inspectionDone: Boolean(st.inspection_done),
              inspectionNote: st.inspection_note || "",
              serverInspectionPhotoIds: st.inspection_photo_ids || [],
              inspectionPhotos: mergedInspection,
              repairDone: Boolean(st.repair_done),
              repairNote: st.repair_note || "",
              serverRepairPhotoIds: st.repair_photo_ids || [],
              repairPhotos: mergedRepair,
              fastTrackPending: Boolean(st.fast_track_pending),
              narration: st.narration,
              team: st.team,
              priority: st.priority,
              dateSubmitted: existing?.dateSubmitted || submittedMs,
              deadline: st.deadline,
              status: existing?.status === "Verified Fixed" ? "Verified Fixed" : st.status,
              metrics: existing?.metrics || { submittedAt: submittedMs, assignedAt: submittedMs, startedAt: submittedMs },
              reassignments: existing?.reassignments || [],
              workNotes: notesList,
            };
          });

          const remaining = current.filter((t) => !t.assignmentId && !syncedIds.has(t.id));
          return [...serverMapped, ...remaining];
        });
      } catch {
        // Ignore transient poll errors
      }
    };
    void loadServerMaintenanceTasks();
    const timer = window.setInterval(loadServerMaintenanceTasks, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const logAudit = useCallback((entry) => {
    setAuditLog((log) => [{ key: `${log.length + 1}-${NOW()}-${entry.taskId}`, at: stamp(true), ...entry }, ...log]);
  }, []);

  function updateTask(id, changes) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...changes } : task)));
  }

  /* 1 — Review & Ingest from Intake Queue into Active Work Orders */
  function confirmIngest(queueId, { urgency, tanod, deadline }) {
    const item = queue.find((q) => q.queueId === queueId);
    if (!item) return;
    const id = nextTaskId(tasks);
    const time = NOW();
    const tanodName = tanod?.display_name || tanod?.responder_name || "Assigned Tanod";
    const initialAdminNote = `Dispatched to ${tanodName} (${urgency}) with on-site inspection deadline ${fmtDue(deadline)}.`;
    if (item.incidentId) {
      fetch("/api/admin/maintenance/ingest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_id: item.incidentId,
          unit_id: tanod?.id,
          tanod_name: tanodName,
          task_code: id,
          urgency,
          deadline,
          admin_notes: initialAdminNote,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.assignment_id) {
            updateTask(id, { assignmentId: data.assignment_id, incidentId: item.incidentId });
          }
        })
        .catch((err) => console.error("Failed to dispatch maintenance task to Tanod:", err));
    }
    const task = {
      id,
      incidentId: item.incidentId || null,
      issue: item.issue,
      source: "report",
      originReportId: item.reportId,
      reporter: item.reporter,
      category: item.category,
      location: item.location,
      zone: item.zone || ZONES[0],
      lat: item.lat,
      lng: item.lng,
      geotag: item.geotag,
      reporterPhotos: item.photos || [],
      evidence: item.evidence,
      inspectionPhotos: [],
      repairPhotos: [],
      narration: languageScan(item.narration).sanitized,
      team: tanodName,
      priority: urgency,
      dateSubmitted: time,
      deadline,
      status: "In Progress",
      metrics: { submittedAt: time, assignedAt: time, startedAt: time },
      reassignments: [],
      workNotes: [
        { at: fmtWhen(time), by: "Admin — N. Villanueva", note: `Dispatched to ${tanodName} (${urgency}) with on-site inspection deadline ${fmtDue(deadline)}.` },
      ],
    };
    setTasks((current) => [task, ...current]);
    setQueue((current) => current.filter((q) => q.queueId !== queueId));
    if (item.serverBacked) setDismissedIntakeIds((current) => new Set(current).add(item.incidentId));
    setReviewingIntakeItem(null);
    setTab("active");
    logAudit({
      taskId: id,
      actor: "Admin — N. Villanueva",
      system: false,
      action: "Reviewed & ingested to work order",
      detail: `${item.reportId} assigned to ${tanodName} (${urgency}) with inspection deadline ${fmtDue(deadline)}.`,
    });
    toast.add({
      type: "success",
      title: `Work order ${id} created`,
      description: `Assigned to ${tanodName} (${urgency}) — now in Active Work Orders.`,
    });
  }

  /* 1b — Flag / Reject an incoming maintenance report from Intake Queue */
  async function flagIntakeReport(item, reason) {
    if (!item) return;
    try {
      if (item.incidentId) {
        const res = await fetch(`/api/admin/maintenance/intake/${encodeURIComponent(item.incidentId)}/reject`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not flag maintenance report.");
      }
      setQueue((current) => current.filter((q) => q.queueId !== item.queueId));
      if (item.serverBacked && item.incidentId) {
        setDismissedIntakeIds((current) => new Set(current).add(item.incidentId));
      }
      setReviewingIntakeItem(null);
      fetch("/api/admin/maintenance/false-reports", { credentials: "include", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (Array.isArray(data?.reports)) setFalseReports(data.reports);
        })
        .catch(() => {});
      logAudit({
        taskId: item.reportId,
        actor: "Admin — N. Villanueva",
        system: false,
        action: "Maintenance intake report flagged",
        detail: reason || "Flagged by Admin during intake review.",
      });
      toast.add({
        type: "warning",
        title: "Report Flagged",
        description: `${item.reportId} was flagged and moved to False-Report Controls.`,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Flag failed", description: err.message });
    }
  }

  /* 3b — Reject Tanod's Inspection Photo or Proof of Repair and request retake */
  async function rejectTaskProof(id, stage, reason) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    try {
      if (task.assignmentId) {
        const res = await fetch(`/api/admin/maintenance/tasks/${encodeURIComponent(task.assignmentId)}/reject-proof`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage, reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not reject Tanod proof.");
      }
      if (stage === "inspection") {
        updateTask(id, {
          status: "In Progress",
          forFunding: false,
          inspectionDone: false,
          inspectionNote: "",
          inspectionPhotos: [],
          serverInspectionPhotoIds: [],
        });
      } else {
        updateTask(id, {
          repairDone: false,
          repairNote: "",
          repairPhotos: [],
          serverRepairPhotoIds: [],
        });
      }
      logAudit({
        taskId: id,
        actor: "Admin — N. Villanueva",
        system: false,
        action: stage === "inspection" ? "Inspection photo rejected" : "Proof of repair rejected",
        detail: reason || "Tanod notified to retake and resubmit photo proof.",
      });
      toast.add({
        type: "warning",
        title: stage === "inspection" ? "Inspection photo rejected" : "Proof of repair rejected",
        description: `${task.team} has been notified to retake and resubmit.`,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Reject failed", description: err.message });
    }
  }

  /* 2 — Manual work-order creation. */
  function createWorkOrder(draft) {
    const id = nextTaskId(tasks);
    const time = NOW();
    const task = {
      id, issue: draft.issue, source: "manual", originReportId: null, reporter: null,
      category: draft.category, location: draft.location, zone: draft.zone,
      lat: 14.7285, lng: 121.0168 + Math.random() * 0.002,
      geotag: { source: "Internal survey", accuracy: "±5 m", landmark: `${draft.location} — admin-placed pin` },
      evidence: [],
      inspectionPhotos: [],
      repairPhotos: [],
      narration: draft.notes || "Internal preventive/scheduled work order.",
      team: draft.team, priority: draft.priority, dateSubmitted: time,
      deadline: draft.deadline, status: "In Progress",
      metrics: { submittedAt: time, assignedAt: time, startedAt: time },
      reassignments: [],
      workNotes: draft.notes ? [{ at: stamp(true), by: "Admin — N. Villanueva", note: draft.notes }] : [],
    };
    setTasks((current) => [task, ...current]);
    setCreateOpen(false);
    logAudit({ taskId: id, actor: "Admin — N. Villanueva", action: "Manual work order created", detail: `${draft.issue} — ${draft.team}, ${draft.priority} priority, deadline ${fmtDue(draft.deadline)}.` });
    toast.add({ type: "success", title: "Work order created", description: `${id} filed under Active Work Orders for ${draft.team}.` });
  }

  /* 3a — Optional: Mark Maintenance Task as "For Funding" after Inspection Photo */
  function toggleForFunding(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !task.inspectionPhotos?.length) return;
    const nextForFunding = task.status !== "For Funding";
    if (task.assignmentId) {
      fetch(`/api/admin/maintenance/tasks/${encodeURIComponent(task.assignmentId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ for_funding: nextForFunding }),
      }).catch((err) => console.error("Failed to update For Funding status:", err));
    }
    updateTask(id, { status: nextForFunding ? "For Funding" : "In Progress", forFunding: nextForFunding });
    logAudit({
      taskId: id,
      actor: "Admin — N. Villanueva",
      action: nextForFunding ? "Marked as For Funding" : "Returned to In Progress",
      detail: nextForFunding
        ? "Admin reviewed the inspection photo and set status to For Funding (synced to Resident and Tanod)."
        : "Admin cleared For Funding status and resumed In Progress.",
    });
    toast.add({
      type: "success",
      title: nextForFunding ? `${id} marked For Funding` : `${id} returned to In Progress`,
      description: nextForFunding
        ? "Status synced with the reporting Resident and assigned Tanod."
        : "Maintenance task resumed as In Progress.",
    });
  }

  /* 3 — Complete Check (Active Work Orders -> Awaiting Verification) */
  function completeCheck(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !task.inspectionPhotos?.length) return;
    if (task.assignmentId) {
      fetch(`/api/admin/maintenance/tasks/${encodeURIComponent(task.assignmentId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_check_approved: true }),
      }).catch((err) => console.error("Failed to persist complete check:", err));
    }
    updateTask(id, { status: "Awaiting Verification", fastTrackPending: false });
    setSelectedId(null);
    setTab("verify");
    logAudit({
      taskId: id,
      actor: "Admin — N. Villanueva",
      action: "On-site check completed",
      detail: `Tanod arrival & inspection evidence (${task.inspectionPhotos.join(", ")}) verified. Moved to Awaiting Verification.`,
    });
    toast.add({
      type: "info",
      title: `${id} check complete`,
      description: "Moved to Awaiting Verification for final repair proof & closure.",
    });
  }

  function updateInspectionPhotos(id, photos) {
    updateTask(id, { inspectionPhotos: photos });
    logAudit({
      taskId: id,
      actor: "Admin — N. Villanueva",
      action: "Inspection photos updated",
      detail: `On-site inspection evidence set to: ${photos.length ? photos.join(", ") : "none"}.`,
    });
  }

  function updateRepairPhotos(id, photos) {
    updateTask(id, { repairPhotos: photos });
    logAudit({
      taskId: id,
      actor: "Admin — N. Villanueva",
      action: "Final repair photos updated",
      detail: `Finalizing repair proof set to: ${photos.length ? photos.join(", ") : "none"}.`,
    });
  }

  /* 4 — Proof-gated closure (Awaiting Verification -> Resolved & Logged) */
  function closeTask(id, closure, publishIntent = false) {
    const task = tasks.find((t) => t.id === id);
    if (task?.assignmentId) {
      fetch(`/api/admin/maintenance/tasks/${encodeURIComponent(task.assignmentId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified_fixed: true }),
      }).catch((err) => console.error("Failed to persist verified fixed:", err));
    }
    const at = stamp(true);
    const updates = {
      status: "Verified Fixed",
      closure,
      metrics: { ...task.metrics, verifiedAt: NOW() },
      notified: true,
    };
    if (publishIntent) updates.published = { at, summary: privacySummary(task) };
    updateTask(id, updates);
    setSelectedId(null);
    setTab("resolved");
    logAudit({ taskId: id, actor: closure.closedBy, action: "Resolution verified with proof", detail: `Final repair proof (${closure.proof}) uploaded — outcome: ${closure.outcome}` });
    logAudit({ taskId: id, actor: "System — Notifications", system: true, action: "Reporter notified", detail: `Read-only status update pushed${task.reporter?.type === "guest" ? ` to guest link ${task.reporter.token}` : ` to ${task.reporter?.name}`}.` });
    if (publishIntent) logAudit({ taskId: id, actor: "Admin — N. Villanueva", action: "Accomplishment summary published", detail: "Privacy-safe summary pushed to the public accomplishment log — reporter identifiers and exact addresses stripped." });
    toast.add({ type: "success", title: `${id} verified fixed`, description: publishIntent ? "Final repair proof recorded; privacy-safe summary published to Resolved & Logged." : "Final repair proof recorded; moved to Resolved & Logged." });
  }

  function addNote(id, note) {
    const task = tasks.find((t) => t.id === id);
    if (task?.assignmentId) {
      fetch(`/api/admin/maintenance/tasks/${encodeURIComponent(task.assignmentId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: note }),
      }).catch((err) => console.error("Failed to sync admin note to Tanod:", err));
    }
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
    integrity: falseReports.length,
  };

  const actionLabel = tab === "verify" ? "Review" : "Manage";

  return (
    <div className="space-y-4">
      {/* 1 — KPI summary banner */}
      <section aria-label="Maintenance KPI summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Pending Intake" value={stats.intake} icon={FileText} hint="auto-routed reports awaiting work orders" onClick={() => setTab("intake")} />
        <StatCard label="Active Tasks" value={stats.active} icon={Wrench} hint="ongoing repairs in the field" onClick={() => setTab("active")} />
        <StatCard label="Awaiting Verification" value={stats.verifying} icon={ShieldCheck} hint="crew done — needs admin proof-review" onClick={() => setTab("verify")} />
        <StatCard label="Overdue Tasks" value={stats.overdue} icon={Clock} hint="past deadline — escalate now" alert onClick={() => setTab("active")} />
        <StatCard label="False-Report Controls" value={falseReports.length} icon={ShieldCheck} hint="review rejected &amp; flagged reports" onClick={() => setTab("integrity")} />
      </section>

      {/* 2 — Tabbed workspaces */}
      <section className="rounded-xl border border-[#e2e8eb] bg-white shadow-sm">
        <div role="tablist" aria-label="Maintenance workspaces" className="flex flex-wrap gap-1 border-b border-[#e2e8eb] px-4">
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
                className={`-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-4 py-3.5 text-[13px] font-bold transition hover:-translate-y-px hover:bg-(--gf-green-soft) ${active ? "border-(--gf-green) bg-(--gf-green-soft) text-(--gf-green)" : "border-transparent text-[#60738f] hover:text-(--gf-green)"}`}
              >
                <Icon size={15} />
                {label}
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold leading-none ${alerting ? "bg-[#fff1c6] text-[#e69500]" : "bg-[#eef2f4] text-[#60738f]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5">
          {tab === "integrity" ? (
            <FalseReportsPanel
              reports={falseReports}
              loading={falseReportsLoading}
              onUpdateAccount={handleFalseReportAccountAction}
            />
          ) : tab === "intake" ? (
            queue.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {queue.map((item) => (
                  <IntakeCard
                    key={item.queueId}
                    item={item}
                    onReview={(target) => setReviewingIntakeItem(target)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ShieldCheck size={28} className="text-(--gf-green)" />
                <p className="text-[11px] font-bold text-[#263246]">Intake queue is clear</p>
                <p className="text-[10px] text-[#60738f]">No non-emergency reports are awaiting review right now.</p>
              </div>
            )
          ) : (
            <>
              {/* Top bar: search + filters + record actions */}
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#e2e8eb] bg-(--gf-surface) p-3">
                <label className="gf-search">
                  <Search size={14} />
                  <input
                    aria-label="Search tasks"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search tasks, teams, zones, origin reports..."
                    className="w-full text-[12px] outline-none placeholder:text-[#7c8ba3]"
                  />
                </label>
                <SelectFilter value={priority} options={["All Priorities", ...PRIORITIES]} onChange={setPriority} ariaLabel="Filter priority" />
                <SelectFilter value={team} options={["All Teams", ...TEAMS]} onChange={setTeam} ariaLabel="Filter team" />
                <SelectFilter value={zone} options={["All Zones", ...ZONES]} onChange={setZone} ariaLabel="Filter zone" />
                <button type="button" onClick={resetFilters} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-[#60738f] transition hover:bg-(--gf-green-soft) hover:text-(--gf-green)"><RotateCcw size={13} /> Reset</button>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setAudit({ open: true, taskId: "All tasks" })} className="gf-btn gf-btn--chip"><History size={11} />Audit Trail</button>
                  <button type="button" onClick={() => toast.add({ title: "Export ready", description: "CSV of the filtered maintenance records is prepared.", type: "success" })} className="gf-btn gf-btn--chip"><Download size={11} /> Export CSV</button>
                  <button type="button" onClick={() => toast.add({ title: "Export ready", description: "PDF export of the filtered maintenance records is prepared for archiving.", type: "success" })} className="gf-btn gf-btn--chip"><Download size={11} /> Export PDF</button>
                  <button type="button" onClick={() => setCreateOpen(true)} className="gf-btn gf-btn--primary"><Plus size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 3 }} />Create Work Order</button>
                </div>
              </div>

              <p className="mb-3 text-[11px] font-semibold text-[#7184a0]">
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
                    ? "Nothing to verify — no pending repair verifications."
                    : "No resolved tasks logged yet."}
              />
            </>
          )}
        </div>
      </section>

      {reviewingIntakeItem && (
        <IntakeReviewDrawer
          key={reviewingIntakeItem.queueId}
          item={reviewingIntakeItem}
          tanods={tanods}
          onClose={() => setReviewingIntakeItem(null)}
          onConfirmIngest={confirmIngest}
          onFlagIntake={flagIntakeReport}
          logAudit={logAudit}
        />
      )}

      {selectedTask && (
        <TaskDrawer
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedId(null)}
          onCompleteCheck={completeCheck}
          onToggleForFunding={toggleForFunding}
          onCloseTask={closeTask}
          onRejectProof={rejectTaskProof}
          onUpdateInspectionPhotos={updateInspectionPhotos}
          onUpdateRepairPhotos={updateRepairPhotos}
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
