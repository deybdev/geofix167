import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, MapPin, Radio, RefreshCw, ShieldCheck, Truck, X } from "lucide-react";
import MapViewer from "../../shared/components/MapViewer";
import { toast } from "../../shared/components/ui/toast";

async function request(path, options = {}) {
  const response = await fetch(`/api/admin/dispatch${path}`, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

const card = "rounded-xl border border-slate-200 bg-white shadow-sm";

export default function AdminDispatch() {
  const [reports, setReports] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [helpNote, setHelpNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reportData, unitData] = await Promise.all([request("/reports"), request("/units")]);
      setReports(reportData.reports || []);
      setUnits(unitData.units || []);
      setSelectedId((current) => reportData.reports?.some((report) => report.id === current) ? current : reportData.reports?.[0]?.id || "");
      setSelectedUnit((current) => unitData.units?.some((unit) => unit.id === current && unit.availability_status === "AVAILABLE")
        ? current
        : unitData.units?.find((unit) => unit.availability_status === "AVAILABLE")?.id || "");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const selectedReport = reports.find((report) => report.id === selectedId) || null;
  const availableUnits = useMemo(() => units.filter((unit) => unit.availability_status === "AVAILABLE"), [units]);
  const allDeployed = units.length > 0 && availableUnits.length === 0;
  const photo = useMemo(() => {
    if (!selectedReport?.photo) return null;
    if (typeof selectedReport.photo === "object") return selectedReport.photo;
    try { return JSON.parse(selectedReport.photo); } catch { return null; }
  }, [selectedReport]);
  const hasCoordinates = selectedReport?.latitude != null && selectedReport?.longitude != null
    && Number.isFinite(Number(selectedReport.latitude)) && Number.isFinite(Number(selectedReport.longitude));
  const reviewStatus = String(selectedReport?.status_code || "").toUpperCase();
  const canReview = ["SUBMITTED", "UNDER_REVIEW"].includes(reviewStatus);
  const isVerified = reviewStatus === "VERIFIED";

  async function performAction(path, body, successMessage) {
    setBusy(true);
    try {
      await request(path, { method: "POST", body: JSON.stringify(body) });
      toast.add({ title: successMessage, type: "success" });
      setRejectReason("");
      setHelpNote("");
      await refresh();
    } catch (actionError) {
      toast.add({ title: "Action failed", description: actionError.message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#2e8b57]">Operations center</p><h2 className="mt-1 text-xl font-bold text-slate-900">Incoming Reports &amp; Dispatch</h2><p className="mt-1 text-xs text-slate-500">Verify new reports, then assign an available responder.</p></div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
      </div>

      {allDeployed && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"><span className="flex items-center gap-2"><AlertTriangle size={18} />All units are deployed.</span><span className="text-xs font-medium">Request City Hall DRRMO support for the selected report.</span></div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? <div className={`${card} flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500`}><LoaderCircle size={18} className="animate-spin" />Loading dispatch data…</div> : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-bold text-slate-800">Pending / verified reports</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">{reports.length} awaiting action</span></div>
            {reports.length === 0 ? <div className="px-5 py-12 text-center"><ShieldCheck size={28} className="mx-auto text-emerald-600" /><p className="mt-3 text-sm font-semibold text-slate-700">No reports need dispatch</p><p className="mt-1 text-xs text-slate-500">New reports will appear here when submitted.</p></div> : <div className="divide-y divide-slate-100">
              {reports.map((report) => <button key={report.id} type="button" onClick={() => setSelectedId(report.id)} className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${selectedId === report.id ? "bg-emerald-50/70" : ""}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{report.title || report.category || "Incident report"}</p><p className="mt-1 line-clamp-2 text-xs text-slate-600">{report.description || report.description_original}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${report.status_code === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{report.status}</span></div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500"><span>{report.reporter}</span><span>{report.location || (report.latitude != null ? `${report.latitude}, ${report.longitude}` : "Location not provided")}</span><span>{report.submitted_at ? new Date(report.submitted_at).toLocaleString() : "Time unavailable"}</span></div>
              </button>)}
            </div>}
          </section>

          <div className="space-y-4">
            <section className={`${card} p-4`}>
              <h3 className="text-sm font-bold text-slate-800">Report review</h3>
              {!selectedReport ? <p className="py-8 text-center text-xs text-slate-500">Select a report to review its details.</p> : <>
                <div className="mt-3 space-y-2 text-xs"><p className="font-semibold text-slate-700">{selectedReport.description || selectedReport.description_original || "No description provided."}</p><p className="text-slate-500">Reporter: {selectedReport.reporter}</p><p className="flex items-start gap-1 text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0" />{selectedReport.location || "Location not provided"}{selectedReport.latitude != null && ` · ${selectedReport.latitude}, ${selectedReport.longitude}`}</p></div>
                {hasCoordinates && <div className="mt-3 h-52 overflow-hidden rounded-lg border border-slate-200"><MapViewer compact showBackButton={false} incidents={[{ id: selectedReport.id, title: selectedReport.title, category: selectedReport.category, status: selectedReport.status, lat: Number(selectedReport.latitude), lng: Number(selectedReport.longitude) }]} selectedIncident={{ id: selectedReport.id, lat: Number(selectedReport.latitude), lng: Number(selectedReport.longitude) }} /></div>}
                {photo && <div className="mt-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Attached photo</p><img alt="Report evidence" className="max-h-48 w-full rounded-lg border border-slate-200 object-contain" src={`/api/admin/dispatch/reports/${encodeURIComponent(selectedReport.id)}/photos/${encodeURIComponent(photo.media_id)}`} /></div>}
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  <button type="button" disabled={busy || !canReview} onClick={() => performAction(`/reports/${encodeURIComponent(selectedReport.id)}/verify`, { decision: "VERIFIED" }, "Report approved and marked reviewed")} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:text-emerald-800"><Check size={16} /> {isVerified ? "Approved · Reviewed" : "Approve / Mark Reviewed"}</button>
                  {canReview && <><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reason for rejecting as invalid" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-red-400" /><button type="button" disabled={busy || !rejectReason.trim()} onClick={() => performAction(`/reports/${encodeURIComponent(selectedReport.id)}/verify`, { decision: "REJECTED", reason: rejectReason }, "Report rejected")} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"><X size={14} /> Reject as invalid</button></>}
                </div>
              </>}
            </section>

            <section className={`${card} p-4`}>
              <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Truck size={16} /> Responders / mobile units</h3><span className="text-[10px] text-slate-500">{availableUnits.length} available</span></div>
              <div className="mt-3 space-y-2">{units.length === 0 ? <p className="text-xs text-slate-500">No responder units are registered.</p> : units.map((unit) => <label key={unit.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${unit.availability_status === "AVAILABLE" ? "cursor-pointer border-slate-200 hover:border-emerald-300" : "border-slate-100 bg-slate-50 opacity-70"}`}><input type="radio" name="dispatch-unit" value={unit.id} checked={selectedUnit === unit.id} disabled={unit.availability_status !== "AVAILABLE"} onChange={() => setSelectedUnit(unit.id)} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{unit.display_name}</span><span className="text-[10px] text-slate-500">{unit.responder_name || unit.mobile_number || unit.resource_type}</span></span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${unit.availability_status === "AVAILABLE" ? "bg-emerald-100 text-emerald-800" : unit.availability_status === "BUSY" ? "bg-orange-100 text-orange-800" : "bg-slate-200 text-slate-600"}`}>{unit.availability_status === "AVAILABLE" ? "Available" : unit.availability_status === "BUSY" ? "Deployed" : "Offline"}</span></label>)}</div>
              <button type="button" disabled={busy || !selectedReport || !isVerified || !selectedUnit || availableUnits.length === 0} onClick={() => performAction(`/reports/${encodeURIComponent(selectedReport.id)}/dispatch`, { unit_id: selectedUnit }, "Responder dispatched")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2e8b57] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#26764a] disabled:cursor-not-allowed disabled:opacity-50"><Radio size={14} /> Dispatch responder</button>
              {allDeployed && selectedReport && <div className="mt-4 border-t border-slate-100 pt-3"><label className="mb-2 block text-[10px] font-semibold text-slate-600">Optional note for City Hall DRRMO</label><textarea value={helpNote} onChange={(event) => setHelpNote(event.target.value)} rows={2} placeholder="All local response units are deployed." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-500" /><button type="button" disabled={busy || !["SUBMITTED", "UNDER_REVIEW", "VERIFIED"].includes(selectedReport.status_code)} onClick={() => performAction(`/reports/${encodeURIComponent(selectedReport.id)}/request-drrmo`, { note: helpNote }, "City Hall DRRMO support requested")} className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50">Request help from City Hall DRRMO</button></div>}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
