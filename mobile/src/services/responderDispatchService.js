import api from './api';

export async function getResponderDispatches(status) {
  const { data } = await api.get('/responder/dispatches', {
    params: status ? { status } : undefined,
  });
  if (!Array.isArray(data?.dispatches)) {
    throw new Error('The server returned an invalid dispatch list.');
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
