-- LamMail SQLite schema
-- Applied by db/client.js on boot. Idempotent.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mailboxes (
  address        TEXT PRIMARY KEY,
  token_hash     TEXT,
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL,
  passcode_hash  TEXT,
  passcode_salt  TEXT,
  persistent     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_expires
  ON mailboxes(expires_at);

-- Per-device session tokens. Multiple devices can hold valid tokens for the
-- same admin-created mailbox without invalidating each other.
CREATE TABLE IF NOT EXISTS mailbox_tokens (
  token_hash  TEXT PRIMARY KEY,
  address     TEXT NOT NULL REFERENCES mailboxes(address) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mailbox_tokens_address
  ON mailbox_tokens(address);

CREATE INDEX IF NOT EXISTS idx_mailbox_tokens_expires
  ON mailbox_tokens(expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  address       TEXT NOT NULL REFERENCES mailboxes(address) ON DELETE CASCADE,
  from_addr     TEXT,
  from_name     TEXT,
  to_addrs      TEXT,
  subject       TEXT,
  preview       TEXT,
  html          TEXT,
  text          TEXT,
  headers_json  TEXT,
  size_bytes    INTEGER,
  received_at   INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_address
  ON messages(address);

CREATE INDEX IF NOT EXISTS idx_messages_expires
  ON messages(expires_at);

CREATE INDEX IF NOT EXISTS idx_messages_received
  ON messages(address, received_at DESC);

CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  message_id    TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename      TEXT,
  content_type  TEXT,
  size_bytes    INTEGER,
  data          BLOB
);

CREATE INDEX IF NOT EXISTS idx_attachments_message
  ON attachments(message_id);
