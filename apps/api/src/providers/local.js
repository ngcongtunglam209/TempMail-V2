// LamMail API — local provider
// Implements the provider interface using SQLite as the backing store.
// Mail arrives via the SMTP receiver (src/smtp/server.js) and is read here.

import { getDb } from '../db/client.js';
import {
  generateToken,
  hashToken,
} from '../lib/auth.js';
import { hashPasscode, verifyPasscode } from '../lib/passcode.js';
import { newLocalPart, isValidLocalPart, newMessageId, newAttachmentId } from '../lib/id.js';
import { sanitizeHtml, makePreview } from '../lib/sanitize.js';
import CONFIG from '../config.js';

function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ');
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function toMs(sec) {
  return sec * 1000;
}

export default {
  name: 'local',

  // Admin-only: create a persistent mailbox protected by a passcode.
  // No session token is issued here — the admin shares (address, passcode)
  // with the visitor, who exchanges them for a session token via /v1/unlock.
  async createAdminMailbox({ localPart, domain, passcode } = {}) {
    const useDomain = domain || CONFIG.mailDomain;
    if (!CONFIG.allowedDomains.includes(useDomain)) {
      const err = new Error('Domain not allowed');
      err.statusCode = 400;
      throw err;
    }

    let part = localPart;
    if (part) {
      if (!isValidLocalPart(part)) {
        const err = new Error('Invalid localPart');
        err.statusCode = 400;
        throw err;
      }
      part = part.toLowerCase();
    } else {
      part = newLocalPart();
    }

    const address = `${part}@${useDomain}`;
    const { salt, hash } = hashPasscode(passcode);
    const created = nowSec();
    // expires_at is unused for persistent rows but kept non-null for the
    // existing index. Set it far in the future as a sentinel.
    const expires = created + 100 * 365 * 24 * 3600;

    const db = getDb();
    try {
      db.prepare(
        `INSERT INTO mailboxes
           (address, token_hash, created_at, expires_at,
            passcode_hash, passcode_salt, persistent)
         VALUES (?, NULL, ?, ?, ?, ?, 1)`,
      ).run(address, created, expires, hash, salt);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        const err = new Error('Address already taken');
        err.statusCode = 409;
        throw err;
      }
      throw e;
    }

    return { address, createdAt: toMs(created) };
  },

  // Verify (address, passcode) and mint a session token tied to this mailbox.
  // Returns null on any failure so the route layer can return a uniform 401
  // (no oracle that distinguishes unknown address vs wrong passcode).
  async unlockMailbox({ address, passcode } = {}) {
    if (!address || !passcode) return null;
    const lower = String(address).trim().toLowerCase();
    const db = getDb();
    const row = db
      .prepare(
        `SELECT address, passcode_hash, passcode_salt
           FROM mailboxes
          WHERE address = ?`,
      )
      .get(lower);
    if (!row || !row.passcode_hash || !row.passcode_salt) {
      // Burn a scrypt cycle so the timing matches the verify path.
      verifyPasscode(passcode, '00', '00');
      return null;
    }
    if (!verifyPasscode(passcode, row.passcode_salt, row.passcode_hash)) {
      return null;
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const created = nowSec();
    const expires = created + CONFIG.sessionTtlSeconds;
    db.prepare(
      `INSERT INTO mailbox_tokens (token_hash, address, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).run(tokenHash, row.address, created, expires);

    return {
      address: row.address,
      token,
      expiresAt: toMs(expires),
    };
  },

  async getMailboxByToken(token) {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const db = getDb();
    const row = db
      .prepare(
        `SELECT m.address, m.created_at, m.expires_at, m.persistent,
                t.expires_at AS session_expires
           FROM mailbox_tokens t
           JOIN mailboxes m ON m.address = t.address
          WHERE t.token_hash = ?
            AND t.expires_at > ?
            AND (m.persistent = 1 OR m.expires_at > ?)`,
      )
      .get(tokenHash, nowSec(), nowSec());
    if (!row) return null;
    const count = db
      .prepare(`SELECT COUNT(*) AS c FROM messages WHERE address = ?`)
      .get(row.address).c;
    return {
      address: row.address,
      createdAt: toMs(row.created_at),
      expiresAt: toMs(row.persistent ? row.session_expires : row.expires_at),
      persistent: Boolean(row.persistent),
      count,
    };
  },

  async listMessages(mailbox) {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, from_addr, from_name, subject, preview, received_at,
                EXISTS(SELECT 1 FROM attachments a WHERE a.message_id = messages.id) AS has_att
           FROM messages
          WHERE address = ?
          ORDER BY received_at DESC`,
      )
      .all(mailbox.address);
    return rows.map((r) => ({
      id: r.id,
      from: r.from_addr,
      fromName: r.from_name,
      subject: r.subject,
      preview: r.preview,
      receivedAt: toMs(r.received_at),
      hasAttachments: Boolean(r.has_att),
    }));
  },

  async getMessage(mailbox, id) {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, from_addr, from_name, to_addrs, subject, html, text,
                headers_json, size_bytes, received_at
           FROM messages
          WHERE id = ? AND address = ?`,
      )
      .get(id, mailbox.address);
    if (!row) return null;

    const attachments = db
      .prepare(
        `SELECT id, filename, content_type, size_bytes
           FROM attachments
          WHERE message_id = ?`,
      )
      .all(id);

    let headers = {};
    try {
      headers = row.headers_json ? JSON.parse(row.headers_json) : {};
    } catch {
      headers = {};
    }

    return {
      id: row.id,
      from: row.from_addr,
      fromName: row.from_name,
      to: row.to_addrs ? row.to_addrs.split(',') : [],
      subject: row.subject,
      html: row.html,
      text: row.text,
      headers,
      sizeBytes: row.size_bytes,
      receivedAt: toMs(row.received_at),
      attachments: attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        sizeBytes: a.size_bytes,
      })),
    };
  },

  async getAttachment(mailbox, messageId, attachmentId) {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT a.filename, a.content_type, a.data
           FROM attachments a
           JOIN messages m ON m.id = a.message_id
          WHERE a.id = ? AND a.message_id = ? AND m.address = ?`,
      )
      .get(attachmentId, messageId, mailbox.address);
    return row || null;
  },

  async deleteMessage(mailbox, id) {
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM messages WHERE id = ? AND address = ?`)
      .run(id, mailbox.address);
    return result.changes > 0;
  },

  async deleteAllMessages(mailbox) {
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM messages WHERE address = ?`)
      .run(mailbox.address);
    return result.changes;
  },

  async deleteMailbox(mailbox) {
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM mailboxes WHERE address = ?`)
      .run(mailbox.address);
    return result.changes > 0;
  },

  // Admin: list every mailbox with message counts.
  async listMailboxesAdmin() {
    const db = getDb();
    return db
      .prepare(
        `SELECT m.address,
                m.created_at,
                m.persistent,
                (SELECT COUNT(*) FROM messages WHERE address = m.address) AS count
           FROM mailboxes m
          ORDER BY m.created_at DESC`,
      )
      .all()
      .map((r) => ({
        address: r.address,
        createdAt: toMs(r.created_at),
        persistent: Boolean(r.persistent),
        messageCount: r.count,
      }));
  },

  async deleteMailboxByAddress(address) {
    if (!address) return false;
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM mailboxes WHERE address = ?`)
      .run(String(address).toLowerCase());
    return result.changes > 0;
  },

  // Admin: rotate the passcode on an existing mailbox. Invalidates all
  // outstanding session tokens so old devices have to re-unlock.
  async setPasscode(address, passcode) {
    if (!address || !passcode) return false;
    const lower = String(address).toLowerCase();
    const { salt, hash } = hashPasscode(passcode);
    const db = getDb();
    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `UPDATE mailboxes
              SET passcode_hash = ?, passcode_salt = ?
            WHERE address = ?`,
        )
        .run(hash, salt, lower);
      if (result.changes > 0) {
        db.prepare(`DELETE FROM mailbox_tokens WHERE address = ?`).run(lower);
      }
      return result.changes;
    });
    return tx() > 0;
  },

  async domains() {
    return CONFIG.allowedDomains.map((d) => ({ domain: d, isActive: true }));
  },

  // Used by the SMTP receiver to validate RCPT TO before accepting bytes.
  async isAddressActive(address) {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT 1 FROM mailboxes
          WHERE address = ?
            AND (persistent = 1 OR expires_at > ?)`,
      )
      .get(String(address).toLowerCase(), nowSec());
    return Boolean(row);
  },

  // Used by the SMTP receiver to persist a parsed inbound message.
  async persistInboundMessage(address, parsed, sizeBytes) {
    const db = getDb();
    const lower = String(address).toLowerCase();
    const mailbox = db
      .prepare(
        `SELECT address, expires_at, persistent FROM mailboxes
          WHERE address = ? AND (persistent = 1 OR expires_at > ?)`,
      )
      .get(lower, nowSec());
    if (!mailbox) return null;

    const id = newMessageId();
    const fromObj = parsed.from?.value?.[0] || {};
    const toList = (parsed.to?.value || []).map((t) => t.address).filter(Boolean);
    const headersJson = JSON.stringify(
      Object.fromEntries(parsed.headers || new Map()),
    );

    const insert = db.prepare(
      `INSERT INTO messages
       (id, address, from_addr, from_name, to_addrs, subject, preview, html, text,
        headers_json, size_bytes, received_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertAtt = db.prepare(
      `INSERT INTO attachments (id, message_id, filename, content_type, size_bytes, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const tx = db.transaction(() => {
      insert.run(
        id,
        mailbox.address,
        fromObj.address || null,
        fromObj.name || null,
        toList.join(',') || null,
        parsed.subject || null,
        makePreview(parsed.text || stripTags(parsed.html || '')),
        sanitizeHtml(parsed.html || ''),
        parsed.text || null,
        headersJson,
        sizeBytes,
        nowSec(),
        mailbox.expires_at,
      );
      for (const att of parsed.attachments || []) {
        if (!att.content) continue;
        if (att.content.length > 2 * 1024 * 1024) continue; // 2 MB cap per file
        insertAtt.run(
          newAttachmentId(),
          id,
          att.filename || 'attachment',
          att.contentType || 'application/octet-stream',
          att.content.length,
          att.content,
        );
      }
    });
    tx();
    return id;
  },
};
