// LamMail API — Fastify entry point

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

import CONFIG from './config.js';
import { getDb } from './db/client.js';
import { startCleanupJob, stopCleanupJob } from './jobs/cleanup.js';
import { startSmtpServer, stopSmtpServer } from './smtp/server.js';

import healthRoutes from './routes/health.js';
import domainRoutes from './routes/domains.js';
import mailboxRoutes from './routes/mailboxes.js';
import messageRoutes from './routes/messages.js';
import unlockRoutes from './routes/unlock.js';
import adminRoutes from './routes/admin.js';
import adminApiKeyRoutes from './routes/adminApiKeys.js';
import apiPublicRoutes from './routes/apiPublic.js';

async function build() {
  const app = Fastify({
    logger: CONFIG.isProd
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
    trustProxy: true,
  });

  // Force the database to initialize early so a misconfigured DB_PATH
  // surfaces during boot, not on first request.
  getDb();

  // Expose limits on the app instance so route configs can read them.
  app.decorate('lammailLimits', {
    create: CONFIG.rateLimit.createPerMinute,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, server-to-server
      if (CONFIG.corsOrigins.includes(origin) || CONFIG.corsOrigins.includes('*')) {
        return cb(null, true);
      }
      cb(new Error('CORS not allowed'), false);
    },
    credentials: false,
  });

  await app.register(rateLimit, {
    max: CONFIG.rateLimit.maxPerMinute,
    timeWindow: '1 minute',
  });

  await app.register(healthRoutes);
  await app.register(domainRoutes);
  await app.register(mailboxRoutes);
  await app.register(messageRoutes);
  await app.register(unlockRoutes);
  await app.register(adminRoutes);
  await app.register(adminApiKeyRoutes);
  await app.register(apiPublicRoutes);

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'Not found', path: req.url });
  });

  // Always-on safety headers. Caddy adds more on top in prod.
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    return payload;
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request failed');
    const code = err.statusCode || 500;
    reply.code(code).send({ error: err.message || 'Internal error' });
  });

  return app;
}

async function main() {
  const app = await build();
  startCleanupJob(app.log);
  startSmtpServer(app.log);

  const shutdown = async (signal) => {
    app.log.info({ signal }, 'shutting down');
    stopCleanupJob();
    stopSmtpServer();
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: CONFIG.port, host: CONFIG.host });
    app.log.info(
      `LamMail API ${CONFIG.version} (provider=${CONFIG.provider}, domain=${CONFIG.mailDomain})`,
    );
    if (!CONFIG.adminToken) {
      app.log.warn(
        'ADMIN_TOKEN is not set — admin endpoints are disabled. Set ADMIN_TOKEN in .env to enable mailbox creation.',
      );
    }
  } catch (err) {
    app.log.error({ err }, 'failed to start');
    process.exit(1);
  }
}

main();
