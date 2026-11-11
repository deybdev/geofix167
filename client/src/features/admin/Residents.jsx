import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Ban, Download, FileImage, FileText, IdCard, KeyRound,
  MapPin, Phone, RotateCcw, Search, ShieldAlert, ShieldCheck, UserCheck, UserX, Users, X,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";

/* ------------------------------------------------------------------------ */
/* Shared styled primitives (standard Tailwind recipes)                     */
/* ------------------------------------------------------------------------ */

const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";
const btnDanger = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-50";
const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${className}`}>
      {children}
    </span>
  );
}

const STATUS_CHIP = {
  Verified: "bg-emerald-50 text-emerald-700",
  Suspended: "bg-amber-100 text-amber-700",
  Revoked: "bg-rose-50 text-rose-600",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-rose-50 text-rose-600",
  Denied: "bg-rose-50 text-rose-600",
};

function Avatar({ name, size = "h-9 w-9 text-[10px]" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white ${size}`}>
      {name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("")}
    </span>
  );
}

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

/* ------------------------------------------------------------------------ */
/* Slide-over drawer shell (~45% width)                                     */
/* ------------------------------------------------------------------------ */

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
        aria-label="Close drawer"
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

/* ------------------------------------------------------------------------ */
/* Mock data                                                                */
/* ------------------------------------------------------------------------ */

const seedResidents = [
  { id: "RSD-0231", name: "Marvin Navarrete", mobile: "0917•••0167", address: "Blk 4, Rizal Street", zone: "Zone 1", reports: 3, status: "Verified", joined: "January 2026" },
  { id: "RSD-0187", name: "Rain Opinion", mobile: "0918•••2210", address: "Blk 7, Quezon Avenue", zone: "Zone 2", reports: 5, status: "Verified", joined: "December 2025" },
  { id: "RSD-0202", name: "Ellyz Gomez", mobile: "0920•••7781", address: "Blk 2, Magsaysay Boulevard", zone: "Zone 2", reports: 2, status: "Verified", joined: "February 2026" },
  { id: "RSD-0256", name: "Rain Santiago", mobile: "0928•••1199", address: "Blk 5, Bonifacio Street", zone: "Zone 4", reports: 4, status: "Verified", joined: "November 2025" },
  { id: "RSD-0214", name: "Efren Cahilig", mobile: "0936•••8822", address: "Blk 3, Magsaysay Boulevard", zone: "Zone 2", reports: 1, status: "Verified", joined: "March 2026" },
  { id: "RSD-0240", name: "Liza Maranan", mobile: "0945•••3041", address: "Blk 6, Rizal Street", zone: "Zone 1", reports: 2, status: "Verified", joined: "October 2025" },
  { id: "RSD-0163", name: "Danilo Reyes", mobile: "0919•••5566", address: "Blk 8, Bonifacio Street", zone: "Zone 4", reports: 6, status: "Suspended", joined: "September 2025" },
  { id: "RSD-0119", name: "Demi Villanueva", mobile: "0945•••7710", address: "Blk 1, Roxas Boulevard", zone: "Zone 3", reports: 0, status: "Revoked", joined: "August 2025" },
];

const seedPending = [
  {
    id: "PND-001", name: "Cataluna Jhone", mobile: "0921•••5432", address: "Blk 9, Roxas Boulevard", zone: "Zone 3",
    flag: "Unreadable ID", submitted: "Apr 21, 2026", status: "Pending",
    submittedDetails: { fullName: "Cataluna Jhone", mobile: "0921•••5432", address: "Blk 9, Roxas Boulevard, near the covered court", idType: "Barangay ID (photo blurry — glare on hologram)" },
    masterlist: { name: "Cataluna Jhone", mobile: "0921•••5432", address: "Blk 9, Roxas Boulevard", note: "Name and mobile matched; ID photo needs manual confirmation." },
  },
  {
    id: "PND-002", name: "Joselito Ramirez", mobile: "0917•••0167", address: "Blk 4, Rizal Street", zone: "Zone 1",
    flag: "Duplicate Mobile", submitted: "Apr 22, 2026", status: "Pending",
    submittedDetails: { fullName: "Joselito Ramirez", mobile: "0917•••0167", address: "Blk 4, Rizal Street, 2nd unit", idType: "PhilID (clear upload)" },
    masterlist: { name: "Marvin Navarrete (RSD-0231)", mobile: "0917•••0167", address: "Blk 4, Rizal Street", note: "Mobile already bound to RSD-0231 — possible household shared line or re-registration." },
  },
  {
    id: "PND-003", name: "Ma. Corazon Bautista", mobile: "0938•••4411", address: "Blk 2, Del Pilar Road", zone: "Zone 4",
    flag: "Name mismatch", submitted: "Apr 22, 2026", status: "Pending",
    submittedDetails: { fullName: "Ma. Corazon D. Bautista", mobile: "0938•••4411", address: "Blk 2, Del Pilar Road", idType: "Barangay ID (clear upload)" },
    masterlist: { name: "Corazon Bautista", mobile: "0938•••4411", address: "Blk 2, Del Pilar Road", note: "Likely the same person — masterlist stores the maiden-form name without middle initials." },
  },
  {
    id: "PND-004", name: "Guest V. Reyes", mobile: "0926•••3387", address: "Covered court side lane, Del Pilar Rd", zone: "Zone 4",
    flag: "Address not in masterlist", submitted: "Apr 23, 2026", status: "Pending",
    submittedDetails: { fullName: "Vincent Reyes", mobile: "0926•••3387", address: "Side lane beside the covered court, Del Pilar Rd", idType: "Driver's license (clear upload)" },
    masterlist: { name: "— no record —", mobile: "—", address: "—", note: "No matching household on the barangay masterlist; address sits between Blocks 5 and 6." },
  },
];

const seedRecovery = [
  {
    id: "REC-001", name: "Ellyz Gomez", residentId: "RSD-0202", lostMobile: "0920•••7781",
    newMobile: "0921•••9902", email: "ellyz.gomez@mail.example", requested: "Apr 22, 2026", status: "Pending",
    proof: { type: "Valid government ID re-uploaded", detail: "PhilID upload matches the masterlist portrait; selfie liveness check passed." },
    note: "Lost phone replaced after the April 19 incident; old number was pre-paid and non-restorable.",
  },
  {
    id: "REC-002", name: "Liza Maranan", residentId: "RSD-0240", lostMobile: "0945•••3041",
    newMobile: "0995•••1240", email: "l.maranan@mail.example", requested: "Apr 23, 2026", status: "Pending",
    proof: { type: "Barangay certification of residency", detail: "Signed certification from the barangay secretary verifying identity in person at the hall." },
    note: "Number was reported stolen; resident filed in person at the barangay hall.",
  },
  {
    id: "REC-003", name: "Efren Cahilig", residentId: "RSD-0214", lostMobile: "0936•••8822",
    newMobile: "0977•••6018", email: "efren.cahilig@mail.example", requested: "Apr 23, 2026", status: "Pending",
    proof: { type: "Valid ID + telco release letter", detail: "Telco confirmed the old number recycled; ID matches the masterlist record." },
    note: "SIM expired after 60 days of non-use while the resident worked out of town.",
  },
];

/* ------------------------------------------------------------------------ */
/* Tab 1 — Resident directory table                                         */
/* ------------------------------------------------------------------------ */

function DirectoryTable({ rows, onManage }) {
  const HEADINGS = ["Resident Name", "Mobile", "Address (Zone/Block)", "Reports Filed", "Member Since", "Action"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {HEADINGS.map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.name} />
                  <div className="min-w-0">
                    <span className="block font-bold text-slate-800">{r.name}</span>
                    <span className="text-[10px] font-medium text-slate-400">{r.id}</span>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600"><span className="flex items-center gap-1.5"><Phone size={11} className="text-emerald-600" />{r.mobile}</span></td>
              <td className="px-4 py-3 text-slate-600">
                <span className="flex items-center gap-1.5"><MapPin size={11} className="text-emerald-600" />{r.address}</span>
                <span className="text-[10px] font-medium text-slate-400">{r.zone}</span>
              </td>
              <td className="px-4 py-3 font-bold text-emerald-700">{r.reports}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.joined}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Chip className={STATUS_CHIP[r.status]}>{r.status}</Chip>
                  <button type="button" onClick={() => onManage(r.id)} className={btnSecondary}>
                    <KeyRound size={12} />Manage Access
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={HEADINGS.length} className="px-4 py-10 text-center text-slate-500">No residents match the selected filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Tab 2 — Pending verifications table                                      */
/* ------------------------------------------------------------------------ */

function PendingTable({ rows, onReview }) {
  const HEADINGS = ["Submitted Name", "Flag Reason", "Date Submitted", "Status", "Action"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {HEADINGS.map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={row.name} />
                  <div className="min-w-0">
                    <span className="block font-bold text-slate-800">{row.name}</span>
                    <span className="text-[10px] font-medium text-slate-400">{row.id} • {row.mobile}</span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3"><Chip className="bg-amber-100 text-amber-700"><AlertTriangle size={9} />{row.flag}</Chip></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.submitted}</td>
              <td className="px-4 py-3"><Chip className={STATUS_CHIP[row.status]}>{row.status}</Chip></td>
              <td className="px-4 py-3">
                <button type="button" onClick={() => onReview(row.id)} className={btnPrimary}>
                  <IdCard size={12} />Review Identity
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={HEADINGS.length} className="px-4 py-10 text-center text-slate-500">Verification queue is clear — nothing awaiting manual review.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Tab 3 — Recovery requests table                                          */
/* ------------------------------------------------------------------------ */

function RecoveryTable({ rows, onReview }) {
  const HEADINGS = ["Resident Name", "Lost Number", "Requested Contact", "Proof Presented", "Status", "Action"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {HEADINGS.map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={row.name} />
                  <div className="min-w-0">
                    <span className="block font-bold text-slate-800">{row.name}</span>
                    <span className="text-[10px] font-medium text-slate-400">{row.residentId} • {row.id}</span>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.lostMobile}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.newMobile}</td>
              <td className="px-4 py-3 text-slate-600"><span className="flex items-center gap-1.5"><FileText size={11} className="text-emerald-600" />{row.proof.type}</span></td>
              <td className="px-4 py-3"><Chip className={STATUS_CHIP[row.status]}>{row.status}</Chip></td>
              <td className="px-4 py-3">
                <button type="button" onClick={() => onReview(row.id)} className={btnPrimary}>
                  <KeyRound size={12} />Review Request
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={HEADINGS.length} className="px-4 py-10 text-center text-slate-500">No recovery requests on file.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Drawer 1 — Manage Access (directory)                                     */
/* ------------------------------------------------------------------------ */

function AccessDrawer({ resident, onClose, onAction }) {
  const [reason, setReason] = useState("");
  const needsReason = resident.status === "Verified"; // revoke requires reason
  const ready = !needsReason || reason.trim().length >= 10;

  return (
    <DrawerShell
      title="Manage Access"
      subtitle={`${resident.id} • ${resident.address}, ${resident.zone}`}
      badges={<Chip className={STATUS_CHIP[resident.status]}>{resident.status}</Chip>}
      onClose={onClose}
      footer={
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {resident.status === "Verified" && (
              <>
                <button type="button" disabled={!ready} onClick={() => { onAction(resident.id, "Suspend", reason.trim()); onClose(); }} className={btnSecondary}>
                  <ShieldAlert size={12} />Suspend Account
                </button>
                <button type="button" disabled={!ready} onClick={() => { onAction(resident.id, "Revoke", reason.trim()); onClose(); }} className={btnDanger}>
                  <Ban size={12} />Revoke Access
                </button>
              </>
            )}
            {resident.status === "Suspended" && (
              <button type="button" onClick={() => { onAction(resident.id, "Restore", ""); onClose(); }} className={btnPrimary}>
                <RotateCcw size={12} />Restore Access
              </button>
            )}
            {resident.status === "Revoked" && (
              <button type="button" disabled={!ready} onClick={() => { onAction(resident.id, "Restore", reason.trim()); onClose(); }} className={btnPrimary}>
                <UserCheck size={12} />Restore Access
              </button>
            )}
            <button type="button" onClick={onClose} className={btnSecondary}>Close</button>
          </div>
          {needsReason && <p className="text-[10px] font-semibold text-amber-600">Revoking requires a documented reason (min 10 characters) for the audit record.</p>}
        </div>
      }
    >
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name={resident.name} size="h-12 w-12 text-sm" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">{resident.name}</h3>
            <p className="text-[11px] text-slate-500">{resident.id} • member since {resident.joined}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-1.5 text-[11px] text-slate-700">
          <p><span className="font-semibold text-slate-500">Verified mobile:</span> {resident.mobile}</p>
          <p><span className="font-semibold text-slate-500">Address (Zone/Block):</span> {resident.address}, {resident.zone}</p>
          <p><span className="font-semibold text-slate-500">Reports filed:</span> {resident.reports}</p>
          <p><span className="font-semibold text-slate-500">Masterlist record:</span> Matched — bound to this resident ID</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Access Controls</h3>
        <p className="mt-1.5 text-[11px] text-slate-500">Suspending temporarily blocks report filing; revoking unbinds the masterlist record and requires identity re-verification. All actions are logged to the audit trail.</p>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for restriction (required for revocation)…"
          className={`${inputCls} mt-3 resize-none leading-relaxed`}
        />
      </section>
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Drawer 2 — Identity review (side-by-side comparison)                     */
/* ------------------------------------------------------------------------ */

function VerificationDrawer({ entry, onClose, onApprove, onReject }) {
  const [reason, setReason] = useState("");
  const readyReject = reason.trim().length >= 10;

  return (
    <DrawerShell
      title="Identity Review"
      subtitle={`${entry.id} • flagged: ${entry.flag}`}
      badges={<Chip className={STATUS_CHIP[entry.status]}>{entry.status}</Chip>}
      onClose={onClose}
      footer={
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">Approving binds the masterlist record to this account. Rejections require a documented reason sent to the applicant.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!readyReject} onClick={() => { onReject(entry.id, reason.trim()); onClose(); }} className={btnDanger}>
                <UserX size={12} />Reject Verification
              </button>
              <button type="button" onClick={() => { onApprove(entry.id); onClose(); }} className={btnPrimary}>
                <UserCheck size={12} />Approve &amp; Link Account
              </button>
            </div>
          </div>
          {!readyReject && <p className="text-[10px] font-semibold text-amber-600">Rejection requires a reason (min 10 characters) — it is sent to the resident and stored on the audit record.</p>}
        </div>
      }
    >
      {/* Comparison: submitted vs masterlist */}
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <IdCard size={11} className="text-emerald-600" />User Submitted Details &amp; ID Photo
          </h3>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
              <FileImage size={20} />
            </span>
            <p className="min-w-0 text-[11px] font-semibold text-slate-700">{entry.submittedDetails.idType}</p>
          </div>
          <div className="mt-3 grid gap-1.5 text-[11px] text-slate-700">
            <p><span className="font-semibold text-slate-500">Full name:</span> {entry.submittedDetails.fullName}</p>
            <p><span className="font-semibold text-slate-500">Mobile:</span> {entry.submittedDetails.mobile}</p>
            <p><span className="font-semibold text-slate-500">Address:</span> {entry.submittedDetails.address}</p>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            <ShieldCheck size={11} />Barangay Masterlist Record
          </h3>
          <div className="mt-3 grid gap-1.5 text-[11px] text-slate-700">
            <p><span className="font-semibold text-slate-500">Record name:</span> {entry.masterlist.name}</p>
            <p><span className="font-semibold text-slate-500">Record mobile:</span> {entry.masterlist.mobile}</p>
            <p><span className="font-semibold text-slate-500">Record address:</span> {entry.masterlist.address}</p>
          </div>
          <p className="mt-3 rounded-lg bg-white px-3 py-2.5 text-[11px] font-medium text-emerald-800">
            <span className="font-bold">Matcher verdict:</span> {entry.masterlist.note}
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Rejection Reason</h3>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Submitted ID is unreadable — please re-upload a clear photo of both sides at the barangay hall…"
          className={`${inputCls} mt-2 resize-none leading-relaxed`}
        />
      </section>
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Drawer 3 — Recovery request review                                       */
/* ------------------------------------------------------------------------ */

function RecoveryDrawer({ entry, onClose, onAuthorize, onDeny }) {
  const [reason, setReason] = useState("");
  const readyDeny = reason.trim().length >= 10;

  return (
    <DrawerShell
      title="Account Recovery Review"
      subtitle={`${entry.residentId} • ${entry.id} • requested ${entry.requested}`}
      badges={<Chip className={STATUS_CHIP[entry.status]}>{entry.status}</Chip>}
      onClose={onClose}
      footer={
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">Authorization rebinds the masterlist record to the new number; the old number is released.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!readyDeny} onClick={() => { onDeny(entry.id, reason.trim()); onClose(); }} className={btnDanger}>
                <UserX size={12} />Deny
              </button>
              <button type="button" onClick={() => { onAuthorize(entry.id); onClose(); }} className={btnPrimary}>
                <UserCheck size={12} />Authorize Contact Change
              </button>
            </div>
          </div>
          {!readyDeny && <p className="text-[10px] font-semibold text-amber-600">Denying requires a documented reason (min 10 characters).</p>}
        </div>
      }
    >
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name={entry.name} size="h-12 w-12 text-sm" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">{entry.name}</h3>
            <p className="text-[11px] text-slate-500">{entry.residentId} • verified account</p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">{entry.note}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <Phone size={11} className="text-emerald-600" />Contact Change
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600">Lost / compromised</p>
            <p className="mt-0.5 text-xs font-bold text-slate-800">{entry.lostMobile}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Requested replacement</p>
            <p className="mt-0.5 text-xs font-bold text-slate-800">{entry.newMobile}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-1.5 text-[11px] text-slate-700">
          <p><span className="font-semibold text-slate-500">Alternate contact:</span> {entry.newMobile} • {entry.email}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <FileText size={11} className="text-emerald-600" />Recovery Proof
        </h3>
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <FileImage size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-800">{entry.proof.type}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{entry.proof.detail}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Denial Reason</h3>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Submitted portrait does not match the masterlist record — request in-person re-verification at the hall…"
          className={`${inputCls} mt-2 resize-none leading-relaxed`}
        />
      </section>
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------------ */
/* Main page                                                                */
/* ------------------------------------------------------------------------ */

const TABS = [
  { key: "directory", label: "Resident Directory", icon: Users },
  { key: "pending", label: "Pending Verifications", icon: IdCard },
  { key: "recovery", label: "Account Recovery", icon: KeyRound },
];

const ZONE_FILTERS = ["All Zones", "Zone 1", "Zone 2", "Zone 3", "Zone 4"];
const STATUS_FILTERS = ["All Statuses", "Verified", "Suspended", "Revoked"];

export default function Residents() {
  const [residents, setResidents] = useState(seedResidents);
  const [pending, setPending] = useState(seedPending);
  const [recovery, setRecovery] = useState(seedRecovery);
  const [tab, setTab] = useState("directory");
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("All Zones");
  const [status, setStatus] = useState("All Statuses");
  const [drawer, setDrawer] = useState(null); // { mode: "access" | "verify" | "recovery", id }

  const stats = useMemo(() => ({
    verified: residents.filter((r) => r.status === "Verified").length,
    pending: pending.filter((p) => p.status === "Pending").length,
    recovery: recovery.filter((r) => r.status === "Pending").length,
    restricted: residents.filter((r) => r.status === "Suspended" || r.status === "Revoked").length,
  }), [residents, pending, recovery]);

  const directoryRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return residents.filter((r) => (!search || `${r.name} ${r.mobile} ${r.address} ${r.id}`.toLowerCase().includes(search))
      && (zone === "All Zones" || r.zone === zone)
      && (status === "All Statuses" || r.status === status));
  }, [residents, query, zone, status]);

  const pendingRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return pending.filter((p) => !search || `${p.name} ${p.flag} ${p.mobile} ${p.id}`.toLowerCase().includes(search));
  }, [pending, query]);

  const recoveryRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return recovery.filter((r) => !search || `${r.name} ${r.lostMobile} ${r.newMobile} ${r.id}`.toLowerCase().includes(search));
  }, [recovery, query]);

  const accessTarget = drawer?.mode === "access" ? residents.find((r) => r.id === drawer.id) : null;
  const verifyTarget = drawer?.mode === "verify" ? pending.find((p) => p.id === drawer.id) : null;
  const recoveryTarget = drawer?.mode === "recovery" ? recovery.find((r) => r.id === drawer.id) : null;

  const tabCounts = {
    directory: directoryRows.length,
    pending: pending.filter((p) => p.status === "Pending").length,
    recovery: recovery.filter((r) => r.status === "Pending").length,
  };

  /* — access management (tab 1) — */
  function manageAccess(id, action, reason) {
    const statusMap = { Suspend: "Suspended", Revoke: "Revoked", Restore: "Verified" };
    const resident = residents.find((r) => r.id === id);
    setResidents((cur) => cur.map((r) => r.id === id ? { ...r, status: statusMap[action] } : r));
    toast.add({
      type: action === "Restore" ? "success" : "info",
      title: `${resident.name} — ${action.toLowerCase()}d`,
      description: action === "Revoke"
        ? `Masterlist binding released. Reason: ${reason}`
        : action === "Suspend"
          ? "Report filing blocked until restored."
          : "Account restored to full verified access.",
    });
  }

  /* — verification review (tab 2) — */
  function approveVerification(id) {
    const entry = pending.find((p) => p.id === id);
    setPending((cur) => cur.map((p) => p.id === id ? { ...p, status: "Approved" } : p));
    setResidents((cur) => [{
      id: `RSD-${String(260 + residents.length).padStart(4, "0")}`,
      name: entry.name, mobile: entry.mobile, address: entry.address, zone: entry.zone,
      reports: 0, status: "Verified", joined: "April 2026",
    }, ...cur]);
    toast.add({ type: "success", title: "Account approved", description: `${entry.name} linked to the masterlist and added to the directory.` });
  }

  function rejectVerification(id, reason) {
    const entry = pending.find((p) => p.id === id);
    setPending((cur) => cur.map((p) => p.id === id ? { ...p, status: "Rejected" } : p));
    toast.add({ type: "info", title: "Verification rejected", description: `${entry.name} notified — reason: ${reason}` });
  }

  /* — recovery review (tab 3) — */
  function authorizeRecovery(id) {
    const entry = recovery.find((r) => r.id === id);
    setRecovery((cur) => cur.map((r) => r.id === id ? { ...r, status: "Approved" } : r));
    setResidents((cur) => cur.map((r) => r.id === entry.residentId ? { ...r, mobile: entry.newMobile } : r));
    toast.add({ type: "success", title: "Contact change authorized", description: `${entry.name}'s account rebound to ${entry.newMobile}.` });
  }

  function denyRecovery(id, reason) {
    const entry = recovery.find((r) => r.id === id);
    setRecovery((cur) => cur.map((r) => r.id === id ? { ...r, status: "Denied" } : r));
    toast.add({ type: "info", title: "Recovery denied", description: `${entry.name} notified — reason: ${reason}` });
  }

  return (
    <div className="space-y-4">
      {/* 1 — Header + KPI banner */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white"><Users size={16} /></span>
            Residents — Identity &amp; Access Management
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">Verified masterlist, manual identity review, and mobile-number recovery for Barangay 167.</p>
        </div>
        <button type="button" onClick={() => toast.add({ type: "success", title: "Export ready", description: "Resident directory CSV generated (privacy-safe columns only)." })} className={btnSecondary}>
          <Download size={12} />Export Directory
        </button>
      </section>

      <section aria-label="Residents KPI summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Verified" value={stats.verified} icon={UserCheck} hint="active masterlist accounts" />
        <KpiCard label="Pending Verification" value={stats.pending} icon={IdCard} tone="amber" hint="requires admin action" />
        <KpiCard label="Recovery Requests" value={stats.recovery} icon={ShieldAlert} tone="rose" hint="lost number / device" />
        <KpiCard label="Revoked / Suspended" value={stats.restricted} icon={UserX} tone="slate" hint="restricted accounts" />
      </section>

      {/* 2 — Tabbed workspace */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div role="tablist" aria-label="Identity management workspaces" className="flex flex-wrap gap-1 border-b border-slate-200 px-3">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const alerting = (key === "pending" || key === "recovery") && tabCounts[key] > 0;
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
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${alerting ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                  {tabCounts[key]}
                </span>
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-4 [animation:gf-fade-in_0.2s_ease-out]">
          {/* Shared search + filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20">
              <Search size={13} />
              <input
                aria-label="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === "directory" ? "Search name, address, or mobile…" : tab === "pending" ? "Search submitted names or flag reasons…" : "Search residents or numbers…"}
                className="w-full text-xs text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>
            {tab === "directory" && (
              <>
                <select aria-label="Filter zone" value={zone} onChange={(e) => setZone(e.target.value)} className={`${inputCls} h-9 w-auto min-w-[110px]`}>
                  {ZONE_FILTERS.map((option) => <option key={option}>{option}</option>)}
                </select>
                <select aria-label="Filter account status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} h-9 w-auto min-w-[130px]`}>
                  {STATUS_FILTERS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </>
            )}
          </div>

          {tab === "directory" && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <DirectoryTable rows={directoryRows} onManage={(id) => setDrawer({ mode: "access", id })} />
            </div>
          )}

          {tab === "pending" && (
            <>
              <p className="mb-2 text-[11px] font-medium text-slate-500">Failed automatic ID matching or duplicate data — review side-by-side against the barangay masterlist before linking.</p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <PendingTable rows={pendingRows} onReview={(id) => setDrawer({ mode: "verify", id })} />
              </div>
            </>
          )}

          {tab === "recovery" && (
            <>
              <p className="mb-2 text-[11px] font-medium text-slate-500">Lost verified mobile numbers — confirm alternate contact and recovery proof before rebinding the account.</p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <RecoveryTable rows={recoveryRows} onReview={(id) => setDrawer({ mode: "recovery", id })} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Slide-over drawers */}
      {accessTarget && (
        <AccessDrawer
          key={accessTarget.id}
          resident={accessTarget}
          onClose={() => setDrawer(null)}
          onAction={manageAccess}
        />
      )}
      {verifyTarget && (
        <VerificationDrawer
          key={verifyTarget.id}
          entry={verifyTarget}
          onClose={() => setDrawer(null)}
          onApprove={approveVerification}
          onReject={rejectVerification}
        />
      )}
      {recoveryTarget && (
        <RecoveryDrawer
          key={recoveryTarget.id}
          entry={recoveryTarget}
          onClose={() => setDrawer(null)}
          onAuthorize={authorizeRecovery}
          onDeny={denyRecovery}
        />
      )}
    </div>
  );
}
