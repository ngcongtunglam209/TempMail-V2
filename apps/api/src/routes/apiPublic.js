// LamMail API — programmatic /v1/api/* surface
//
// Authenticated with admin-issued API keys. Scripts can:
//   - create disposable mailboxes (POST /mailboxes)
//   - list all mailboxes (GET /mailboxes)
//   - delete a mailbox (DELETE /mailboxes/:address)
//   - read messages (GET /mailboxes/:address/messages[/:id])
//   - delete messages (DELETE /mailboxes/:address/messages/:id)
//   - stream new mail in real time (GET /mailboxes/:address/stream)
//
// Rate limiting is disabled here (rateLimit: false) per the design: keys are
// already issued by trusted admins.

import crypto from 'node:crypto';

import provider from '../providers/index.js';
import { requireApiKey } from '../lib/apiKeyAuth.js';
import { isValidPasscode } from '../lib/passcode.js';
import events from '../lib/events.js';

const SSE_PING_MS = 25_000;

// Default passcode generator. Mixed-case letters + digits, 12 chars.
// Removes ambiguous chars (0/O, 1/l) so the passcode is easy to read aloud.
function generatePasscode(len = 12) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function loadMailbox(req, reply) {
  const mailbox = await provider.getMailboxByAddress(req.params.address);
  if (!mailbox) {
    reply.code(404).send({ error: 'Mailbox not found' });
    return null;
  }
  return mailbox;
}

export default async function apiPublicRoutes(app) {
  app.post(
    '/v1/api/mailboxes',
    {
      preHandler: requireApiKey,
      config: { rateLimit: false },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            localPart: { type: 'string', minLength: 3, maxLength: 32 },
            domain: { type: 'string', minLength: 3, maxLength: 64 },
            ttlSeconds: { type: 'integer', minimum: 60, maximum: 7 * 24 * 3600 },
            // Optional: when set, the mailbox can be unlocked by a visitor at
            // POST /v1/unlock with (address, passcode). Omit to keep it
            // API-key-only.
            passcode: { type: 'string', minLength: 4, maxLength: 128 },
          },
        },
      },
    },
    async (req, reply) => {
      const body = { ...(req.body || {}) };
      if (body.passcode) {
        if (!isValidPasscode(body.passcode)) {
          reply.code(400);
          return { error: 'Passcode must be 4-128 printable ASCII characters' };
        }
      } else {
        // Auto-generate so every API-created mailbox is visitor-unlockable
        // by default. Caller can opt out with `"passcode": null`-style
        // sentinel — but we treat unset as "please generate".
        body.passcode = generatePasscode();
      }
      try {
        const result = await provider.createTtlMailbox(body);
        reply.code(201);
        // Echo plaintext passcode back so the caller can hand it to a visitor.
        // Server stores only the scrypt hash + salt.
        result.passcode = body.passcode;
        return result;
      } catch (err) {
        const code = err.statusCode || 500;
        reply.code(code);
        return { error: err.message || 'Failed to create mailbox' };
      }
    },
  );

  app.get(
    '/v1/api/mailboxes',
    { preHandler: requireApiKey, config: { rateLimit: false } },
    async () => {
      const mailboxes = await provider.listAllMailboxes();
      return { mailboxes };
    },
  );

  app.delete(
    '/v1/api/mailboxes/:address',
    { preHandler: requireApiKey, config: { rateLimit: false } },
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

  app.get(
    '/v1/api/mailboxes/:address/messages',
    { preHandler: requireApiKey, config: { rateLimit: false } },
    async (req, reply) => {
      const mailbox = await loadMailbox(req, reply);
      if (!mailbox) return;
      return provider.listMessages(mailbox);
    },
  );

  app.get(
    '/v1/api/mailboxes/:address/messages/:id',
    { preHandler: requireApiKey, config: { rateLimit: false } },
    async (req, reply) => {
      const mailbox = await loadMailbox(req, reply);
      if (!mailbox) return;
      const msg = await provider.getMessage(mailbox, req.params.id);
      if (!msg) {
        reply.code(404);
        return { error: 'Message not found' };
      }
      return msg;
    },
  );

  app.delete(
    '/v1/api/mailboxes/:address/messages/:id',
    { preHandler: requireApiKey, config: { rateLimit: false } },
    async (req, reply) => {
      const mailbox = await loadMailbox(req, reply);
      if (!mailbox) return;
      const ok = await provider.deleteMessage(mailbox, req.params.id);
      if (!ok) {
        reply.code(404);
        return { error: 'Message not found' };
      }
      reply.code(204);
      return null;
    },
  );

  // Server-Sent Events stream for real-time inbound mail. The handler keeps
  // the response open and writes a `message` event each time the SMTP receiver
  // emits one for this address.
  app.get(
    '/v1/api/mailboxes/:address/stream',
    { preHandler: requireApiKey, config: { rateLimit: false } },
    async (req, reply) => {
      const mailbox = await loadMailbox(req, reply);
      if (!mailbox) return;

      const raw = reply.raw;
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Disable proxy buffering on Caddy/Nginx so frames flush immediately.
        'X-Accel-Buffering': 'no',
      });
      raw.write(`event: connected\ndata: ${JSON.stringify({ address: mailbox.address })}\n\n`);

      const onMsg = (m) => {
        if (m.address !== mailbox.address) return;
        try {
          raw.write(`event: message\ndata: ${JSON.stringify(m)}\n\n`);
        } catch {
          /* socket closing */
        }
      };
      events.on('message', onMsg);

      const ping = setInterval(() => {
        try {
          raw.write(': ping\n\n');
        } catch {
          /* ignore */
        }
      }, SSE_PING_MS);

      const close = () => {
        events.off('message', onMsg);
        clearInterval(ping);
        try {
          raw.end();
        } catch {
          /* already closed */
        }
      };
      req.raw.on('close', close);
      req.raw.on('aborted', close);

      // Keep Fastify from auto-finishing the reply.
      reply.hijack();
    },
  );
}
