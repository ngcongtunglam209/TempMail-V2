// LamMail API — TTL cleanup job
// Runs on an interval, removes any expired mailbox (cascades to messages
// and attachments via FK) and any orphaned expired messages.

import { getDb } from '../db/client.js';
import CONFIG from '../config.js';

let timer = null;

function purge() {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const expiredMailboxes = db
    .prepare(`DELETE FROM mailboxes WHERE expires_at <= ?`)
    .run(now);

  // Some messages may have a shorter TTL than the mailbox in future; clean those too.
  const expiredMessages = db
    .prepare(`DELETE FROM messages WHERE expires_at <= ?`)
    .run(now);

  if (expiredMailboxes.changes || expiredMessages.changes) {
    return {
      mailboxes: expiredMailboxes.changes,
      messages: expiredMessages.changes,
    };
  }
  return null;
}

export function startCleanupJob(log) {
  if (timer) return;
  const interval = Math.max(10, CONFIG.cleanupIntervalSeconds) * 1000;
  timer = setInterval(() => {
    try {
      const stats = purge();
      if (stats && log) {
        log.info({ stats }, 'cleanup purged expired rows');
      }
    } catch (err) {
      if (log) log.error({ err }, 'cleanup job failed');
    }
  }, interval);
  // Don't keep the event loop alive solely for the cleanup ticker.
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopCleanupJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export { purge };
