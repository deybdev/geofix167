import { getReportDetails } from './residentService';

const ACTIVE = ['ON_SCENE', 'EN_ROUTE', 'ACCEPTED', 'DISPATCHED', 'OFFERED'];
const utcTime = value => Date.parse(typeof value === 'string'
  ? value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2Z') : value);

export function trackingState(report) {
  // GPS is position data only. Completed/declined/cancelled units cannot lead
  // an active response, and only the parent report can confirm final closure.
  const units = (report.dispatched_units || [])
    .filter(unit => ACTIVE.includes(unit.status))
    .map(unit => ({
      ...unit,
      roleCode: unit.role,
      role: { fire: 'BFP Fire Protection', police: 'PNP Police Responder', tanod: 'Barangay Tanod', bdrrmo: 'BDRRMO Responder' }[unit.role] || 'Responder',
      phone: unit.phone || null,
      location: unit.location && Number.isFinite(unit.location.lat) && Number.isFinite(unit.location.lng)
        ? { ...unit.location, updatedAt: utcTime(unit.location.updated_at) || null } : null,
    }))
    .sort((a, b) => ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status));
  const has = status => units.some(unit => unit.status === status);
  const status = report.status_id === 10 ? 'resolved'
    : [11, 12].includes(report.status_id) ? 'inactive'
      : report.status_id === 9 ? 'closure_review'
        : report.status_id === 8 || has('ON_SCENE') ? 'arrived'
          : report.status_id === 7 || has('EN_ROUTE') ? 'on_the_way'
            : units.length || [6, 13].includes(report.status_id) ? 'dispatched'
              : [4, 5, 14].includes(report.status_id) ? 'validated' : 'received';
  const activeUnits = ['resolved', 'inactive'].includes(status) ? [] : units;
  const leadResponder = activeUnits.find((u) => Boolean(u.location)) || activeUnits[0] || null;
  return {
    report: {
      id: report.public_id, status, status_label: report.status_label,
      priority: { Critical: 1, High: 2, Moderate: 3, Low: 4 }[report.urgency] || null,
      location: Number.isFinite(report.latitude) && Number.isFinite(report.longitude)
        ? { lat: report.latitude, lng: report.longitude } : null,
    },
    units: activeUnits,
    responder: leadResponder,
  };
}

export function subscribeToTracking(reportId, handlers) {
  if (!reportId || reportId === 'demo') {
    handlers.onUnavailable();
    return () => {};
  }
  const controller = new AbortController();
  let busy = false;
  let stopped = false;
  let confirmed = false;
  const poll = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const { data } = await getReportDetails(reportId, { signal: controller.signal });
      if (stopped) return;
      if (!data?.report || data.report.public_id !== reportId) {
        throw Object.assign(new Error('Report unavailable'), { status: 404 });
      }
      const state = trackingState(data.report);
      confirmed = true;
      handlers.onReport(state.report);
      handlers.onResponders(state.units);
      handlers.onResponder(state.responder);
    } catch (error) {
      if (stopped) return;
      if ([401, 403, 404].includes(error.status)) {
        stopped = true;
        handlers.onUnavailable();
      } else {
        if (!confirmed) handlers.onUnavailable();
        handlers.onError(new Error('Tracking updates are unavailable. Retrying automatically.'));
      }
    } finally {
      busy = false;
    }
  };
  void poll();
  const timer = setInterval(poll, 4000);
  return () => {
    stopped = true;
    controller.abort();
    clearInterval(timer);
  };
}
