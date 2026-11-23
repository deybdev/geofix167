/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const Context = createContext(null);

const now = () =>
  new Date().toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

function formatElapsed(submittedAt) {
  const ts = Date.parse(submittedAt);
  if (!Number.isFinite(ts)) return "Just now";
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function BdrrmoDemoProvider({ children }) {
  const [incidents, setIncidents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [supportRequests, setSupportRequests] = useState([]);
  const [responders, setResponders] = useState([]);
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
            elapsed: formatElapsed(item.submittedAt),
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
            acceptedAt: unit.status !== "DISPATCHED" ? unit.dispatched_at : null,
            completedAt: unit.status === "COMPLETED" ? unit.dispatched_at : null,
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
      if (data.departmentCounts && typeof data.departmentCounts === "object") {
        setDepartmentCounts({
          fire: Number(data.departmentCounts.fire) || 0,
          police: Number(data.departmentCounts.police) || 0,
          tanod: Number(data.departmentCounts.tanod) || 0,
        });
      }

      const liveHandovers = Array.isArray(data.handovers)
        ? data.handovers.map((h) => ({
            id: h.id.slice(0, 10).toUpperCase(),
            incidentId: h.incident_id,
            receiver: h.receiving_officer_name || "Receiving Hospital ER",
            receiverType: "Hospital",
            organization: "Receiving Hospital",
            officer: h.receiving_officer_name || "Pending scan",
            method: "Protected QR",
            qrStatusCode: h.qr_status_code || "PENDING_ACCEPTANCE",
            authenticatedReceiver: false,
            createdAt: h.created_at,
            acceptedAt: h.accepted_at,
            expiresAt: h.expires_at,
            remarks: h.receiving_remarks || "Hospital QR handover generated by Tanod.",
          }))
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
      title: falseReport ? "Flagged as False Report" : "Incident rejected",
      body: `Incident ${serverIncidentId} was ${falseReport ? "flagged as a false report" : "rejected"} by BDRRMO.`,
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

  const value = {
    incidents,
    assignments,
    supportRequests,
    handovers,
    responders,
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
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useBdrrmoDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("BdrrmoDemoProvider is required");
  return value;
}
