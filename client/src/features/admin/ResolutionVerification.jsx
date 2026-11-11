import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, Download, EyeOff, FileCheck, FileImage, FileVideo,
  History, Lock, Printer, QrCode, Scale, ScanLine, Search, ShieldCheck, UserCheck, X, XCircle,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import { stamp } from "../../shared/components/GovernanceUi";

const NOW = () => Date.now();

const OPERATORS = {
  emergency: "BDRRMO — Lt. C. Ramos",
  nonEmergency: "Admin — N. Villanueva",
};

const LADDER = [
  "Formal warning on record",
  "24-hour report restriction",
  "7-day report restriction",
  "Full admin review / account suspension",
];

const PROHIBITED_BASES = [
  { label: "Missed callback only", note: "Sec. 4.2 — a failed callback is never, by itself, evidence of abuse." },
  { label: "Language flag only", note: "Sec. 4.3 — the intake sanitizer is a screening aid, not a judge of intent." },
  { label: "Reporter absent from scene", note: "Sec. 4.4 — absence may be legitimate; never grounds for a strike alone." },
];

const VALID_BASES = [
  "Forged or fabricated evidence",
  "Malicious intent / harassment",
  "Duplicate subject, maliciously filed",
  "Deliberate false location",
];

const EVIDENCE_ITEMS = ["Subject statements reviewed", "Report records cross-checked", "Witness entries verified"];

/* ------------------------------------------------------------------ */
/* Mock data                                                           */
/* ------------------------------------------------------------------ */

const seedSubmissions = [
  {
    id: "RV-167-01", reportId: "GF-002", title: "Broken Streetlight Pole", category: "Electrical", kind: "nonEmergency",
    team: "Engineering Crew B", reporter: "Lito Mercado (resident)",
    originalReport: "Resident reported Pole 14 going dark after the storm — lamp flickering, mounting visibly loose, wiring sagging toward the sidewalk.",
    summary: "Pole re-anchored, wiring inspected at night, lamp restored.",
    outcome: "Streetlight operational; footing confirmed stable under load.",
    completedAt: "Apr 19, 8:42 PM",
    proof: [{ kind: "photo", file: "streetlight-on.jpg" }], fallback: null,
    obligations: [
      { label: "Barangay support tasks closed", resolved: true },
      { label: "Final scope re-checked on site", resolved: true },
    ],
    handovers: [], status: "Awaiting Review", closure: null,
  },
  {
    id: "RV-167-02", reportId: "GF-005", title: "Cracked Sidewalk Path", category: "Road Damage", kind: "nonEmergency",
    team: "Barangay Public Works", reporter: "Marites Dulan (resident)",
    originalReport: "Sidewalk slab cracked and uneven in front of the reporter's street; pedestrians tripping during the school run.",
    summary: "Cement patch cured 48 hours; pedestrians rerouted during cure.",
    outcome: "Sidewalk passable and even; curing proof attached.",
    completedAt: "Apr 20, 5:10 PM",
    proof: [{ kind: "photo", file: "sidewalk-repaired.jpg" }], fallback: null,
    obligations: [
      { label: "Barangay support tasks closed", resolved: true },
      { label: "Road-clearance sign removed", resolved: false },
    ],
    handovers: [], status: "Awaiting Review", closure: null,
  },
  {
    id: "RV-167-03", reportId: "GF-003", title: "Clogged Drainage Canal", category: "Sanitation", kind: "nonEmergency",
    team: "Barangay Sanitizers", reporter: null,
    originalReport: "Internal preventive work order — canal segment near the market backing up ahead of the monsoon window.",
    summary: "Canal cleared and flushed; debris hauled in two trips.",
    outcome: "Flow restored end to end; no residual overflow after rain.",
    completedAt: "Apr 21, 9:20 AM",
    proof: [],
    fallback: { reason: "Device storage full", note: "Second crew phone died mid-shift. Before-and-after stills verified by crew lead — no-proof closure requested per justified reason." },
    obligations: [{ label: "Sanitation follow-through (Zone 3) pending — barangay support task", resolved: false }],
    handovers: [], status: "Awaiting Review", closure: null,
  },
  {
    id: "RV-167-04", reportId: "GF-004", title: "Exposed Power Lines", category: "Electrical", kind: "emergency",
    team: "Meralco Dispatch", reporter: "Guest link GF-004",
    originalReport: "Emergency line — sagging exposed conductors over a walkway after a tree limb fell; public pass-by risk flagged critical.",
    summary: "Lines secured and de-energized span barricaded within 40 minutes.",
    outcome: "Scene safe; Meralco retained ownership of the repair schedule.",
    completedAt: "Apr 17, 10:15 PM",
    proof: [{ kind: "photo", file: "lines-secured.jpg" }], fallback: null,
    obligations: [{ label: "Barricade retrieval (BDRRMO asset)", resolved: true }],
    handovers: [
      { code: "QH-101", agency: "Meralco Personnel", incident: "RV-167-04", issued: "Apr 17, 9:40 PM", status: "Accepted", ack: { by: "Engr. R. Trinidad", role: "Meralco Field Supervisor", at: "Apr 17, 10:05 PM", path: "Digital sign-in" }, failureReason: null },
    ],
    status: "Sent Back", closure: null,
  },
  {
    id: "RV-167-05", reportId: "GF-001", title: "Vehicular Accident on Rizal Street", category: "Incident / Emergency", kind: "emergency",
    team: "BDRRMO Response", reporter: "Danilo Reyes (resident)",
    originalReport: "Two-vehicle collision on the Rizal corridor with trapped occupants; patients conscious, traffic building behind the scene.",
    summary: "Scene secured with traffic rerouting; patients moved within 9 minutes.",
    outcome: "Two injured walked to triage van; police took the accident record.",
    completedAt: "Apr 18, 8:58 PM",
    proof: [{ kind: "video", file: "scene-response.mp4 • 1:12" }], fallback: null,
    obligations: [
      { label: "Traffic management lifted", resolved: true },
      { label: "Barangay support tasks closed", resolved: true },
    ],
    handovers: [
      { code: "QH-099", agency: "Police Precinct 4", incident: "RV-167-05", issued: "Apr 18, 8:35 PM", status: "Accepted", ack: { by: "PSInsp. A. Dimaculangan", role: "Police Desk 3", at: "Apr 18, 8:52 PM", path: "Authenticated digital sign-in" }, failureReason: null },
      { code: "QH-100", agency: "General Hospital", incident: "RV-167-05", issued: "Apr 18, 8:38 PM", status: "Accepted", ack: { by: "Dr. Meyer Corteza", role: "Triage Nurse", at: "Apr 18, 8:56 PM", path: "No-login field acknowledgment" }, failureReason: null },
    ],
    status: "Closed",
    closure: { outcome: "Completed — Handed Over", closedBy: "BDRRMO — Lt. C. Ramos", closedAt: "Apr 18, 9:15 PM", remarks: "Turnover records verified for both recipients; no barangay obligations remained." },
  },
  {
    id: "RV-167-06", reportId: "GF-006", title: "Pedestrian Bleeding at Market Frontage", category: "Incident / Emergency", kind: "emergency",
    team: "Tanod — R. Delacruz", reporter: "Guest link GF-006",
    originalReport: "Walk-in patient bleeding at the market frontage after a fall; companion on site requesting immediate assistance.",
    summary: "Patient reached the report's exact GPS pin; bleeding stemmed; companion briefed.",
    outcome: "Responder handed the patient over at the hospital ER entrance per QR.",
    completedAt: "Apr 22, 7:05 PM",
    proof: [{ kind: "video", file: "handover-clip.mp4 • 0:31" }], fallback: null,
    obligations: [
      { label: "Companion crosswalk escrow returned", resolved: true },
      { label: "Bike-assist token archived", resolved: true },
    ],
    handovers: [
      { code: "QH-104", agency: "General Hospital", incident: "RV-167-06", issued: "Apr 22, 6:40 PM", status: "Failed", ack: null, failureReason: "Hospital phone offline — scan not completed before the code window closed." },
      { code: "QH-106", agency: "Authorized Companion", incident: "RV-167-06", issued: "Apr 22, 6:52 PM", status: "Accepted", ack: { by: "C. Domingo", role: "Authorized companion", at: "Apr 22, 7:22 PM", path: "Approved manual receipt" }, failureReason: null },
      { code: "QH-107", agency: "Police Precinct 4", incident: "RV-167-06", issued: "Apr 22, 7:10 PM", status: "Pending", ack: null, failureReason: null },
    ],
    status: "Handover Pending", closure: null,
  },
];

const seedIntegrity = [
  {
    id: "INT-167-09", reporter: "Marites Dulan (resident)", residentId: "RSD-0231", reportId: "GF-005",
    recent: "Fence vandalism claim reused a guest photo from GF-008 (week 2).",
    flags: ["Language flag raised by intake sanitizer", "Two missed callbacks logged"],
    strikes: 1, restrictions: [{ tier: "Formal warning on record", at: "Apr 14, 2:10 PM", by: "Admin — N. Villanueva" }],
    basis: null, reason: "", evidence: [], status: "Open",
  },
  {
    id: "INT-167-10", reporter: "Guest link GF-008", residentId: "Guest link", reportId: "GF-008",
    recent: "Third blocked-pin submission from the same device fingerprint.",
    flags: ["Reporter absent from scene (verified twice)"],
    strikes: 0, restrictions: [],
    basis: null, reason: "", evidence: [], status: "Open",
  },
  {
    id: "INT-167-12", reporter: "R. Gonzales (resident)", residentId: "RSD-0187", reportId: "GF-011",
    recent: "Duplicate flood claim filed minutes apart with an altered location pin.",
    flags: ["Duplicate subject, maliciously filed (confirmed)"],
    strikes: 2, restrictions: [
      { tier: "Formal warning on record", at: "Mar 30, 1:44 PM", by: "Admin — N. Villanueva" },
      { tier: "24-hour report restriction", at: "Apr 12, 4:20 PM", by: "Admin — N. Villanueva" },
    ],
    basis: "Duplicate subject, maliciously filed", reason: "", evidence: [], status: "Open",
  },
];

const seedAudit = [
  { key: "a1", at: "Apr 18, 9:15 PM", taskId: "RV-167-05", actor: "BDRRMO — Lt. C. Ramos", action: "Closure authorized", detail: "Completed — Handed Over. Turnover records QH-099/QH-100 verified; obligations cleared." },
  { key: "a2", at: "Apr 18, 9:18 PM", taskId: "RV-167-05", actor: "System", system: true, action: "Published to public accomplishment log", detail: "Privacy-safe summary emitted — personal identifiers and exact addresses stripped." },
  { key: "a3", at: "Apr 22, 7:22 PM", taskId: "RV-167-06", actor: "Admin — N. Villanueva", action: "Manual receipt reconciled", detail: "QH-106 — approved manual receipt from C. Domingo; flagged for later audit reconciliation." },
  { key: "a4", at: "Apr 14, 2:10 PM", taskId: "INT-167-09", actor: "Admin — N. Villanueva", action: "Formal warning issued", detail: "Progressive control 1/4 applied to Marites Dulan (resident) after forged-photo finding." },
];

function logAuditTask(id, actor, action, detail) {
  return { key: `${stamp(true)}-${id}-${Math.floor(NOW() / 1000)}`, at: stamp(true), taskId: id, actor, action, detail };
}

/* ------------------------------------------------------------------ */
/* Shared styled primitives (standard Tailwind recipes)                */
/* ------------------------------------------------------------------ */

const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const btnReject = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-50";
const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${className}`}>
      {children}
    </span>
  );
}

const QR_CHIP = {
  Pending: "bg-amber-100 text-amber-700",
  Accepted: "bg-emerald-50 text-emerald-700",
  Failed: "bg-rose-50 text-rose-600",
};

function KpiCard({ label, value, icon: Icon, tone = "emerald", hint }) {
  const tones = {
    emerald: { chip: "bg-emerald-50 text-emerald-600", ring: "border-slate-200", num: "text-slate-800" },
    amber: { chip: "bg-amber-50 text-amber-600", ring: "border-amber-200", num: "text-amber-700" },
    rose: { chip: "bg-rose-50 text-rose-600", ring: "border-rose-200", num: "text-rose-700" },
    slate: { chip: "bg-slate-100 text-slate-600", ring: "border-slate-200", num: "text-slate-800" },
  };
  const t = tones[tone] ?? tones.emerald;
  return (
    <div className={`flex items-center gap-3 rounded-xl border ${t.ring} bg-white p-4 shadow-sm transition hover:shadow-md`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`block text-xl font-extrabold leading-tight ${t.num}`}>{value}</span>
        {hint && <span className="block text-[10px] font-medium text-slate-400">{hint}</span>}
      </span>
    </div>
  );
}

function EvidencePreview({ item }) {
  const Icon = item.kind === "video" ? FileVideo : FileImage;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Icon size={13} className="text-emerald-600" />{item.file}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">{item.kind === "video" ? "Video proof — playable inline for reviewers" : "Photo proof — captured on site by the responding team"}</p>
        <Chip className="mt-1 bg-emerald-50 text-emerald-700"><ShieldCheck size={9} />verified upload • stored with 5-year retention</Chip>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slide-over drawer (shared shell, role-based content)                */
/* ------------------------------------------------------------------ */

function DrawerShell({ title, subtitle, badges, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

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
        aria-label={title}
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl [animation:gf-drawer-in_0.22s_ease-out] sm:w-[45%] sm:min-w-[520px] sm:max-w-[760px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-emerald-700">{title}</h2>
              {badges}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 transition hover:bg-white hover:text-emerald-700">
            <X size={16} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</footer>}
      </aside>
    </>
  );
}

function DrawerSection({ title, icon: Icon, tone = "slate", children }) {
  const toneCls = tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-500";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${toneCls}`}>
        {Icon && <Icon size={11} />}{title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Review drawer — evidence review + role-based closure                */
/* ------------------------------------------------------------------ */

function ReviewDrawer({ submission, onClose, onToggleObligation, onAuthorize, onReject, onOpenIntegrity }) {
  const [remark, setRemark] = useState("");
  const [publish, setPublish] = useState(true);
  const closed = submission.status === "Closed";
  const isEmergency = submission.kind === "emergency";
  const obligationsDone = submission.obligations.every((o) => o.resolved);
  const verifiedAcks = submission.handovers.some((h) => h.status === "Accepted");

  function authorize(mode) {
    if (!obligationsDone) return;
    const outcome = mode === "handed" ? "Completed — Handed Over" : "Completed — Locally";
    onAuthorize(submission.id, outcome, publish);
  }

  const statusBadge = closed
    ? <Chip className="bg-emerald-50 text-emerald-700"><CheckCircle2 size={10} />Closed</Chip>
    : submission.status === "Sent Back"
      ? <Chip className="bg-rose-50 text-rose-600">Sent back</Chip>
      : <Chip className="bg-amber-100 text-amber-700">{submission.status}</Chip>;

  return (
    <DrawerShell
      title={`Review — ${submission.id}`}
      subtitle={closed ? "Closure archive — read-only certified record" : "Verify completion details before authorizing closure"}
      badges={statusBadge}
      onClose={onClose}
      footer={
        closed ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>Close</button>
          </div>
        ) : (
          <div className="grid gap-2">
            <textarea
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Rejection remark — describe exactly what proof is missing or inadequate (min 10 chars)…"
              className={`${inputCls} resize-none`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => onOpenIntegrity(submission)} className={btnSecondary}>
                <Scale size={12} />Flag as false report
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={remark.trim().length < 10}
                  onClick={() => { onReject(submission.id, remark.trim()); onClose(); }}
                  className={btnReject}
                  title="Send back to the team with your remark"
                >
                  <XCircle size={12} />Reject — Request Better Proof
                </button>
                {isEmergency && (
                  <button
                    type="button"
                    disabled={!obligationsDone || !verifiedAcks}
                    onClick={() => authorize("handed")}
                    className={btnPrimary}
                    title={verifiedAcks ? "Authorize closure — handed over" : "Locked — no verified handover acknowledgment on record"}
                  >
                    <CheckCircle2 size={12} />Authorize Closure — Handed Over
                  </button>
                )}
                <button
                  type="button"
                  disabled={!obligationsDone}
                  onClick={() => authorize("local")}
                  className={btnPrimary}
                  title={obligationsDone ? "Authorize closure — resolved locally" : "Locked — barangay obligations pending"}
                >
                  <CheckCircle2 size={12} />Authorize Closure — Local
                </button>
              </div>
            </div>
            {!obligationsDone && (
              <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                <AlertTriangle size={11} />Closure stays locked until every barangay obligation is resolved.
              </p>
            )}
          </div>
        )
      }
    >
      {/* Original report summary */}
      <DrawerSection title="Original Report Summary" icon={FileCheck}>
        <div className="grid gap-1.5 text-[11px] text-slate-700">
          <p><span className="font-semibold text-slate-500">Original ticket:</span> {submission.reportId}</p>
          <p><span className="font-semibold text-slate-500">Reporter:</span> {submission.reporter || "Internal work order — no resident reporter"}</p>
          <p className="rounded-lg bg-slate-50 p-2.5 leading-relaxed text-slate-600">{submission.originalReport}</p>
        </div>
      </DrawerSection>

      {/* Responder completion notes & evidence */}
      <DrawerSection title="Responder's Completion Notes & Evidence" icon={ShieldCheck} tone="emerald">
        <div className="grid gap-1.5 text-[11px] text-slate-700">
          <p><span className="font-semibold text-slate-500">Assigned team:</span> {submission.team}</p>
          <p><span className="font-semibold text-slate-500">Action summary:</span> {submission.summary}</p>
          <p><span className="font-semibold text-slate-500">Outcome:</span> {submission.outcome}</p>
          <p><span className="font-semibold text-slate-500">Completion timestamp:</span> {submission.completedAt}</p>
        </div>
        <div className="mt-3 grid gap-2">
          {submission.proof.length
            ? submission.proof.map((item) => <EvidencePreview key={item.file} item={item} />)
            : (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2.5 text-[11px] font-medium text-amber-700">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                No proof attached — documented fallback: <span className="font-semibold">{submission.fallback?.reason}</span>. {submission.fallback?.note}
              </p>
            )}
        </div>
        {closed && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
            <strong>Closure record:</strong> {submission.closure.outcome} — {submission.closure.closedBy} at {submission.closure.closedAt}. Remarks: {submission.closure.remarks}
          </p>
        )}
      </DrawerSection>

      {/* Barangay obligations checklist */}
      {!closed && (
        <DrawerSection title="Barangay Obligations Checklist" icon={ScanLine} tone="emerald">
          <p className="mb-2 text-[11px] text-slate-500">Completion does not auto-close — every barangay obligation must clear before authorization unlocks.</p>
          <div className="grid gap-1.5">
            {submission.obligations.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => onToggleObligation(submission.id, o.label)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[11px] font-semibold transition ${o.resolved ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}`}
              >
                <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${o.resolved ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                  {o.resolved && <CheckCircle2 size={11} />}
                </span>
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-semibold text-slate-500">
            {submission.obligations.filter((o) => o.resolved).length}/{submission.obligations.length} obligations resolved
          </p>
        </DrawerSection>
      )}

      {/* Handover acknowledgments (emergencies) */}
      {isEmergency && submission.handovers.length > 0 && (
        <DrawerSection title="QR Turnover Acknowledgments" icon={QrCode}>
          <div className="grid gap-1.5">
            {submission.handovers.map((h) => (
              <div key={h.code} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px]">
                <span className="min-w-0 font-semibold text-slate-700">{h.code} • {h.agency}</span>
                <Chip className={QR_CHIP[h.status === "Accepted" ? "Accepted" : h.status === "Failed" ? "Failed" : "Pending"]}>{h.status}</Chip>
              </div>
            ))}
          </div>
        </DrawerSection>
      )}

      {/* Publish toggle */}
      {!closed && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <EyeOff size={12} className="text-emerald-600" />Publish privacy-safe summary to the public accomplishment log?
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={publish}
            aria-label="Publish privacy-safe summary"
            onClick={() => setPublish((v) => !v)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${publish ? "bg-emerald-600" : "bg-slate-300"}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${publish ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
      )}
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Reconcile drawer — failed / pending QR handovers                    */
/* ------------------------------------------------------------------ */

function ReconcileDrawer({ record, submission, onClose, onReconcile }) {
  const [remark, setRemark] = useState("");
  const ready = remark.trim().length >= 10;

  return (
    <DrawerShell
      title={`Reconcile Handover — ${record.code}`}
      subtitle={`${submission.id} (${submission.reportId}) • ${submission.title}`}
      badges={<Chip className={QR_CHIP[record.status]}>{record.status}</Chip>}
      onClose={onClose}
      footer={
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">Manual approvals are logged for later audit reconciliation — remarks become part of the permanent record.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
              <button type="button" disabled={!ready} onClick={() => { onReconcile(record, remark.trim()); onClose(); }} className={btnPrimary}>
                <CheckCircle2 size={12} />Approve Manual Receipt
              </button>
            </div>
          </div>
          {!ready && <p className="text-[10px] font-semibold text-amber-600">Typed remarks (min 10 characters) are required to approve a failed or pending scan.</p>}
        </div>
      }
    >
      <DrawerSection title="Handover Record" icon={QrCode}>
        <div className="grid gap-1.5 text-[11px] text-slate-700">
          <p><span className="font-semibold text-slate-500">Code:</span> {record.code} • single-use dynamic QR</p>
          <p><span className="font-semibold text-slate-500">Receiving agency:</span> {record.agency}</p>
          <p><span className="font-semibold text-slate-500">Issued:</span> {record.issued}</p>
          <p><span className="font-semibold text-slate-500">Status:</span> {record.status}</p>
          {record.failureReason && (
            <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-3 py-2.5 text-rose-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span><strong>Failure note:</strong> {record.failureReason}</span>
            </p>
          )}
          {record.ack && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-emerald-800">
              <strong>Acknowledged:</strong> {record.ack.by} ({record.ack.role}) — {record.ack.at} via {record.ack.path}.
            </p>
          )}
        </div>
      </DrawerSection>

      <DrawerSection title="Incident Context" icon={FileCheck}>
        <div className="grid gap-1.5 text-[11px] text-slate-700">
          <p><span className="font-semibold text-slate-500">Incident:</span> {submission.title}</p>
          <p><span className="font-semibold text-slate-500">Responding team:</span> {submission.team}</p>
          <p><span className="font-semibold text-slate-500">Outcome:</span> {submission.outcome}</p>
        </div>
      </DrawerSection>

      <DrawerSection title="Reconciliation Remarks" icon={ScanLine} tone="emerald">
        <textarea
          rows={4}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="e.g. Verified with the hospital ER desk by phone — receiver signed the paper log; code window closed before the digital scan…"
          className={`${inputCls} resize-none leading-relaxed`}
        />
      </DrawerSection>
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Integrity drawer — false-report review & progressive restrictions   */
/* ------------------------------------------------------------------ */

function tierLabel(strikes) {
  if (strikes <= 0) return "Under review";
  if (strikes === 1) return "1st Warning";
  if (strikes === 2) return "24h Ban";
  if (strikes === 3) return "7d Ban";
  return "Full review";
}

const TIER_CHIP = {
  "Under review": "bg-amber-100 text-amber-700",
  "1st Warning": "bg-sky-50 text-sky-700",
  "24h Ban": "bg-amber-100 text-amber-700",
  "7d Ban": "bg-rose-50 text-rose-600",
  "Full review": "bg-rose-50 text-rose-600",
};

function IntegrityDrawer({ entry, onClose, onAction }) {
  const ready = entry.basis && entry.evidence.length === EVIDENCE_ITEMS.length && entry.reason.trim().length >= 32;
  const nextTier = LADDER[Math.min(entry.strikes, LADDER.length - 1)];

  return (
    <DrawerShell
      title={`False-Report Verification — ${entry.id}`}
      subtitle={`${entry.reporter} • linked ticket ${entry.reportId}`}
      badges={<Chip className={TIER_CHIP[tierLabel(entry.strikes)]}>{tierLabel(entry.strikes)}</Chip>}
      onClose={onClose}
      footer={
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[10px] text-slate-500"><Lock size={10} />Executing applies <strong className="text-slate-700">{nextTier}</strong> — audit record attached; appeal path stays accessible.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
              <button type="button" disabled={!ready} onClick={() => { onAction("confirm", entry.id); onClose(); }} className={btnPrimary}>
                <Ban size={12} />Apply {nextTier.split(" ")[0]} Action
              </button>
            </div>
          </div>
          {!ready && <p className="text-[10px] font-semibold text-amber-600">Requires a valid basis, all three evidence checks, and a documented reason (min 32 chars).</p>}
        </div>
      }
    >
      <DrawerSection title="Reviewed Context" icon={History}>
        <div className="grid gap-1.5 text-[11px] text-slate-700">
          <p><span className="font-semibold text-slate-500">Resident:</span> {entry.reporter} ({entry.residentId})</p>
          <p><span className="font-semibold text-slate-500">Triggering incident:</span> {entry.reportId} — {entry.recent}</p>
          <p><span className="font-semibold text-slate-500">Automatic signals logged:</span> {entry.flags.join(" • ")}</p>
          {entry.restrictions.length > 0 && (
            <p><span className="font-semibold text-slate-500">Restrictions on record:</span> {entry.restrictions.map((r) => `${r.tier} (${r.at})`).join("; ")}</p>
          )}
          <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-3 py-2.5 text-rose-700">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span><strong>Prohibited bases:</strong> signals above are context only — a strike may never rest solely on {PROHIBITED_BASES.map((p) => p.label.toLowerCase()).join(", ")}.</span>
          </p>
        </div>
      </DrawerSection>

      <DrawerSection title="Valid Finding Basis (required)" icon={Scale} tone="emerald">
        <div className="grid gap-1.5">
          {VALID_BASES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onAction("basis", entry.id, b)}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[11px] font-semibold transition ${entry.basis === b ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}`}
            >
              <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border ${entry.basis === b ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                {entry.basis === b && <CheckCircle2 size={10} />}
              </span>
              {b}
            </button>
          ))}
          {PROHIBITED_BASES.map((p) => (
            <div key={p.label} className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-400">
              <Lock size={12} className="mt-0.5 shrink-0" />
              <span>{p.label}<span className="block text-[9px] font-medium">Prohibited basis — {p.note}</span></span>
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection title="Evidence Review (all three required)" icon={ShieldCheck} tone="emerald">
        <div className="grid gap-1.5">
          {EVIDENCE_ITEMS.map((item) => {
            const checked = entry.evidence.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => onAction("evidence", entry.id, item)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[11px] font-semibold transition ${checked ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}`}
              >
                <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                  {checked && <CheckCircle2 size={11} />}
                </span>
                {item}
              </button>
            );
          })}
        </div>
        <textarea
          rows={3}
          value={entry.reason}
          onChange={(e) => onAction("reason", entry.id, e.target.value)}
          placeholder="Documented reason — describe the evidence trail that establishes the false report (min 32 chars)…"
          className={`${inputCls} mt-2 resize-none leading-relaxed`}
        />
      </DrawerSection>

      <DrawerSection title="Progressive Restriction Ladder" icon={UserCheck}>
        <div className="flex flex-wrap gap-1.5">
          {LADDER.map((tier, i) => (
            <Chip key={tier} className={i < entry.strikes ? "bg-emerald-50 text-emerald-700" : i === entry.strikes ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"}>
              {i < entry.strikes ? "✓ " : ""}Tier {i + 1}: {tier}
            </Chip>
          ))}
        </div>
      </DrawerSection>
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs 2 & 3 — data tables                                            */
/* ------------------------------------------------------------------ */

function HandoverTable({ rows, onReconcile }) {
  const HEADINGS = ["Incident ID", "Receiving Agency", "QR Status", "Timestamp", "Action"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {HEADINGS.map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50">
              <td className="px-4 py-3">
                <span className="font-bold text-emerald-700">{row.incident}</span>
                <div className="text-[10px] font-medium text-slate-400">{row.code}</div>
              </td>
              <td className="px-4 py-3 font-semibold text-slate-700">{row.agency}</td>
              <td className="px-4 py-3"><Chip className={QR_CHIP[row.status]}>{row.status}</Chip></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.at}</td>
              <td className="px-4 py-3">
                {row.status === "Accepted"
                  ? <span className="text-[10px] font-semibold text-slate-400">Verified — no action needed</span>
                  : (
                    <button type="button" onClick={() => onReconcile(row)} className={btnPrimary}>
                      <ScanLine size={12} />Reconcile
                    </button>
                  )}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={HEADINGS.length} className="px-4 py-10 text-center text-slate-500">No handover records match the current filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function IntegrityTable({ rows, onOpen }) {
  const HEADINGS = ["Resident ID / Name", "Offense Count", "Triggering Incident", "Action"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {HEADINGS.map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50">
              <td className="px-4 py-3">
                <span className="font-bold text-slate-800">{row.reporter}</span>
                <div className="text-[10px] font-medium text-slate-400">{row.residentId} • {row.id}</div>
              </td>
              <td className="px-4 py-3"><Chip className={TIER_CHIP[tierLabel(row.strikes)]}>{tierLabel(row.strikes)}</Chip></td>
              <td className="px-4 py-3 text-slate-600">
                <span className="font-semibold text-emerald-700">{row.reportId}</span> — {row.recent}
              </td>
              <td className="px-4 py-3">
                <button type="button" onClick={() => onOpen(row.id)} className={btnSecondary}>
                  <Scale size={12} />Review Evidence
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={HEADINGS.length} className="px-4 py-10 text-center text-slate-500">No flagged reporters match the current filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: "evidence", label: "Evidence Review", icon: FileCheck },
  { key: "handover", label: "QR Handover Reconciliation", icon: QrCode },
  { key: "integrity", label: "False-Report Controls", icon: Scale },
];

export default function ResolutionVerification() {
  const [submissions, setSubmissions] = useState(seedSubmissions);
  const [integrity, setIntegrity] = useState(seedIntegrity);
  const [audit, setAudit] = useState(seedAudit);
  const [tab, setTab] = useState("evidence");
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState(null); // { mode: "review" | "reconcile" | "integrity", id }

  const addAudit = (entry) => setAudit((log) => [entry, ...log]);
  const getSubmission = (id) => submissions.find((s) => s.id === id);

  /* KPI counts */
  const stats = useMemo(() => ({
    awaiting: submissions.filter((s) => s.status === "Awaiting Review" || s.status === "Sent Back").length,
    reconcile: submissions.reduce((n, s) => n + s.handovers.filter((h) => h.status !== "Accepted").length, 0),
    closed: submissions.filter((s) => s.status === "Closed").length,
    restricted: integrity.filter((i) => i.restrictions.length > 0).length,
  }), [submissions, integrity]);

  /* Tab 1 — evidence review list */
  const reviewItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return submissions.filter((s) => s.status !== "Closed" && (!search || `${s.id} ${s.reportId} ${s.title} ${s.team} ${s.category}`.toLowerCase().includes(search)));
  }, [submissions, query]);

  /* Tab 2 — flattened handover rows */
  const handoverRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const rows = submissions.flatMap((s) => s.handovers.map((h) => ({
      ...h,
      at: h.ack?.at ?? h.issued,
      title: s.title,
      submissionId: s.id,
    })));
    return rows.filter((r) => !search || `${r.incident} ${r.code} ${r.agency} ${r.title}`.toLowerCase().includes(search));
  }, [submissions, query]);

  /* Tab 3 — flagged reporters */
  const integrityRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return integrity.filter((i) => !search || `${i.reporter} ${i.residentId} ${i.id} ${i.reportId} ${i.recent}`.toLowerCase().includes(search));
  }, [integrity, query]);

  const reviewTarget = drawer?.mode === "review" ? getSubmission(drawer.id) : null;
  const integrityTarget = drawer?.mode === "integrity" ? integrity.find((i) => i.id === drawer.id) : null;
  const reconcileTarget = drawer?.mode === "reconcile" ? handoverRows.find((r) => r.code === drawer.id) : null;

  const tabCounts = { evidence: reviewItems.length, handover: handoverRows.filter((r) => r.status !== "Accepted").length, integrity: integrity.filter((i) => i.status === "Open").length };

  /* — obligations (closure gate) — */
  function toggleObligation(id, label) {
    const resolvedNow = !getSubmission(id)?.obligations.find((o) => o.label === label)?.resolved;
    setSubmissions((cur) => cur.map((s) => s.id === id ? { ...s, obligations: s.obligations.map((o) => o.label === label ? { ...o, resolved: resolvedNow } : o) } : s));
    addAudit(logAuditTask(id, "Admin — N. Villanueva", resolvedNow ? "Obligation resolved" : "Obligation reopened", `${label} — closure gate ${resolvedNow ? "released one step" : "re-locked"}.`));
    toast.add({ type: "info", title: resolvedNow ? "Obligation resolved" : "Obligation reopened", description: label });
  }

  /* — role-based closure — */
  function authorize(id, outcome, publish) {
    const s = getSubmission(id);
    if (!s) return;
    const closer = OPERATORS[s.kind];
    setSubmissions((cur) => cur.map((x) => x.id === id ? {
      ...x,
      status: "Closed",
      closure: { outcome, closedBy: closer, closedAt: stamp(true), remarks: "Authorized from the review drawer after obligation clearance." },
    } : x));
    addAudit(logAuditTask(id, closer, "Closure authorized", `${outcome}. Obligations cleared: ${s.obligations.map((o) => o.label).join("; ")}.`));
    if (publish) {
      addAudit(logAuditTask(id, closer, "Published to public accomplishment log", "Privacy-safe summary emitted — personal identifiers and exact addresses stripped."));
      toast.add({ type: "success", title: "Closure authorized", description: `${id} closed as ${outcome}; privacy-safe summary published.` });
    } else {
      toast.add({ type: "success", title: "Closure authorized", description: `${id} closed as ${outcome}. Summary kept internal.` });
    }
    setDrawer({ mode: "review", id });
  }

  /* — reject / send back — */
  function reject(id, remark) {
    const s = getSubmission(id);
    setSubmissions((cur) => cur.map((x) => x.id === id ? { ...x, status: "Sent Back" } : x));
    addAudit(logAuditTask(id, "Admin — N. Villanueva", "Sent back to team", `Resubmission required — remark: ${remark}`));
    toast.add({ type: "info", title: `${id} sent back`, description: `${s.team} must resubmit with better proof.` });
  }

  /* — QR reconciliation — */
  function reconcile(record, remark) {
    setSubmissions((cur) => cur.map((s) => s.id === record.submissionId ? {
      ...s,
      status: s.status === "Handover Pending" && s.handovers.every((h) => (h.code === record.code ? { ...h, status: "Accepted" } : h).status === "Accepted") ? "Awaiting Review" : s.status,
      handovers: s.handovers.map((h) => h.code === record.code
        ? { ...h, status: "Accepted", ack: { by: "Admin — N. Villanueva", role: "Manual reconciliation", at: stamp(true), path: "Approved manual receipt" } }
        : h),
    } : s));
    addAudit(logAuditTask(record.incident, "Admin — N. Villanueva", "Manual receipt reconciled", `${record.code} (${record.agency}) approved with typed remarks: ${remark}. Flagged for later audit reconciliation.`));
    toast.add({ type: "success", title: `${record.code} reconciled`, description: "Manual receipt approved and queued for later audit reconciliation." });
  }

  /* — integrity actions — */
  function integrityAction(kind, id, value) {
    if (kind === "confirm") {
      const entry = integrity.find((i) => i.id === id);
      if (!entry) return;
      const tier = LADDER[Math.min(entry.strikes, LADDER.length - 1)];
      setIntegrity((cur) => cur.map((i) => i.id !== id ? i : {
        ...i,
        strikes: i.strikes + 1,
        restrictions: [...i.restrictions, { tier, at: stamp(true), by: OPERATORS.nonEmergency }],
        status: "Action taken",
      }));
      addAudit(logAuditTask(id, OPERATORS.nonEmergency, "Restriction executed", `${tier} applied to ${entry.reporter} after false-report finding (${entry.basis}). Reason: ${entry.reason}`));
      toast.add({ type: "warning", title: "Progressive restriction applied", description: `${tier} — audit record attached; appeal path accessible.` });
      return;
    }
    setIntegrity((cur) => cur.map((i) => {
      if (i.id !== id) return i;
      if (kind === "basis") return { ...i, basis: value };
      if (kind === "reason") return { ...i, reason: value };
      if (kind === "evidence") {
        const evidence = i.evidence.includes(value) ? i.evidence.filter((e) => e !== value) : [...i.evidence, value];
        return { ...i, evidence };
      }
      return i;
    }));
  }

  /* — open the false-report drawer from the review drawer — */
  function flagFromReview(sub) {
    const existing = integrity.find((i) => i.reportId === sub.reportId);
    const target = existing ?? {
      id: `INT-167-${13 + integrity.length}`, reporter: sub.reporter || "Unattributed reporter", residentId: sub.reporter || "Guest link",
      reportId: sub.reportId, recent: `Raised via review of ${sub.id} — flagged for documented evidence check.`,
      flags: ["Awaiting supervisor triage"], strikes: 0, restrictions: [], basis: null, reason: "", evidence: [], status: "Open",
    };
    if (!existing) setIntegrity((cur) => [target, ...cur]);
    setDrawer({ mode: "integrity", id: target.id });
  }

  return (
    <div className="space-y-4">
      {/* 1 — Header + KPI banner */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white"><ShieldCheck size={16} /></span>
            Resolution Verification
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">BDRRMO / Admin review workspace — evidence-gated closure, QR reconciliation, and integrity controls.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => toast.add({ type: "success", title: "Export ready", description: "Verification CSV export generated for the current tab." })} className={btnSecondary}>
            <Download size={12} />Export CSV
          </button>
          <button type="button" onClick={() => toast.add({ type: "success", title: "Export ready", description: "PDF verification packet generated for printing." })} className={btnSecondary}>
            <Printer size={12} />Export PDF
          </button>
        </div>
      </section>

      <section aria-label="Verification KPI summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Awaiting Review" value={stats.awaiting} icon={FileCheck} tone="amber" hint="proof awaiting admin decision" />
        <KpiCard label="Handovers to Reconcile" value={stats.reconcile} icon={QrCode} tone="rose" hint="pending or failed QR scans" />
        <KpiCard label="Closures Authorized" value={stats.closed} icon={CheckCircle2} hint="role-based closures on record" />
        <KpiCard label="Active Restrictions" value={stats.restricted} icon={Ban} tone="slate" hint="progressive controls active" />
      </section>

      {/* 2 — Tabbed governance workspace */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div role="tablist" aria-label="Resolution verification workspaces" className="flex flex-wrap gap-1 border-b border-slate-200 px-3">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const alerting = key !== "integrity" && tabCounts[key] > 0;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={active}
                aria-controls={`panel-${key}`}
                onClick={() => setTab(key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${active ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-emerald-700"}`}
              >
                <Icon size={13} />
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${key === "evidence" && tabCounts[key] > 0 ? "bg-rose-50 text-rose-600" : alerting ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                  {tabCounts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab 1 — Evidence Review */}
        {tab === "evidence" && (
          <div role="tabpanel" id="panel-evidence" aria-labelledby="tab-evidence" className="p-4 [animation:gf-fade-in_0.2s_ease-out]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20">
                <Search size={13} />
                <input aria-label="Search submissions" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets, teams, categories…" className="w-full text-xs text-slate-800 outline-none placeholder:text-slate-400" />
              </label>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {reviewItems.map((s) => (
                <article key={s.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip className="bg-emerald-50 text-emerald-700">{s.id}</Chip>
                        <Chip className="bg-slate-100 text-slate-500">from {s.reportId}</Chip>
                        {s.status === "Sent Back" && <Chip className="bg-rose-50 text-rose-600">sent back</Chip>}
                      </div>
                      <h3 className="mt-1 text-xs font-bold text-slate-800">{s.title}</h3>
                      <p className="text-[11px] text-slate-500">{s.category} • {s.team}</p>
                    </div>
                    <Chip className="bg-slate-100 text-slate-500">{s.obligations.filter((o) => o.resolved).length}/{s.obligations.length} obligations</Chip>
                  </div>
                  <p className="text-[11px] text-slate-500">Completed <span className="font-semibold text-slate-700">{s.completedAt}</span></p>
                  <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    {s.proof.length ? (
                      s.proof.map((item) => {
                        const Icon = item.kind === "video" ? FileVideo : FileImage;
                        return (
                          <span key={item.file} className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                            <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400"><Icon size={15} /></span>
                            {item.file}
                          </span>
                        );
                      })
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600"><AlertTriangle size={12} />no proof — fallback justification on file</span>
                    )}
                  </div>
                  <button type="button" onClick={() => setDrawer({ mode: "review", id: s.id })} className={`${btnPrimary} mt-auto`}>
                    <FileCheck size={12} />Open Review
                  </button>
                </article>
              ))}
              {!reviewItems.length && (
                <div className="flex flex-col items-center gap-1 py-10 text-center lg:col-span-2">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                  <p className="text-xs font-semibold text-slate-500">Nothing awaiting review — every submission has been processed.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2 — QR Handover Reconciliation */}
        {tab === "handover" && (
          <div role="tabpanel" id="panel-handover" aria-labelledby="tab-handover" className="p-4 [animation:gf-fade-in_0.2s_ease-out]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-800">QR handover reconciliation</h2>
                <p className="text-[11px] text-slate-500">Pending or failed turnovers to hospitals, police and other receiving agencies. Accepted rows are verified and read-only.</p>
              </div>
              <label className="flex h-9 min-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20">
                <Search size={13} />
                <input aria-label="Search handovers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search incidents, agencies…" className="w-full text-xs text-slate-800 outline-none placeholder:text-slate-400" />
              </label>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <HandoverTable rows={handoverRows} onReconcile={(row) => setDrawer({ mode: "reconcile", id: row.code })} />
            </div>
          </div>
        )}

        {/* Tab 3 — False-Report Controls */}
        {tab === "integrity" && (
          <div role="tabpanel" id="panel-integrity" aria-labelledby="tab-integrity" className="p-4 [animation:gf-fade-in_0.2s_ease-out]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-800">False-report controls</h2>
                <p className="text-[11px] text-slate-500">Flagged reporters under evidence-based review — progressive restrictions: 1st Warning → 24h Ban → 7d Ban → full review.</p>
              </div>
              <label className="flex h-9 min-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20">
                <Search size={13} />
                <input aria-label="Search flagged reporters" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search residents, incidents…" className="w-full text-xs text-slate-800 outline-none placeholder:text-slate-400" />
              </label>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <IntegrityTable rows={integrityRows} onOpen={(id) => setDrawer({ mode: "integrity", id })} />
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><History size={11} className="text-emerald-600" />Governance audit trail — 3–5 year retention, append-only</h3>
              </div>
              <AuditList audit={audit} />
            </div>
          </div>
        )}
      </section>

      {/* Slide-over drawers */}
      {reviewTarget && (
        <ReviewDrawer
          key={reviewTarget.id}
          submission={reviewTarget}
          onClose={() => setDrawer(null)}
          onToggleObligation={toggleObligation}
          onAuthorize={authorize}
          onReject={reject}
          onOpenIntegrity={flagFromReview}
        />
      )}
      {reconcileTarget && (
        <ReconcileDrawer
          key={reconcileTarget.code}
          record={reconcileTarget}
          submission={getSubmission(reconcileTarget.submissionId)}
          onClose={() => setDrawer(null)}
          onReconcile={reconcile}
        />
      )}
      {integrityTarget && (
        <IntegrityDrawer
          key={integrityTarget.id}
          entry={integrityTarget}
          onClose={() => setDrawer(null)}
          onAction={integrityAction}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline audit list (tab 3 footer)                                    */
/* ------------------------------------------------------------------ */

function AuditList({ audit }) {
  const rows = audit.slice(0, 12);
  return (
    <ol className="max-h-[260px] divide-y divide-slate-100 overflow-y-auto">
      {rows.map((a) => (
        <li key={a.key} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2.5 text-[11px]">
          <span className="whitespace-nowrap font-semibold text-slate-400">{a.at}</span>
          <span className="font-bold text-emerald-700">{a.taskId}</span>
          <span className="font-semibold text-slate-700">{a.action}</span>
          {a.system && <Chip className="bg-slate-100 text-slate-500">system</Chip>}
          <span className="w-full text-slate-500">{a.detail}</span>
        </li>
      ))}
      {!rows.length && <li className="px-4 py-6 text-center text-slate-500">No audit entries recorded yet.</li>}
    </ol>
  );
}
