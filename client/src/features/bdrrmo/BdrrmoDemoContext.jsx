/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const Context = createContext(null);

const now = () =>
  new Date().toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

function parseUtcTimestamp(value) {
  if (!value) return NaN;
  const text = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? text.replace(" ", "T") + "Z"
    : text;
  return Date.parse(normalized);
}

function formatPhDateTime(value) {
  const ts = parseUtcTimestamp(value);
  if (!Number.isFinite(ts)) return value ? String(value) : null;
  return new Date(ts).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function parseHandoverRemarks(raw) {
  if (!raw || typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return { further_info: trimmed };
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? parsed : { further_info: trimmed };
  } catch {
    return { further_info: trimmed };
  }
}

function formatElapsed(submittedAt, endAt) {
  const startTs = parseUtcTimestamp(submittedAt);
  if (!Number.isFinite(startTs)) return "Just now";
  const endTs = endAt ? parseUtcTimestamp(endAt) : Date.now();
  const refTs = Number.isFinite(endTs) ? endTs : Date.now();
  const mins = Math.max(0, Math.floor((refTs - startTs) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function BdrrmoDemoProvider({ children }) {
  const [incidents, setIncidents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [supportRequests, setSupportRequests] = useState([]);
  const [responders, setResponders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [departmentCounts, setDepartmentCounts] = useState({ fire: 0, police: 0, tanod: 0 });
  const [handovers, setHandovers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sync, setSync] = useState({ state: "syncing", lastUpdated: now() });

  const addNotification = useCallback((item) => {
    setNotifications((current) => [
      { id: `N-${Date.now()}`, createdAt: "Just now", read: false, ...item },
      ...current,
    ]);
  }, []);

  const fetchLiveOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/bdrrmo/overview", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setSync({ state: "error", lastUpdated: now() });
        return;
      }
      const data = await res.json();

      const mappedIncidents = Array.isArray(data.incidents)
        ? data.incidents.map((item) => ({
            ...item,
            elapsed: formatElapsed(item.submittedAt, item.completedAt || item.closedAt),
            media: (item.photos || []).map((p) => p.filename || "photo"),
            timeline: [item.incidentStatusCode],
          }))
        : [];
      setIncidents(mappedIncidents);

      const derivedAssignments = [];
      const derivedSupport = [];
      const liveNotifs = [];

      for (const inc of mappedIncidents) {
        if (inc.incidentStatusCode === "FORWARDED_TO_BDRRMO" && !(inc.dispatchedUnits?.length > 0)) {
          liveNotifs.push({
            id: `FWD-${inc.incidentId}`,
            incidentId: inc.id,
            type: "INCIDENT_REVIEW",
            title: "Emergency awaiting dispatch",
            body: `${inc.id} (${inc.category}) at ${inc.location} needs responder dispatch.`,
            createdAt: inc.elapsed,
          });
        }

        for (const alert of inc.backupAlerts || []) {
          derivedSupport.push({
            id: alert.id,
            incidentId: inc.id,
            organization: "Field Responder Backup",
            statusCode: "REQUESTED",
            requestedAt: alert.created_at,
            reason: alert.note.replace("[BACKUP REQUEST] ", ""),
          });
          liveNotifs.push({
            id: `BKP-${alert.id}`,
            incidentId: inc.id,
            type: "SUPPORT",
            title: "Field backup requested",
            body: `${inc.id}: ${alert.note.replace("[BACKUP REQUEST] ", "")}`,
            createdAt: formatElapsed(alert.created_at),
          });
        }

        for (const unit of inc.dispatchedUnits || []) {
          derivedAssignments.push({
            id: unit.id,
            incidentId: inc.id,
            serverIncidentId: inc.incidentId,
            responderId: unit.responder_id || unit.role,
            responderLabel: unit.label,
            role: unit.role,
            statusCode: unit.status === "DISPATCHED" ? "OFFERED" : unit.status,
            assignedAt: unit.dispatched_at || now(),
            acceptedAt: unit.accepted_at || null,
            completedAt: unit.completed_at || null,
            notes: null,
          });
        }
      }

      setAssignments(derivedAssignments);
      setSupportRequests(derivedSupport);

      setNotifications((prev) => {
        const readIds = new Set(prev.filter((n) => n.read).map((n) => n.id));
        const manualNotifs = prev.filter((n) => n.id.startsWith("N-"));
        const mergedLive = liveNotifs.map((n) => ({
          ...n,
          read: readIds.has(n.id),
        }));
        return [...manualNotifs.slice(0, 10), ...mergedLive];
      });

      const liveResponders = Array.isArray(data.responders)
        ? data.responders.map((r) => ({
            id: r.id,
            name: r.responder_name || r.display_name,
            unit: r.display_name,
            resourceType: r.resource_type,
            availabilityStatus: r.availability_status || "AVAILABLE",
            updated: r.updated_at ? formatElapsed(r.updated_at) : "Live",
          }))
        : [];
      setResponders(liveResponders);
      // Keep Tanod Vehicles empty for now per project requirements.
      setVehicles([]);

      if (data.departmentCounts && typeof data.departmentCounts === "object") {
        setDepartmentCounts({
          fire: Number(data.departmentCounts.fire) || 0,
          police: Number(data.departmentCounts.police) || 0,
          tanod: Number(data.departmentCounts.tanod) || 0,
        });
      }

      const liveHandovers = Array.isArray(data.handovers)
        ? data.handovers.map((h) => {
            const parsed = parseHandoverRemarks(h.receiving_remarks);
            const hospitalName = typeof parsed.hospital_name === "string" && parsed.hospital_name.trim()
              ? parsed.hospital_name.trim()
              : null;
            const furtherInfo = typeof parsed.further_info === "string" ? parsed.further_info.trim() : "";
            const patients = Array.isArray(parsed.patients) ? parsed.patients : [];
            const proofMediaId = typeof parsed.proof_media_id === "string" ? parsed.proof_media_id : null;
            return {
              id: h.id.slice(0, 10).toUpperCase(),
              incidentId: h.incident_id,
              incidentRef: h.reference_number || h.incident_id,
              receiver: hospitalName || h.receiving_officer_name || "Receiving Hospital ER",
              receiverType: "Hospital",
              organization: hospitalName || "Receiving Hospital",
              officer: h.receiving_officer_name || "Pending scan",
              method: "Protected QR",
              qrStatusCode: h.qr_status_code || "PENDING_ACCEPTANCE",
              authenticatedReceiver: false,
              createdAt: formatPhDateTime(h.created_at) || "—",
              acceptedAt: formatPhDateTime(h.accepted_at),
              expiresAt: formatPhDateTime(h.expires_at),
              hospitalName,
              furtherInfo,
              patients,
              proofMediaId,
              remarks: furtherInfo || "Hospital QR handover generated by Tanod.",
            };
          })
        : [];
      setHandovers(liveHandovers);

      setSync({ state: "success", lastUpdated: now() });
    } catch {
      setSync({ state: "error", lastUpdated: now() });
    }
  }, []);

  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      void fetchLiveOverview();
    }, 0);
    const timer = window.setInterval(fetchLiveOverview, 5000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [fetchLiveOverview]);

  const refresh = useCallback(() => {
    setSync((s) => ({ ...s, state: "syncing" }));
    void fetchLiveOverview();
  }, [fetchLiveOverview]);

  const markRead = (id) =>
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  const markAllRead = () =>
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));

  const batchDispatch = async (serverIncidentId, payload) => {
    const res = await fetch(
      `/api/bdrrmo/incidents/${encodeURIComponent(serverIncidentId)}/dispatch`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Dispatch failed.");
    addNotification({
      incidentId: serverIncidentId,
      type: "ASSIGNMENT",
      title: "Batch dispatch sent",
      body: `Dispatched ${(data.dispatched_departments || []).join(", ") || "units"}${data.tanod_dispatched ? " + Tanod Transport" : ""}.`,
    });
    await fetchLiveOverview();
    return data;
  };

  const broadcastNote = async (serverIncidentId, note) => {
    const res = await fetch(
      `/api/bdrrmo/incidents/${encodeURIComponent(serverIncidentId)}/note`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Could not send tactical note.");
    await fetchLiveOverview();
    return data;
  };

  const rejectServerIncident = async (serverIncidentId, { falseReport = false, reason = "" } = {}) => {
    const res = await fetch(
      `/api/bdrrmo/incidents/${encodeURIComponent(serverIncidentId)}/reject`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ false_report: falseReport, reason }),
      },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Could not reject incident.");
    addNotification({
      incidentId: serverIncidentId,
      type: "CLOSURE",
      title: "Report Flagged",
      body: `Incident ${serverIncidentId} was flagged by BDRRMO.`,
    });
    await fetchLiveOverview();
    return data;
  };

  const rejectCompletionReport = async (serverIncidentId, { reason = "", targetRole, photoLabel, photoId } = {}) => {
    const res = await fetch(
      `/api/bdrrmo/incidents/${encodeURIComponent(serverIncidentId)}/reject-completion`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          ...(targetRole ? { target_role: targetRole } : {}),
          ...(photoLabel ? { photo_label: photoLabel } : {}),
          ...(photoId ? { photo_id: photoId } : {}),
        }),
      },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Could not reject completion report.");
    addNotification({
      incidentId: serverIncidentId,
      type: "CLOSURE",
      title: "Completion proof rejected",
      body: `Responders on ${serverIncidentId} were notified to refill their completion report.`,
    });
    await fetchLiveOverview();
    return data;
  };

  const closeServerIncident = async (serverIncidentId) => {
    const res = await fetch(
      `/api/bdrrmo/incidents/${encodeURIComponent(serverIncidentId)}/close`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Could not close incident.");
    addNotification({
      incidentId: serverIncidentId,
      type: "CLOSURE",
      title: "Incident closed",
      body: `Incident ${serverIncidentId} closed and summary sent to Admin.`,
    });
    await fetchLiveOverview();
    return data;
  };

  const setResponderAvailability = (responderId, availabilityStatus) => {
    setResponders((current) =>
      current.map((r) => (r.id === responderId ? { ...r, availabilityStatus, updated: "Just now" } : r)),
    );
  };

  const setVehicleAvailability = (vehicleId, availabilityStatus) => {
    setVehicles((current) =>
      current.map((v) => (v.id === vehicleId ? { ...v, availabilityStatus, updated: "Just now" } : v)),
    );
  };

  const assign = async (incidentId, responderId) => {
    const match = incidents.find((i) => i.id === incidentId || i.incidentId === incidentId);
    if (!match) return false;
    await batchDispatch(match.incidentId || incidentId, {
      departments: ["tanod"],
      tanod_unit_id: responderId || null,
    });
    return true;
  };

  const closeIncident = async (incidentId) => {
    const match = incidents.find((i) => i.id === incidentId || i.incidentId === incidentId);
    await closeServerIncident(match?.incidentId || incidentId);
  };

  const value = {
    incidents,
    assignments,
    supportRequests,
    handovers,
    responders,
    vehicles,
    departmentCounts,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    sync,
    refresh,
    markRead,
    markAllRead,
    batchDispatch,
    broadcastNote,
    rejectServerIncident,
    rejectCompletionReport,
    closeServerIncident,
    assign,
    advanceAssignment: () => false,
    releaseAssignment: () => false,
    setResponderAvailability,
    setVehicleAvailability,
    requestSupport: () => false,
    closeIncident,
    reset: refresh,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useBdrrmoDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("BdrrmoDemoProvider is required");
  return value;
}
