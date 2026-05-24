// LamMail API — bearer auth plugin
// Adds req.mailbox by looking up the bearer token via the active provider.

import provider from '../providers/index.js';
import { extractBearer } from '../lib/auth.js';

export async function requireMailbox(req, reply) {
  const token = extractBearer(req);
  if (!token) {
    reply.code(401).send({ error: 'Missing bearer token' });
    return reply;
  }
  const mailbox = await provider.getMailboxByToken(token);
  if (!mailbox) {
    reply.code(401).send({ error: 'Invalid or expired token' });
    return reply;
  }
  req.mailbox = mailbox;
}
