// LamMail web — email viewer in sandboxed iframe

import { api } from '../apiClient.js';
import { store } from '../store.js';
import { toast } from './toast.js';
import { t } from './i18n.js';

let currentMessage = null;
let blockImages = true;

function frameDoc(html, { dark, blockRemote }) {
  const safeHtml = html || '<p style="color:#888">(no HTML body)</p>';
  // Block remote images by default by stripping src on http(s).
  const transformed = blockRemote
    ? safeHtml.replace(
        /<img\b([^>]*?)\ssrc\s*=\s*("|')(https?:[^"']+)\2/gi,
        '<img$1 data-src="$3" style="filter:blur(2px);opacity:0.5"',
      )
    : safeHtml;
  const bg = dark ? '#0b0f1a' : '#ffffff';
  const fg = dark ? '#f1f5f9' : '#0f172a';
  return `<!doctype html>
    <html><head><meta charset="utf-8"><base target="_blank">
    <style>
      :root { color-scheme: ${dark ? 'dark' : 'light'}; }
      html, body { margin: 0; }
      body { font: 14px/1.5 ui-sans-serif, system-ui; background: ${bg}; color: ${fg}; padding: 18px; }
      img, video { max-width: 100%; height: auto; }
      a { color: hsl(252 100% 70%); }
      blockquote { border-left: 3px solid #888; padding-left: 12px; color: #888; margin: 8px 0; }
      pre, code { background: #0001; padding: 2px 4px; border-radius: 4px; }
      table { border-collapse: collapse; }
    </style></head>
    <body>${transformed}</body></html>`;
}

function renderFrame() {
  if (!currentMessage) return;
  const dark = document.documentElement.dataset.theme !== 'light';
  const frame = document.getElementById('viewer-frame');
  frame.srcdoc = frameDoc(currentMessage.html || `<pre>${escapeText(currentMessage.text)}</pre>`, {
    dark,
    blockRemote: blockImages,
  });
}

function escapeText(s) {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function openViewer(msg) {
  currentMessage = msg;
  blockImages = store.get().prefs.blockRemoteImages;

  document.getElementById('viewer-subject').textContent = msg.subject || '(no subject)';
  document.getElementById('viewer-from').textContent = msg.fromName
    ? `${msg.fromName} <${msg.from}>`
    : msg.from || 'Unknown';
  document.getElementById('viewer-date').textContent = new Date(msg.receivedAt).toLocaleString();

  renderFrame();
  document.getElementById('viewer').showModal();
}

export function bindViewer({ onChanged } = {}) {
  const dlg = document.getElementById('viewer');
  document.getElementById('viewer-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });

  document.getElementById('viewer-toggle-images').addEventListener('click', () => {
    blockImages = !blockImages;
    store.setPrefs({ blockRemoteImages: blockImages });
    renderFrame();
    toast(blockImages ? 'Remote images blocked' : 'Remote images allowed', 'info');
  });

  document.getElementById('viewer-eml').addEventListener('click', () => {
    if (!currentMessage) return;
    const eml = buildEml(currentMessage);
    const blob = new Blob([eml], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentMessage.id}.eml`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('viewer-delete').addEventListener('click', async () => {
    if (!currentMessage) return;
    const session = store.active();
    if (!session) return;
    try {
      await api.deleteMessage(session.token, currentMessage.id);
      dlg.close();
      onChanged?.();
      toast('Deleted', 'success');
    } catch {
      toast(t('toast.network'), 'error');
    }
  });
}

function buildEml(msg) {
  const headers = [
    `From: ${msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from}`,
    `To: ${(msg.to || []).join(', ')}`,
    `Subject: ${msg.subject || ''}`,
    `Date: ${new Date(msg.receivedAt).toUTCString()}`,
    `Content-Type: text/html; charset=utf-8`,
    '',
  ];
  return headers.join('\r\n') + (msg.html || msg.text || '');
}
