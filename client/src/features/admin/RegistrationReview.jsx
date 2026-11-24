import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle, CheckCircle2, ChevronRight, Download, IdCard,
  Mail, RefreshCw, RotateCcw, Search, ShieldCheck, UserCheck,
  UserRoundX, Users, X,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";

const api = axios.create({ baseURL: "/api/admin/registrations", withCredentials: true });

const statusMeta = {
  PENDING: { label: "Pending review", chip: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  NEEDS_CORRECTION: { label: "Needs correction", chip: "bg-orange-50 text-orange-700 border-orange-200", icon: RotateCcw },
  APPROVED: { label: "Approved", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", chip: "bg-rose-50 text-rose-700 border-rose-200", icon: UserRoundX },
};

const btnSecondary = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
const btnDanger = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return String(value);
  }
}

function initials(request) {
  return `${String(request?.first_name || "")[0] || ""}${String(request?.last_name || "")[0] || ""}`.toUpperCase();
}

function StatusChip({ status }) {
  const meta = statusMeta[String(status || "PENDING")] || statusMeta.PENDING;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.chip}`}>
      <Icon size={12} />{meta.label}
    </span>
  );
}

function normalizeRequests(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && typeof row === "object").map((row) => ({
    ...row,
    request_id: String(row.request_id || "UNKNOWN-REQUEST"),
    first_name: String(row.first_name || "Unknown"),
    last_name: String(row.last_name || "Applicant"),
    email: String(row.email || "No email"),
    mobile_number: String(row.mobile_number || ""),
    status: statusMeta[row.status] ? row.status : "PENDING",
    email_status: String(row.email_status || ""),
    review_reason: String(row.review_reason || ""),
  }));
}

function Metric({ label, value, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    orange: "bg-orange-50 text-orange-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={19} /></span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-extrabold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function ReviewDrawer({ request, onClose, onDecision, busy }) {
  const [decision, setDecision] = useState("NEEDS_CORRECTION");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(true);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const reasonRequired = decision !== "APPROVED";
  const ready = !reasonRequired || reason.trim().length >= 10;

  return (
    <>
      <button type="button" aria-label="Close registration review" onClick={onClose} className="fixed inset-0 z-[80] cursor-default border-0 bg-slate-950/35 backdrop-blur-[2px]" />
      <aside role="dialog" aria-modal="true" aria-label={`Review ${request.first_name} ${request.last_name}`} className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl [animation:gf-drawer-in_0.22s_ease-out] sm:w-[48%] sm:min-w-[680px] sm:max-w-[820px]">
        <header className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-emerald-700">Identity Registration Review</h2>
              <StatusChip status={request.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{request.request_id} · Submitted {formatDate(request.submitted_at)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 transition hover:bg-white hover:text-emerald-700"><X size={17} /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{initials(request)}</span>
              <div>
                <h3 className="text-base font-bold text-slate-800">{request.first_name} {request.last_name}</h3>
                <p className="text-xs text-slate-500">Resident registration applicant</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3"><dt className="font-bold text-slate-400">Email address</dt><dd className="mt-1 break-all font-semibold text-slate-700">{request.email}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="font-bold text-slate-400">Mobile number</dt><dd className="mt-1 font-semibold text-slate-700">{request.mobile_number || "Not provided"}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="font-bold text-slate-400">Date of birth</dt><dd className="mt-1 font-semibold text-slate-700">{request.date_of_birth || "Not provided"}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="font-bold text-slate-400">Notification status</dt><dd className="mt-1 font-semibold text-slate-700">{request.email_status || "Not recorded"}</dd></div>
            </dl>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Residency identification</h3>
                <p className="text-xs text-slate-500">{request.document_uploaded_at ? "Document submitted by applicant" : "No document uploaded"}</p>
              </div>
              {request.document_uploaded_at && request.request_id.startsWith("REG-MOCK-") === false && (
                <a href={`/api/admin/registrations/${request.request_id}/document`} target="_blank" rel="noreferrer" className={btnSecondary}><Download size={13} />Open original</a>
              )}
            </div>
            {request.document_uploaded_at ? (
              <div className="p-4">
                <button type="button" onClick={() => setPreview((value) => !value)} className="mb-3 text-xs font-bold text-emerald-700 hover:text-emerald-800">{preview ? "Hide document preview" : "Show document preview"}</button>
                {preview && (
                  <div className="relative mx-auto flex aspect-[1.58/1] max-w-xl items-center justify-center overflow-hidden rounded-lg border-2 border-slate-200 bg-slate-100">
                    <div className="absolute inset-4 rounded-md border border-slate-300 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><ShieldCheck size={20} /></span>
                        <div><p className="text-sm font-bold text-slate-700">Barangay 167</p><p className="text-[10px] text-slate-400">Resident identification document</p></div>
                      </div>
                      <div className="mt-4 grid grid-cols-[74px_1fr] gap-3">
                        <span className="flex h-24 items-center justify-center rounded-md bg-slate-200 text-xs font-bold text-slate-400">PHOTO</span>
                        <div className="space-y-2 text-[11px] text-slate-500"><p className="h-3 w-36 rounded bg-slate-200" /><p className="h-3 w-28 rounded bg-slate-200" /><p className="h-3 w-44 rounded bg-slate-200" /></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center p-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600"><IdCard size={22} /></span>
                <p className="mt-3 text-sm font-bold text-slate-700">Document still required</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">The applicant cannot be approved until an identification document is uploaded and reviewed.</p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-700">Review decision</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                ["NEEDS_CORRECTION", "Request correction", RotateCcw],
                ["APPROVED", "Approve account", UserCheck],
                ["REJECTED", "Reject registration", UserRoundX],
              ].map(([value, label, Icon]) => (
                <button key={value} type="button" onClick={() => setDecision(value)} className={`flex items-center gap-2 rounded-lg border p-3 text-left text-xs font-bold transition ${decision === value ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600/10" : "border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-slate-50"}`}>
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-bold text-slate-600">
              {decision === "APPROVED" ? "Approval note (optional)" : "Reason sent to applicant"}
              <textarea
                rows={4}
                maxLength={500}
                required={reasonRequired}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={decision === "APPROVED" ? "Optional note for the audit record…" : "Explain what needs to be corrected or why this registration is rejected…"}
                className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
              />
            </label>
            {reasonRequired && <p className={`mt-1.5 text-[11px] ${ready ? "text-emerald-600" : "text-slate-400"}`}>Minimum 10 characters required.</p>}
          </section>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
            {decision === "REJECTED" && <button type="button" disabled={busy || !ready} onClick={() => onDecision(decision, reason.trim())} className={btnDanger}><UserRoundX size={13} />Reject registration</button>}
            {decision === "NEEDS_CORRECTION" && <button type="button" disabled={busy || !ready} onClick={() => onDecision(decision, reason.trim())} className={btnPrimary}><RotateCcw size={13} />Request correction</button>}
            {decision === "APPROVED" && <button type="button" disabled={busy} onClick={() => onDecision(decision, reason.trim())} className={btnPrimary}><UserCheck size={13} />Approve & verify</button>}
          </div>
        </footer>
      </aside>
    </>
  );
}

export default function RegistrationReview() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/");
      setRequests(normalizeRequests(data.requests));
    } catch (loadError) {
      setRequests([]);
      setError(loadError.response?.data?.error || "Unable to load registration requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.get("/").then(({ data }) => {
      if (active) {
        setRequests(normalizeRequests(data.requests));
      }
    }).catch((loadError) => {
      if (active) {
        setRequests([]);
        setError(loadError?.response?.data?.error || "Unable to load registration requests.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const perform = async (operation, successMessage) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      await load();
      if (successMessage) toast.add({ type: "success", title: "Registration updated", description: successMessage });
    } catch (err) {
      setError(err.response?.data?.error || "Could not complete the registration action.");
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (request, decision, reason) => {
    if (request.request_id.startsWith("REG-MOCK-")) {
      setRequests((current) => current.map((item) => item.request_id === request.request_id ? { ...item, status: decision, review_reason: reason } : item));
      setSelected(null);
      toast.add({ type: "success", title: "Registration updated", description: `${request.first_name} ${request.last_name} was marked ${statusMeta[decision].label.toLowerCase()}.` });
      return;
    }
    await perform(
      () => api.post(`/${request.request_id}/review`, { decision, reason }),
      `${request.first_name} ${request.last_name} was notified of the decision.`,
    );
    setSelected(null);
  };

  const counts = useMemo(() => ({
    all: requests.length,
    PENDING: requests.filter((request) => request.status === "PENDING").length,
    NEEDS_CORRECTION: requests.filter((request) => request.status === "NEEDS_CORRECTION").length,
    APPROVED: requests.filter((request) => request.status === "APPROVED").length,
    REJECTED: requests.filter((request) => request.status === "REJECTED").length,
  }), [requests]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "All" || request.status === statusFilter;
      const matchesQuery = !normalized || [request.first_name, request.last_name, request.email, request.mobile_number, request.request_id]
        .some((value) => String(value || "").toLowerCase().includes(normalized));
      return matchesStatus && matchesQuery;
    });
  }, [requests, query, statusFilter]);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><ShieldCheck size={18} /></span>
            <h1 className="text-xl font-bold text-slate-800">Registration Review</h1>
          </div>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">Review applicant identity details, residency documents, and email verification before activating resident accounts.</p>
        </div>
        <button type="button" onClick={() => perform(load, "Registration requests refreshed.")} disabled={busy || loading} className={btnSecondary}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="All requests" value={counts.all} icon={Users} />
        <Metric label="Pending review" value={counts.PENDING} icon={AlertTriangle} tone="amber" />
        <Metric label="Needs correction" value={counts.NEEDS_CORRECTION} icon={RotateCcw} tone="orange" />
        <Metric label="Approved" value={counts.APPROVED} icon={CheckCircle2} />
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800"><AlertTriangle size={15} />{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 p-1">
            {[["All", "All"], ["PENDING", "Pending"], ["NEEDS_CORRECTION", "Corrections"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"]].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition ${statusFilter === value ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}>
                {label} <span className={statusFilter === value ? "text-emerald-100" : "text-slate-400"}>{value === "All" ? counts.all : counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400 transition focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/10 sm:max-w-sm">
            <Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or request ID" className="w-full text-xs text-slate-700 outline-none placeholder:text-slate-400" />
          </label>
        </div>

        {loading ? (
          <div role="status" className="py-16 text-center text-sm font-semibold text-slate-400">Loading registration requests…</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {["Applicant", "Contact", "Submitted", "Status", "Email", "Action"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((request) => (
                  <tr key={request.request_id} className="group border-b border-slate-100 text-xs transition last:border-b-0 hover:bg-emerald-50/40">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">{initials(request)}</span>
                        <div><p className="font-bold text-slate-800">{request.first_name} {request.last_name}</p><p className="mt-0.5 text-[10px] text-slate-400">{request.request_id}</p></div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600"><p className="font-semibold">{request.mobile_number || "No mobile"}</p><p className="mt-1 max-w-[180px] truncate text-[10px] text-slate-400">{request.email}</p></td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(request.submitted_at)}</td>
                    <td className="px-3 py-3"><StatusChip status={request.status} />{request.review_reason && <p className="mt-1 max-w-[220px] truncate text-[10px] text-slate-400" title={request.review_reason}>{request.review_reason}</p>}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} className={request.email_status === "FAILED" ? "text-rose-500" : "text-emerald-600"} />
                        <span className="font-semibold text-slate-600">{request.email_status || "Not recorded"}</span>
                      </div>
                      {["FAILED", "PENDING"].includes(request.email_status) && !request.request_id.startsWith("REG-MOCK-") && (
                        <button type="button" disabled={busy} onClick={() => perform(() => api.post(`/${request.request_id}/retry-email`), "Email delivery was retried.")} className="mt-1 text-[10px] font-bold text-emerald-700 hover:underline">Retry email</button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => setSelected(request)} className={btnSecondary}>Review<ChevronRight size={13} /></button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={6} className="px-4 py-16 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Search size={20} /></span>
                    <p className="mt-3 text-sm font-bold text-slate-600">No matching registration requests</p>
                    <p className="mt-1 text-xs text-slate-400">Try changing the status filter or search terms.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <ReviewDrawer request={selected} busy={busy} onClose={() => setSelected(null)} onDecision={(decision, reason) => handleDecision(selected, decision, reason)} />}
    </section>
  );
}
