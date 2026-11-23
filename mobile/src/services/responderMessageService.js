import api from './api';

function messageError(error, fallback) {
  return new Error(
    error.response?.data?.error || fallback,
    { cause: error },
  );
}

export async function getResponderMessages(role) {
  try {
    const { data } = await api.get('/responder/messages', {
      params: { with_role: role },
    });

    if (!Array.isArray(data.messages)) {
      throw new Error('The server returned an invalid message list.');
    }

    return data.messages;
  } catch (error) {
    if (error.message === 'The server returned an invalid message list.') throw error;
    throw messageError(error, 'Unable to load messages.');
  }
}

export async function sendResponderMessage(recipientRole, body) {
  try {
    const { data } = await api.post('/responder/messages', {
      recipient_role: recipientRole,
      body,
    });

    if (!data.message?.id) throw new Error('The server returned an invalid message.');
    return data.message;
  } catch (error) {
    if (error.message === 'The server returned an invalid message.') throw error;
    throw messageError(error, 'Unable to send message.');
  }
}

export async function getIncidentMessages(incidentId) {
  try {
    const { data } = await api.get(`/reports/${encodeURIComponent(incidentId)}/messages`);
    if (!Array.isArray(data.messages)) {
      throw new Error('The server returned an invalid message list.');
    }
    return data.messages;
  } catch (error) {
    if (error.message === 'The server returned an invalid message list.') throw error;
    throw messageError(error, 'Unable to load messages.');
  }
}

export async function sendIncidentMessage(incidentId, body) {
  try {
    const { data } = await api.post(`/reports/${encodeURIComponent(incidentId)}/messages`, {
      body,
    });
    if (!data.message?.id) throw new Error('The server returned an invalid message.');
    return data.message;
  } catch (error) {
    if (error.message === 'The server returned an invalid message.') throw error;
    throw messageError(error, 'Unable to send message.');
  }
}
