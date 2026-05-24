// LamMail API — mailbox routes

import provider from '../providers/index.js';
import { requireMailbox } from './_auth.js';

export default async function mailboxRoutes(app) {
  // Public mailbox creation is disabled. Admin creates mailboxes via
  // /v1/admin/mailboxes; visitors unlock them via /v1/unlock.
  app.post('/v1/mailboxes', async (req, reply) => {
    reply.code(403);
    return { error: 'Mailbox creation is admin-only. Use /v1/unlock with an issued passcode.' };
  });

  // Get current mailbox info. Requires bearer token.
  app.get('/v1/mailboxes/me', { preHandler: requireMailbox }, async (req) => {
    return {
      address: req.mailbox.address,
      createdAt: req.mailbox.createdAt,
      expiresAt: req.mailbox.expiresAt,
      persistent: req.mailbox.persistent,
      count: req.mailbox.count,
    };
  });

  // Delete the current mailbox.
  app.delete('/v1/mailboxes/me', { preHandler: requireMailbox }, async (req, reply) => {
    await provider.deleteMailbox(req.mailbox);
    reply.code(204);
    return null;
  });
}
