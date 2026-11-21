import { useMemo, useState } from "react";
import { Bell, Camera, CheckCircle2, Eye, EyeOff, FileText, FileUp, GitMerge, History, Languages, Link2, MapPinned, QrCode, Share2, ShieldCheck, Siren, Video, Wrench, X } from "lucide-react";
import MapViewer from "../../../../shared/components/MapViewer";
import { Badge, ModalSection, RowList, stamp } from "../../../../shared/components/GovernanceUi";
import { toast } from "../../../../shared/components/ui/toast";
import { CLOSURE_REASONS, TANODS, TEAM_OPTIONS, URGENCY_OPTS, VEHICLES } from "../constants";
import { isEmergency, languageScan, shortUrgency } from "../utils";
import StageTrack from "./StageTrack";

function IncidentDrawer({ report, onClose, onResolve, onPublish, onOpenAudit, onDispatch, logAudit }) {
  const [classification, setClassification] = useState(report.urgency);
  const [team, setTeam] = useState(TEAM_OPTIONS[2]);
  const [closingMode, setClosingMode] = useState("proof");
  const [proof, setProof] = useState(null);
  const [reason, setReason] = useState(CLOSURE_REASONS[0]);
  const [explanation, setExplanation] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [savingResolution, setSavingResolution] = useState(false);
  const resolved = report.status === "Verified Fixed";
  const language = useMemo(() => languageScan(report.text ?? ""), [report.text]);
  const hasPhotoEvidence = Boolean(report.photos?.length && report.incidentId);
  const canResolve = closingMode === "proof" ? Boolean(proof || hasPhotoEvidence) : Boolean(reason && explanation.trim().length >= 10);

  function toggleRaw() {
    const next = !showRaw;
    setShowRaw(next);
    if (next) logAudit({ reportId: report.id, actor: "Admin", action: "Unfiltered text view", detail: "Admin viewed the original un-sanitized report text." });
  }

  async function resolve() {
    if (!canResolve || resolved) return;
    const changes = { status: "Verified Fixed" };
    if (closingMode === "proof") {
      changes.closure = { proof: proof || "responder-transport-proof.jpg", at: stamp(true), by: "Admin" };
    } else {
      changes.closure = { reason, note: explanation.trim(), at: stamp(true), by: "Admin" };
    }
    setSavingResolution(true);
    try {
      const saved = await onResolve(report.id, changes, closingMode === "proof" ? "proof" : "no-proof");
      if (saved) onClose();
    } finally {
      setSavingResolution(false);
    }
  }

  function publish() {
    if (!resolved || report.published) return;
    onPublish(report.id);
  }

  function applyDispatch() {
    const maintenance = classification === "Non-Emergency Infrastructure";
    const changes = {
      urgency: classification,
      routedTo: maintenance ? "Barangay Maintenance (Infrastructure)" : "BDRRMO (Emergency)",
      team: maintenance ? team : "BDRRMO Response",
      status: "In Progress",
      emergencyVerified: maintenance ? undefined : (report.emergencyVerified ?? true),
    };
    logAudit({ reportId: report.id, actor: "Admin", action: "Triage & dispatch", detail: `Classified “${classification}” → ${changes.routedTo}${maintenance ? ` • assigned ${team}` : ""}.` });
    onDispatch(report.id, changes);
    onClose();
  }

  return (
    <>
      <div className="gf-drawer-backdrop" onClick={onClose} />
      <aside className="gf-drawer" role="dialog" aria-modal="true" aria-label={`Incident details ${report.id}`}>
        <header className="flex items-start justify-between gap-3 border-b border-[#e2e8eb] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-(--gf-green)">{report.id} • {report.category}</p>
            <h2 className="truncate text-[12px] font-bold text-[#263246]">{report.title}</h2>
          </div>
          <button type="button" className="gf-btn gf-btn--icon" onClick={onClose} aria-label="Close details"><X size={12} /></button>
        </header>
        <div className="gf-drawer-body">
          <ModalSection title="Intake & Geotagged Location">
            <RowList rows={[
              ["Report ID", report.id],
              ["Reporter", report.reporter],
              ["Reporter Pathway", report.reporterType === "guest"
                ? <Badge key="p" label="Guest — secure 7-day link" styles="gf-badge gf-badge--guest" />
                : <Badge key="p" label="Verified Resident (masterlist match)" styles="gf-badge gf-badge--resident" />],
              ["Date Reported", report.date],
              ["Urgency", shortUrgency(report.urgency)],
              ["Location", `${report.location}, Barangay 167`],
            ]} />
            {report.guestLink && (
              <div className="gf-note mt-2" style={{ borderColor: "#c9d7f2", background: "#f5f8ff" }}>
                <Link2 size={14} style={{ marginTop: 2, color: "#4c6fbf" }} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#3d5175]">Guest tracking link (read-only)</p>
                  <p className="mt-0.5">Token <span className="font-mono">{report.guestLink.token}</span> • issued {report.guestLink.issued} • expires {report.guestLink.expires}. The guest can track this case read-only for 7 days;
                    <button type="button" className="ml-1 underline" onClick={() => { try { navigator.clipboard?.writeText(`https://geofix167.ph/track/${report.guestLink.token}`); } catch { /* clipboard unavailable */ } toast.add({ type: "success", title: "Link copied", description: "Read-only guest tracking link copied." }); }}>copy link</button>
                  </p>
                </div>
              </div>
            )}
            <div className="gf-note mt-2">
              <MapPinned size={14} style={{ marginTop: 2, color: "var(--gf-green)" }} />
              <div>
                <p><strong>{report.geotag?.source ?? "Report location"}</strong> • accuracy {report.geotag?.accuracy ?? "Not provided"} • landmark: {report.geotag?.landmark ?? report.location}</p>
                {report.geotag?.note && <p className="mt-0.5 text-[#b45309]">{report.geotag.note}</p>}
                <p className="mt-0.5 text-[#a8b6c6]">The system never generates default or fabricated coordinate fallbacks when GPS fails.</p>
              </div>
            </div>
            {Number.isFinite(report.lat) && Number.isFinite(report.lng) ? <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
              <div className="h-[300px]">
                <MapViewer compact incidents={[{ id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng }]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} />
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-[9px] font-bold text-[#60738f]">
                <span>{report.location}, Barangay 167</span>
                <span>{report.lat.toFixed(4)} N, {report.lng.toFixed(4)} E</span>
              </div>
            </div> : <div className="gf-note gf-note--soft mt-2"><MapPinned size={14} /><span>No coordinate pin was saved. Location note: {report.location}</span></div>}
          </ModalSection>

          <ModalSection title="Multimedia Evidence (Optional)">
            {report.photos?.length && report.incidentId ? (
              <div className="grid grid-cols-2 gap-2">
                {report.photos.map((photo, index) => (
                  <a
                    key={photo.id || index}
                    href={`/api/reports/${encodeURIComponent(report.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block h-[130px] overflow-hidden rounded-lg border border-[#dfe7ea] bg-slate-100"
                  >
                    <img
                      src={`/api/reports/${encodeURIComponent(report.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                      alt={`Incident evidence ${index + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-900/75 px-2 py-0.5 text-[9px] font-bold text-white">
                      {index === report.photos.length - 1 && report.status === "Handed Over"
                        ? "Responder Transport Proof"
                        : `Evidence Photo #${index + 1}`}
                    </span>
                  </a>
                ))}
              </div>
            ) : report.evidence?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {report.evidence.includes("photo") && (
                  <div className="flex h-[120px] items-center justify-center gap-1 rounded-lg border border-[#dfe7ea] bg-[linear-gradient(150deg,#efe9dd_0%,#cdbfa8_55%,#8f8168_100%)] text-[#5c5343]"><Camera size={18} /><span className="text-[9px] font-bold">photo-evidence.jpg</span></div>
                )}
                {report.evidence.includes("video") && (
                  <div className="flex h-[120px] items-center justify-center gap-1 rounded-lg border border-[#dfe7ea] bg-[linear-gradient(150deg,#33312c_0%,#6b665a_60%,#a39c8d_100%)] text-white"><Video size={18} /><span className="text-[9px] font-bold">clip-evidence.mp4 • 0:42</span></div>
                )}
              </div>
            ) : (
              <div className="gf-note gf-note--soft">
                <ShieldCheck size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                <span>{report.reporterType === "guest" ? "No photo evidence is attached. Guest reports need at least one photo before submission." : "No media is attached. Residents may add photo or video evidence when useful."}</span>
              </div>
            )}
          </ModalSection>

          <ModalSection title="Report Language (Auto-Sanitized)">
            <div className="gf-note gf-note--soft" style={{ alignItems: "center" }}>
              <Languages size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
              <span>Submission was never blocked or delayed. {language.flaggedTerms.length ? "Flagged terms were masked for all staff views:" : "No flagged language detected."}</span>
            </div>
            {language.flaggedTerms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {language.flaggedTerms.map((term, i) => <span key={`${term}-${i}`} className="gf-badge gf-badge--alert">{term.trim()} → masked</span>)}
              </div>
            )}
            <div className="mt-2 rounded-lg border border-[#e0e7eb] bg-white p-3 text-[10px] leading-4 text-[#42506a]">
              <p className="mb-1 text-[8px] font-bold uppercase text-[#7184a0]">Sanitized copy (default view)</p>
              <p>{report.text ? language.sanitized : report.accident ? <span className="text-[#7184a0]">Description is optional for emergencies. Review based on the photo evidence.</span> : <span className="text-[#7184a0]">No description. See photo evidence.</span>}</p>
            </div>
            <div className="mt-1.5 rounded-lg border border-dashed border-[#e7c9c9] bg-[#fffafa] p-3 text-[10px] leading-4 text-[#7a3040]">
              <p className="mb-1 flex items-center gap-1 text-[8px] font-bold uppercase text-[#b04646]">
                <button type="button" onClick={toggleRaw} aria-pressed={showRaw} className="flex items-center gap-1 uppercase" style={{ fontSize: 8 }}>
                  {showRaw ? <EyeOff size={9} /> : <Eye size={9} />}{showRaw ? "Hide" : "Show"} unfiltered view (admin only)
                </button>
              </p>
              {showRaw && <p>{report.text || (report.accident ? "Description is optional for emergencies. Review based on the photo evidence." : "No description. See photo evidence.")}</p>}
              {!showRaw && <p className="text-[#b9c6d2]">Hidden. Every unfiltered view is written to the immutable audit trail.</p>}
            </div>
          </ModalSection>

          {isEmergency(report) && report.medical && (
            <ModalSection title="On-Scene & Medical Tracking (BDRRMO)">
              <RowList rows={[
                ["Identified Injuries", report.medical.injuries],
                ["Capability Match", report.medical.capability],
                ["Routed Hospital", report.medical.hospital],
                ["Route to Hospital", report.medical.route ?? "—"],
              ]} />
            </ModalSection>
          )}

          {report.external?.length > 0 && (
            <ModalSection title="External Unit Status">
              <div className="grid gap-1.5">
                {report.external.map((unit) => <p key={unit} className="rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-2.5 py-2 text-[9px] font-medium text-[#60738f]"><Siren size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4, color: "var(--gf-green)" }} />{unit}</p>)}
              </div>
            </ModalSection>
          )}

          {report.duplicateOf && (
            <ModalSection title="Duplicate Handling">
              <div className="gf-note gf-note--soft">
                <GitMerge size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                <span>This report is linked to master incident <strong>{report.duplicateOf}</strong>. It stays for the record but no longer drives dispatch on its own.</span>
              </div>
            </ModalSection>
          )}

          {(report.responders || report.fieldStage) && (
            <ModalSection title="Responder & Field Status">
              {report.responders && <RowList rows={[
                ["Assigned Tanod", `${TANODS.find((t) => t.id === report.responders.tanod)?.name ?? report.responders.tanod} (${report.responders.tanod})`],
                ["Vehicle", `${VEHICLES.find((v) => v.id === report.responders.vehicle)?.type ?? report.responders.vehicle}`],
                ["Acceptance", report.responders.accepted ? `Accepted • ${report.responders.accepted}` : "Awaiting acceptance"],
                ["Privacy-scoped GPS", report.gpsEnded ? "Off — duty completed" : "On during response only"],
              ]} />}
              <StageTrack stage={report.fieldStage} className="mt-2" />
              {report.handover && (
                <div className="gf-note gf-note--soft mt-2">
                  <QrCode size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                  <span>QR handover acknowledged by <strong>{report.handover.scannedBy}</strong> • {report.handover.at}</span>
                </div>
              )}
            </ModalSection>
          )}

          {report.qr && (
            <ModalSection title="QR Follow-up Data">
              <RowList rows={[["Admitting Hospital", report.qr.hospital], ["Incident Description", report.qr.description], ["Contact Person", report.qr.contact]]} />
            </ModalSection>
          )}

          <ModalSection title="Evidence-Gated Closure">
            {resolved ? (
              <RowList rows={[
                ["Closure mode", report.closure?.reason ? "Documented no-proof reason" : "Proof uploaded"],
                report.closure?.reason ? ["Reason", `${report.closure.reason} — ${report.closure.note}`] : ["Proof", report.closure?.proof],
                ["Closed at", `${report.closure?.at ?? "—"} by ${report.closure?.by ?? "—"}`],
              ]} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={`gf-option ${closingMode === "proof" ? "gf-option--active" : ""}`} onClick={() => setClosingMode("proof")}>
                    <FileUp size={13} />
                    <span>Upload proof of response/repair</span>
                  </button>
                  <button type="button" className={`gf-option ${closingMode === "reason" ? "gf-option--active" : ""}`} onClick={() => setClosingMode("reason")}>
                    <FileText size={13} />
                    <span>Document why proof is unavailable</span>
                  </button>
                </div>
                {closingMode === "proof" && (
                  <>
                    <label htmlFor="proof-upload" className="mt-2 flex flex-col items-center gap-1 rounded-lg border border-dashed border-(--gf-green-border) bg-[#f8fafb] p-4 text-center hover:border-(--gf-green)">
                      <FileUp size={18} style={{ color: "var(--gf-green)" }} />
                      <span className="text-[10px] font-bold text-[#263246]">Upload proof of response/repair</span>
                      <span className="text-[9px] text-[#60738f]">Photos or video of the completed repair or response.</span>
                      <input id="proof-upload" type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => event.target.files[0] && setProof(event.target.files[0].name)} />
                    </label>
                    {proof && <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-(--gf-green)"><CheckCircle2 size={12} />{proof} uploaded.</p>}
                  </>
                )}
                {closingMode === "reason" && (
                  <div className="mt-2 grid gap-2">
                    <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Reason
                      <select className="gf-select" value={reason} onChange={(event) => setReason(event.target.value)} style={{ color: "#42506a", height: 32 }}>
                        {CLOSURE_REASONS.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Explanation (min 10 characters)
                      <textarea rows={2} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="e.g. Live wires removed by Meralco at 21:40; recording was unsafe…" className="rounded-md border border-[#d5dee3] px-2 py-1.5 text-[10px] outline-none focus:border-(--gf-green)" />
                    </label>
                    <p className="text-[9px] text-[#7184a0]">Closing without media still requires this documented reason — the closure is recorded in the audit trail either way.</p>
                  </div>
                )}
              </>
            )}
          </ModalSection>

          {report.published && (
            <ModalSection title="Publishing">
              <div className="gf-note gf-note--soft">
                <CheckCircle2 size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                <span>Published {report.published.at} — “{report.published.summary}”</span>
              </div>
            </ModalSection>
          )}

          {!resolved && (
            <ModalSection title="Urgency Classification & Team Assignment">
              <div className="grid grid-cols-3 gap-2">
                {URGENCY_OPTS.map((option) => (
                  <button key={option} type="button" aria-pressed={classification === option} onClick={() => setClassification(option)}
                    className={`gf-option ${classification === option ? "gf-option--active" : ""}`}>
                    {option === "Critical Emergency" ? <Siren size={13} /> : option === "Standard Emergency" ? <Bell size={13} /> : <Wrench size={13} />}
                    <span>{shortUrgency(option)}</span>
                  </button>
                ))}
              </div>
              {classification === "Non-Emergency Infrastructure" ? (
                <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Assign maintenance team
                  <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={team} onChange={(event) => setTeam(event.target.value)}>
                    {TEAM_OPTIONS.slice(1).map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              ) : (
                <div className="gf-note gf-note--soft">
                  <Siren size={13} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                  <span>Emergencies route to BDRRMO Response. Use <strong>Actions → Request Responder</strong> for responder backup or reassignment.</span>
                </div>
              )}
              <div className="flex justify-end">
                <button type="button" className="gf-btn gf-btn--primary" onClick={applyDispatch}>
                  {classification === "Non-Emergency Infrastructure" ? "Classify & Assign Team" : "Confirm Dispatch"}
                </button>
              </div>
            </ModalSection>
          )}
        </div>
        <footer className="gf-modal-foot" style={{ justifyContent: "space-between", borderTop: "1px solid #e2e8eb" }}>
          <p className="min-w-0 flex-1 text-[9px] text-[#7184a0]">
            {resolved
              ? (report.closure?.reason ? "Closed with a documented no-proof reason." : "Resolution proof is recorded.")
              : (closingMode === "proof"
                ? "Closure is evidence-gated: upload proof of response/repair."
                : "Document why proof is unavailable to close without media.")}
          </p>
          {!report.published && resolved && (
            <button type="button" className="gf-btn gf-btn--cancel" onClick={publish}>
              <Share2 size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Publish Privacy-Safe Summary
            </button>
          )}
          {report.published && <span className="gf-badge gf-badge--fixed"><CheckCircle2 size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />Published</span>}
          <button type="button" className="gf-btn gf-btn--cancel" onClick={() => onOpenAudit(report.id)}><History size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Audit</button>
          <button type="button" disabled={resolved || !canResolve || savingResolution} className="gf-btn gf-btn--primary" onClick={resolve}>{savingResolution ? "Saving report…" : "Mark as Resolved"}</button>
        </footer>
      </aside>
    </>
  );
}

export default IncidentDrawer;
