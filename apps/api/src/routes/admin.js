// LamMail API — admin routes
// All endpoints require ADMIN_TOKEN as Bearer.

import provider from '../providers/index.js';
import { requireAdmin } from '../lib/adminAuth.js';
import { isValidPasscode } from '../lib/passcode.js';

export default async function adminRoutes(app) {
  // Create a persistent admin-owned mailbox protected by a passcode.
  app.post(
    '/v1/admin/mailboxes',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['passcode'],
          properties: {
            localPart: { type: 'string', minLength: 3, maxLength: 32 },
            domain: { type: 'string', minLength: 3, maxLength: 64 },
            passcode: { type: 'string', minLength: 4, maxLength: 128 },
          },
        },
      },
    },
    async (req, reply) => {
      if (!isValidPasscode(req.body.passcode)) {
        reply.code(400);
        return { error: 'Passcode must be 4-128 printable ASCII characters' };
      }
      try {
        const result = await provider.createAdminMailbox(req.body);
        reply.code(201);
        // Echo the passcode back so the admin can copy it. The plaintext is
        // never stored server-side; only the scrypt hash + salt persist.
        return { ...result, passcode: req.body.passcode };
      } catch (err) {
        const code = err.statusCode || 500;
        reply.code(code);
        return { error: err.message || 'Failed to create mailbox' };
      }
    },
  );

  // List every mailbox.
  app.get(
    '/v1/admin/mailboxes',
    { preHandler: requireAdmin },
    async () => {
      const list = await provider.listMailboxesAdmin();
      return { mailboxes: list };
    },
  );

  // Delete a mailbox by address. Cascades to messages and tokens.
  app.delete(
    '/v1/admin/mailboxes/:address',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const ok = await provider.deleteMailboxByAddress(req.params.address);
      if (!ok) {
        reply.code(404);
        return { error: 'Mailbox not found' };
      }
      reply.code(204);
      return null;
    },
  );

  // Rotate the passcode on a mailbox. Invalidates all outstanding sessions.
  app.patch(
    '/v1/admin/mailboxes/:address',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['passcode'],
          properties: {
            passcode: { type: 'string', minLength: 4, maxLength: 128 },
          },
        },
      },
    },
    async (req, reply) => {
      if (!isValidPasscode(req.body.passcode)) {
        reply.code(400);
        return { error: 'Passcode must be 4-128 printable ASCII characters' };
      }
      const ok = await provider.setPasscode(req.params.address, req.body.passcode);
      if (!ok) {
        reply.code(404);
        return { error: 'Mailbox not found' };
      }
      return { address: String(req.params.address).toLowerCase(), passcode: req.body.passcode };
    },
  );
}
