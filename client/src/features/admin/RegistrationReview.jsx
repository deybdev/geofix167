import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "../../shared/components/ui/button";

const api = axios.create({ baseURL: "/api/admin/registrations", withCredentials: true });

export default function RegistrationReview() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("NEEDS_CORRECTION");
  const [reason, setReason] = useState("");
  const load = async () => setRequests((await api.get("/")).data.requests);
  useEffect(() => {
    let active = true;
    api.get("/").then(({ data }) => { if (active) setRequests(data.requests); }).catch(() => { if (active) setError("Unable to load registrations."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const perform = async operation => {
    setBusy(true); setError("");
    try { await operation(); await load(); }
    catch (err) { setError(err.response?.data?.error || "Could not complete the request."); }
    finally { setBusy(false); }
  };
  return <section className="space-y-5">
    <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-primary">Registration verification</h2><Button variant="outline" disabled={busy} onClick={() => perform(load)}>Refresh</Button></div>
    <p className="text-sm text-slate-600">Review resident applications and their private ID documents. Decisions are emailed to the verified applicant.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {loading ? <p role="status">Loading…</p> : requests.length === 0 ? <p>No registration requests yet.</p> : <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50">{["Applicant", "Contact", "Status", "Email", "Actions"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{requests.map(r => <tr key={r.request_id} className="border-b align-top">
          <td className="p-3"><strong>{r.first_name} {r.last_name}</strong><p>Birth date: {r.date_of_birth}</p><p className="text-xs text-slate-500">{r.submitted_at}</p></td>
          <td className="p-3">{r.email}<p>{r.mobile_number}</p></td>
          <td className="p-3">{r.status.replaceAll("_", " ")}<p className="max-w-xs text-xs text-slate-500">{r.review_reason}</p></td>
          <td className="p-3">{r.email_status || "—"}{["FAILED", "PENDING"].includes(r.email_status) && <Button variant="outline" disabled={busy} onClick={() => perform(() => api.post(`/${r.request_id}/retry-email`))}>Retry email</Button>}</td>
          <td className="space-y-2 p-3">{r.document_uploaded_at && <a className="block font-semibold text-primary underline" href={`/api/admin/registrations/${r.request_id}/document`}>Download ID</a>}
            {r.status === "PENDING" && r.document_uploaded_at && <Button disabled={busy} onClick={() => { setSelected(r); setReason(""); setDecision("NEEDS_CORRECTION"); }}>Review</Button>}
          </td>
        </tr>)}</tbody></table>
    </div>}
    {selected && <form className="space-y-3 rounded-xl border bg-white p-5" onSubmit={e => { e.preventDefault(); perform(async () => { await api.post(`/${selected.request_id}/review`, { decision, reason }); setSelected(null); }); }}>
      <h3 className="font-semibold">Review: {selected.first_name} {selected.last_name}</h3>
      <label className="block">Decision<select className="ml-3 rounded border p-2" value={decision} onChange={e => setDecision(e.target.value)}><option value="NEEDS_CORRECTION">Request correction</option><option value="APPROVED">Approve</option><option value="REJECTED">Reject</option></select></label>
      <label className="block">Message to applicant<textarea className="mt-2 block w-full rounded border p-2" maxLength={500} required={decision !== "APPROVED"} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <p className="text-xs text-slate-500">Approval activates this verified-email account. Corrections and rejection keep it unverified.</p>
      <div className="flex gap-2"><Button disabled={busy} type="submit">Save decision and notify</Button><Button variant="outline" type="button" onClick={() => setSelected(null)}>Cancel</Button></div>
    </form>}
  </section>;
}
