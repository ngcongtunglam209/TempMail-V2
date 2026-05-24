// LamMail web — unlock dialog
// Visitor enters (address, passcode) and exchanges them for a session token.

import { api, ApiError } from '../apiClient.js';
import { store } from '../store.js';
import { t } from './i18n.js';
import { toast } from './toast.js';

let onUnlocked = null;

function showError(message) {
  const el = document.getElementById('unlock-error');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById('unlock-error');
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

export function bindUnlockDialog({ onSuccess } = {}) {
  onUnlocked = onSuccess || null;

  const dlg = document.getElementById('unlock-dialog');
  const form = document.getElementById('unlock-form');
  const closeBtn = document.getElementById('unlock-close');
  const cancelBtn = document.getElementById('unlock-cancel');

  closeBtn.addEventListener('click', () => dlg.close());
  cancelBtn.addEventListener('click', () => dlg.close());

  // Hide the inline error as soon as the user edits either field.
  for (const id of ['unlock-address', 'unlock-passcode']) {
    document.getElementById(id)?.addEventListener('input', clearError);
  }
  // Reset on close so a stale error doesn't reappear next time.
  dlg.addEventListener('close', clearError);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const address = document.getElementById('unlock-address').value.trim().toLowerCase();
    const passcode = document.getElementById('unlock-passcode').value;
    if (!address || !passcode) {
      showError(t('unlock.required'));
      return;
    }

    const submit = document.getElementById('unlock-submit');
    submit.disabled = true;
    try {
      const result = await api.unlock({ address, passcode });
      try {
        store.addSession(result);
      } catch (err) {
        if (err.code === 'LIMIT') {
          // Replace the active session if at the cap.
          store.replaceActiveSession(result);
        } else {
          throw err;
        }
      }
      toast(t('unlock.success'), 'success');
      dlg.close();
      document.getElementById('unlock-passcode').value = '';
      onUnlocked?.();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        showError(t('unlock.invalid'));
      } else if (err instanceof ApiError && err.status === 429) {
        showError('Too many attempts — wait a minute');
      } else {
        showError(t('toast.network'));
      }
    } finally {
      submit.disabled = false;
    }
  });
}

export function openUnlockDialog() {
  const dlg = document.getElementById('unlock-dialog');
  clearError();
  if (!dlg.open) dlg.showModal();
  setTimeout(() => document.getElementById('unlock-address')?.focus(), 0);
}
