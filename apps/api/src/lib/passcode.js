// LamMail API — passcode hashing
// Admin-issued mailbox passcodes are hashed with scrypt + per-mailbox salt.
// scrypt is built into node:crypto, so no extra native dependency.

import crypto from 'node:crypto';

const KEY_LEN = 32;
const SALT_LEN = 16;
// Conservative cost; passcode verification only happens on /v1/unlock,
// which is rate-limited per-IP.
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPasscode(passcode) {
  if (typeof passcode !== 'string' || passcode.length === 0) {
    throw new Error('passcode must be a non-empty string');
  }
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const hash = crypto
    .scryptSync(passcode, salt, KEY_LEN, SCRYPT_OPTS)
    .toString('hex');
  return { salt, hash };
}

export function verifyPasscode(passcode, salt, hash) {
  if (typeof passcode !== 'string' || !salt || !hash) return false;
  let derived;
  try {
    derived = crypto.scryptSync(passcode, salt, KEY_LEN, SCRYPT_OPTS);
  } catch {
    return false;
  }
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function isValidPasscode(value) {
  if (typeof value !== 'string') return false;
  // 4..128 chars, printable ASCII. Admin chooses; we don't enforce complexity.
  if (value.length < 4 || value.length > 128) return false;
  return /^[\x21-\x7e]+$/.test(value);
}
