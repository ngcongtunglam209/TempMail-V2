// LamMail — example API client
//
// Usage:
//   API_BASE=https://api.yunaalways.cyou \
//   API_KEY=lk_... \
//   node scripts/example-client.mjs
//
// What it does:
//   1. Creates a new disposable mailbox (ttl 1h).
//   2. Lists current messages.
//   3. Opens the SSE stream and prints each new message as it arrives.

const API_BASE = (process.env.API_BASE || 'http://localhost:3001').replace(/\/+$/, '');
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('Set API_KEY (issue one from /admin -> API keys).');
  process.exit(1);
}

const headers = {
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json',
};

async function call(method, path, body) {
  const res = await fetch(`${API_BASE}/v1/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${data?.error || text}`);
  }
  return data;
}

const mailbox = await call('POST', '/mailboxes', { ttlSeconds: 3600 });
console.log(`mailbox: ${mailbox.address}`);
console.log(`expires: ${new Date(mailbox.expiresAt).toISOString()}`);

const initial = await call('GET', `/mailboxes/${encodeURIComponent(mailbox.address)}/messages`);
console.log(`existing messages: ${initial.length}`);

const streamUrl = `${API_BASE}/v1/api/mailboxes/${encodeURIComponent(mailbox.address)}/stream`;
console.log(`waiting for inbound mail at ${mailbox.address} ...`);

const res = await fetch(streamUrl, { headers: { 'X-Api-Key': API_KEY } });
if (!res.ok || !res.body) {
  throw new Error(`stream open failed: ${res.status}`);
}

const decoder = new TextDecoder();
let buffer = '';
for await (const chunk of res.body) {
  buffer += decoder.decode(chunk, { stream: true });
  let idx;
  while ((idx = buffer.indexOf('\n\n')) !== -1) {
    const frame = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    if (frame.startsWith(':')) continue; // ping
    const lines = frame.split('\n');
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) data += line.slice(6);
    }
    if (event === 'connected') {
      console.log('stream connected');
    } else if (event === 'message') {
      try {
        const m = JSON.parse(data);
        console.log(`[mail] from=${m.from || '?'}  subject=${m.subject || '(none)'}`);
      } catch {
        console.log('event message (unparseable):', data);
      }
    }
  }
}
