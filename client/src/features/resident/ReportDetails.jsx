import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, FileText, MapPin } from "lucide-react";
import { Button } from "../../shared/components/ui/button";
import { PATHS } from "../../router/paths";
import { getReportDetails, updateReportDetails } from "../../services/residentService";

function formatTime(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }) : "Time unavailable";
}

export default function ReportDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reportId = id || location.state?.report?.public_id || location.state?.report?.incident_id;
  useEffect(() => {
    if (!id && reportId) navigate(`${PATHS.reportDetails}/${encodeURIComponent(reportId)}`, { replace: true });
  }, [id, reportId, navigate]);
  return <ReportDetailsView key={reportId || "missing"} id={reportId} />;
}

function ReportDetailsView({ id }) {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(id ? "" : "No report ID was provided. Select a report from My Reports.");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!id) {
      return () => controller.abort();
    }
    getReportDetails(id, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setReport(data.report); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message || "Could not load this report."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, reload]);

  const editable = report && !report.is_terminal && [1, 2, 3].includes(report.status_id);

  function refresh() {
    setLoading(true);
    setError("");
    setReload(value => value + 1);
  }

  function startEditing() {
    setDescription(report.description);
    setAddress(report.address);
    setEditError("");
    setNotice("");
    setEditing(true);
  }

  async function saveDetails(event) {
    event.preventDefault();
    if (!editable || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setEditError("");
    try {
      const { data } = await updateReportDetails(id, {
        description_sanitized: description.trim(), location_description: address.trim(),
      });
      // PATCH returns the report, while GET also returns its event history.
      setReport(previous => ({ ...data.report, status_events: previous.status_events }));
      setEditing(false);
      setNotice("Report details saved.");
      try {
        const fresh = await getReportDetails(id);
        setReport(fresh.data.report);
      } catch {
        setNotice("Report details saved. Refresh to load the latest status history.");
      }
    } catch (error) {
      setEditError(error.message || "Unable to save your changes. Please try again.");
      // Keep the draft visible, but refresh eligibility after a rejected edit.
      if ([403, 409].includes(error.status)) {
        try {
          const fresh = await getReportDetails(id);
          setReport(fresh.data.report);
        } catch { /* Keep the backend error and the resident's draft. */ }
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-5 text-sm text-slate-700">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(PATHS.myReports)} aria-label="Back to my reports"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-primary hover:text-primary">
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Report Details</h1>
        <button type="button" disabled={loading || saving || editing || !id} onClick={refresh}
          className="ml-auto text-xs font-semibold text-primary disabled:opacity-50">Refresh</button>
      </div>

      {loading && <div role="status" className="mt-4 rounded-xl bg-slate-100 p-6 text-center">Loading report…</div>}
      {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-600">
        <FileText size={24} className="mb-2" />
        <p>{error}</p>
        {id && <button type="button" onClick={refresh} className="mt-2 font-semibold underline">Try again</button>}
      </div>}

      {!loading && !error && report && <>
        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <MapPin size={13} className="text-emerald-600" />
            </span>
            <p className="text-sm font-bold text-slate-900">{report.title || report.category}</p>
            <span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold ${
              report.status === "resolved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>{report.status_label}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-4 text-slate-500">{report.description || "No description provided."}</p>
          <p className="mt-1.5 break-words text-xs leading-4 text-slate-500">{report.address || "Location not provided"}</p>
          {Number.isFinite(report.latitude) && Number.isFinite(report.longitude) &&
            <p className="mt-1 text-xs text-slate-500">{report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</p>}
          <p className="mt-1 text-xs text-slate-500">Priority: {report.urgency}</p>
          <p className="mt-1 break-all font-mono text-[10px] font-semibold tracking-wide text-slate-400">Report #{report.reference_number}</p>
          <p className="mt-1 text-xs text-slate-400">Submitted: {formatTime(report.created_at)}</p>
        </div>

        {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>}
        {editable && !editing && <Button type="button" variant="outline" onClick={startEditing}
          className="mt-4 h-11 w-full rounded-xl text-sm font-semibold">Edit Details</Button>}
        {!editable && <p className="mt-3 text-xs text-slate-500">Details can only be edited before verification or dispatch.</p>}
        {editing && <form onSubmit={saveDetails} className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-4">
          <label className="block text-xs font-semibold">Description
            <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={10000}
              disabled={saving || !editable} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block text-xs font-semibold">Location / landmark
            <textarea value={address} onChange={event => setAddress(event.target.value)} maxLength={4000}
              disabled={saving || !editable} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          {editError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{editError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)} className="h-11 flex-1 rounded-lg">Cancel</Button>
            <Button type="submit" disabled={saving || !editable} className="h-11 flex-1 rounded-lg">{saving ? "Saving…" : "Save Changes"}</Button>
          </div>
        </form>}

        <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">Status history</p>
        {report.status_events.length === 0 ? <p className="mb-4 text-xs text-slate-500">No status history is available yet.</p> :
          <ol className="mb-4 space-y-4 border-l-2 border-slate-200 pl-4">
            {report.status_events.map(event => <li key={event.id} className="relative rounded-xl border border-slate-100 bg-white p-3">
              <span className="absolute -left-[23px] top-4 size-3 rounded-full bg-primary ring-4 ring-white" />
              <p className="text-sm font-semibold text-slate-900">{event.label}</p>
              <time dateTime={event.created_at || undefined} className="text-[11px] text-slate-400">{formatTime(event.created_at)}</time>
              {event.note && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">{event.note}</p>}
            </li>)}
          </ol>}
      </>}
      <Button type="button" onClick={() => navigate(PATHS.myReports)} variant="outline"
        className="mt-2 h-11 w-full rounded-xl text-sm font-semibold">Back to My Reports</Button>
    </section>
  );
}
