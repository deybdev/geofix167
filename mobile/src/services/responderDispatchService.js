import api from './api';

export async function getResponderDispatches(status, role) {
  const { data } = await api.get('/responder/dispatches', {
    params: status ? { status } : undefined,
  });
  if (!Array.isArray(data?.dispatches)) {
    throw new Error('The server returned an invalid dispatch list.');
  }
  if (['police', 'fire'].includes(String(role || '').toLowerCase())) {
    return data.dispatches.filter((item) => !item?.is_maintenance);
  }
  return data.dispatches;
}

export async function updateResponderDispatchStatus(id, status) {
  const { data } = await api.patch(`/responder/dispatches/${id}/status`, { status });
  if (!data?.ok) throw new Error('The dispatch status could not be updated.');
  return data;
}

export async function postResponderLocation(assignmentId, coords) {
  const { data } = await api.post('/responder/location', {
    assignment_id: assignmentId,
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy ?? null,
    heading: coords.heading == null || coords.heading < 0 ? null : coords.heading,
  });
  if (!data?.ok) throw new Error('Responder location was not accepted.');
  return data;
}

export async function createResponderDispatch(dispatch) {
  const { data } = await api.post('/responder/dispatches', dispatch);
  if (!data?.ok) throw new Error('The dispatch could not be saved.');
  return data;
}

export async function getGuestEmergencies() {
  const { data } = await api.get('/responder/dispatches/guest-emergencies');
  if (!Array.isArray(data?.emergencies)) {
    throw new Error('The server returned an invalid guest emergency list.');
  }
  return data.emergencies;
}

export async function generateHospitalQrHandover(dispatchId, payload = {}) {
  const { data } = await api.post(`/responder/dispatches/${dispatchId}/qr-handover`, payload);
  if (!data?.ok || !data.token) {
    throw new Error('Could not generate hospital QR handover.');
  }
  return data;
}

export async function getNearestHospitals(lat, lng) {
  const { data } = await api.get('/responder/dispatches/hospitals', {
    params: lat != null && lng != null ? { lat, lng } : undefined,
  });
  return Array.isArray(data?.hospitals) ? data.hospitals : [];
}

export async function submitMaintenanceInspection(dispatchId, payload = {}) {
  const { data } = await api.post(`/responder/dispatches/${dispatchId}/maintenance-inspection`, payload);
  if (!data.ok) throw new Error('Could not submit inspection proof.');
  return data;
}

export async function submitMaintenanceRepair(dispatchId, payload = {}) {
  const { data } = await api.post(`/responder/dispatches/${dispatchId}/maintenance-repair`, payload);
  if (!data.ok) throw new Error('Could not submit proof of repair.');
  return data;
}

export async function completeAgencyDispatch(dispatchId, payload = {}) {
  const { data } = await api.post(`/responder/dispatches/${dispatchId}/complete-agency`, payload);
  if (!data.ok) throw new Error('Could not submit agency resolution report.');
  return data;
}

export async function requestFieldBackup(dispatchId, payload = {}) {
  const { data } = await api.post(`/responder/dispatches/${dispatchId}/request-backup`, payload);
  if (!data.ok) throw new Error('Could not send backup request.');
  return data;
}

export async function markArrivedOnScene(dispatchId, payload = {}) {
  const { data } = await api.post(`/responder/dispatches/${dispatchId}/arrive`, payload);
  if (!data.ok) throw new Error('Could not update on-scene status.');
  return data;
}

function confirmedDuty(data) {
  if (data?.ok !== true || typeof data.on_duty !== 'boolean') throw new Error('Invalid duty status response.');
  return data.on_duty;
}

export async function getResponderDutyStatus() {
  const { data } = await api.get('/responder/dispatches/duty-status');
  return confirmedDuty(data);
}

export async function updateResponderDutyStatus(onDuty) {
  if (typeof onDuty !== 'boolean') throw new Error('Duty status must be a boolean.');
  const { data } = await api.patch('/responder/dispatches/duty-status', {
    on_duty: onDuty,
  });
  if (confirmedDuty(data) !== onDuty) throw new Error('Duty change was not confirmed.');
  return data.on_duty;
}
