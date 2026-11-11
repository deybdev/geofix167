import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CheckCircle, ClipboardList, Download, EyeOff, FileText, History,
  Lock, MapPin, Megaphone, Printer, Search, Siren, Unlock, Wrench, X,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import { stamp } from "../../shared/components/GovernanceUi";

/* ------------------------------------------------------------------------ */
/* Privacy helpers — the public ledger never shows raw personal content.    */
/* ------------------------------------------------------------------------ */

// Strips resident names, contact numbers, household references, and GPS from
// released text; everything else is street/zone generalized by design.
const redactText = (text, entry) => {
  let out = text ?? "";
  (entry.personal ?? []).forEach((name) => { out = out.replaceAll(name, "[name withheld]"); });
  (entry.contacts ?? []).forEach((c) => { out = out.replaceAll(c, "[contact withheld]"); });
  out = out.replace(/(\+63\d{10}|09\d{4}[\d -]{6,8})/g, "[contact withheld]");
  out = out.replace(/House\s*#?\s*\d+/gi, "[address withheld]");
  out = out.replace(/\b(lat|lng|lat\.?|long\.?)\s*[:=]?\s*-?\d+(\.\d+)?/gi, "[gps masked]");
  return out;
};

const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });

const KIND_META = {
  notice: { label: "Verified non-incident update", icon: Megaphone },
  emergency: { label: "Emergency response", icon: Siren },
  infra: { label: "Infrastructure repair", icon: Wrench },
};

const KIND_FILTERS = ["All Kinds", "Verified non-incident update", "Emergency response", "Infrastructure repair"];
const ZONE_FILTERS = ["All Zones", "Zone 1", "Zone 2", "Zone 3", "Zone 4"];

const MASK_OPTIONS = [
  "Zone 1 — Barangay Hall frontage (zone level)",
  "Zone 2 — Quezon Avenue corridor (street level)",
  "Zone 3 — Rizal Street area (street level)",
  "Zone 4 — Bonifacio St / market area (zone level)",
];

const TABS = [
  { key: "ledger", label: "Public Ledger (Preview)", icon: MapPin },
  { key: "curation", label: "Curation Queue", icon: ClipboardList },
  { key: "audit", label: "Audit & Retention", icon: History },
];

/* ------------------------------------------------------------------------ */
/* Mock data                                                                */
/* ------------------------------------------------------------------------ */

const seedEntries = [
  {
    id: "AL-167-E01", ticketId: "IR-167-114", kind: "emergency", zone: "Zone 3", street: "Rizal Street",
    locationRaw: "23 Rizal Street, beside House #7 waiting shed", gps: "14.7320 N, 121.0189 E",
    reporter: { name: "Danilo Reyes", contact: "0917-555-0167" },
    date: "2026-04-18", duration: "6 hours", handler: "BDRRMO — Lt. C. Ramos", resolvedAt: "Apr 18, 8:02 AM",
    rawNarrative: "Resident Danilo Reyes (0917-555-0167) reported the crash; both drivers moved to the House #7 waiting shed. Patients transferred at the Rizal corridor shed while police took the accident record.",
    evidence: ["scene-response.mp4", "triage-photos.zip"],
    status: "Published", publishedAt: "Apr 18, 9:18 PM",
    maskedLocation: "Zone 3 — Rizal Street area (street level)",
    summary: "Traffic incident on the Rizal corridor resolved within six hours following verified QR turnovers to police and hospital. Road cleared and reopened to two-way traffic.",
  },
  {
    id: "AL-167-I01", ticketId: "TASK-167-02", kind: "infra", zone: "Zone 2", street: "Quezon Avenue",
    locationRaw: "Pole 14, Quezon Avenue, across House #21", gps: "14.7321 N, 121.0192 E",
    reporter: { name: "Rain Opinion", contact: "0906-455-1123" },
    date: "2026-04-21", duration: "2 days", handler: "Engineering Crew B", resolvedAt: "Apr 21, 6:40 PM",
    rawNarrative: "Crew re-terminated Pole 14 wiring (work order from resident Rain Opinion, contact 0906-455-1123) beside House #21; night inspection passed.",
    evidence: ["streetlight-on.jpg", "load-test-log.pdf"],
    status: "Published", publishedAt: "Apr 21, 8:55 PM",
    maskedLocation: "Zone 2 — Quezon Avenue corridor (street level)",
    summary: "Streetlight pole re-anchored with wiring re-terminated and restored in two days, finishing ahead of the deadline. Night inspection passed.",
  },
  {
    id: "ADV-167-02", ticketId: "NOTICE-012", kind: "notice", zone: "Zone 2", street: "Barangay hall frontage",
    locationRaw: "Barangay Hall, Pasong Kamagong Compound, House #3 annex", gps: "14.7290 N, 121.0162 E",
    reporter: null,
    date: "2026-04-22", duration: "—", handler: "Admin — N. Villanueva", resolvedAt: "Apr 22, 8:30 AM",
    rawNarrative: "Barangay Secretary Luningning Reyes confirms the power-interruption advisory for Quezon Avenue sectors (contact 0917-555-0167). One-flag posting verified on the House #3 annex bulletin.",
    evidence: ["advisory-posting.jpg"],
    status: "Published", publishedAt: "Apr 22, 9:05 AM",
    maskedLocation: "Zone 2 — Quezon Avenue corridor (street level)",
    summary: "Confirmed advisory: planned power interruption along Quezon Avenue sectors coordinated with the utility desk. One-flag postings walk-verified on site.",
  },
  {
    id: "AL-167-I02", ticketId: "TASK-167-05", kind: "infra", zone: "Zone 4", street: "Bonifacio Street",
    locationRaw: "Sidewalk stretch beside House #12, Bonifacio Street", gps: "14.7275 N, 121.0141 E",
    reporter: { name: "Marites Dulan", contact: "0998-225-7712" },
    date: "2026-04-20", duration: "3 days", handler: "Barangay Public Works", resolvedAt: "Apr 23, 10:15 AM",
    rawNarrative: "Sidewalk patch cured over Marites Dulan's House #12 frontage (contact 0998-225-7712); workmen cleared barricades after the 48-hour cure check.",
    evidence: ["sidewalk-repaired.jpg"],
    status: "Curation", summary: null,
  },
  {
    id: "AL-167-N03", ticketId: "NOTICE-014", kind: "notice", zone: "Zone 1", street: "Barangay hall frontage",
    locationRaw: "Community hall, Barangay Hall grounds, House #3 annex", gps: "14.7290 N, 121.0162 E",
    reporter: { name: "Maria Luz Tan", contact: "0919-166-9932" },
    date: "2026-04-22", duration: "—", handler: "Admin — N. Villanueva", resolvedAt: "Apr 23, 11:02 AM",
    rawNarrative: "Assembly walk-in contact 0919-166-9932 (Maria Luz Tan) confirms the medical mission advisory at the House #3 hall grounds; field confirmation pending final walkthrough.",
    evidence: ["mission-advisory.pdf"],
    status: "Curation", summary: null,
  },
  {
    id: "AL-167-I03", ticketId: "TASK-167-07", kind: "infra", zone: "Zone 3", street: "Magsaysay Boulevard",
    locationRaw: "Canal segment, Magsaysay Boulevard, rear of House #9", gps: "14.7269 N, 121.0174 E",
    reporter: null,
    date: "2026-04-21", duration: "1 day", handler: "Barangay Sanitizers", resolvedAt: "Apr 23, 9:20 AM",
    rawNarrative: "Silt clearing (2.5 m³) completed before the weekend rain; closure logged by N. Villanueva via internal field log (contact 0917-220-3341).",
    evidence: [],
    status: "Curation", summary: null,
  },
  {
    id: "AL-167-E02", ticketId: "IR-167-121", kind: "emergency", zone: "Zone 4", street: "Market frontage",
    locationRaw: "Market frontage, Rizal turn, House #4 lane", gps: "14.7288 N, 121.0155 E",
    reporter: { name: "C. Domingo", contact: "0917-845-2210" },
    date: "2026-04-22", duration: "1 hour", handler: "BDRRMO — Lt. C. Ramos", resolvedAt: "Apr 22, 7:44 PM",
    rawNarrative: "Companion C. Domingo (0917-845-2210) received the patient; hospital receipt reconciled via manual field log.",
    evidence: ["handover-clip.mp4"],
    status: "Curation", summary: null,
  },
];

const seedAudit = [
  { key: "a1", at: "Apr 22, 9:05 AM", actor: "Admin — N. Villanueva", action: "Accomplishment published", ticketId: "NOTICE-012", logId: "ADV-167-02", system: false },
  { key: "a2", at: "Apr 21, 8:55 PM", actor: "Admin — N. Villanueva", action: "Accomplishment published", ticketId: "TASK-167-02", logId: "AL-167-I01", system: false },
  { key: "a3", at: "Apr 21, 8:55 PM", actor: "System", action: "Privacy stripping applied", ticketId: "TASK-167-02", logId: "AL-167-I01", system: true },
  { key: "a4", at: "Apr 18, 9:18 PM", actor: "Admin — N. Villanueva", action: "Accomplishment published", ticketId: "IR-167-114", logId: "AL-167-E01", system: false },
  { key: "a5", at: "Apr 22, 10:12 AM", actor: "Public ledger visitor", action: "Role-gated access logged", ticketId: "—", logId: "LEDGER", system: true },
];

/* ------------------------------------------------------------------------ */
/* Shared styled primitives (standard Tailwind recipes)                     */
/* ------------------------------------------------------------------------ */

const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";
const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${className}`}>
      {children}
    </span>
  );
}

function KindChip({ kind }) {
  const styles = kind === "emergency" ? "bg-rose-50 text-rose-600" : kind === "infra" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700";
  return <Chip className={styles}>{KIND_META[kind].label}</Chip>;
}

/* ------------------------------------------------------------------------ */
/* KPI widget                                                               */
/* ------------------------------------------------------------------------ */

function KpiCard({ label, value, icon: Icon, tone = "emerald", hint }) {
  const tones = {
    emerald: { chip: "bg-emerald-50 text-emerald-600", ring: "border-slate-200", num: "text-slate-800" },
    amber: { chip: "bg-amber-50 text-amber-600", ring: "border-amber-200", num: "text-amber-700" },
    rose: { chip: "bg-rose-50 text-rose-600", ring: "border-slate-200", num: "text-slate-800" },
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

/* ------------------------------------------------------------------------ */
/* Tab 1 — Public Ledger (Preview): privacy-safe timeline                    */
/* ------------------------------------------------------------------------ */

function LedgerCard({ entry, isLast }) {
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3 px-4 py-4">
      <div className="flex shrink-0 flex-col items-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Icon size={15} /></span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-slate-200" />}
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800">{entry.id} • {fmtDay(entry.date)}</p>
          <Chip className="bg-emerald-50 text-emerald-700"><CheckCircle size={10} />Published</Chip>
        </div>
        <p className="mt-0.5 text-[11px] font-medium text-slate-500">{meta.label}</p>

        {/* Privacy-safe location: street/zone generalization only, GPS never shown */}
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <MapPin size={12} className="shrink-0 text-emerald-600" />
          <span className="font-semibold text-slate-700">{entry.maskedLocation}</span>
          <Chip className="bg-slate-100 text-slate-500"><Lock size={9} />GPS masked to street/zone level</Chip>
        </p>

        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">{entry.summary}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
          <span>Handled by {entry.handler}</span>
          <span>• Response window: {entry.duration}</span>
          <span className="ml-auto flex items-center gap-1"><EyeOff size={10} />Resident identities & exact address withheld</span>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------------ */
/* Tab 2 — Curation Queue item                                              */
/* ------------------------------------------------------------------------ */

function QueueItem({ entry, onCurate }) {
  const meta = KIND_META[entry.kind];
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip className="bg-emerald-50 text-emerald-700">{entry.id}</Chip>
            <Chip className="bg-slate-100 text-slate-500"><FileText size={9} />from {entry.ticketId}</Chip>
          </div>
          <h3 className="mt-1 text-xs font-bold text-slate-800">{meta.label}</h3>
        </div>
        <Chip className="bg-amber-100 text-amber-700">Awaiting curation</Chip>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <MapPin size={12} className="shrink-0 text-emerald-600" />
        {entry.street} ({entry.zone})
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
        <span>Resolved {entry.resolvedAt} via {entry.handler}</span>
        <span>• {entry.evidence.length} evidence file(s) on record</span>
      </div>
      <div className="mt-auto border-t border-slate-100 pt-2">
        <button type="button" onClick={onCurate} className={`${btnPrimary} w-full`}>
          <Unlock size={12} />Curate &amp; Publish
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------------ */
/* Tab 2 — Curation slide-over drawer                                       */
/* ------------------------------------------------------------------------ */

function CurationDrawer({ entry, onClose, onConfirm }) {
  const suggested = entry.summary ?? redactText(entry.rawNarrative, entry);
  const defaultMask = MASK_OPTIONS.find((m) => m.startsWith(`${entry.zone} —`)) ?? entry.maskedLocation ?? MASK_OPTIONS[0];
  const [summary, setSummary] = useState(suggested);
  const [masked, setMasked] = useState(defaultMask);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const ready = summary.trim().length >= 10 && Boolean(masked);

  function publish() {
    if (!ready) return;
    onConfirm(entry.id, { summary: summary.trim(), maskedLocation: masked });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close curation drawer"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default border-0 bg-slate-900/40 backdrop-blur-[2px] [animation:gf-fade-in_0.18s_ease-out]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Curate ${entry.id}`}
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl [animation:gf-drawer-in_0.22s_ease-out] sm:w-[40%] sm:min-w-[500px] sm:max-w-[680px]"
      >
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-emerald-700">Curate &amp; Publish</h2>
              <Chip className="bg-emerald-50 text-emerald-700">{entry.id}</Chip>
              <KindChip kind={entry.kind} />
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Sanitize before release — original identities never reach the public ledger.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 transition hover:bg-white hover:text-emerald-700">
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Original view — internal only */}
          <section className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-600">
              <Unlock size={11} />Original Report — internal only, never published
            </h3>
            <div className="mt-2 grid gap-1.5 text-[11px] text-slate-700">
              <p><span className="font-semibold text-slate-500">Original ticket:</span> {entry.ticketId}</p>
              <p><span className="font-semibold text-slate-500">Exact address:</span> {entry.locationRaw}</p>
              <p><span className="font-semibold text-slate-500">Coordinates:</span> {entry.gps}</p>
              <p><span className="font-semibold text-slate-500">Resident:</span> {entry.reporter ? `${entry.reporter.name} • ${entry.reporter.contact}` : "Internal / no resident reporter"}</p>
              <p className="rounded-lg border border-rose-200 bg-white p-2.5 leading-relaxed text-slate-600"><span className="font-semibold text-slate-500">Raw narrative:</span> {entry.rawNarrative}</p>
              <p><span className="font-semibold text-slate-500">Evidence on file:</span> {entry.evidence.length ? entry.evidence.join(", ") : "none"}</p>
            </div>
          </section>

          {/* Sanitization form */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Lock size={11} className="text-emerald-600" />Sanitization Form — what the community will see
            </h3>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
                Public Summary
                <textarea
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Write the privacy-safe public summary (names, contacts and exact addresses removed)…"
                  className={`${inputCls} resize-none leading-relaxed`}
                />
              </label>
              <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
                Masked Location Area
                <select value={masked} onChange={(e) => setMasked(e.target.value)} className={inputCls}>
                  {MASK_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-medium text-emerald-700">
                <EyeOff size={12} className="mt-0.5 shrink-0" />
                Released card will show: <span className="font-bold">{masked}</span> — resident names, contacts, exact addresses and GPS coordinates are stripped automatically on publish.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="button" disabled={!ready} onClick={publish} className={btnPrimary}>
            <CheckCircle size={12} />Publish to Ledger
          </button>
        </footer>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Tab 3 — Audit & retention table                                          */
/* ------------------------------------------------------------------------ */

const AUDIT_HEADINGS = ["Date / Time", "Admin Name", "Action Taken", "Original Ticket ID", "Published Log ID"];

function AuditTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {AUDIT_HEADINGS.map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{row.at}</td>
              <td className="px-4 py-3">
                <span className="font-medium text-slate-700">{row.actor}</span>
                {row.system && <Chip className="ml-2 bg-slate-100 text-slate-500">system</Chip>}
              </td>
              <td className="px-4 py-3">
                <span className="font-semibold text-slate-700">{row.action}</span>
              </td>
              <td className="px-4 py-3"><Chip className="bg-slate-100 text-slate-600">{row.ticketId}</Chip></td>
              <td className="px-4 py-3 font-semibold text-emerald-700">{row.logId}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={AUDIT_HEADINGS.length} className="px-4 py-10 text-center text-slate-500">No audit entries match the current filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Main page                                                                */
/* ------------------------------------------------------------------------ */

export default function AccomplishmentLog() {
  const [entries, setEntries] = useState(seedEntries);
  const [audit, setAudit] = useState(seedAudit);
  const [tab, setTab] = useState("ledger");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("All Kinds");
  const [zone, setZone] = useState("All Zones");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [openCuration, setOpenCuration] = useState(null);

  const published = useMemo(() => entries.filter((entry) => entry.status === "Published"), [entries]);
  const queue = useMemo(() => entries.filter((entry) => entry.status === "Curation"), [entries]);

  const filtered = useMemo(() => published.filter((entry) => {
    const search = query.trim().toLowerCase();
    const kindLabel = KIND_META[entry.kind].label;
    const matchQuery = !search || `${entry.id} ${entry.street} ${entry.zone} ${entry.maskedLocation} ${entry.summary} ${kindLabel}`.toLowerCase().includes(search);
    const matchKind = kind === "All Kinds" || kindLabel === kind;
    const matchZone = zone === "All Zones" || entry.zone === zone;
    const matchFrom = !from || entry.date >= from;
    const matchTo = !to || entry.date <= to;
    return matchQuery && matchKind && matchZone && matchFrom && matchTo;
  }), [published, query, kind, zone, from, to]);

  const auditRows = useMemo(() => {
    const s = auditQuery.trim().toLowerCase();
    return s ? audit.filter((a) => `${a.at} ${a.actor} ${a.action} ${a.ticketId} ${a.logId}`.toLowerCase().includes(s)) : audit;
  }, [audit, auditQuery]);

  const stats = useMemo(() => ({
    published: published.length,
    gate: queue.length,
    emergency: published.filter((entry) => entry.kind === "emergency").length,
    infra: published.filter((entry) => entry.kind === "infra").length,
  }), [published, queue]);

  const curationTarget = entries.find((entry) => entry.id === openCuration && entry.status === "Curation");

  function confirmPublish(id, { summary, maskedLocation }) {
    const entry = entries.find((e) => e.id === id);
    const at = stamp(true);
    setEntries((cur) => cur.map((e) => e.id === id
      ? { ...e, status: "Published", publishedAt: at, summary, maskedLocation }
      : e));
    setAudit((log) => [
      { key: `${id}-pub-${log.length + 1}`, at, actor: "Admin — N. Villanueva", action: "Accomplishment published", ticketId: entry.ticketId, logId: id, system: false },
      { key: `${id}-strip-${log.length + 1}`, at, actor: "System", action: "Privacy stripping applied", ticketId: entry.ticketId, logId: id, system: true },
      ...log,
    ]);
    setOpenCuration(null);
    setTab("ledger");
    toast.add({ type: "success", title: "Published to ledger", description: `${id} is live on the public ledger — sanitized summary only.` });
  }

  const tabCounts = { ledger: published.length, curation: queue.length, audit: audit.length };

  return (
    <div className="space-y-4">
      {/* 1 — Header + KPI banner */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white"><CheckCircle size={16} /></span>
            Accomplishment Log
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">Public transparency ledger — curate resolved tickets before they reach the community.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => toast.add({ type: "success", title: "Export ready", description: "Public ledger CSV generated (privacy-safe rows only)." })} className={btnSecondary}>
            <Download size={12} />Export CSV
          </button>
          <button type="button" onClick={() => toast.add({ type: "success", title: "Export ready", description: "Official ledger PDF generated for the barangay board." })} className={btnSecondary}>
            <Printer size={12} />Export PDF
          </button>
        </div>
      </section>

      <section aria-label="Ledger KPI summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Published" value={stats.published} icon={CheckCircle} hint="live on the public ledger" />
        <KpiCard label="In Gate" value={stats.gate} icon={ClipboardList} tone="amber" hint="pending curation" />
        <KpiCard label="Emergency Responses" value={stats.emergency} icon={Siren} tone="rose" hint="published resolutions" />
        <KpiCard label="Infrastructure Repairs" value={stats.infra} icon={Wrench} tone="slate" hint="published repairs" />
      </section>

      {/* 2 — Tabbed curation workspace */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div role="tablist" aria-label="Accomplishment log workspaces" className="flex flex-wrap gap-1 border-b border-slate-200 px-3">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const alerting = key === "curation" && tabCounts[key] > 0;
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
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${alerting ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                  {tabCounts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab 1 — Public Ledger (Preview) */}
        {tab === "ledger" && (
          <div role="tabpanel" id="panel-ledger" aria-labelledby="tab-ledger" className="p-4 [animation:gf-fade-in_0.2s_ease-out]">
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20">
                <Search size={13} />
                <input
                  aria-label="Search published accomplishments"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search published accomplishments…"
                  className="w-full text-xs text-slate-800 outline-none placeholder:text-slate-400"
                />
              </label>
              <select aria-label="Filter category" value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputCls} h-9 w-auto min-w-[150px]`}>
                {KIND_FILTERS.map((option) => <option key={option}>{option}</option>)}
              </select>
              <select aria-label="Filter zone" value={zone} onChange={(e) => setZone(e.target.value)} className={`${inputCls} h-9 w-auto min-w-[110px]`}>
                {ZONE_FILTERS.map((option) => <option key={option}>{option}</option>)}
              </select>
              <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-400">
                <CalendarDays size={12} className="text-emerald-600" />
                <input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[110px] bg-transparent text-[11px] text-slate-700 outline-none" />
              </label>
              <span className="text-[11px] text-slate-400">to</span>
              <input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} h-9 w-auto`} />
            </div>

            <div className="border-b border-slate-200 px-1 pb-3">
              <h2 className="text-sm font-bold text-slate-800">Timeline — community view ({filtered.length})</h2>
              <p className="text-[11px] text-slate-500">Exactly what residents see: street/zone-level summaries only — evidence, case narratives and identities never leave the internal trail.</p>
            </div>

            <ol className="grid">
              {filtered.map((entry, index) => <LedgerCard key={entry.id} entry={entry} isLast={index === filtered.length - 1} />)}
              {!filtered.length && (
                <li className="flex flex-col items-center gap-1 py-10 text-center">
                  <MapPin size={22} className="text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">No published accomplishments match the selected filters.</p>
                </li>
              )}
            </ol>

            <p className="mx-1 mb-1 flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-medium text-emerald-700">
              <Lock size={12} className="mt-0.5 shrink-0" />
              Privacy enforcement: resident-submitted photos/videos, chat logs, exact addresses and coordinates stay strictly role-gated internally and are never rendered on this public preview.
            </p>
          </div>
        )}

        {/* Tab 2 — Curation Queue */}
        {tab === "curation" && (
          <div role="tabpanel" id="panel-curation" aria-labelledby="tab-curation" className="p-4 [animation:gf-fade-in_0.2s_ease-out]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Curation queue ({queue.length})</h2>
                <p className="text-[11px] text-slate-500">Tickets resolved in other modules land here before going public. Open the drawer to sanitize and publish.</p>
              </div>
              <Chip className="bg-amber-100 text-amber-700"><ClipboardList size={10} />{queue.length} awaiting review</Chip>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {queue.map((entry) => <QueueItem key={entry.id} entry={entry} onCurate={() => setOpenCuration(entry.id)} />)}
              {!queue.length && (
                <div className="flex flex-col items-center gap-1 py-10 text-center lg:col-span-2">
                  <CheckCircle size={22} className="text-emerald-500" />
                  <p className="text-xs font-semibold text-slate-500">Curation queue is empty — every resolved ticket has been reviewed.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3 — Audit & Retention */}
        {tab === "audit" && (
          <div role="tabpanel" id="panel-audit" aria-labelledby="tab-audit" className="p-4 [animation:gf-fade-in_0.2s_ease-out]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Audit &amp; retention trail</h2>
                <p className="text-[11px] text-slate-500">Read-only system log — publishes, redaction runs and access events. Retained 3–5 years; entries can never be edited or deleted.</p>
              </div>
              <Chip className="bg-slate-100 text-slate-500"><Lock size={10} />append-only</Chip>
            </div>
            <label className="mb-3 flex h-9 min-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20">
              <Search size={13} />
              <input
                aria-label="Filter audit entries"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Filter by date, admin, action, ticket or log ID…"
                className="w-full text-xs text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <AuditTable rows={auditRows} />
            </div>
          </div>
        )}
      </section>

      {curationTarget && (
        <CurationDrawer
          key={curationTarget.id}
          entry={curationTarget}
          onClose={() => setOpenCuration(null)}
          onConfirm={confirmPublish}
        />
      )}
    </div>
  );
}
