// LamMail API — API-key auth preHandler
// Scripts authenticate by sending the plaintext key in either:
//   X-Api-Key: lk_...
//   Authorization: Bearer lk_...
// On success the route handler can read req.apiKey = { id, label }.

import provider from '../providers/index.js';
import { extractBearer } from './auth.js';

function extractApiKey(req) {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  const bearer = extractBearer(req);
  if (bearer) return bearer;
  return null;
}

export async function requireApiKey(req, reply) {
  const key = extractApiKey(req);
  if (!key) {
    reply.code(401).send({ error: 'Missing API key' });
    return reply;
  }
  const row = await provider.findApiKeyByPlaintext(key);
  if (!row) {
    reply.code(401).send({ error: 'Invalid or revoked API key' });
    return reply;
  }
  req.apiKey = row;
}
