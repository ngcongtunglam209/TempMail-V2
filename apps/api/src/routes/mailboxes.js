// LamMail API — mailbox routes

import provider from '../providers/index.js';
import { requireMailbox } from './_auth.js';

export default async function mailboxRoutes(app) {
  // Create a mailbox. Public, with a stricter dedicated rate limit.
  app.post('/v1/mailboxes', {
    config: {
      rateLimit: {
        max: app.lammailLimits?.create ?? 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          localPart: { type: 'string', minLength: 3, maxLength: 32 },
          domain: { type: 'string', minLength: 3, maxLength: 64 },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const result = await provider.createMailbox(req.body || {});
      reply.code(201);
      return result;
    } catch (err) {
      const code = err.statusCode || 500;
      reply.code(code);
      return { error: err.message || 'Failed to create mailbox' };
    }
  });

  // Get current mailbox info. Requires bearer token.
  app.get('/v1/mailboxes/me', { preHandler: requireMailbox }, async (req) => {
    return {
      address: req.mailbox.address,
      createdAt: req.mailbox.createdAt,
      expiresAt: req.mailbox.expiresAt,
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
