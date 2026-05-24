// LamMail API — HTML sanitization for incoming email bodies.
// Uses DOMPurify with a jsdom window; blocks scripts, event handlers,
// and remote resources by default.

import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const FORBIDDEN_TAGS = ['script', 'object', 'embed', 'iframe', 'meta', 'link', 'base'];
const FORBIDDEN_ATTRS = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'];

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  // Strip remote http(s) images by default; they leak the read state to senders.
  if (data.attrName === 'src' && /^https?:/i.test(data.attrValue)) {
    data.keepAttr = false;
  }
});

export function sanitizeHtml(input) {
  if (!input) return '';
  return DOMPurify.sanitize(String(input), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: FORBIDDEN_ATTRS,
    ALLOW_DATA_ATTR: false,
  });
}

export function makePreview(text, max = 140) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + '…';
}
