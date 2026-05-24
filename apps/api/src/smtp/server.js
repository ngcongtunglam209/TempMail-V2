// LamMail SMTP receiver
// Listens on CONFIG.smtp.port. Validates RCPT TO against the mailbox table,
// rejects unknown recipients with 550. Accepts mail, parses with mailparser,
// hands off to provider.persistInboundMessage().

import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import CONFIG from '../config.js';
import provider from '../providers/index.js';

let server = null;

function lower(addr) {
  return String(addr || '').trim().toLowerCase();
}

export function startSmtpServer(log) {
  if (server) return server;
  if (!CONFIG.smtp.enabled) {
    log?.info('SMTP receiver disabled (SMTP_ENABLED=false)');
    return null;
  }
  if (provider.name !== 'local') {
    log?.info({ provider: provider.name }, 'SMTP receiver skipped for non-local provider');
    return null;
  }

  server = new SMTPServer({
    name: CONFIG.smtp.hostname,
    banner: `LamMail ESMTP ${CONFIG.version}`,
    authOptional: true,
    disabledCommands: ['AUTH'],
    size: CONFIG.smtp.maxSizeBytes,
    hideSize: false,
    logger: false,

    async onRcptTo(address, session, callback) {
      const rcpt = lower(address.address);
      // Domain check
      const at = rcpt.lastIndexOf('@');
      if (at < 0) return callback(new Error('550 5.1.3 Bad recipient'));
      const domain = rcpt.slice(at + 1);
      if (!CONFIG.allowedDomains.includes(domain)) {
        return callback(new Error('550 5.7.1 Relay denied'));
      }
      try {
        const ok = await provider.isAddressActive(rcpt);
        if (!ok) {
          return callback(new Error('550 5.1.1 No such user'));
        }
      } catch (err) {
        log?.error({ err, rcpt }, 'isAddressActive failed');
        return callback(new Error('451 4.7.1 Temporary failure'));
      }
      callback();
    },

    onData(stream, session, callback) {
      const chunks = [];
      let total = 0;
      stream.on('data', (c) => {
        chunks.push(c);
        total += c.length;
      });
      stream.on('end', async () => {
        const raw = Buffer.concat(chunks, total);
        try {
          const parsed = await simpleParser(raw);
          const recipients = (session.envelope?.rcptTo || [])
            .map((r) => lower(r.address))
            .filter(Boolean);

          let stored = 0;
          for (const rcpt of recipients) {
            const id = await provider.persistInboundMessage(rcpt, parsed, total);
            if (id) {
              stored += 1;
              log?.info(
                { id, rcpt, from: parsed.from?.text, subject: parsed.subject, size: total },
                'mail accepted',
              );
            }
          }
          if (!stored) {
            return callback(new Error('550 5.1.1 No active recipient'));
          }
          callback(null, `Queued ${stored} message(s)`);
        } catch (err) {
          log?.error({ err }, 'failed to parse/store mail');
          callback(new Error('451 4.7.0 Local processing failure'));
        }
      });
      stream.on('error', (err) => {
        log?.error({ err }, 'smtp data stream error');
        callback(err);
      });
    },
  });

  server.on('error', (err) => log?.error({ err }, 'smtp server error'));

  server.listen(CONFIG.smtp.port, '0.0.0.0', () => {
    log?.info(
      `LamMail SMTP listening on :${CONFIG.smtp.port} (${CONFIG.smtp.hostname})`,
    );
  });

  return server;
}

export function stopSmtpServer() {
  if (server) {
    try {
      server.close();
    } catch {
      /* noop */
    }
    server = null;
  }
}
