// LamMail API — configuration loader
// Reads .env, validates, freezes, and exports a single CONFIG object.

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const env = process.env;

const CONFIG = Object.freeze({
  env: env.NODE_ENV ?? 'development',
  isProd: env.NODE_ENV === 'production',

  port: int(env.PORT, 3001),
  host: env.HOST ?? '0.0.0.0',

  provider: env.PROVIDER ?? 'local',

  mailDomain: env.MAIL_DOMAIN ?? 'vietkieu.edu.pl',
  allowedDomains: list(env.ALLOWED_DOMAINS, [env.MAIL_DOMAIN ?? 'vietkieu.edu.pl']),

  mailboxTtlSeconds: int(env.MAILBOX_TTL_SECONDS, 3600),
  cleanupIntervalSeconds: int(env.CLEANUP_INTERVAL_SECONDS, 60),

  smtp: Object.freeze({
    enabled: bool(env.SMTP_ENABLED, true),
    port: int(env.SMTP_PORT, 2525),
    hostname: env.SMTP_HOSTNAME ?? 'mail.vietkieu.edu.pl',
    maxSizeBytes: int(env.SMTP_MAX_SIZE_BYTES, 5 * 1024 * 1024),
  }),

  dbPath: path.isAbsolute(env.DB_PATH ?? '')
    ? env.DB_PATH
    : path.resolve(repoRoot, env.DB_PATH ?? './data/mail.db'),

  corsOrigins: list(env.CORS_ORIGINS, ['http://localhost:5173']),

  rateLimit: Object.freeze({
    maxPerMinute: int(env.RATE_LIMIT_MAX_PER_MINUTE, 120),
    createPerMinute: int(env.RATE_LIMIT_CREATE_PER_MINUTE, 10),
  }),

  version: '0.1.0',
});

export default CONFIG;
