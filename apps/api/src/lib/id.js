// LamMail API — id helpers

import { customAlphabet } from 'nanoid';

// URL-safe, lowercase + digits, no ambiguous chars (l, o)
const localPartAlphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
const messageIdAlphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const newLocalPart = customAlphabet(localPartAlphabet, 10);
export const newMessageId = customAlphabet(messageIdAlphabet, 16);
export const newAttachmentId = customAlphabet(messageIdAlphabet, 12);

export function isValidLocalPart(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 3 || value.length > 32) return false;
  return /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/i.test(value);
}
