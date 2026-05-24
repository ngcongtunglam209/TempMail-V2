// LamMail API — passcode unlock route
// Visitor exchanges (address, passcode) for a session token.

import provider from '../providers/index.js';
import CONFIG from '../config.js';

export default async function unlockRoutes(app) {
  app.post(
    '/v1/unlock',
    {
      config: {
        rateLimit: {
          max: CONFIG.rateLimit.unlockPerMinute,
          timeWindow: '1 minute',
        },
      },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['address', 'passcode'],
          properties: {
            address: { type: 'string', minLength: 3, maxLength: 254 },
            passcode: { type: 'string', minLength: 4, maxLength: 128 },
          },
        },
      },
    },
    async (req, reply) => {
      const result = await provider.unlockMailbox(req.body || {});
      if (!result) {
        // Generic error — no oracle for unknown address vs wrong passcode.
        reply.code(401);
        return { error: 'Invalid address or passcode' };
      }
      return result;
    },
  );
}
