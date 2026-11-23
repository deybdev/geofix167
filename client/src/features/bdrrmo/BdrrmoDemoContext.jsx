/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { assignments as seedAssignments, handovers, incidents as seedIncidents, responders as seedResponders, supportRequests as seedSupport, vehicles as seedVehicles } from "./mockData";

const Context = createContext(null);
const now = () => new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" });

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
    const timer = window.setTimeout(() => {
      const incomingIncident = {
        id: "GF-106",
        title: "Collapsed wall near Barangay Hall",
        category: "Structural",
        location: "Barangay Hall perimeter",
        priorityCode: "P1",
        incidentStatusCode: "FORWARDED_TO_BDRRMO",
        reviewType: "BDRRMO_ESCALATION",
        elapsed: "00:08",
        lat: 14.7308,
        lng: 121.0159,
        submittedAt: "2026-11-19 08:52",
        description: "Resident reported a collapsed perimeter wall with possible injuries nearby. Immediate assessment requested.",
        media: ["PHOTO"],
        timeline: ["SUBMITTED", "UNDER_REVIEW", "FORWARDED_TO_BDRRMO"],
      };
      setIncidents((current) => (current.some((i) => i.id === incomingIncident.id) ? current : [incomingIncident, ...current]));
      addNotification({
        incidentId: "GF-106",
        type: "INCIDENT_REVIEW",
        title: "New emergency report received",
        body: "GF-106 was forwarded to BDRRMO and needs immediate review.",
      });
    }, 6000);

    return () => window.clearTimeout(timer);
  }, []);

  const refresh = () => {
    if (sync.state === "syncing") return;
    setSync((s) => ({ ...s, state: "syncing" }));
    setTimeout(() => setSync({ state: "success", lastUpdated: now() }), 700);
  };

  const markRead = (id) => setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllRead = () => setNotifications((current) => current.map((n) => ({ ...n, read: true })));

  const assign = (incidentId, responderId) => {
    if (assignments.some((a) => a.incidentId === incidentId && !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode))) return false;
    if (responders.find((r) => r.id === responderId)?.availabilityStatus !== "AVAILABLE") return false;
    setAssignments((current) => [
      ...current,
      { id: `TA-${Date.now()}`, incidentId, responderId, statusCode: "OFFERED", assignedAt: now(), acceptedAt: null, completedAt: null, notes: null },
    ]);
    setResponders((current) => current.map((r) => (r.id === responderId ? { ...r, availabilityStatus: "BUSY", updated: "Just now" } : r)));
    setIncidents((current) => current.map((i) => (i.id === incidentId ? { ...i, incidentStatusCode: "ASSIGNED", timeline: [...i.timeline, "ASSIGNED"] } : i)));
    addNotification({ incidentId, type: "ASSIGNMENT", title: "Assignment offered", body: `A Tanod assignment for ${incidentId} is now OFFERED.` });
    setSync({ state: "success", lastUpdated: now() });
    return true;
  };

  const advanceAssignment = (incidentId) => {
    const assignment = assignments.find((a) => a.incidentId === incidentId && !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode));
    if (!assignment) return false;
    const next = { OFFERED: "ACCEPTED", ACCEPTED: "EN_ROUTE", EN_ROUTE: "ON_SCENE", ON_SCENE: "COMPLETED" }[assignment.statusCode];
    if (!next) return false;
    setAssignments((current) =>
      current.map((a) =>
        a.id === assignment.id
          ? { ...a, statusCode: next, acceptedAt: next === "ACCEPTED" ? now() : a.acceptedAt, completedAt: next === "COMPLETED" ? now() : a.completedAt }
          : a,
      ),
    );
    if (next === "COMPLETED") {
      setResponders((current) => current.map((r) => (r.id === assignment.responderId ? { ...r, availabilityStatus: "AVAILABLE", updated: "Just now" } : r)));
    }
    const incidentNext = { ACCEPTED: "ASSIGNED", EN_ROUTE: "EN_ROUTE", ON_SCENE: "ON_SCENE", COMPLETED: "FOR_CLOSURE_REVIEW" }[next];
    setIncidents((current) => current.map((i) => (i.id === incidentId ? { ...i, incidentStatusCode: incidentNext, timeline: [...i.timeline, incidentNext] } : i)));
    addNotification({ incidentId, type: next === "COMPLETED" ? "CLOSURE_REVIEW" : "ASSIGNMENT", title: `Assignment ${next}`, body: `${incidentId} moved to ${incidentNext}.` });
    setSync({ state: "success", lastUpdated: now() });
    return true;
  };

  const releaseAssignment = (incidentId) => {
    const assignment = assignments.find((a) => a.incidentId === incidentId && !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode));
    if (!assignment) return false;
    setAssignments((current) =>
      current.map((a) => (a.id === assignment.id ? { ...a, statusCode: "COMPLETED", completedAt: now() } : a)),
    );
    setResponders((current) => current.map((r) => (r.id === assignment.responderId ? { ...r, availabilityStatus: "AVAILABLE", updated: "Just now" } : r)));
    setIncidents((current) =>
      current.map((i) =>
        i.id === incidentId && !["FOR_CLOSURE_REVIEW", "CLOSED"].includes(i.incidentStatusCode)
          ? { ...i, incidentStatusCode: "FOR_CLOSURE_REVIEW", timeline: [...(i.timeline || []), "FOR_CLOSURE_REVIEW"] }
          : i,
      ),
    );
    addNotification({ incidentId, type: "CLOSURE_REVIEW", title: "Deployment released", body: `${incidentId} deployment marked clear and moved to closure review.` });
    setSync({ state: "success", lastUpdated: now() });
    return true;
  };

  const setResponderAvailability = (responderId, availabilityStatus) => {
    setResponders((current) => current.map((r) => (r.id === responderId ? { ...r, availabilityStatus, updated: "Just now" } : r)));
    setSync({ state: "success", lastUpdated: now() });
  };

  const setVehicleAvailability = (vehicleId, availabilityStatus) => {
    setVehicles((current) => current.map((v) => (v.id === vehicleId ? { ...v, availabilityStatus, updated: "Just now" } : v)));
    setSync({ state: "success", lastUpdated: now() });
  };

  const requestSupport = (incidentId) => {
    if (supportRequests.some((s) => s.incidentId === incidentId && !["COMPLETED", "CANCELLED", "DECLINED", "UNAVAILABLE"].includes(s.statusCode))) return false;
    setSupportRequests((current) => [
      ...current,
      { id: `SR-${Date.now()}`, incidentId, organization: "Police / BFP", statusCode: "REQUESTED", requestedAt: now(), acceptedAt: null, completedAt: null, reason: "BDRRMO operational support request." },
    ]);
    addNotification({ incidentId, type: "SUPPORT_REQUEST", title: "External support requested", body: `Support request for ${incidentId} is REQUESTED.` });
    setSync({ state: "success", lastUpdated: now() });
    return true;
  };

  const closeIncident = (incidentId) => {
    setIncidents((current) =>
      current.map((i) => (i.id === incidentId && i.incidentStatusCode === "FOR_CLOSURE_REVIEW" ? { ...i, incidentStatusCode: "CLOSED", timeline: [...i.timeline, "CLOSED"] } : i)),
    );
    addNotification({ incidentId, type: "CLOSURE_REVIEW", title: "Incident closed", body: `${incidentId} is now CLOSED.` });
    setSync({ state: "success", lastUpdated: now() });
  };

  const reset = () => {
    setIncidents(seedIncidents);
    setAssignments(seedAssignments);
    setSupportRequests(seedSupport);
    setResponders(seedResponders);
    setVehicles(seedVehicles);
    setSync({ state: "success", lastUpdated: now() });
  };

  const value = {
    incidents,
    assignments,
    supportRequests,
    handovers,
    responders,
    vehicles,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    sync,
    refresh,
    markRead,
    markAllRead,
    assign,
    advanceAssignment,
    releaseAssignment,
    setResponderAvailability,
    setVehicleAvailability,
    requestSupport,
    closeIncident,
    reset,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useBdrrmoDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("BdrrmoDemoProvider is required");
  return value;
}
