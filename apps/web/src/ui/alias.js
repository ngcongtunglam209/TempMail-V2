// LamMail web — claim alias modal

import { api } from '../apiClient.js';
import { store } from '../store.js';
import { toast } from './toast.js';
import { t } from './i18n.js';
import { refreshInbox } from './inbox.js';

let domain = 'vietkieu.edu.pl';

async function loadDomain() {
  try {
    const list = await api.domains();
    const active = (list || []).find((d) => d.isActive) || list?.[0];
    if (active?.domain) domain = active.domain;
  } catch {
    /* ignore — fallback to default */
  }
  const suffix = document.getElementById('alias-suffix');
  if (suffix) suffix.textContent = `@${domain}`;
}

export function openAliasDialog() {
  const dlg = document.getElementById('alias-dialog');
  const input = document.getElementById('alias-input');
  input.value = '';
  dlg.showModal();
  setTimeout(() => input.focus(), 0);
}

function closeDialog() {
  const dlg = document.getElementById('alias-dialog');
  if (dlg.open) dlg.close();
}

async function submitAlias(e) {
  e.preventDefault();
  const input = document.getElementById('alias-input');
  const localPart = input.value.trim().toLowerCase();
  if (!localPart) return;

  try {
    const result = await api.createMailbox({ localPart, domain });
    if (store.get().sessions.length === 0) {
      store.addSession(result);
    } else {
      try {
        store.addSession(result);
      } catch (err) {
        // At limit: replace active mailbox instead.
        if (err.code === 'LIMIT') store.replaceActiveSession(result);
        else throw err;
      }
    }
    closeDialog();
    toast(t('toast.created'), 'success');
    await refreshInbox({ silent: true });
  } catch (err) {
    if (err.status === 409) toast(t('toast.aliasTaken'), 'error');
    else if (err.status === 400) toast(t('toast.aliasInvalid'), 'error');
    else toast(t('toast.network'), 'error');
  }
}

export function bindAliasDialog() {
  loadDomain();
  document.getElementById('claim-btn').addEventListener('click', openAliasDialog);
  document.getElementById('alias-form').addEventListener('submit', submitAlias);
  document.getElementById('alias-cancel').addEventListener('click', closeDialog);
  document.getElementById('alias-close').addEventListener('click', closeDialog);
  document.getElementById('alias-dialog').addEventListener('click', (e) => {
    if (e.target.id === 'alias-dialog') closeDialog();
  });
}
