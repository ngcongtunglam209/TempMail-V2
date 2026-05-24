// LamMail API — admin auth preHandler
// Compares the bearer token in the request to CONFIG.adminToken with a
// constant-time comparison. If ADMIN_TOKEN is unset, all admin endpoints
// refuse unconditionally (fail-closed).

import CONFIG from '../config.js';
import { extractBearer, safeEqual } from './auth.js';

export async function requireAdmin(req, reply) {
  if (!CONFIG.adminToken) {
    reply.code(503).send({ error: 'Admin disabled (ADMIN_TOKEN not set)' });
    return reply;
  }
  const token = extractBearer(req);
  if (!token) {
    reply.code(401).send({ error: 'Missing bearer token' });
    return reply;
  }
  if (!safeEqual(token, CONFIG.adminToken)) {
    reply.code(403).send({ error: 'Forbidden' });
    return reply;
  }
}
