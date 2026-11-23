import api from './api';
import { secureStorage } from './secureStorage';

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

export function connectIncidentMessagesSocket(incidentId, { onMessage } = {}) {
  if (!incidentId) return () => {};
  let closed = false;
  let socket = null;
  let reconnectTimer = null;

  const open = async () => {
    if (closed) return;
    try {
      const token = await secureStorage.getAccessToken();
      if (!token || closed) return;
      const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
      const wsBase = base.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
      const url = `${wsBase}/reports/${encodeURIComponent(incidentId)}/messages/ws?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(url);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'message' && payload.message && onMessage) {
            onMessage(payload.message);
          }
        } catch {
          // Ignore malformed WS messages
        }
      };
      socket.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(open, 3000);
        }
      };
      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          // Ignore close error
        }
      };
    } catch {
      if (!closed) {
        reconnectTimer = setTimeout(open, 4000);
      }
    }
  };

  void open();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try {
      socket?.close();
    } catch {
      // Ignore close error
    }
  };
}
