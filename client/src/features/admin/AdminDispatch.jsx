import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Clock3, Eye, Image as ImageIcon,
  LoaderCircle, MapPin, Radio, RefreshCw, ShieldCheck, Truck, X,
} from "lucide-react";
import MapViewer from "../../shared/components/MapViewer";
import { isInside } from "../../shared/utils/mapUtils";
import { toast } from "../../shared/components/ui/toast";
import AccessibleDropdown from "../../shared/components/AccessibleDropdown";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "../../shared/components/ui/alert-dialog";

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

const card = "rounded-xl border border-slate-200 bg-white";
const urgencyLabel = (report) => {
  const priority = String(report.priority_code ?? "").toUpperCase();
  if (priority === "P1" || priority === "P2") return "High";
  if (priority === "P3") return "Medium";
  if (priority === "P4") return "Low";
  return report.is_emergency ? "High" : "Medium";
};
const urgencyRank = { High: 0, Medium: 1, Low: 2 };
const urgencyClasses = {
  High: "border-red-200 bg-red-50 text-red-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-800",
  Low: "border-slate-200 bg-slate-50 text-slate-600",
};
function relativeTime(value) {
  if (!value) return "Time unavailable";
  const milliseconds = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) return "Time unavailable";
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
function photoUrl(reportId, mediaId) {
  return `/api/admin/dispatch/reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(mediaId)}`;
}

export default function AdminDispatch() {
  const [reports, setReports] = useState([]);
  const [units, setUnits] = useState([]);
  const [barangayBoundary, setBarangayBoundary] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [mapFocusedIncident, setMapFocusedIncident] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [helpNote, setHelpNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reportData, unitData] = await Promise.all([request("/reports"), request("/units")]);
      const nextReports = reportData.reports || [];
      const nextUnits = unitData.units || [];
      setReports(nextReports);
      setUnits(nextUnits);
      setSelectedId((current) => nextReports.some((report) => report.id === current) ? current : nextReports[0]?.id || "");
      setSelectedUnit((current) => nextUnits.some((unit) => unit.id === current && unit.availability_status === "AVAILABLE")
        ? current
        : nextUnits.find((unit) => unit.availability_status === "AVAILABLE")?.id || "");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    fetch("/barangay-167.geojson", { cache: "force-cache" })
      .then((response) => response.ok ? response.json() : null)
      .then((boundary) => { if (active && boundary) setBarangayBoundary(boundary); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => { setPhotoIndex(0); setLightboxOpen(false); setRejectOpen(false); setRejectReason(""); setMapFocusedIncident(null); }, [selectedId]);

  const sortedReports = useMemo(() => [...reports].sort((a, b) =>
    urgencyRank[urgencyLabel(a)] - urgencyRank[urgencyLabel(b)]
    || (Date.parse(a.submitted_at) || 0) - (Date.parse(b.submitted_at) || 0)), [reports]);
  const filteredReports = useMemo(() => sortedReports.filter((report) => {
    const status = String(report.status_code ?? "").toUpperCase();
    const matchesUrgency = urgencyFilter === "All" || urgencyLabel(report) === urgencyFilter;
    const matchesStatus = statusFilter === "All"
      || (statusFilter === "Submitted" && ["SUBMITTED", "UNDER_REVIEW"].includes(status))
      || (statusFilter === "Verified" && status === "VERIFIED");
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [report.title, report.category, report.location, report.reporter]
      .some((value) => String(value ?? "").toLowerCase().includes(query));
    return matchesUrgency && matchesStatus && matchesSearch;
  }), [sortedReports, statusFilter, urgencyFilter, searchQuery]);
  const selectedReport = reports.find((report) => report.id === selectedId) || null;
  const mapIncidents = useMemo(() => reports.flatMap((report) => {
    const hasLatitude = report.latitude !== null && report.latitude !== undefined && report.latitude !== "";
    const hasLongitude = report.longitude !== null && report.longitude !== undefined && report.longitude !== "";
    const lat = Number(report.latitude);
    const lng = Number(report.longitude);
    if (!hasLatitude || !hasLongitude || !Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];
    const hasBoundaryFlag = report.within_barangay_boundary !== null
      && report.within_barangay_boundary !== undefined
      && report.within_barangay_boundary !== "";
    const outsideBarangay = hasBoundaryFlag
      ? Number(report.within_barangay_boundary) === 0
      : Boolean(barangayBoundary && !isInside(lat, lng, barangayBoundary));
    return [{ id: report.id, title: report.title, category: report.category, status: report.status, lat, lng, outsideBarangay }];
  }), [reports, barangayBoundary]);
  const selectedPhotos = selectedReport?.photos ?? [];
  const activePhoto = selectedPhotos[photoIndex] ?? selectedPhotos[0] ?? null;
  const availableUnits = useMemo(() => units.filter((unit) => unit.availability_status === "AVAILABLE"), [units]);
  const allDeployed = units.length > 0 && availableUnits.length === 0;
  const reportLatitude = Number(selectedReport?.latitude);
  const reportLongitude = Number(selectedReport?.longitude);
  const hasCoordinates = selectedReport?.latitude != null && selectedReport?.longitude != null
    && Number.isFinite(reportLatitude) && Number.isFinite(reportLongitude)
    && reportLatitude >= -90 && reportLatitude <= 90
    && reportLongitude >= -180 && reportLongitude <= 180;
  const hasBoundaryFlag = selectedReport?.within_barangay_boundary !== null
    && selectedReport?.within_barangay_boundary !== undefined
    && selectedReport?.within_barangay_boundary !== "";
  const outsideBarangay = hasCoordinates && (hasBoundaryFlag
    ? Number(selectedReport.within_barangay_boundary) === 0
    : Boolean(barangayBoundary && !isInside(reportLatitude, reportLongitude, barangayBoundary)));
  const reviewStatus = String(selectedReport?.status_code || "").toUpperCase();
  const canReview = ["SUBMITTED", "UNDER_REVIEW"].includes(reviewStatus);
  const isVerified = reviewStatus === "VERIFIED";
  const canDispatch = Boolean(selectedReport && isVerified && selectedUnit && availableUnits.length > 0 && !busy);
  const dispatchReason = allDeployed
    ? "All units are deployed."
    : !isVerified ? "Approve the report before dispatching."
      : !selectedUnit ? "Select an available responder."
        : "";

  function focusReportOnMap() {
    if (!selectedReport || !hasCoordinates) return;
    setMapFocusedIncident({
      id: selectedReport.id,
      title: selectedReport.title,
      category: selectedReport.category,
      status: selectedReport.status,
      lat: Number(selectedReport.latitude),
      lng: Number(selectedReport.longitude),
    });
  }

  async function performAction(path, body, successMessage) {
    setBusy(true);
    try {
      await request(path, { method: "POST", body: JSON.stringify(body) });
      toast.add({ title: successMessage, type: "success" });
      setRejectReason("");
      setRejectOpen(false);
      setHelpNote("");
      await refresh();
    } catch (actionError) {
      toast.add({ title: "Action failed", description: actionError.message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    await performAction(action.path, action.body, action.successMessage);
  }

  function requestVerification() {
    if (!selectedReport || !canReview) return;
    setPendingAction({
      kind: "verify",
      path: `/reports/${encodeURIComponent(selectedReport.id)}/verify`,
      body: { decision: "VERIFIED" },
      successMessage: "Report approved and marked reviewed",
      title: "Approve this report?",
      description: `Confirm that “${selectedReport.title || "Incident report"}” is valid. It will be marked reviewed and become eligible for responder dispatch.`,
      confirmLabel: "Approve report",
    });
  }

  function requestDispatch() {
    if (!selectedReport || !canDispatch) return;
    const unit = units.find((candidate) => candidate.id === selectedUnit);
    const unitName = unit?.display_name?.trim() || unit?.responder_name?.trim() || unit?.resource_type || "selected responder";
    setPendingAction({
      kind: "dispatch",
      path: `/reports/${encodeURIComponent(selectedReport.id)}/dispatch`,
      body: { unit_id: selectedUnit },
      successMessage: "Responder dispatched",
      title: "Dispatch this responder?",
      description: `${unitName} will be assigned to “${selectedReport.title || "Incident report"}” and marked as deployed.`,
      confirmLabel: "Confirm dispatch",
    });
  }

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowRight" && selectedPhotos.length > 1) setPhotoIndex((index) => (index + 1) % selectedPhotos.length);
      if (event.key === "ArrowLeft" && selectedPhotos.length > 1) setPhotoIndex((index) => (index - 1 + selectedPhotos.length) % selectedPhotos.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, selectedPhotos.length]);

  return (
    <div className="flex h-[calc(100dvh-132px)] min-h-[560px] flex-col gap-3 overflow-hidden text-slate-800 max-xl:h-auto max-xl:min-h-0 max-xl:overflow-visible">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Incoming reports &amp; dispatch</h2>
          <p className="mt-1 text-xs text-slate-500">{reports.length} awaiting · {reports.filter((report) => urgencyLabel(report) === "High").length} High · {availableUnits.length} {availableUnits.length === 1 ? "unit" : "units"} available</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
      </div>

      {allDeployed && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={15} />All units are deployed. City Hall DRRMO support can be requested for the selected report.</div>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"><span>{error}</span><button type="button" onClick={refresh} className="font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600">Try again</button></div>}

      {loading ? <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[380px_minmax(0,1fr)]" aria-label="Loading dispatch reports" aria-busy="true"><div className={`${card} space-y-3 p-4`}>{[1, 2, 3].map((item) => <div key={item} className="animate-pulse space-y-2 border-b border-slate-100 pb-3"><div className="h-3 w-1/3 rounded bg-slate-100" /><div className="h-3 w-2/3 rounded bg-slate-100" /><div className="h-2 w-1/2 rounded bg-slate-100" /></div>)}</div><div className={`${card} min-h-72 animate-pulse bg-slate-50`} /></div> : (
        <div className="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[380px_minmax(0,1fr)] max-xl:grid-cols-1">
          <section className={`${card} flex min-h-0 flex-col overflow-hidden`}>
            <div className="sticky top-0 z-10 space-y-3 border-b border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Reports awaiting action</h3><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">{reports.length} awaiting</span></div>
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <AccessibleDropdown label="Filter by urgency" value={urgencyFilter} onChange={setUrgencyFilter} options={[
                  { value: "All", label: "All urgency", tone: "neutral" },
                  { value: "High", label: "High urgency", tone: "red" },
                  { value: "Medium", label: "Medium urgency", tone: "amber" },
                ]} />
                <AccessibleDropdown label="Filter by report status" value={statusFilter} onChange={setStatusFilter} options={[
                  { value: "All", label: "All status", tone: "neutral" },
                  { value: "Submitted", label: "Submitted status", tone: "amber" },
                  { value: "Verified", label: "Verified status", tone: "green" },
                ]} />
                <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search reports" aria-label="Search reports" className="col-span-2 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-600" />
              </div>
            </div>
            {reports.length === 0 ? <div className="px-5 py-12 text-center"><ShieldCheck size={27} className="mx-auto text-emerald-700" /><p className="mt-3 text-sm font-semibold">No reports need review</p><p className="mt-1 text-xs text-slate-500">New submissions appear here.</p></div>
              : filteredReports.length === 0 ? <p className="px-4 py-10 text-center text-xs text-slate-500">No reports match these filters.</p>
                : <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                  {filteredReports.map((report) => {
                    const urgency = urgencyLabel(report);
                    const submitted = report.submitted_at ? new Date(report.submitted_at) : null;
                    const fullTime = submitted && Number.isFinite(submitted.getTime()) ? submitted.toLocaleString() : "Time unavailable";
                    const count = report.photos?.length ?? report.photo_count ?? 0;
                    const statusLabel = String(report.status_code).toUpperCase() === "VERIFIED" ? "Verified" : "Submitted";
                    return <button key={report.id} type="button" aria-pressed={selectedId === report.id} onClick={() => setSelectedId(report.id)} className={`w-full border-l-2 px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${selectedId === report.id ? "border-l-emerald-700 bg-emerald-50/70" : "border-l-transparent hover:bg-slate-50"}`}>
                      <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-bold">{report.title || "Incident report"}</p><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${urgencyClasses[urgency]}`}>{urgency}</span></div>
                      <p className="mt-1 truncate text-[11px] text-slate-600">{report.category || "Uncategorized"} · {report.location || "Location unavailable"}</p>
                      <div className="mt-1 flex items-center gap-2 truncate text-[10px] text-slate-500"><span className="truncate">{report.reporter || "Guest"}</span><span title={fullTime} className="shrink-0">{relativeTime(report.submitted_at)}</span><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusLabel === "Verified" ? "bg-emerald-600" : "bg-amber-500"}`} title={statusLabel} /><span className="inline-flex shrink-0 items-center gap-1" title={`${count} photos`}><ImageIcon size={11} />{count}</span></div>
                    </button>;
                  })}
                </div>}
          </section>

          <section className={`${card} flex min-h-0 flex-col overflow-hidden`}>
            {!selectedReport ? <div className="px-5 py-12 text-center"><ShieldCheck size={28} className="mx-auto text-emerald-700" /><p className="mt-3 text-sm font-semibold">Select a report</p><p className="mt-1 text-xs text-slate-500">The report details and responder actions will appear here.</p></div> : <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-3 sm:p-5">
                <section aria-label="Report summary" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${urgencyClasses[urgencyLabel(selectedReport)]}`}>{urgencyLabel(selectedReport)} urgency</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{isVerified ? "Verified" : selectedReport.status || "Submitted"}</span></div>
                  <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900">{selectedReport.title || "Incident report"}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600"><span className="font-semibold text-slate-700">{selectedReport.category || "Uncategorized"}</span><span className="text-slate-300">•</span><span>Reported by {selectedReport.reporter || "Guest"}</span><span className="text-slate-300">•</span><span title={selectedReport.submitted_at ? new Date(selectedReport.submitted_at).toLocaleString() : "Time unavailable"}>{relativeTime(selectedReport.submitted_at)}</span></div>
                </section>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(290px,0.85fr)]">
                  <div className="space-y-4">
                <section aria-label="Photo evidence" className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-xs font-bold">Photo evidence</h4><button type="button" disabled={!selectedPhotos.length} onClick={() => { setPhotoIndex(0); setLightboxOpen(true); }} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"><Eye size={13} />{selectedPhotos.length ? `View ${selectedPhotos.length === 1 ? "photo" : `${selectedPhotos.length} photos`}` : "No photo attached"}</button></div>
                  {activePhoto ? <>
                    <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label="Open report photo gallery">
                      <img src={photoUrl(selectedReport.id, activePhoto.media_id)} alt={`Report evidence ${photoIndex + 1}`} className="h-40 w-full bg-slate-950/[0.02] object-contain sm:h-48" />
                    </button>
                    {selectedPhotos.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{selectedPhotos.map((photo, index) => <button key={photo.media_id} type="button" aria-label={`Show photo ${index + 1}`} aria-pressed={photoIndex === index} onClick={() => setPhotoIndex(index)} className={`h-14 w-16 shrink-0 overflow-hidden rounded-md border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${photoIndex === index ? "border-emerald-700" : "border-slate-200"}`}><img src={photoUrl(selectedReport.id, photo.media_id)} alt="" className="h-full w-full object-cover" /></button>)}</div>}
                  </> : <div className="flex min-h-20 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500"><ImageIcon size={15} />No photo submitted</div>}
                </section>

                <section aria-label="Description" className="rounded-xl border border-slate-200 bg-white p-3.5"><h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Incident description</h4><p className={`whitespace-pre-wrap text-xs leading-relaxed ${selectedReport.description || selectedReport.description_original ? "text-slate-700" : "text-slate-500"}`}>{String(selectedReport.description || selectedReport.description_original || "").trim() || "No description. See photo evidence."}</p></section>

                <section aria-label="Location" className="rounded-xl border border-slate-200 bg-white p-3.5"><h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Location</h4><p className="flex items-start gap-1.5 text-xs text-slate-600"><MapPin size={13} className="mt-0.5 shrink-0 text-emerald-700" />{selectedReport.location || "Location not provided"}{hasCoordinates && <span className="text-slate-400">· {Number(selectedReport.latitude).toFixed(5)}, {Number(selectedReport.longitude).toFixed(5)}</span>}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {outsideBarangay && <span role="status" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[10px] font-semibold text-amber-900"><AlertTriangle size={12} />Outside Barangay 167</span>}
                    <button type="button" disabled={!hasCoordinates} onClick={focusReportOnMap} className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"><MapPin size={12} />Pin report on map</button>
                  </div>
                  <div className="mt-2 h-[320px] overflow-hidden rounded-lg border border-slate-200 sm:h-[380px]"><MapViewer compact mapHeight="h-full" showBackButton={false} incidents={mapIncidents} reportCount={mapIncidents.length} selectedIncident={mapFocusedIncident} allowOutsideIncidents allowOutsideBounds fitWholeBarangay showFitButton /></div>
                </section>

                  </div>
                  <div className="space-y-4">
                <section aria-label="Verification" className={`rounded-xl border p-3.5 ${isVerified ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/60"}`}>
                  <div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}><ShieldCheck size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold text-slate-900">Report review</h4><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${isVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{isVerified ? "Verified" : "Awaiting review"}</span></div><p className="mt-1 text-[11px] leading-relaxed text-slate-600">{isVerified ? "This report has been approved and can be assigned to an available responder." : "Check the report details and evidence before approving it for dispatch."}</p></div></div>
                </section>

                <section aria-label="Responders" className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-xs font-bold"><Truck size={14} className="text-emerald-800" />Responders / mobile units</h4><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">{availableUnits.length} available</span></div>
                  {units.length === 0 ? <p className="mt-3 text-xs text-slate-500">No responder units are registered.</p> : <div className="mt-2 space-y-1.5">{units.map((unit) => {
                    const available = unit.availability_status === "AVAILABLE";
                    const deployed = unit.availability_status === "BUSY";
                    const unitStatus = available ? "Available" : deployed ? "Deployed" : "Offline";
                    const unitName = unit.display_name?.trim() || unit.responder_name?.trim() || unit.resource_type;
                    const details = [unit.resource_type, unit.mobile_number].filter((value) => value && value !== unitName).join(" · ");
                    return <label key={unit.id} className={`flex min-h-12 items-center gap-2.5 rounded-lg border px-3 py-2 ${available ? "cursor-pointer border-slate-200 hover:border-emerald-400" : "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"} ${selectedUnit === unit.id ? "border-emerald-700 bg-emerald-50/50 ring-1 ring-emerald-700" : ""}`}>
                      <input type="radio" name="dispatch-unit" value={unit.id} checked={selectedUnit === unit.id} disabled={!available} onChange={() => setSelectedUnit(unit.id)} className="accent-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
                      <span className={`h-2 w-2 shrink-0 rounded-full ${available ? "bg-emerald-600" : deployed ? "bg-amber-500" : "bg-slate-400"}`} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{unitName}</span>{details && <span className="block truncate text-[10px] text-slate-500">{details}</span>}</span>
                      <span className={`text-[10px] font-semibold ${available ? "text-emerald-800" : deployed ? "text-amber-800" : "text-slate-500"}`}>{unitStatus}</span>
                    </label>;
                  })}</div>}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <button type="button" disabled={!canDispatch} onClick={requestDispatch} className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"><Radio size={14} />Dispatch responder</button>
                    {dispatchReason && <p className="mt-1.5 text-center text-[10px] text-slate-500">{dispatchReason}</p>}
                    {allDeployed && <div className="mt-3 border-t border-slate-100 pt-3"><label htmlFor="drrmo-note" className="mb-1.5 block text-[10px] font-semibold text-slate-600">Optional note for City Hall DRRMO</label><textarea id="drrmo-note" value={helpNote} onChange={(event) => setHelpNote(event.target.value)} rows={2} maxLength={500} placeholder="All local response units are deployed." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-100" /><button type="button" disabled={busy || !["SUBMITTED", "UNDER_REVIEW", "VERIFIED"].includes(reviewStatus)} onClick={() => performAction(`/reports/${encodeURIComponent(selectedReport.id)}/request-drrmo`, { note: helpNote }, "City Hall DRRMO support requested")} className="mt-2 min-h-9 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-50">Request help from City Hall DRRMO</button></div>}
                  </div>
                </section>
                  </div>
                </div>
              </div>

              {(canReview || rejectOpen) && <div className="shrink-0 border-t border-slate-200 bg-white p-4">
                {canReview && <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busy} onClick={requestVerification} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-xs font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"><Check size={14} />Approve / mark reviewed</button>
                  <button type="button" disabled={busy} onClick={() => setRejectOpen((open) => !open)} className="min-h-10 rounded-lg border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-60">{rejectOpen ? "Cancel rejection" : "Reject as invalid"}</button>
                </div>}
                {rejectOpen && canReview && <div className="mb-2 flex gap-2"><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reason for rejecting this report" rows={2} maxLength={500} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-red-400 focus-visible:ring-2 focus-visible:ring-red-200" /><button type="button" disabled={busy || !rejectReason.trim()} onClick={() => performAction(`/reports/${encodeURIComponent(selectedReport.id)}/verify`, { decision: "REJECTED", reason: rejectReason }, "Report rejected")} className="rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Confirm</button></div>}
              </div>}
            </>}
          </section>
        </div>
      )}

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open && !busy) setPendingAction(null); }}>
        <AlertDialogContent className="overflow-hidden rounded-2xl border border-slate-200 p-0 shadow-2xl">
          <div className={`h-1.5 ${pendingAction?.kind === "dispatch" ? "bg-emerald-700" : "bg-teal-700"}`} />
          <div className="p-5 sm:p-6">
            <AlertDialogHeader className="gap-3 text-left">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${pendingAction?.kind === "dispatch" ? "bg-emerald-50 text-emerald-800" : "bg-teal-50 text-teal-800"}`}>{pendingAction?.kind === "dispatch" ? <Radio size={20} /> : <ShieldCheck size={20} />}</div>
              <div><AlertDialogTitle className="text-base font-bold text-slate-900">{pendingAction?.title}</AlertDialogTitle><AlertDialogDescription className="mt-1.5 text-xs leading-relaxed text-slate-600">{pendingAction?.description}</AlertDialogDescription></div>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="border-slate-100 bg-slate-50/80 p-4 sm:px-6">
            <AlertDialogCancel disabled={busy} className="h-9 rounded-lg px-4 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmPendingAction} className={`h-9 rounded-lg px-4 text-xs font-bold text-white ${pendingAction?.kind === "dispatch" ? "bg-emerald-800 hover:bg-emerald-900" : "bg-teal-800 hover:bg-teal-900"}`}>{pendingAction?.confirmLabel || "Confirm"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightboxOpen && selectedReport && activePhoto && <div role="dialog" aria-modal="true" aria-label="Report photo gallery" className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/85 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxOpen(false); }}>
        <div className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col rounded-xl border border-white/15 bg-slate-950 p-3">
          <div className="flex items-center justify-between gap-3 pb-2 text-xs text-white"><span className="truncate">{selectedReport.title} · Photo {photoIndex + 1} of {selectedPhotos.length}</span><button type="button" onClick={() => setLightboxOpen(false)} aria-label="Close photo gallery" className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X size={16} /></button></div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center"><img src={photoUrl(selectedReport.id, activePhoto.media_id)} alt={`Report evidence ${photoIndex + 1}`} className="max-h-[82dvh] max-w-full object-contain" />{selectedPhotos.length > 1 && <><button type="button" aria-label="Previous photo" onClick={() => setPhotoIndex((index) => (index - 1 + selectedPhotos.length) % selectedPhotos.length)} className="absolute left-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronLeft size={20} /></button><button type="button" aria-label="Next photo" onClick={() => setPhotoIndex((index) => (index + 1) % selectedPhotos.length)} className="absolute right-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronRight size={20} /></button></>}</div>
        </div>
      </div>}
    </div>
  );
}
