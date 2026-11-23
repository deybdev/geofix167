import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, RotateCcw, Minimize2, Maximize2, AlertTriangle, Clock3, MapPin, BellRing } from "lucide-react";
import { PATHS } from "../../router/paths";
import { Chip, DrawerSection, InfoRow } from "./ui";
import { statusTone, priorityTone } from "./constants";
import { displayStatus, INCIDENT_STATUS, PRIORITY, QR_STATUS } from "./statusModel";
import { validateIncident } from "./validation";
import { useBdrrmoDemo } from "./BdrrmoDemoContext";
import ConfirmationDialog from "../../shared/components/ConfirmationDialog";
import MapViewer from "../../shared/components/MapViewer";
import { toast } from "../../shared/components/ui/toast";
import { Flame, Shield, ShieldCheck, Truck, UserCheck, X, Camera, TriangleAlert, Send, CheckCircle2, MapPinned, Navigation, Handshake } from "lucide-react";

function IncidentTable({ rows, onOpen, emptyLabel = "No incidents found." }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <section
        className={`overflow-hidden rounded-xl border border-[#e2e8eb] bg-white shadow-sm ${
          expanded ? "fixed inset-4 z-50 flex flex-col shadow-2xl" : ""
        }`}
      >
        <header className="flex items-center justify-between border-b border-[#edf0f2] px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-[#263246]">Incident records</h3>
            <p className="text-[10px] text-[#60738f]">{rows.length} matching records</p>
          </div>
          <button
            type="button"
            title={expanded ? "Minimize" : "Maximize"}
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-[#dfe7ea] p-2 text-(--gf-green)"
            aria-label={expanded ? "Minimize table" : "Maximize table"}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </header>

        <div className={`overflow-x-auto ${expanded ? "min-h-0 flex-1" : ""}`}>
          <table className="w-full min-w-[920px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[10px] font-bold uppercase tracking-wider text-[#60738f]">
                {["Incident", "Category", "Location", "Priority", "Status", "Dispatched Units", "Elapsed", "Action"].map(
                  (h) => (
                    <th className="px-4 py-3.5" key={h}>{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const units = item.dispatchedUnits || [];
                const hasBackupAlert = item.backupAlerts?.length > 0;
                return (
                  <tr
                    id={`incident-${item.id}`}
                    key={item.id}
                    className={`border-b border-[#f1f4f6] transition-colors last:border-b-0 hover:bg-(--gf-row-hover)`}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-(--gf-green)">{item.id}</span>
                      <div className="mt-0.5 text-[12px] font-semibold text-[#263246]">{item.title}</div>
                      {hasBackupAlert && (
                        <div className="mt-1">
                          <Chip className="bg-[#fdecea] text-[#dc2626]">
                            <AlertTriangle size={9} /> Backup Requested
                          </Chip>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Chip className="bg-[#eef2f4] text-[#60738f]">{item.category}</Chip>
                    </td>
                    <td className="px-4 py-3.5 text-[#60738f]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} className="shrink-0 text-(--gf-green)" />
                        {item.location}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Chip className={priorityTone(item.priorityCode)}>
                        {item.priorityCode} · {displayStatus(PRIORITY, item.priorityCode).split(",")[0]}
                      </Chip>
                    </td>
                    <td className="px-4 py-3.5">
                      <Chip className={statusTone(item.incidentStatusCode)}>
                        {displayStatus(INCIDENT_STATUS, item.incidentStatusCode)}
                      </Chip>
                    </td>
                    <td className="px-4 py-3.5">
                      {units.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {units.map((u) => (
                            <Chip key={u.id} className={statusTone(u.status)}>
                              {u.role.toUpperCase()} · {u.status}
                            </Chip>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] italic text-[#94a3b8]">Unassigned</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#60738f]">
                      <Clock3 size={11} className="mr-1 inline" />
                      {item.elapsed}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[11px] font-bold text-white transition hover:-translate-y-px hover:bg-(--gf-green-dark) focus-visible:outline-2 focus-visible:outline-(--gf-green)"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-[#60738f]">
                    {emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {expanded && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/30"
          aria-label="Minimize table"
          onClick={() => setExpanded(false)}
        />
      )}
    </>
  );
}

export function IncidentDrawer({ incident: initialIncident, onClose, onOpenHandover }) {
  const {
    incidents,
    handovers,
    responders,
    batchDispatch,
    broadcastNote,
    verifyClosureForAdmin,
    closeServerIncident,
  } = useBdrrmoDemo();

  const incident = incidents.find((i) => i.id === initialIncident.id) ?? initialIncident;

  const fireLocked = Boolean(incident.lockedDepartments?.fire);
  const policeLocked = Boolean(incident.lockedDepartments?.police);

  const [includeFire, setIncludeFire] = useState(fireLocked);
  const [includePolice, setIncludePolice] = useState(policeLocked);
  const [selectedTanodId, setSelectedTanodId] = useState("");
  const [tacticalNoteDraft, setTacticalNoteDraft] = useState("");
  const [showLiveTrackingMap, setShowLiveTrackingMap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  useEffect(() => {
    if (!incident.incidentId) return undefined;
    let active = true;
    const loadChat = async () => {
      try {
        const res = await fetch(`/api/reports/${encodeURIComponent(incident.incidentId)}/messages`, {
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
  }, [incident.incidentId]);

  async function handleSendChatMessage() {
    if (!incident.incidentId || !chatDraft.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(incident.incidentId)}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: chatDraft.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not send message.");
      if (data?.message) {
        setChatMessages((prev) => [...prev, data.message]);
      }
      setChatDraft("");
    } catch (err) {
      toast.add({ type: "error", title: "Message failed", description: err.message });
    } finally {
      setSendingChat(false);
    }
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const availableTanods = responders.filter(
    (r) =>
      !["UNAVAILABLE", "OUT_OF_SERVICE"].includes(r.availabilityStatus) &&
      (!r.resourceType || r.resourceType === "TANOD"),
  );
  const dispatchedUnits = incident.dispatchedUnits || [];
  const linkedHandovers = handovers.filter(
    (h) => h.incidentId === incident.incidentId || h.incidentId === incident.id,
  );

  const incidentErrors = validateIncident(incident);
  const selectedTanod = responders.find((r) => r.id === selectedTanodId) || null;
  const dispatchErrors = [];
  if (!(includeFire || fireLocked || includePolice || policeLocked || selectedTanodId)) {
    dispatchErrors.push("Select at least one department (BFP / Police) or a Tanod.");
  }
  if (selectedTanod && ["UNAVAILABLE", "OUT_OF_SERVICE"].includes(selectedTanod.availabilityStatus)) {
    dispatchErrors.push("Selected Tanod is offline or out of service.");
  }
  const canBatchDispatch = dispatchErrors.length === 0 && incident.incidentStatusCode !== "CLOSED";

  const pendingUnits = dispatchedUnits.filter(
    (u) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(u.status),
  );
  const closureWarnings = [];
  if (dispatchedUnits.length === 0) {
    closureWarnings.push("No responder units have been dispatched yet.");
  }
  if (pendingUnits.length > 0) {
    closureWarnings.push(`${pendingUnits.length} dispatched unit(s) are still active on this incident.`);
  }
  if (linkedHandovers.some((h) => h.qrStatusCode === "PENDING_ACCEPTANCE")) {
    closureWarnings.push("A hospital QR handover is still pending acceptance.");
  }

  const hasCoordinates = Number.isFinite(Number(incident.lat)) && Number.isFinite(Number(incident.lng));
  const liveTrackers = dispatchedUnits
    .filter((u) => u.location && Number.isFinite(u.location.lat) && Number.isFinite(u.location.lng))
    .map((u) => ({
      id: u.id,
      lat: u.location.lat,
      lng: u.location.lng,
      category: u.role === "fire" ? "fire" : u.role === "police" ? "crime" : "incident",
      label: u.label,
    }));

  async function handleBatchDispatch() {
    if (!canBatchDispatch || submitting) return;
    setSubmitting(true);
    try {
      const departments = [];
      if (includeFire || fireLocked) departments.push("fire");
      if (includePolice || policeLocked) departments.push("police");
      await batchDispatch(incident.incidentId, {
        departments,
        tanod_unit_id: selectedTanodId || null,
        tactical_note: tacticalNoteDraft.trim() || undefined,
      });
      setTacticalNoteDraft("");
      setSelectedTanodId("");
      toast.add({
        type: "success",
        title: "Dispatch sent",
        description: `${incident.id} dispatched to selected responders.`,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Dispatch failed", description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBroadcastNote() {
    if (!tacticalNoteDraft.trim() || submitting) return;
    setSubmitting(true);
    try {
      await broadcastNote(incident.incidentId, tacticalNoteDraft.trim());
      setTacticalNoteDraft("");
      toast.add({
        type: "success",
        title: "Tactical note sent",
        description: "Broadcast to all dispatched units on this incident.",
      });
    } catch (err) {
      toast.add({ type: "error", title: "Failed to send note", description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyForAdmin() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await verifyClosureForAdmin(incident.incidentId);
      toast.add({
        type: "success",
        title: "Verified & forwarded to Admin",
        description: `${incident.id} resolution verified by BDRRMO and sent to Admin for final closure.`,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Verification failed", description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAuthorizeClosure() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await closeServerIncident(incident.incidentId);
      setConfirmCloseOpen(false);
      toast.add({
        type: "success",
        title: "Incident closed",
        description: `${incident.id} closed and synced to Admin.`,
      });
    } catch (err) {
      toast.add({ type: "error", title: "Closure failed", description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close emergency drawer"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default border-0 bg-slate-900/40 backdrop-blur-[2px] [animation:gf-fade-in_0.18s_ease-out]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Manage emergency ${incident.id}`}
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-[#e2e8eb] bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.25)] [animation:gf-drawer-in_0.22s_ease-out] sm:w-[44%] sm:min-w-[520px] sm:max-w-[700px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf0f2] bg-(--gf-green-soft) px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold text-(--gf-green)">{incident.id}</h2>
              <Chip className={statusTone(incident.incidentStatusCode)}>
                {displayStatus(INCIDENT_STATUS, incident.incidentStatusCode)}
              </Chip>
              <Chip className={priorityTone(incident.priorityCode)}>
                {incident.priorityCode}
              </Chip>
              <Chip className="bg-[#eef2f4] text-[#60738f]">{incident.category}</Chip>
            </div>
            <p className="mt-1 truncate text-[11px] font-semibold text-[#263246]">
              {incident.title} • {incident.location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#60738f] transition hover:bg-white hover:text-(--gf-green)"
          >
            <X size={16} />
          </button>
        </header>

        <div className="gf-drawer-body">
          {incidentErrors.length > 0 && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded">{incidentErrors.join(", ")}</div>}

          <DrawerSection title="Incident Lifecycle Timeline" icon={Clock3} collapsible defaultOpen={false}>
            <div className="space-y-2 text-[10px] text-[#60738f]">
              {(incident.timeline || []).map((status, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-(--gf-green)" />
                  <span>{displayStatus(INCIDENT_STATUS, status)}</span>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection title="Emergency Report & Reporter" icon={ShieldCheck}>
            <div>
              <InfoRow label="Incident ID">{incident.id}</InfoRow>
              <InfoRow label="Category">{incident.category}</InfoRow>
              <InfoRow label="Priority">
                {incident.priorityCode} · {displayStatus(PRIORITY, incident.priorityCode)}
              </InfoRow>
              <InfoRow label="Reporter">
                {incident.reporterName || "Guest Reporter"}
                {incident.reporterPhone ? ` · ${incident.reporterPhone}` : ""}
              </InfoRow>
              <InfoRow label="Submitted">{incident.submittedAt}</InfoRow>
              <InfoRow label="Dispatched Units">
                {dispatchedUnits.length ? `${dispatchedUnits.length} unit(s)` : "None yet"}
              </InfoRow>
            </div>
            {incident.description && (
              <p className="mt-2 rounded-md border border-[#e0e7eb] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#42506a]">
                <span className="font-bold text-[#263246]">Report description:</span> {incident.description}
              </p>
            )}
          </DrawerSection>

          {linkedHandovers.length > 0 && (
            <DrawerSection title="Linked Hospital QR Handovers" icon={Handshake} collapsible defaultOpen={false}>
              <div className="space-y-2">
                {linkedHandovers.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-lg border border-[#e0e7eb] bg-white p-3 text-[11px] group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-[10px] font-bold text-(--gf-green)">{h.id}</strong>
                      <Chip className={statusTone(h.qrStatusCode)}>
                        {displayStatus(QR_STATUS, h.qrStatusCode)}
                      </Chip>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="block text-[#7c8ba3]">Receiver</span>
                        <span className="block font-semibold text-[#263246]">{h.receiver}</span>
                      </div>
                      <div>
                        <span className="block text-[#7c8ba3]">Officer</span>
                        <span className="block font-semibold text-[#263246]">{h.officer}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] mt-1">
                      <div>
                        <span className="block text-[#7c8ba3]">Created</span>
                        <span className="block font-semibold text-[#263246]">{h.createdAt}</span>
                      </div>
                      <div>
                        <span className="block text-[#7c8ba3]">Accepted</span>
                        <span className="block font-semibold text-[#263246]">{h.acceptedAt ?? "Pending scan"}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenHandover(h);
                      }}
                      className="mt-2 w-full rounded-md border border-[#dfe7ea] bg-[#f8fafb] px-3 py-1.5 text-[10px] font-bold text-(--gf-green) transition hover:bg-(--gf-green-soft)/50"
                    >
                      Open Handover Record
                    </button>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}

          {incident.backupAlerts?.length > 0 && (
            <DrawerSection title="Field Backup / Transport Alerts" icon={TriangleAlert}>
              <div className="space-y-2">
                {incident.backupAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-[#f3d3d3] bg-[#fdecea] p-3 text-[11px] text-[#991b1b]">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={13} />
                      <span>{alert.note.replace("[BACKUP REQUEST] ", "")}</span>
                    </div>
                    <p className="mt-1 text-[9px] text-[#b91c1c]">{alert.created_at}</p>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}

          {incident.incidentStatusCode !== "CLOSED" && (
            <DrawerSection title="Single / Batch Dispatch (BFP, Police & Tanod Transport)" icon={UserCheck}>
              <div
                className={`space-y-3 rounded-lg border border-[#e0e7eb] bg-[#f8fafb] p-3.5 ${
                  incident.bdrrmoVerified ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-[11px] font-bold transition ${
                      fireLocked
                        ? "cursor-not-allowed border-[#f3d3d3] bg-[#fdecea] text-[#dc2626]"
                        : includeFire
                          ? "border-(--gf-green) bg-(--gf-green-soft) text-(--gf-green)"
                          : "border-[#dfe7ea] bg-white text-[#263246]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={includeFire || fireLocked}
                        disabled={fireLocked}
                        onChange={(e) => setIncludeFire(e.target.checked)}
                      />
                      <Flame size={13} className="text-[#dc2626]" />
                      BFP (Fire)
                    </span>
                    {fireLocked && <Lock size={12} title="Auto-locked for Fire incidents" />}
                  </label>

                  <label
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-[11px] font-bold transition ${
                      policeLocked
                        ? "cursor-not-allowed border-[#cbd5f5] bg-[#eef2fb] text-[#4c6fbf]"
                        : includePolice
                          ? "border-(--gf-green) bg-(--gf-green-soft) text-(--gf-green)"
                          : "border-[#dfe7ea] bg-white text-[#263246]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={includePolice || policeLocked}
                        disabled={policeLocked}
                        onChange={(e) => setIncludePolice(e.target.checked)}
                      />
                      <Shield size={13} className="text-[#4c6fbf]" />
                      Police (PNP)
                    </span>
                    {policeLocked && <Lock size={12} title="Auto-locked for Crime incidents" />}
                  </label>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wide text-[#7184a0]">
                    Assign Available Tanod (Emergency Patient Transport)
                  </label>
                  <select
                    value={selectedTanodId}
                    onChange={(e) => setSelectedTanodId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-[#dfe7ea] bg-white px-2.5 text-[11px] font-semibold text-[#263246] outline-none focus:border-(--gf-green)"
                  >
                    <option value="">— Optional: No Tanod transport assigned —</option>
                    {availableTanods.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.unit}) — {t.availabilityStatus}
                      </option>
                    ))}
                  </select>
                </div>

                {dispatchErrors.length > 0 && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-[#e69500]">
                    <TriangleAlert size={11} />
                    {dispatchErrors[0]}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!canBatchDispatch || submitting}
                  onClick={handleBatchDispatch}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-(--gf-green) py-2.5 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Truck size={14} />
                  {submitting ? "Dispatching..." : "Dispatch / Batch Dispatch Selected Units"}
                </button>
              </div>
            </DrawerSection>
          )}

          <DrawerSection title="Geotagged Location & Live Unit Tracking" icon={MapPinned}>
            <div className="mb-2.5 flex items-center justify-between rounded-lg border border-[#e0e7eb] bg-white px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[#263246]">
                <Navigation size={13} className="text-(--gf-green)" />
                <span>Show Live Responder Tracking Map ({liveTrackers.length} live GPS)</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showLiveTrackingMap}
                onClick={() => setShowLiveTrackingMap((v) => !v)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  showLiveTrackingMap ? "bg-(--gf-green)" : "bg-[#c8d2da]"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    showLiveTrackingMap ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {showLiveTrackingMap && hasCoordinates && (
              <div className="mb-3 overflow-hidden rounded-lg border border-[#dfe7ea]">
                <div className="h-[220px]">
                  <MapViewer
                    compact
                    incidents={[
                      {
                        id: incident.id,
                        title: incident.title,
                        category: fireLocked ? "fire" : policeLocked ? "crime" : "emergency",
                        status: incident.incidentStatusCode,
                        lat: Number(incident.lat),
                        lng: Number(incident.lng),
                      },
                    ]}
                    selectedIncident={{ id: incident.id, lat: Number(incident.lat), lng: Number(incident.lng) }}
                    trackers={liveTrackers}
                    allowOutsideBounds
                    allowOutsideIncidents
                  />
                </div>
                <div className="flex items-center justify-between bg-[#f8fafb] px-3 py-2 text-[9px] font-bold text-[#60738f]">
                  <span>{incident.location}, Barangay 167</span>
                  <span>
                    {Number(incident.lat).toFixed(4)} N, {Number(incident.lng).toFixed(4)} E
                  </span>
                </div>
              </div>
            )}

            {dispatchedUnits.length > 0 ? (
              <div className="space-y-1.5">
                {dispatchedUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between rounded-lg border border-[#e0e7eb] bg-white px-3 py-2 text-[11px]"
                  >
                    <div>
                      <strong className="text-[#263246]">{unit.label}</strong>
                      <p className="text-[9px] text-[#7c8ba3]">
                        {unit.location
                          ? `Live GPS: ${unit.location.lat.toFixed(4)}, ${unit.location.lng.toFixed(4)}`
                          : "Awaiting live GPS ping"}
                      </p>
                    </div>
                    <Chip className={statusTone(unit.status)}>{unit.status}</Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#7c8ba3]">No units dispatched to this emergency yet.</p>
            )}
          </DrawerSection>

          <DrawerSection title="Direct Emergency Chat (Resident & Field Units)" icon={Send} collapsible defaultOpen={false}>
            <div className="space-y-2 rounded-lg border border-[#e0e7eb] bg-[#f8fafb] p-3">
              {chatMessages.length === 0 ? (
                <p className="py-2 text-center text-[10px] text-[#7c8ba3]">
                  No messages yet. Send a message below to chat directly with the reporting Resident and assigned units.
                </p>
              ) : (
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {chatMessages.map((msg) => {
                    const isDispatcher = ["bdrrmo", "admin"].includes(String(msg.sender_role || "").toLowerCase());
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                          isDispatcher
                            ? "ml-6 bg-(--gf-green) text-white"
                            : "mr-6 border border-[#dfe7ea] bg-white text-[#263246]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[9px] font-bold opacity-80">
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

              {incident.incidentStatusCode !== "CLOSED" && (
                <div className="flex gap-2 pt-1">
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
                    className="h-9 flex-1 rounded-md border border-[#dfe7ea] bg-white px-3 text-[11px] text-[#263246] outline-none focus:border-(--gf-green)"
                  />
                  <button
                    type="button"
                    disabled={!chatDraft.trim() || sendingChat}
                    onClick={handleSendChatMessage}
                    className="flex items-center gap-1 rounded-md bg-(--gf-green) px-3 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:opacity-40"
                  >
                    <Send size={12} />
                    {sendingChat ? "..." : "Reply"}
                  </button>
                </div>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Shared Tactical Dispatch Notes" icon={Send} collapsible defaultOpen={false}>
            <div className="flex gap-2">
              <input
                value={tacticalNoteDraft}
                onChange={(e) => setTacticalNoteDraft(e.target.value)}
                placeholder="e.g. Road blocked on Rizal St — use Magsaysay Blvd..."
                className="h-9 flex-1 rounded-md border border-[#dfe7ea] bg-white px-3 text-[11px] text-[#263246] outline-none focus:border-(--gf-green)"
              />
              <button
                type="button"
                disabled={!tacticalNoteDraft.trim() || submitting}
                onClick={handleBroadcastNote}
                className="flex items-center gap-1 rounded-md bg-(--gf-green) px-3 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:opacity-40"
              >
                <Send size={12} />
                Send
              </button>
            </div>
            {incident.tacticalNotes?.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {incident.tacticalNotes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md border border-[#dfe7ea] bg-(--gf-green-soft)/60 px-3 py-2 text-[11px] text-[#263246]"
                  >
                    {n.note.replace("[BDRRMO NOTE] ", "")}
                    <span className="ml-2 text-[9px] text-[#60738f]">{n.created_at}</span>
                  </li>
                ))}
              </ul>
            )}
          </DrawerSection>

          {incident.agencyReports?.length > 0 && (
            <DrawerSection title="Submitted Field Resolution Reports" icon={CheckCircle2}>
              <ul className="space-y-2">
                {incident.agencyReports.map((rep) => (
                  <li
                    key={rep.id}
                    className="rounded-lg border border-(--gf-green-tint-2) bg-(--gf-green-soft) p-3 text-[11px] text-[#263246]"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-(--gf-green)">
                      <CheckCircle2 size={13} />
                      <span>{rep.note.replace("[AGENCY REPORT] ", "")}</span>
                    </div>
                    <p className="mt-1 text-[9px] text-[#60738f]">{rep.created_at}</p>
                  </li>
                ))}
              </ul>
            </DrawerSection>
          )}

          <DrawerSection title="Evidence & Responder Completion Proof Photos" icon={Camera} last>
            {incident.photos?.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {incident.photos.map((photo, idx) => {
                  const fname = String(photo.filename || "");
                  const label = /^fire-/i.test(fname)
                    ? "BFP Completion Proof"
                    : /^police-/i.test(fname)
                      ? "Police Completion Proof"
                      : /^tanod-/i.test(fname)
                        ? "Tanod Transport Proof"
                        : photo.by_staff
                          ? `Responder Proof #${idx + 1}`
                          : `Reporter Photo #${idx + 1}`;
                  return (
                    <a
                      key={photo.id}
                      href={`/api/reports/${encodeURIComponent(incident.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block h-[120px] overflow-hidden rounded-lg border border-[#dfe7ea] bg-slate-100"
                    >
                      <img
                        src={`/api/reports/${encodeURIComponent(incident.incidentId)}/photos/${encodeURIComponent(photo.id)}`}
                        alt={photo.filename}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[8px] font-bold text-white">
                        {label}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-[#7c8ba3]">No photos uploaded yet.</p>
            )}
          </DrawerSection>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf0f2] bg-(--gf-green-soft) px-5 py-3">
          {incident.incidentStatusCode === "CLOSED" ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-(--gf-green)">
              <CheckCircle2 size={12} /> Incident is closed and synced to Admin.
            </span>
          ) : incident.bdrrmoVerified ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-(--gf-green)">
              <CheckCircle2 size={12} /> Verified by BDRRMO — forwarded to Admin for final closure.
            </span>
          ) : closureWarnings.length > 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[#e69500]">
              <TriangleAlert size={11} /> {closureWarnings[0]}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-(--gf-green)">
              <CheckCircle2 size={12} /> All units completed — ready for BDRRMO verification.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#dfe7ea] bg-white px-3 py-2 text-[10px] font-bold text-[#60738f] transition hover:text-(--gf-green)"
            >
              Close
            </button>
            {incident.incidentStatusCode !== "CLOSED" &&
              !incident.bdrrmoVerified &&
              closureWarnings.length === 0 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleVerifyForAdmin}
                  className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Sending..." : "Verify & Send to Admin"}
                </button>
              )}
          </div>
        </footer>
      </aside>

      <ConfirmationDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        onConfirm={handleAuthorizeClosure}
        title="Authorize coordinated closure?"
        description={
          closureWarnings.length > 0
            ? `${incident.id}: ${closureWarnings.join(" ")} Close this incident anyway and sync to Admin?`
            : `${incident.id} will be marked CLOSED and synced to Admin.`
        }
        confirmLabel="Authorize Closure"
      />
    </>
  );
}

export default function BdrrmoIncidents() {
  const { incidents } = useBdrrmoDemo();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incomingReports, setIncomingReports] = useState([]);
  const seenIncidentIdsRef = useRef(new Set());
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const incidentId = searchParams.get("incident");
    if (!incidentId) return;
    const match = incidents.find((item) => item.id === incidentId);
    if (!match) return;
    queueMicrotask(() => {
      setSelectedIncident(match);
      setSearchParams({}, { replace: true });
    });
  }, [incidents, searchParams, setSearchParams]);

  useEffect(() => {
    const currentIds = new Set(incidents.map((i) => i.id));

    if (!hasInitializedRef.current) {
      seenIncidentIdsRef.current = currentIds;
      hasInitializedRef.current = true;
      return;
    }

    const newIncidents = incidents.filter((i) => !seenIncidentIdsRef.current.has(i.id));
    if (newIncidents.length > 0) {
      setIncomingReports((prev) => {
        const prevIds = new Set(prev.map((p) => p.id));
        const fresh = newIncidents.filter((i) => !prevIds.has(i.id)).map((i) => ({
          id: i.id,
          incident: i,
          receivedAt: new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
        }));
        return [...fresh, ...prev].slice(0, 5);
      });
    }

    seenIncidentIdsRef.current = currentIds;
  }, [incidents]);

  useEffect(() => {
    if (incomingReports.length === 0) return undefined;
    const timer = window.setTimeout(() => {
      setIncomingReports((prev) => prev.slice(0, -1));
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [incomingReports]);

  const dismissIncoming = (id) => {
    setIncomingReports((prev) => prev.filter((item) => item.id !== id));
  };

  const filtered = useMemo(
    () =>
      incidents.filter((item) => {
        const matchesQuery = `${item.id} ${item.title} ${item.category} ${item.location}`
          .toLowerCase()
          .includes(query.toLowerCase());
        if (!matchesQuery) return matchesQuery;
        return true;
      }),
    [query, incidents],
  );

  return (
    <div className="space-y-5">
      {incomingReports.length > 0 && (
        <div className="fixed right-4 top-20 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
          {incomingReports.map((report) => (
            <div
              key={report.id}
              role="status"
              aria-live="polite"
              className="overflow-hidden rounded-xl border border-[#cfe0d5] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]"
            >
              <div className="flex items-start gap-3 p-4">
                <span className="mt-0.5 rounded-lg bg-(--gf-green-soft) p-2 text-(--gf-green)">
                  <BellRing size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-(--gf-green)">
                        Incoming Report
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-[#263246]">{report.incident.id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissIncoming(report.id)}
                      className="rounded-md p-1 text-[#7c8ba3] transition hover:bg-[#f3f6f8] hover:text-[#263246]"
                      aria-label={`Dismiss notification for ${report.incident.id}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#42506a]">{report.incident.title}</p>
                  <p className="mt-1 text-[11px] text-[#60738f]">
                    {report.incident.category} • {report.incident.location}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-[#7c8ba3]">Received {report.receivedAt}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIncident(report.incident);
                        dismissIncoming(report.id);
                      }}
                      className="rounded-md bg-(--gf-green) px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-(--gf-green-dark)"
                    >
                      View Incident
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="flex gap-2 rounded-xl border border-[#e2e8eb] bg-white p-3">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-[#dfe7ea] px-3 focus-within:border-(--gf-green)">
          <Search size={14} className="text-[#7c8ba3]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full text-xs text-[#263246] outline-none"
            placeholder="Search incident ID, category, title, or location..."
          />
        </label>
        <button
          type="button"
          onClick={() => setQuery("")}
          className="flex items-center gap-1.5 rounded-lg border border-[#dfe7ea] px-3 text-xs font-bold text-[#60738f] hover:border-(--gf-green) hover:text-(--gf-green)"
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </section>

      <IncidentTable
        rows={filtered}
        onOpen={setSelectedIncident}
        emptyLabel="No emergencies match this filter."
      />

      {selectedIncident && (
        <IncidentDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onOpenHandover={(handover) => {
            setSelectedIncident(null);
            navigate(`${PATHS.bdrrmoHandoverCompletion}?incident=${encodeURIComponent(handover.incidentId)}`);
          }}
        />
      )}
    </div>
  );
}
