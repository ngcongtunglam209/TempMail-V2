// LamMail API — auth helpers
// Bearer tokens are random 32-byte URL-safe strings.
// Only the sha256 hash is stored. Lookups use a constant-time compare.

import crypto from 'node:crypto';

export function generateToken() {
  // 32 bytes -> 43 char base64url string
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function extractBearer(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}
