// LamMail web — multi-mailbox tabs

import { store, MAX_MAILBOXES } from '../store.js';
import { t } from './i18n.js';

function shortAddr(addr) {
  if (!addr) return 'mailbox';
  const at = addr.indexOf('@');
  return at > 0 ? addr.slice(0, at) : addr;
}

function render() {
  const tabs = document.getElementById('tabs');
  const { sessions, activeIndex } = store.get();
  const items = sessions.map((s, i) => `
    <button class="tab ${i === activeIndex ? 'tab--active' : ''}" data-index="${i}" title="${s.address}">
      <span>${shortAddr(s.address)}</span>
      <span class="tab__close" data-close="${i}" aria-label="Close">✕</span>
    </button>
  `).join('');
  const canAdd = sessions.length < MAX_MAILBOXES;
  tabs.innerHTML =
    items +
    (canAdd ? `<button class="tab tab--add" data-add="1">+ ${t('actions.unlock')}</button>` : '');
}

export function bindTabs({ onChanged } = {}) {
  const tabs = document.getElementById('tabs');
  tabs.addEventListener('click', async (e) => {
    const close = e.target.closest('[data-close]');
    if (close) {
      e.stopPropagation();
      const idx = Number(close.dataset.close);
      // Closing a tab signs the device out of that mailbox (drops the local
      // session token) but does NOT delete the admin-owned mailbox itself.
      store.removeSession(idx);
      onChanged?.();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      // Opening another mailbox requires another unlock.
      const dlg = document.getElementById('unlock-dialog');
      if (dlg && !dlg.open) dlg.showModal();
      setTimeout(() => document.getElementById('unlock-address')?.focus(), 0);
      return;
    }
    const tab = e.target.closest('[data-index]');
    if (tab) {
      const idx = Number(tab.dataset.index);
      store.setActive(idx);
      onChanged?.();
    }
  });

  store.subscribe(render);
}
