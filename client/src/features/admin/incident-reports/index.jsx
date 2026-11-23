import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban, ChevronLeft, ChevronRight, Download, GitMerge, History,
  RotateCcw, Search, Siren, X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge, SelectFilter, stamp } from "../../../shared/components/GovernanceUi";
import { toast } from "../../../shared/components/ui/toast";
import {
  DISPLAY_URGENCY_STYLES, STATUS_STYLES, STRIKE_STEPS,
  TANODS, VEHICLES, categories, locations, statuses,
} from "./constants";
import {
  EMPTY_QUEUE_MESSAGES, QUEUES, primaryActionLabel, queuesFor, sortReportsForQueue,
} from "./queues";
import {
  NEW_CALLS, displayUrgency, downloadReportsCsv, formatTimestamp, mapApiReport, privacySummary,
} from "./utils";
import IncidentDrawer from "./components/IncidentDrawer";
import ActionCell from "./components/table/ActionCell";
import AuditTrailModal from "./components/modals/AuditTrailModal";
import DispatchModal from "./components/modals/DispatchModal";
import DispatchTransactionModal from "./components/modals/DispatchTransactionModal";
import FieldOpsModal from "./components/modals/FieldOpsModal";
import LinkDuplicateModal from "./components/modals/LinkDuplicateModal";
import StrikeModal from "./components/modals/StrikeModal";
import SuccessModal from "./components/modals/SuccessModal";
import UnitTrackModal from "./components/modals/UnitTrackModal";
import TrackingBoard from "./components/tracking/TrackingBoard";

export default function IncidentReports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedQueue = searchParams.get("queue") || "";
  const tab = QUEUES.some((queue) => queue.key === selectedQueue) ? selectedQueue : QUEUES[0].key;

  /* Tab clicks update ?queue=… so refresh, back/forward and shared links all
     land on the same queue. */
  function selectQueue(key) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("queue", key);
      return next;
    });
  }

  const [reports, setReports] = useState([]);
  const [reportsError, setReportsError] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [category, setCategory] = useState("All Categories");
  const [location, setLocation] = useState("All Locations");
  const [urgencyFilter, setUrgencyFilter] = useState("All Urgency");
  const [month, setMonth] = useState("All Months");
  const [photoViewer, setPhotoViewer] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [dispatchReport, setDispatchReport] = useState(null);
  const [savedReport, setSavedReport] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [trackOpen, setTrackOpen] = useState(false);
  const [fieldReport, setFieldReport] = useState(null);
  const [flagReport, setFlagReport] = useState(null);
  const [dupReport, setDupReport] = useState(null);
  const [audit, setAudit] = useState({ open: false, reportId: "All reports" });
  const [strikes, setStrikes] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const locationOptions = useMemo(() => [
    "All Locations",
    ...new Set([...locations.slice(1), ...reports.map((report) => report.location).filter(Boolean)]),
  ], [reports]);

  useEffect(() => {
    let active = true;
    let busy = false;
    const controller = new AbortController();
    const loadApiReports = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const response = await fetch("/api/reports", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Reports could not be loaded from the server.");
        const result = await response.json();
        if (!active || !Array.isArray(result.reports)) return;
        setReportsError("");
        const fetchedAt = Date.now();
        const apiReports = result.reports.map((item) => mapApiReport(item, fetchedAt));
        setReports((current) => {
          const currentById = new Map(current.map((report) => [report.id, report]));
          return apiReports.map((latest) => {
            const existing = currentById.get(latest.id);
            return existing
              ? {
                  ...existing,
                  ...latest,
                  ...(existing.closure && latest.status === "Verified Fixed" ? { closure: existing.closure } : {}),
                  ...(existing.published ? { published: existing.published } : {}),
                }
              : latest;
          });
        });
      } catch (error) {
        if (active) setReportsError(error.message || "Could not refresh reports.");
      } finally {
        busy = false;
      }
    };
    void loadApiReports();
    const timer = window.setInterval(loadApiReports, 6000);
    document.addEventListener("visibilitychange", loadApiReports);
    return () => {
      active = false;
      controller.abort();
      document.removeEventListener("visibilitychange", loadApiReports);
      window.clearInterval(timer);
    };
  }, []);

  const logAudit = useCallback((entry) => {
    setAuditLog((log) => [{ key: `${log.length + 1}-${NEW_CALLS()}-${entry.reportId}`, at: stamp(true), ...entry }, ...log]);
  }, []);

  function updateReportData(id, changes) {
    setReports((current) => current.map((report) => (report.id === id ? { ...report, ...changes } : report)));
  }

  function beginTransaction(updated, units, maintenance) {
    setTrackOpen(false);
    setTransaction({
      report: updated, units, maintenance,
      transactionId: `DSP-${updated.id.replace("GF-", "")}-${String(NEW_CALLS()).slice(-4)}`,
      time: stamp(),
    });
  }

  async function handleResolve(id, changes, mode) {
    const target = reports.find((r) => r.id === id);
    if (target?.incidentId) {
      try {
        const response = await fetch(`/api/reports/${encodeURIComponent(target.incidentId)}/resolve`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            closure_mode: mode,
            resolution_notes: changes.closure?.note || (mode === "proof" ? "Resolved with response or repair proof." : ""),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not save the incident closure.");
      } catch (error) {
        toast.add({ type: "error", title: "Could not resolve incident", description: error instanceof Error ? error.message : "Please try again." });
        return false;
      }
    }
    updateReportData(id, changes);
    logAudit({
      reportId: id, actor: "Admin",
      action: mode === "proof" ? "Resolution closed with proof" : "Closed without proof — reason documented",
      detail: mode === "proof" ? `Proof uploaded before closing the incident.` : `${changes.closure.reason}: ${changes.closure.note}`,
      system: false,
    });
    setSavedReport({ ...reports.find((r) => r.id === id), ...changes });
    toast.add({ type: "success", title: "Incident closed", description: mode === "proof" ? "Proof recorded and the incident is marked resolved." : "No-proof closure recorded with a documented reason." });
    return true;
  }

  function handlePublish(id) {
    const summary = privacySummary(reports.find((r) => r.id === id));
    updateReportData(id, { published: { at: stamp(true), summary } });
    logAudit({ reportId: id, actor: "Admin", action: "Accomplishment summary published", detail: "Privacy-safe summary posted to the public dashboard (addresses and identifiers stripped)." });
    toast.add({ type: "success", title: "Published to public dashboard", description: "Privacy-safe accomplishment summary is now visible to the public feed." });
  }

  function handleAssign(id, { tanod, vehicle }) {
    updateReportData(id, { responders: { tanod, vehicle, sent: stamp(true), accepted: null } });
    const tanodName = TANODS.find((t) => t.id === tanod)?.name ?? tanod;
    const vehicleName = VEHICLES.find((v) => v.id === vehicle)?.id ?? vehicle;
    logAudit({ reportId: id, actor: "BDRRMO", action: "Responder assigned", detail: `${tanodName} + vehicle ${vehicleName} assigned; awaiting field acceptance.` });
  }

  function handleAccepted(id) {
    updateReportData(id, { responders: { ...reports.find((r) => r.id === id).responders, accepted: stamp(true) } });
    logAudit({ reportId: id, actor: "Field Tanod", action: "Assignment accepted", detail: "Tanod confirmed the assignment in the field app." });
    toast.add({ type: "success", title: "Responder accepted", description: `The assigned Tanod accepted the response duty for ${id}.` });
  }

  function handleStage(id, stage) {
    updateReportData(id, { fieldStage: stage });
    if (stage === "Completed") {
      updateReportData(id, { fieldStage: stage, gpsEnded: true });
      logAudit({ reportId: id, actor: "System — GPS", system: true, action: "Live tracking automatically disabled", detail: "Duty reached Completed — privacy-scoped GPS sharing turned off." });
    } else {
      logAudit({ reportId: id, actor: "Field Tanod", action: `Status → ${stage}`, detail: "Field progress updated from the responder app." });
    }
    toast.add({ type: "info", title: `Status updated: ${stage}`, description: stage === "Completed" ? "Live GPS sharing ended automatically." : `${id} → ${stage}.` });
  }

  function handleHandover(id, handover) {
    updateReportData(id, { handover, fieldStage: reportStageAfterScan(reports.find((r) => r.id === id)) });
  }

  function reportStageAfterScan(report) {
    return report?.fieldStage === "On Scene" ? "Handover" : (report?.fieldStage ?? "Handover");
  }

  function handleLinkDuplicate(childId, masterId) {
    const master = reports.find((r) => r.id === masterId);
    const child = reports.find((r) => r.id === childId);
    if (!master || !child) return;
    updateReportData(childId, { duplicateOf: masterId, status: "Duplicate" });
    updateReportData(masterId, { linked: [...(master.linked ?? []), childId] });
    logAudit({ reportId: childId, actor: "Admin", action: "Duplicate linked", detail: `Linked to master incident ${masterId}. Status set to Duplicate.` });
    toast.add({ type: "info", title: "Duplicate linked", description: `${childId} now follows master incident ${masterId}.` });
    setDupReport(null);
  }

  function handleStrike(id) {
    const report = reports.find((r) => r.id === id);
    const current = strikes[report.reporter] ?? { count: 0 };
    const count = Math.min(STRIKE_STEPS.length, current.count + 1);
    const step = STRIKE_STEPS[count - 1];
    setStrikes((s) => ({ ...s, [report.reporter]: { count, lastStep: step } }));
    logAudit({ reportId: id, actor: "Admin", action: `False report strike ${count}`, detail: `${report.reporter}: ${step}.` });
    toast.add({ type: count >= 2 ? "error" : "warning", title: `Strike ${count} recorded`, description: `${report.reporter} — ${step}.` });
    setFlagReport(null);
  }

  function openFieldOps(id) {
    const target = reports.find((report) => report.id === id);
    if (!target) return;
    setFieldReport(target);
  }

  const filteredReports = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matches = reports.filter((report) => {
      const matchesQuery = !search || `${report.id} ${report.title} ${report.category} ${report.location} ${report.reporter} ${report.status} ${report.team}`.toLowerCase().includes(search);
      return matchesQuery
        && queuesFor(report).includes(tab)
        && (month === "All Months" || report.month === month)
        && (tab === "dispatch-tracking" || tab === "resolved" || status === "All Statuses" || report.status === status)
        && (category === "All Categories" || report.category === category)
        && (location === "All Locations" || report.location === location)
        && (urgencyFilter === "All Urgency" || displayUrgency(report) === urgencyFilter);
    });
    return sortReportsForQueue(matches, tab);
  }, [category, location, month, query, reports, status, tab, urgencyFilter]);

  const restrictedReporters = Object.entries(strikes).filter(([, s]) => s.count >= 2).map(([name]) => name);

  function resetFilters() {
    setQuery(""); setStatus("All Statuses"); setCategory("All Categories"); setLocation("All Locations"); setUrgencyFilter("All Urgency"); setMonth("All Months");
  }

  const viewerReport = photoViewer ? reports.find((report) => report.id === photoViewer.reportId) : null;
  const viewerPhotos = viewerReport?.photos ?? [];
  useEffect(() => {
    if (!photoViewer) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setPhotoViewer(null);
      if (event.key === "ArrowRight" && viewerPhotos.length > 1) setPhotoViewer((current) => ({ ...current, index: (current.index + 1) % viewerPhotos.length }));
      if (event.key === "ArrowLeft" && viewerPhotos.length > 1) setPhotoViewer((current) => ({ ...current, index: (current.index - 1 + viewerPhotos.length) % viewerPhotos.length }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photoViewer, viewerPhotos.length]);

  return (
    <div className="space-y-3">
      {reportsError && <p role="alert">{reportsError} Retrying automatically.</p>}
      <section className="sticky top-0 z-30 rounded-lg border border-[#e2e8eb] bg-white/95 p-4 backdrop-blur">
        <div className="gf-tabs">
          {QUEUES.map((queue) => {
            const count = reports.filter((report) => queuesFor(report).includes(queue.key)).length;
            const alerting = queue.key === "external-agencies" && reports.some((report) => report.external?.some((unit) => /: requested/i.test(unit)));
            return (
              <button key={queue.key} type="button" aria-pressed={tab === queue.key} onClick={() => selectQueue(queue.key)} className={`gf-tab ${tab === queue.key ? "gf-tab--active" : ""} ${alerting ? "gf-tab--alert" : ""}`}>
                {queue.label}
                <span className={`gf-badge ${alerting ? "gf-badge--alert" : "gf-badge--duplicate"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-white p-2">
        <label className="gf-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports..." className="w-full text-[11px] outline-none placeholder:text-[#7c8ba3]" />
        </label>
        {tab !== "dispatch-tracking" && tab !== "resolved" && <SelectFilter value={status} options={statuses} onChange={setStatus} ariaLabel="Filter status" />}
        <SelectFilter value={urgencyFilter} options={["All Urgency", "High", "Medium", "Low"]} onChange={setUrgencyFilter} ariaLabel="Filter urgency" />
        <SelectFilter value={category} options={categories} onChange={setCategory} ariaLabel="Filter category" />
        <SelectFilter value={location} options={locationOptions} onChange={setLocation} ariaLabel="Filter location" />
        <SelectFilter value={month} options={["All Months", ...new Set(reports.map((report) => report.month).filter(Boolean))]} onChange={setMonth} ariaLabel="Filter month" />
        <button type="button" onClick={resetFilters} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#60738f] transition hover:bg-(--gf-green-soft) hover:text-(--gf-green)"><RotateCcw size={12} /> Reset</button>
      </section>

      {tab === "dispatch-tracking" ? (
        <TrackingBoard reports={filteredReports} />
      ) : (
        <section className="rounded-lg border border-[#e2e8eb] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold text-(--gf-green)">{QUEUES.find((queue) => queue.key === tab)?.label ?? "Incident Reports"} ({filteredReports.length})</h2>
              <span className="gf-badge gf-badge--guest">Guest pathways: {reports.filter((r) => r.reporterType === "guest").length}</span>
              {restrictedReporters.length > 0 && <span className="gf-badge gf-badge--alert"><Ban size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />Restricted: {restrictedReporters.join(", ")}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setAudit({ open: true, reportId: "All reports" })} className="gf-btn gf-btn--chip"><History size={11} />Audit Trail</button>
              <button type="button" onClick={() => downloadReportsCsv(filteredReports)} className="gf-btn gf-btn--chip"><Download size={11} /> Export CSV</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {(() => {
              const externalTab = tab === "external-agencies";
              const headings = ["ID", "Incident Details", "Category", "Urgency", "Photos", "Location", "Reporter", "Date Reported", "Assigned Team", "Status", ...(externalTab ? ["External Units"] : []), "Action"];
              return (
                <table className="gf-table incident-table">
                  <thead>
                    <tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => {
                      return (
                        <tr key={report.id}>
                          <td className="px-2 py-3 font-bold text-(--gf-green)">
                            {report.id}
                            {report.duplicateOf && <div><span className="gf-badge gf-badge--duplicate"><GitMerge size={8} style={{ display: "inline", verticalAlign: "-1px", marginRight: 2 }} />dup of {report.duplicateOf}</span></div>}
                            {report.published && <div><span className="gf-badge gf-badge--fixed">published</span></div>}
                          </td>
                          <td className="px-2 py-3 font-semibold text-[#263246]">{report.title}</td>
                          <td className="px-2 py-3 text-[#60738f]">{report.category}</td>
                          <td className="px-2 py-3"><Badge label={displayUrgency(report)} styles={DISPLAY_URGENCY_STYLES[displayUrgency(report)]} /></td>
                          <td className="px-2 py-3">
                            {report.photos?.length && report.incidentId ? <button type="button" onClick={() => setPhotoViewer({ reportId: report.id, index: 0 })} className="group relative block h-10 w-12 overflow-hidden rounded-md border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label={`View ${report.photos.length} report photos`}>
                              <img src={`/api/reports/${encodeURIComponent(report.incidentId)}/photos/${encodeURIComponent(report.photos[0].id)}`} alt="Report evidence thumbnail" loading="lazy" className="h-full w-full object-cover" />
                              {report.photos.length > 1 && <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-[10px] font-bold text-white">+{report.photos.length - 1}</span>}
                            </button> : <span className="text-[10px] text-slate-400">No photo</span>}
                          </td>
                          <td className="px-2 py-3 text-[#60738f]">{report.location}{report.outsideBarangayBoundary && <div><Badge label="Outside Barangay 167" styles="gf-badge gf-badge--warn" /></div>}</td>
                          <td className="px-2 py-3">
                            {report.reporter}
                            <div className="mt-0.5 flex gap-1">
                              <Badge label={report.reporterType === "guest" ? "Guest" : "Verified"} styles={report.reporterType === "guest" ? "gf-badge gf-badge--guest" : "gf-badge gf-badge--resident"} />
                              {strikes[report.reporter]?.count >= 2 && <Badge label="Restricted" styles="gf-badge gf-badge--alert" />}
                              {strikes[report.reporter]?.count === 1 && <Badge label="Warned" styles="gf-badge gf-badge--warn" />}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-[#60738f]">{report.date}</td>
                          <td className="px-2 py-3 font-medium text-(--gf-green)">{report.team}</td>
                          <td className="px-2 py-3"><Badge label={report.status} styles={STATUS_STYLES[report.status]} />{report.forwardedAt && <small className="block">{formatTimestamp(report.forwardedAt)}</small>}</td>
                          {externalTab && (
                            <td className="px-2 py-3">
                              {report.external?.length ? (
                                <div className="grid gap-1">
                                  {report.external.map((unit) => {
                                    const waiting = (/: requested/i).test(unit);
                                    return (
                                      <p key={unit} className="rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-2 py-1.5 text-[8px] font-medium text-[#60738f]" style={waiting ? { borderColor: "#f0d9a8", background: "#fdf6e7" } : undefined}>
                                        <Siren size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4, color: waiting ? "var(--gf-amber)" : "var(--gf-green)" }} />{unit}
                                      </p>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[9px] text-[#a0b0c6]">None requested</span>
                              )}
                            </td>
                          )}
                          <ActionCell report={report} primaryLabel={primaryActionLabel(report, tab)} menuOpen={menuFor === report.id}
                            onToggleMenu={() => setMenuFor((current) => (current === report.id ? null : report.id))}
                            onCloseMenu={() => setMenuFor(null)}
                            onOpenDrawer={(target) => { setMenuFor(null); setSelectedReport(target); }}
                            onBackup={(target) => setDispatchReport(target)}
                            onFlag={(target) => setFlagReport(target)}
                            onMerge={(target) => setDupReport(target)}
                            onAudit={(target) => setAudit({ open: true, reportId: target.id })}
                            onFieldOps={(target) => openFieldOps(target.id)}
                            onPrintable={(target) => navigate(`/admin/incident-reports/${encodeURIComponent(target.incidentId)}/report`)} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
            {filteredReports.length === 0 && <p className="py-8 text-center text-xs text-[#60738f]">{EMPTY_QUEUE_MESSAGES[tab] ?? "No reports match the selected filters."}</p>}
          </div>
        </section>
      )}

      {selectedReport && <IncidentDrawer key={selectedReport.id} report={reports.find((r) => r.id === selectedReport.id)} onClose={() => setSelectedReport(null)} onResolve={handleResolve} onPublish={handlePublish} onDispatch={updateReportData} onOpenAudit={(id) => { setSelectedReport(null); setAudit({ open: true, reportId: id }); }} logAudit={logAudit} />}
      {dispatchReport && <DispatchModal key={dispatchReport.id} report={dispatchReport} onClose={() => setDispatchReport(null)} onDispatch={updateReportData} onTransaction={beginTransaction} logAudit={logAudit} />}
      {savedReport && <SuccessModal key={savedReport.id} report={savedReport} onClose={() => setSavedReport(null)} />}
      {transaction && <DispatchTransactionModal key={`txn-${transaction.transactionId}`} data={{ ...transaction, report: reports.find((r) => r.id === transaction.report.id) ?? transaction.report }} onClose={() => setTransaction(null)} onTrack={() => setTrackOpen(true)} onFieldOps={() => { setTrackOpen(false); setTransaction(null); setFieldReport(reports.find((r) => r.id === transaction.report.id)); }} />}
      {transaction && trackOpen && <UnitTrackModal key={`trk-${transaction.transactionId}`} units={transaction.units} report={reports.find((r) => r.id === transaction.report.id) ?? transaction.report} onClose={() => setTrackOpen(false)} />}
      {fieldReport && <FieldOpsModal report={reports.find((r) => r.id === fieldReport.id) ?? fieldReport} onClose={() => setFieldReport(null)} onAssign={handleAssign} onAccepted={handleAccepted} onStage={handleStage} onHandover={handleHandover} logAudit={logAudit} />}
      {flagReport && <StrikeModal key={flagReport.id} report={flagReport} strikes={strikes} onClose={() => setFlagReport(null)} onStrike={handleStrike} />}
      {dupReport && <LinkDuplicateModal key={dupReport.id} report={dupReport} reports={reports} onClose={() => setDupReport(null)} onLink={handleLinkDuplicate} />}
      {audit.open && <AuditTrailModal log={[...auditLog, ...reports.flatMap((report) => report.history.map((event) => ({
        key: event.id, reportId: report.id, at: formatTimestamp(event.created_at), action: event.status, detail: event.note, system: !event.actor,
      })))]} filter={audit.reportId} onFilter={(reportId) => setAudit((a) => ({ ...a, reportId }))} onClose={() => setAudit({ open: false, reportId: "All reports" })} />}
      {photoViewer && viewerReport && viewerPhotos[photoViewer.index] && <div role="dialog" aria-modal="true" aria-label="Report photo viewer" className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhotoViewer(null); }}>
        <div className="relative flex max-h-[90dvh] w-full max-w-4xl flex-col items-center rounded-xl border border-white/15 bg-slate-950 p-3">
          <div className="flex w-full items-center justify-between pb-2 text-xs text-white"><span>{viewerReport.title} · Photo {photoViewer.index + 1} of {viewerPhotos.length}</span><button type="button" onClick={() => setPhotoViewer(null)} aria-label="Close photo viewer" className="rounded-md p-2 text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X size={16} /></button></div>
          <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
            <img src={`/api/reports/${encodeURIComponent(viewerReport.incidentId)}/photos/${encodeURIComponent(viewerPhotos[photoViewer.index].id)}`} alt={`Evidence photo ${photoViewer.index + 1}`} className="max-h-[78dvh] max-w-full rounded-md object-contain" />
            {viewerPhotos.length > 1 && <><button type="button" aria-label="Previous photo" onClick={() => setPhotoViewer((current) => ({ ...current, index: (current.index - 1 + viewerPhotos.length) % viewerPhotos.length }))} className="absolute left-2 rounded-full bg-black/55 p-2 text-white hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronLeft size={20} /></button><button type="button" aria-label="Next photo" onClick={() => setPhotoViewer((current) => ({ ...current, index: (current.index + 1) % viewerPhotos.length }))} className="absolute right-2 rounded-full bg-black/55 p-2 text-white hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronRight size={20} /></button></>}
          </div>
        </div>
      </div>}
    </div>
  );
}
