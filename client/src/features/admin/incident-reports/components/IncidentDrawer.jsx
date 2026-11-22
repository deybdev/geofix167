import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  GitMerge,
  History,
  Languages,
  MapPinned,
  Send,
  Share2,
  ShieldCheck,
  Siren,
  Wrench,
  X,
} from "lucide-react";
import MapViewer from "../../../../shared/components/MapViewer";
import { Badge, ModalSection, RowList, stamp } from "../../../../shared/components/GovernanceUi";
import { CLOSURE_REASONS, TEAM_OPTIONS, URGENCY_OPTS } from "../constants";
import { languageScan, shortUrgency } from "../utils";

function photoBadgeLabel(photo, index) {
  const fname = String(photo?.filename || "");
  if (/^fire-/i.test(fname)) return "BFP Completion Proof";
  if (/^police-/i.test(fname)) return "Police Completion Proof";
  if (/^tanod-/i.test(fname)) return "Tanod Transport Proof";
  if (photo?.by_staff) return `Responder Proof #${index + 1}`;
  return `Reporter Photo #${index + 1}`;
}

function IncidentDrawer({ report, onClose, onResolve, onPublish, onOpenAudit, onDispatch, logAudit }) {
  const [classification, setClassification] = useState(report.urgency);
  const [team, setTeam] = useState(TEAM_OPTIONS[2]);
  const [closingMode, setClosingMode] = useState("proof");
  const [proof, setProof] = useState(null);
  const [reason, setReason] = useState(CLOSURE_REASONS[0]);
  const [explanation, setExplanation] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [savingResolution, setSavingResolution] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  useEffect(() => {
    if (!report.incidentId) return undefined;
    let active = true;
    const loadChat = async () => {
      try {
        const res = await fetch(`/api/reports/${encodeURIComponent(report.incidentId)}/messages`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
        }
      } catch {
        // Ignore transient chat poll errors
      }
    };
    void loadChat();
    const timer = window.setInterval(loadChat, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [report.incidentId]);

  async function handleSendChatMessage() {
    if (!report.incidentId || !chatDraft.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(report.incidentId)}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: chatDraft.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.message) {
        setChatMessages((prev) => [...prev, data.message]);
        setChatDraft("");
      }
    } finally {
      setSendingChat(false);
    }
  }

  const resolved = report.status === "Verified Fixed";
  const handedOver = report.status === "Handed Over";
  const isTriagePending = report.status === "Reported" || report.status === "BDRRMO Takeover";

  const language = useMemo(() => languageScan(report.text ?? ""), [report.text]);
  const allPhotos = useMemo(() => (Array.isArray(report.photos) ? report.photos : []), [report.photos]);
  const responderProofPhotos = useMemo(
    () =>
      allPhotos.filter(
        (p) => p.by_staff || /^(fire|police|tanod)-/i.test(String(p.filename || "")),
      ),
    [allPhotos],
  );
  const reporterIntakePhotos = useMemo(
    () =>
      allPhotos.filter(
        (p) => !p.by_staff && !/^(fire|police|tanod)-/i.test(String(p.filename || "")),
      ),
    [allPhotos],
  );

  const hasPhotoEvidence = Boolean(
    (allPhotos.length && report.incidentId) ||
    responderProofPhotos.length ||
    report.agencyReports?.length ||
    report.bdrrmoVerified,
  );
  const canResolve =
    closingMode === "proof"
      ? Boolean(proof || hasPhotoEvidence)
      : Boolean(reason && explanation.trim().length >= 10);

  function toggleRaw() {
    const next = !showRaw;
    setShowRaw(next);
    if (next) {
      logAudit({
        reportId: report.id,
        actor: "Admin",
        action: "Unfiltered text view",
        detail: "Admin viewed the original un-sanitized report text.",
      });
    }
  }

  async function resolve() {
    if (!canResolve || resolved) return;
    const changes = { status: "Verified Fixed" };
    if (closingMode === "proof") {
      const proofNames =
        responderProofPhotos.map((p) => p.filename).filter(Boolean).join(", ") ||
        proof ||
        "Responder completion proof on file";
      changes.closure = { proof: proofNames, at: stamp(true), by: "Admin" };
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
    logAudit({
      reportId: report.id,
      actor: "Admin",
      action: "Triage & dispatch",
      detail: `Classified “${classification}” → ${changes.routedTo}${maintenance ? ` • assigned ${team}` : ""}.`,
    });
    onDispatch(report.id, changes);
    onClose();
  }

  return (
    <>
      <div className="gf-drawer-backdrop" onClick={onClose} />
      <aside className="gf-drawer" role="dialog" aria-modal="true" aria-label={`Incident details ${report.id}`}>
        <header className="flex items-start justify-between gap-3 border-b border-[#e2e8eb] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-(--gf-green)">
              {report.id} • {report.category}
            </p>
            <h2 className="truncate text-[12px] font-bold text-[#263246]">{report.title}</h2>
          </div>
          <button type="button" className="gf-btn gf-btn--icon" onClick={onClose} aria-label="Close details">
            <X size={12} />
          </button>
        </header>

        <div className="gf-drawer-body">
          <ModalSection title="Incident Overview & Location">
            <RowList
              rows={[
                ["Report ID", report.id],
                ["Reporter", report.reporter],
                [
                  "Reporter Type",
                  report.reporterType === "guest" ? (
                    <Badge key="p" label="Guest Reporter" styles="gf-badge gf-badge--guest" />
                  ) : (
                    <Badge key="p" label="Verified Resident" styles="gf-badge gf-badge--resident" />
                  ),
                ],
                ["Date Reported", report.date],
                ["Urgency", shortUrgency(report.urgency)],
                ["Location", `${report.location}, Barangay 167`],
              ]}
            />

            {Number.isFinite(report.lat) && Number.isFinite(report.lng) ? (
              <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
                <div className="h-[220px]">
                  <MapViewer
                    compact
                    incidents={[
                      {
                        id: report.id,
                        title: report.title,
                        category: report.category,
                        status: report.status,
                        lat: report.lat,
                        lng: report.lng,
                      },
                    ]}
                    selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }}
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-[9px] font-bold text-[#60738f]">
                  <span>{report.location}, Barangay 167</span>
                  <span>
                    {report.lat.toFixed(4)} N, {report.lng.toFixed(4)} E
                  </span>
                </div>
              </div>
            ) : (
              <div className="gf-note gf-note--soft mt-2">
                <MapPinned size={14} />
                <span>Location: {report.location}</span>
              </div>
            )}
          </ModalSection>

          <ModalSection title="Report Description (Auto-Sanitized)">
            <div className="rounded-lg border border-[#e0e7eb] bg-white p-3 text-[10px] leading-4 text-[#42506a]">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[8px] font-bold uppercase text-[#7184a0]">
                  <Languages size={11} className="text-(--gf-green)" />
                  {showRaw ? "Original Unfiltered Description" : "Sanitized Copy"}
                </span>
                <button
                  type="button"
                  onClick={toggleRaw}
                  aria-pressed={showRaw}
                  className="flex items-center gap-1 text-[8px] font-bold uppercase text-[#b04646]"
                >
                  {showRaw ? <EyeOff size={9} /> : <Eye size={9} />}
                  {showRaw ? "Hide raw" : "Show raw"}
                </button>
              </div>
              <p>
                {showRaw
                  ? report.text || "No description provided."
                  : report.text
                    ? language.sanitized
                    : "No description provided."}
              </p>
            </div>
          </ModalSection>

          <ModalSection title="Reporter Intake Photo(s)">
            {reporterIntakePhotos.length > 0 && report.incidentId ? (
              <div className="grid grid-cols-2 gap-2">
                {reporterIntakePhotos.map((photo, index) => (
                  <a
                    key={photo.id || index}
                    href={`/api/reports/${encodeURIComponent(report.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block h-[120px] overflow-hidden rounded-lg border border-[#dfe7ea] bg-slate-100"
                  >
                    <img
                      src={`/api/reports/${encodeURIComponent(report.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                      alt={`Reporter photo ${index + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-900/75 px-2 py-0.5 text-[8px] font-bold text-white">
                      Reporter Photo #{index + 1}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-[#7c8ba3]">No initial reporter photo attached.</p>
            )}
          </ModalSection>

          {(report.dispatchedUnits?.length > 0 ||
            report.agencyReports?.length > 0 ||
            responderProofPhotos.length > 0 ||
            report.bdrrmoVerified) && (
            <ModalSection title="Dispatched Units, Completion Proof & BDRRMO Verification">
              <div className="space-y-3">
                {report.bdrrmoVerified ? (
                  <div className="rounded-lg border border-(--gf-green-border) bg-(--gf-green-soft) p-2.5 text-[10px] text-[#263246]">
                    <p className="flex items-center gap-1.5 font-bold text-(--gf-green)">
                      <CheckCircle2 size={13} />
                      Verified by BDRRMO — Ready for Final Admin Closure
                    </p>
                    {report.bdrrmoVerificationNote && (
                      <p className="mt-1 text-[9px] text-[#60738f]">{report.bdrrmoVerificationNote}</p>
                    )}
                  </div>
                ) : report.agencyReports?.length > 0 || handedOver ? (
                  <div className="rounded-lg border border-[#f5d488] bg-[#fff9e6] p-2.5 text-[10px] text-[#78350f]">
                    <p className="font-bold text-[#b45309]">
                      Field Resolution Submitted — Ready for Verification & Closure
                    </p>
                  </div>
                ) : null}

                {report.dispatchedUnits?.length > 0 && (
                  <div className="grid gap-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#60738f]">
                      Dispatched Responder Unit(s) ({report.dispatchedUnits.length})
                    </p>
                    {report.dispatchedUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center justify-between rounded-md border border-[#dfe7ea] bg-white px-2.5 py-1.5 text-[10px]"
                      >
                        <span className="font-bold text-[#263246]">
                          {unit.name} ({unit.role.toUpperCase()})
                        </span>
                        <span className="gf-badge gf-badge--fixed">{unit.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {report.agencyReports?.length > 0 && (
                  <div className="grid gap-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#60738f]">
                      Responder Completion Notes
                    </p>
                    {report.agencyReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) p-2.5 text-[10px] text-[#263246]"
                      >
                        <p className="font-bold text-(--gf-green)">
                          {rep.note.replace("[AGENCY REPORT] ", "")}
                        </p>
                        <p className="mt-0.5 text-[8px] text-[#60738f]">{rep.created_at}</p>
                      </div>
                    ))}
                  </div>
                )}

                {responderProofPhotos.length > 0 && report.incidentId && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#60738f]">
                      <Camera size={11} className="text-(--gf-green)" />
                      Responder Completion Proof Photo(s) ({responderProofPhotos.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {responderProofPhotos.map((photo, index) => (
                        <a
                          key={photo.id || index}
                          href={`/api/reports/${encodeURIComponent(report.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="relative block h-[125px] overflow-hidden rounded-lg border border-(--gf-green-border) bg-slate-100"
                        >
                          <img
                            src={`/api/reports/${encodeURIComponent(report.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                            alt={`Responder completion proof ${index + 1}`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-emerald-900/85 px-2 py-0.5 text-[8px] font-bold text-white">
                            {photoBadgeLabel(photo, index)}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ModalSection>
          )}

          {report.incidentId && (
            <ModalSection title="Direct Emergency Chat (Resident & Dispatcher / Responders)">
              <div className="space-y-2 rounded-lg border border-[#e0e7eb] bg-[#f8fafb] p-2.5">
                {chatMessages.length === 0 ? (
                  <p className="py-1.5 text-center text-[10px] text-[#7c8ba3]">
                    No messages yet. Send a message below to chat directly with the reporting Resident.
                  </p>
                ) : (
                  <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                    {chatMessages.map((msg) => {
                      const isDispatcher = ["bdrrmo", "admin"].includes(String(msg.sender_role || "").toLowerCase());
                      return (
                        <div
                          key={msg.id}
                          className={`rounded-md px-2.5 py-1.5 text-[10px] ${
                            isDispatcher
                              ? "ml-6 bg-(--gf-green) text-white"
                              : "mr-6 border border-[#dfe7ea] bg-white text-[#263246]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[8px] font-bold opacity-80">
                            <span>
                              {msg.sender_name || "User"} ({String(msg.sender_role || "resident").toUpperCase()})
                            </span>
                            <span>
                              {msg.sent_at
                                ? new Date(msg.sent_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                                : ""}
                            </span>
                          </div>
                          <p className="mt-0.5 leading-snug">{msg.body}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!resolved && (
                  <div className="flex gap-1.5 pt-1">
                    <input
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendChatMessage();
                        }
                      }}
                      placeholder="Message the Resident reporter or field units..."
                      className="h-8 flex-1 rounded-md border border-[#dfe7ea] bg-white px-2.5 text-[10px] text-[#263246] outline-none focus:border-(--gf-green)"
                    />
                    <button
                      type="button"
                      disabled={!chatDraft.trim() || sendingChat}
                      onClick={handleSendChatMessage}
                      className="flex items-center gap-1 rounded-md bg-(--gf-green) px-2.5 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:opacity-40"
                    >
                      <Send size={11} />
                      {sendingChat ? "..." : "Reply"}
                    </button>
                  </div>
                )}
              </div>
            </ModalSection>
          )}

          {report.duplicateOf && (
            <ModalSection title="Duplicate Handling">
              <div className="gf-note gf-note--soft">
                <GitMerge size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                <span>
                  Linked to master incident <strong>{report.duplicateOf}</strong>.
                </span>
              </div>
            </ModalSection>
          )}

          {isTriagePending && !resolved && (
            <ModalSection title="Triage & Forward to BDRRMO / Maintenance">
              <div className="grid grid-cols-3 gap-2">
                {URGENCY_OPTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={classification === option}
                    onClick={() => setClassification(option)}
                    className={`gf-option ${classification === option ? "gf-option--active" : ""}`}
                  >
                    {option === "Critical Emergency" ? (
                      <Siren size={13} />
                    ) : option === "Standard Emergency" ? (
                      <Bell size={13} />
                    ) : (
                      <Wrench size={13} />
                    )}
                    <span>{shortUrgency(option)}</span>
                  </button>
                ))}
              </div>
              {classification === "Non-Emergency Infrastructure" ? (
                <label className="mt-2 grid gap-1 text-[10px] font-medium text-[#4c4c4c]">
                  Assign maintenance team
                  <select
                    className="gf-select"
                    style={{ color: "#42506a", height: 32 }}
                    value={team}
                    onChange={(event) => setTeam(event.target.value)}
                  >
                    {TEAM_OPTIONS.slice(1).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="gf-note gf-note--soft mt-2">
                  <Siren size={13} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                  <span>
                    Confirming forwards this emergency directly to <strong>BDRRMO</strong> for responder dispatch.
                  </span>
                </div>
              )}
              <div className="mt-2 flex justify-end">
                <button type="button" className="gf-btn gf-btn--primary" onClick={applyDispatch}>
                  {classification === "Non-Emergency Infrastructure"
                    ? "Classify & Assign Team"
                    : "Verify & Forward to BDRRMO"}
                </button>
              </div>
            </ModalSection>
          )}

          {!isTriagePending && (
            <ModalSection title="Final Admin Closure">
              {resolved ? (
                <RowList
                  rows={[
                    ["Status", <Badge key="s" label="Verified Fixed & Closed" styles="gf-badge gf-badge--fixed" />],
                    [
                      "Completion Evidence",
                      responderProofPhotos.length > 0
                        ? `${responderProofPhotos.length} responder proof photo(s) on file`
                        : report.closure?.reason
                          ? `${report.closure.reason} — ${report.closure.note}`
                          : report.closure?.proof || "Verified on file",
                    ],
                  ]}
                />
              ) : (
                <>
                  {responderProofPhotos.length > 0 || report.bdrrmoVerified ? (
                    <div className="gf-note gf-note--soft">
                      <ShieldCheck size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                      <span>
                        Responder completion proof is synced above. Click <strong>Mark as Resolved</strong> below to finalize case closure.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={`gf-option ${closingMode === "proof" ? "gf-option--active" : ""}`}
                          onClick={() => setClosingMode("proof")}
                        >
                          <FileUp size={13} />
                          <span>Upload proof photo</span>
                        </button>
                        <button
                          type="button"
                          className={`gf-option ${closingMode === "reason" ? "gf-option--active" : ""}`}
                          onClick={() => setClosingMode("reason")}
                        >
                          <FileText size={13} />
                          <span>Document no-proof reason</span>
                        </button>
                      </div>
                      {closingMode === "proof" && (
                        <>
                          <label
                            htmlFor="proof-upload"
                            className="mt-2 flex flex-col items-center gap-1 rounded-lg border border-dashed border-(--gf-green-border) bg-[#f8fafb] p-4 text-center hover:border-(--gf-green)"
                          >
                            <FileUp size={18} style={{ color: "var(--gf-green)" }} />
                            <span className="text-[10px] font-bold text-[#263246]">
                              Upload proof of response/repair
                            </span>
                            <input
                              id="proof-upload"
                              type="file"
                              accept="image/*,video/*"
                              className="sr-only"
                              onChange={(event) =>
                                event.target.files[0] && setProof(event.target.files[0].name)
                              }
                            />
                          </label>
                          {proof && (
                            <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-(--gf-green)">
                              <CheckCircle2 size={12} />
                              {proof} uploaded.
                            </p>
                          )}
                        </>
                      )}
                      {closingMode === "reason" && (
                        <div className="mt-2 grid gap-2">
                          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">
                            Reason
                            <select
                              className="gf-select"
                              value={reason}
                              onChange={(event) => setReason(event.target.value)}
                              style={{ color: "#42506a", height: 32 }}
                            >
                              {CLOSURE_REASONS.map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">
                            Explanation (min 10 characters)
                            <textarea
                              rows={2}
                              value={explanation}
                              onChange={(event) => setExplanation(event.target.value)}
                              placeholder="Document why media proof is unavailable…"
                              className="rounded-md border border-[#d5dee3] px-2 py-1.5 text-[10px] outline-none focus:border-(--gf-green)"
                            />
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </ModalSection>
          )}
        </div>

        <footer className="gf-modal-foot" style={{ justifyContent: "space-between", borderTop: "1px solid #e2e8eb" }}>
          <p className="min-w-0 flex-1 text-[9px] text-[#7184a0]">
            {resolved
              ? "Case closed and recorded."
              : hasPhotoEvidence
                ? "Completion proof is on file — ready for final closure."
                : "Attach completion proof or document a reason to close."}
          </p>
          {!report.published && resolved && (
            <button type="button" className="gf-btn gf-btn--cancel" onClick={publish}>
              <Share2 size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
              Publish Summary
            </button>
          )}
          <button type="button" className="gf-btn gf-btn--cancel" onClick={onClose}>
            Close
          </button>
          <button type="button" className="gf-btn gf-btn--cancel" onClick={() => onOpenAudit(report.id)}>
            <History size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
            Audit
          </button>
          {!resolved && (
            <button
              type="button"
              disabled={!canResolve || savingResolution}
              className="gf-btn gf-btn--primary"
              onClick={resolve}
            >
              {savingResolution ? "Saving…" : "Mark as Resolved"}
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}

export default IncidentDrawer;
