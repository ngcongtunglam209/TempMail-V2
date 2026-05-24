// LamMail web — API client
// Wraps the /v1 surface. Token is set per-call by the store.

// In dev (Vite), VITE_API_BASE is unset and we use a relative path so the
// Vite proxy forwards /v1 to the local API on :3001.
// In prod, set VITE_API_BASE to the public API origin (e.g. https://api.example.com).
const RAW_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/+$/, '');
const BASE = `${RAW_BASE}/v1`;

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', token, body, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (raw) return res;

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  domains: () => request('/domains'),

  createMailbox: (opts = {}) =>
    request('/mailboxes', { method: 'POST', body: opts }),

  me: (token) => request('/mailboxes/me', { token }),

  deleteMailbox: (token) =>
    request('/mailboxes/me', { method: 'DELETE', token }),

  listMessages: (token) => request('/messages', { token }),

  getMessage: (token, id) => request(`/messages/${encodeURIComponent(id)}`, { token }),

  deleteMessage: (token, id) =>
    request(`/messages/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  deleteAllMessages: (token) =>
    request('/messages', { method: 'DELETE', token }),

  attachmentUrl: (token, msgId, attId) =>
    `${BASE}/messages/${encodeURIComponent(msgId)}/attachments/${encodeURIComponent(
      attId,
    )}?token=${encodeURIComponent(token)}`,
};

export { ApiError };
