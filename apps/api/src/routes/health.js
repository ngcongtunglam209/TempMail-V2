// LamMail API — health route

import CONFIG from '../config.js';
import provider from '../providers/index.js';

const startedAt = Date.now();

export default async function healthRoutes(app) {
  app.get('/v1/health', async () => ({
    ok: true,
    provider: provider.name,
    version: CONFIG.version,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    domain: CONFIG.mailDomain,
  }));
}
