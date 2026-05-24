// LamMail web — inbox list, tag classifier, filters, search

import { api } from '../apiClient.js';
import { store } from '../store.js';
import { t, onLocaleChange } from './i18n.js';
import { toast } from './toast.js';
import { openViewer } from './viewer.js';

const PALETTE = [
  ['#7C5CFF', '#22D3EE'],
  ['#EC4899', '#F59E0B'],
  ['#10B981', '#22D3EE'],
  ['#F97316', '#EC4899'],
  ['#6366F1', '#8B5CF6'],
  ['#14B8A6', '#3B82F6'],
];

let filter = 'all';
let query = '';
let cache = []; // last fetched messages for the active mailbox

const RX = {
  verification: /(verify|verification|verif|otp|one[- ]?time|kode|m[ãa]\s*x[áa]c|code|activation|activate|confirm)/i,
  security: /(security|sign[- ]?in|login|password|reset|2fa|two[- ]?factor)/i,
  marketing: /(newsletter|promo|offer|deal|sale|unsubscribe)/i,
  testing: /(test|sandbox|dev|staging|qa)/i,
};

export function classifyTag(subject = '', from = '') {
  const s = `${subject} ${from}`;
  if (RX.verification.test(s)) return { kind: 'verification', label: t('tag.verification') };
  if (RX.security.test(s)) return { kind: 'security', label: t('tag.security') };
  if (RX.marketing.test(s)) return { kind: 'marketing', label: t('tag.marketing') };
  if (RX.testing.test(s)) return { kind: 'testing', label: t('tag.testing') };
  return null;
}

function avatarFor(sender) {
  let h = 0;
  const s = sender || '?';
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [a, b] = PALETTE[h % PALETTE.length];
  const initial = (s[0] || '?').toUpperCase();
  return { a, b, initial };
}

function relativeTime(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(ts).toLocaleDateString();
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

function renderRow(msg, addr) {
  const tag = classifyTag(msg.subject, msg.from);
  const av = avatarFor(msg.fromName || msg.from);
  const starred = store.isStarred(addr, msg.id);
  return `
    <div class="row" role="listitem" data-id="${escape(msg.id)}">
      <div class="avatar" style="background:linear-gradient(135deg,${av.a},${av.b})" aria-hidden="true">${escape(av.initial)}</div>
      <div class="row__main">
        <div class="row__head">
          <span class="row__from">${escape(msg.fromName || msg.from || 'Unknown')}<span class="row__email">${msg.fromName ? escape(msg.from || '') : ''}</span></span>
          ${tag ? `<span class="tag tag--${tag.kind}">${escape(tag.label)}</span>` : ''}
        </div>
        <div class="row__subject">${escape(msg.subject || '(no subject)')}</div>
        <div class="row__preview">${escape(msg.preview || '')}</div>
      </div>
      <div class="row__side">
        <button class="star ${starred ? 'star--on' : ''}" data-action="star" title="Star">★</button>
        <span>${escape(relativeTime(msg.receivedAt))}</span>
      </div>
    </div>
  `;
}

function applyFilters(list, addr) {
  let out = list;
  if (filter === 'starred') {
    const stars = new Set(store.get().starred[addr] || []);
    out = out.filter((m) => stars.has(m.id));
  } else if (filter === 'verification') {
    out = out.filter((m) => classifyTag(m.subject, m.from)?.kind === 'verification');
  }
  if (query) {
    const q = query.toLowerCase();
    out = out.filter(
      (m) =>
        (m.subject || '').toLowerCase().includes(q) ||
        (m.from || '').toLowerCase().includes(q) ||
        (m.fromName || '').toLowerCase().includes(q) ||
        (m.preview || '').toLowerCase().includes(q),
    );
  }
  return out;
}

function render() {
  const session = store.active();
  const listEl = document.getElementById('inbox-list');
  const emptyEl = document.getElementById('inbox-empty');
  const countEl = document.getElementById('inbox-count');

  if (!session) {
    listEl.innerHTML = '';
    emptyEl.style.display = '';
    listEl.appendChild(emptyEl);
    countEl.textContent = '0';
    return;
  }

  const filtered = applyFilters(cache, session.address);
  countEl.textContent = String(cache.length);

  if (!filtered.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = '';
    listEl.appendChild(emptyEl);
    return;
  }
  emptyEl.style.display = 'none';
  listEl.innerHTML = filtered.map((m) => renderRow(m, session.address)).join('');
}

export async function refreshInbox({ silent = false } = {}) {
  const session = store.active();
  if (!session) {
    cache = [];
    render();
    return;
  }
  try {
    const list = await api.listMessages(session.token);
    cache = Array.isArray(list) ? list : [];
    store.recordKnownIds(cache.map((m) => m.id));
    render();
    if (!silent) toast(t('toast.refreshed'), 'info');
  } catch (err) {
    if (err.status === 401) {
      // session expired; drop it
      const i = store.get().activeIndex;
      if (i >= 0) store.removeSession(i);
      toast(t('session.expired'), 'error');
      const dlg = document.getElementById('unlock-dialog');
      if (dlg && !dlg.open && !store.active()) dlg.showModal();
    } else if (!silent) {
      toast(t('toast.network'), 'error');
    }
  }
}

export function setFilter(f) {
  filter = f;
  for (const el of document.querySelectorAll('.chips .chip')) {
    el.classList.toggle('chip--active', el.dataset.filter === f);
  }
  render();
}

export function setSearch(q) {
  query = (q || '').trim();
  render();
}

export function bindInbox() {
  const list = document.getElementById('inbox-list');
  list.addEventListener('click', async (e) => {
    const star = e.target.closest('[data-action="star"]');
    const row = e.target.closest('.row');
    if (!row) return;
    const id = row.dataset.id;
    const session = store.active();
    if (!session) return;

    if (star) {
      e.stopPropagation();
      store.toggleStar(session.address, id);
      render();
      return;
    }
    const msg = await api.getMessage(session.token, id).catch((err) => {
      if (err.status === 404) toast('Message not found', 'error');
      else toast(t('toast.network'), 'error');
      return null;
    });
    if (msg) openViewer(msg);
  });

  for (const el of document.querySelectorAll('.chips .chip')) {
    el.addEventListener('click', () => setFilter(el.dataset.filter));
  }
  const search = document.getElementById('search');
  let dt = null;
  search.addEventListener('input', () => {
    clearTimeout(dt);
    dt = setTimeout(() => setSearch(search.value), 200);
  });

  store.subscribe(render);
  onLocaleChange(render);
}
