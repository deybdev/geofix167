import api from './api';

export async function getResponderDispatches(status) {
  const { data } = await api.get('/responder/dispatches', {
    params: status ? { status } : undefined,
  });
  if (!Array.isArray(data.dispatches)) {
    throw new Error('The server returned an invalid dispatch list.');
  }
  return data.dispatches;
}

export async function updateResponderDispatchStatus(id, status) {
  const { data } = await api.patch(`/responder/dispatches/${id}/status`, { status });
  if (!data.ok) throw new Error('The dispatch status could not be updated.');
  return data;
}

export async function createResponderDispatch(dispatch) {
  const { data } = await api.post('/responder/dispatches', dispatch);
  if (!data.ok) throw new Error('The dispatch could not be saved.');
  return data;
}
