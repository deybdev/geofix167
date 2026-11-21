import api from './api';

const POLICE_SAMPLE_STATUSES = new Map();
const POLICE_TEST_INCIDENTS = [];

const POLICE_SAMPLE_DISPATCHES = [
  {
    id: 'sample-police-1',
    incident_id: 'sample-police-incident-1',
    incident_title: 'Robbery in progress',
    incident_category: 'Crime / Public Disturbance',
    incident_location: 'Balagtas Street, Barangay 167',
    incident_latitude: 14.7298,
    incident_longitude: 121.0118,
    target_role: 'police',
    urgency: 'Critical',
    vehicle_name: 'Police Patrol 01',
    status: 'DISPATCHED',
    dispatched_at: '2026-11-22 01:35:00',
    reporter_name: 'Maria Santos',
    reporter_phone: '0917 123 4567',
    incident_description: 'Several residents reported a robbery near the commercial area.',
    is_emergency: 1,
  },
  {
    id: 'sample-police-2',
    incident_id: 'sample-police-incident-2',
    incident_title: 'Assault reported',
    incident_category: 'Crime / Public Disturbance',
    incident_location: 'San Bartolome Road, Barangay 167',
    incident_latitude: 14.7312,
    incident_longitude: 121.0142,
    target_role: 'police',
    urgency: 'High',
    vehicle_name: 'Police Patrol 03',
    status: 'ACCEPTED',
    dispatched_at: '2026-11-22 00:48:00',
    reporter_name: 'Juan Dela Cruz',
    reporter_phone: '0928 456 7890',
    incident_description: 'A resident reported an ongoing physical assault at the roadside.',
    is_emergency: 1,
  },
  {
    id: 'sample-police-3',
    incident_id: 'sample-police-incident-3',
    incident_title: 'Hit-and-run incident',
    incident_category: 'Road Accident',
    incident_location: 'Quirino Highway, Barangay 167',
    incident_latitude: 14.7279,
    incident_longitude: 121.0096,
    target_role: 'police',
    urgency: 'High',
    vehicle_name: 'Traffic Unit 02',
    status: 'EN_ROUTE',
    dispatched_at: '2026-11-21 23:55:00',
    reporter_name: 'Anonymous Resident',
    reporter_phone: '',
    incident_description: 'A motorcycle rider requested police assistance after a hit-and-run.',
    is_emergency: 1,
  },
  {
    id: 'sample-police-4',
    incident_id: 'sample-police-incident-4',
    incident_title: 'Public disturbance resolved',
    incident_category: 'Crime / Public Disturbance',
    incident_location: 'Barangay 167 Covered Court',
    incident_latitude: 14.7304,
    incident_longitude: 121.0125,
    target_role: 'police',
    urgency: 'Moderate',
    vehicle_name: 'Police Patrol 05',
    status: 'COMPLETED',
    dispatched_at: '2026-11-21 20:20:00',
    reporter_name: 'Carmen Reyes',
    reporter_phone: '0935 222 1188',
    incident_description: 'Responding officers separated the involved parties and cleared the area.',
    is_emergency: 0,
  },
];

function policeSamples(status) {
  const samples = [...POLICE_TEST_INCIDENTS, ...POLICE_SAMPLE_DISPATCHES].map((sample) => ({
    ...sample,
    status: POLICE_SAMPLE_STATUSES.get(sample.id) || sample.status,
  }));
  return status ? samples.filter((sample) => sample.status === status) : samples;
}

export function addPoliceTestIncident() {
  const sequence = POLICE_TEST_INCIDENTS.length + 1;
  const incident = {
    id: `sample-police-test-${Date.now()}-${sequence}`,
    incident_id: `sample-police-test-report-${Date.now()}-${sequence}`,
    incident_title: 'Test incoming incident report',
    incident_category: 'Crime / Public Disturbance',
    incident_location: 'Balagtas Street near Barangay 167 Hall',
    incident_latitude: 14.7301,
    incident_longitude: 121.0121,
    target_role: 'police',
    urgency: 'Critical',
    vehicle_name: 'Police Patrol Test',
    status: 'DISPATCHED',
    dispatched_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    reporter_name: 'Test Resident',
    reporter_phone: '0917 000 0000',
    incident_description: 'Test notification: a resident reported a crime requiring police response.',
    is_emergency: 1,
  };
  POLICE_TEST_INCIDENTS.unshift(incident);
  return incident;
}

export async function getResponderDispatches(status, role) {
  const isPolice = String(role || '').toLowerCase() === 'police';
  try {
    const { data } = await api.get('/responder/dispatches', {
      params: status ? { status } : undefined,
    });
    if (!Array.isArray(data.dispatches)) {
      throw new Error('The server returned an invalid dispatch list.');
    }
    if (!isPolice) return data.dispatches;

    const realIds = new Set(data.dispatches.map((dispatch) => dispatch.id));
    const samples = policeSamples(status).filter((sample) => !realIds.has(sample.id));
    return [...data.dispatches, ...samples];
  } catch (error) {
    if (isPolice) return policeSamples(status);
    throw error;
  }
}

export async function updateResponderDispatchStatus(id, status, role) {
  if (String(role || '').toLowerCase() === 'police' && String(id).startsWith('sample-police-')) {
    POLICE_SAMPLE_STATUSES.set(id, status);
    return { ok: true, sample: true };
  }
  const { data } = await api.patch(`/responder/dispatches/${id}/status`, { status });
  if (!data.ok) throw new Error('The dispatch status could not be updated.');
  return data;
}

export async function postResponderLocation(assignmentId, coords) {
  if (String(assignmentId).startsWith('sample-police-')) {
    return { ok: true, sample: true };
  }
  const { data } = await api.post('/responder/location', {
    assignment_id: assignmentId,
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy ?? null,
    heading: coords.heading == null || coords.heading < 0 ? null : coords.heading,
  });
  if (!data.ok) throw new Error('Responder location was not accepted.');
  return data;
}

export async function createResponderDispatch(dispatch) {
  const { data } = await api.post('/responder/dispatches', dispatch);
  if (!data.ok) throw new Error('The dispatch could not be saved.');
  return data;
}

export async function getGuestEmergencies() {
  const { data } = await api.get('/responder/dispatches/guest-emergencies');
  if (!Array.isArray(data.emergencies)) {
    throw new Error('The server returned an invalid guest emergency list.');
  }
  return data.emergencies;
}

export async function generateHospitalQrHandover(dispatchId, payload = {}) {
  if (String(dispatchId).startsWith('sample-police-')) {
    return {
      ok: true,
      token: `sample-police-handover-${dispatchId}`,
      sample: true,
      incident_id: payload.incident_id || dispatchId,
    };
  }
  const { data } = await api.post(`/responder/dispatches/${dispatchId}/qr-handover`, payload);
  if (!data.ok || !data.token) {
    throw new Error('Could not generate hospital QR handover.');
  }
  return data;
}

export async function getNearestHospitals(lat, lng) {
  const { data } = await api.get('/responder/dispatches/hospitals', {
    params: lat != null && lng != null ? { lat, lng } : undefined,
  });
  return Array.isArray(data.hospitals) ? data.hospitals : [];
}
