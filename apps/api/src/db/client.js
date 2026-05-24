// LamMail API — SQLite client
// Single shared connection per process. Schema applied on first open.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import CONFIG from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function getDb() {
  if (db) return db;

  // Ensure data directory exists
  const dir = path.dirname(CONFIG.dbPath);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(CONFIG.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Additive migrations for existing DBs that predate the passcode system.
  // schema.sql handles fresh installs; these handle upgrades in place.
  migrate(db);

  return db;
}

function migrate(database) {
  const cols = database.prepare(`PRAGMA table_info(mailboxes)`).all();
  const has = (name) => cols.some((c) => c.name === name);

  if (!has('passcode_hash')) {
    database.exec(`ALTER TABLE mailboxes ADD COLUMN passcode_hash TEXT`);
  }
  if (!has('passcode_salt')) {
    database.exec(`ALTER TABLE mailboxes ADD COLUMN passcode_salt TEXT`);
  }
  if (!has('persistent')) {
    database.exec(
      `ALTER TABLE mailboxes ADD COLUMN persistent INTEGER NOT NULL DEFAULT 0`,
    );
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
