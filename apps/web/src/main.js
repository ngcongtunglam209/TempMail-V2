// LamMail web — entry point

import './styles/tokens.css';
import './styles/layout.css';

import { api } from './apiClient.js';
import { store } from './store.js';
import { applyDom, getLocale, setLocale, t } from './ui/i18n.js';
import { bindInbox, refreshInbox } from './ui/inbox.js';
import { bindTabs } from './ui/tabs.js';
import { bindViewer } from './ui/viewer.js';
import { bindPalette, setCommands } from './ui/palette.js';
import { bindAliasDialog, openAliasDialog } from './ui/alias.js';
import { toast } from './ui/toast.js';

let autoTimer = null;
let ttlTimer = null;

function applyTheme(theme) {
  const resolved =
    theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = resolved === 'light' ? '#f8fafc' : '#0b0f1a';
}

function fmtTtl(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    return `${h}h ${mm}m`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderAddress() {
  const session = store.active();
  const input = document.getElementById('address-input');
  const dot = document.getElementById('status-dot');
  const ttl = document.getElementById('ttl-chip');

  if (session) {
    input.value = session.address;
    input.placeholder = '';
    dot.dataset.status = 'online';
  } else {
    input.value = '';
    input.placeholder = 'No mailbox — click "New address"';
    dot.dataset.status = 'offline';
  }
  updateTtl();
}

function updateTtl() {
  const session = store.active();
  const ttl = document.getElementById('ttl-chip');
  ttl.textContent = session ? fmtTtl(session.expiresAt - Date.now()) : '--:--';
}

async function bootstrapMailbox() {
  if (store.active()) return;
  if (store.get().sessions.length) {
    store.setActive(0);
    return;
  }
  try {
    const dot = document.getElementById('status-dot');
    dot.dataset.status = 'loading';
    const result = await api.createMailbox({});
    store.addSession(result);
  } catch (err) {
    toast(t('toast.network'), 'error');
  }
}

async function newAddress() {
  try {
    const result = await api.createMailbox({});
    if (store.get().sessions.length === 0) store.addSession(result);
    else store.replaceActiveSession(result);
    toast(t('toast.created'), 'success');
    await refreshInbox({ silent: true });
  } catch (err) {
    if (err.code === 'LIMIT') toast(t('toast.maxTabs'), 'error');
    else toast(t('toast.network'), 'error');
  }
}

async function copyAddress() {
  const session = store.active();
  if (!session) return;
  try {
    await navigator.clipboard.writeText(session.address);
    toast(t('toast.copied'), 'success');
  } catch {
    toast(t('toast.copyFail'), 'error');
  }
}

async function deleteCurrent() {
  const i = store.get().activeIndex;
  const session = store.active();
  if (!session) return;
  try {
    await api.deleteMailbox(session.token);
  } catch {
    /* ignore */
  }
  store.removeSession(i);
  toast(t('toast.deleted'), 'info');
  if (!store.active()) await bootstrapMailbox();
  await refreshInbox({ silent: true });
}

function configureAutoRefresh() {
  clearInterval(autoTimer);
  autoTimer = null;
  const { autoRefresh, autoIntervalSec } = store.get().prefs;
  if (autoRefresh) {
    const ms = Math.max(5, autoIntervalSec) * 1000;
    autoTimer = setInterval(() => refreshInbox({ silent: true }), ms);
  }
}

function rebuildCommands() {
  const sessions = store.get().sessions;
  const cmds = [
    { icon: '↻', label: t('cmd.refresh'), hint: 'R', run: () => refreshInbox() },
    { icon: '＋', label: t('cmd.new'), hint: 'N', run: newAddress },
    { icon: '✎', label: t('cmd.claim'), run: openAliasDialog },
    { icon: '⧉', label: t('cmd.copy'), hint: 'C', run: copyAddress },
    { icon: '☼', label: t('cmd.theme'), run: toggleTheme },
    { icon: '🌐', label: t('cmd.lang'), run: toggleLang },
    { icon: '✕', label: t('cmd.delete'), run: deleteCurrent },
    ...sessions.map((s, i) => ({
      icon: '✉',
      label: `${t('cmd.tab')}: ${s.address}`,
      run: () => store.setActive(i),
    })),
  ];
  setCommands(cmds);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  store.setPrefs({ theme: next });
}

function toggleLang() {
  const next = getLocale() === 'en' ? 'vi' : 'en';
  setLocale(next);
  store.setPrefs({ locale: next });
  document.getElementById('lang-btn').textContent = next.toUpperCase();
  rebuildCommands();
}

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    const isText = ['input', 'textarea', 'select'].includes(tag) ||
      document.activeElement?.isContentEditable;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isText) return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      refreshInbox();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      newAddress();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      copyAddress();
    } else if (e.key === '/') {
      e.preventDefault();
      document.getElementById('search').focus();
    }
  });
}

async function main() {
  const prefs = store.get().prefs;
  if (prefs.locale && prefs.locale !== 'en') setLocale(prefs.locale);
  applyTheme(prefs.theme);
  applyDom();

  document.getElementById('lang-btn').textContent = getLocale().toUpperCase();
  document.getElementById('lang-btn').addEventListener('click', toggleLang);
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);
  document.getElementById('copy-btn').addEventListener('click', copyAddress);
  document.getElementById('new-btn').addEventListener('click', newAddress);
  document.getElementById('refresh-btn').addEventListener('click', () => refreshInbox());
  document.getElementById('delete-mb-btn').addEventListener('click', deleteCurrent);

  const auto = document.getElementById('auto-toggle');
  const interval = document.getElementById('auto-interval');
  auto.checked = prefs.autoRefresh;
  interval.value = String(prefs.autoIntervalSec);
  auto.addEventListener('change', () => {
    store.setPrefs({ autoRefresh: auto.checked });
    configureAutoRefresh();
  });
  interval.addEventListener('change', () => {
    store.setPrefs({ autoIntervalSec: Number(interval.value) });
    configureAutoRefresh();
  });

  bindInbox();
  bindTabs({ onChanged: () => refreshInbox({ silent: true }) });
  bindViewer({ onChanged: () => refreshInbox({ silent: true }) });
  bindPalette();
  bindAliasDialog();
  bindKeyboardShortcuts();

  store.subscribe(() => {
    renderAddress();
    rebuildCommands();
  });

  rebuildCommands();
  await bootstrapMailbox();
  await refreshInbox({ silent: true });
  configureAutoRefresh();

  ttlTimer = setInterval(updateTtl, 1000);
}

main();
