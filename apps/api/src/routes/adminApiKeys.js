// LamMail API — admin routes for managing API keys.
// All endpoints require ADMIN_TOKEN; the plaintext key is shown only on creation.

import provider from '../providers/index.js';
import { requireAdmin } from '../lib/adminAuth.js';

export default async function adminApiKeyRoutes(app) {
  app.post(
    '/v1/admin/api-keys',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string', maxLength: 80 },
          },
        },
      },
    },
    async (req, reply) => {
      const result = await provider.createApiKey(req.body || {});
      reply.code(201);
      return result;
    },
  );

  app.get(
    '/v1/admin/api-keys',
    { preHandler: requireAdmin },
    async () => {
      const keys = await provider.listApiKeys();
      return { keys };
    },
  );

  app.delete(
    '/v1/admin/api-keys/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const ok = await provider.revokeApiKey(req.params.id);
      if (!ok) {
        reply.code(404);
        return { error: 'API key not found or already revoked' };
      }
      reply.code(204);
      return null;
    },
  );
}
