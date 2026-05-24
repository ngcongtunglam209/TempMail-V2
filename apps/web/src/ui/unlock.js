// LamMail web — unlock dialog
// Visitor enters (address, passcode) and exchanges them for a session token.

import { api, ApiError } from '../apiClient.js';
import { store } from '../store.js';
import { t } from './i18n.js';
import { toast } from './toast.js';

let onUnlocked = null;

export function bindUnlockDialog({ onSuccess } = {}) {
  onUnlocked = onSuccess || null;

  const dlg = document.getElementById('unlock-dialog');
  const form = document.getElementById('unlock-form');
  const closeBtn = document.getElementById('unlock-close');
  const cancelBtn = document.getElementById('unlock-cancel');

  closeBtn.addEventListener('click', () => dlg.close());
  cancelBtn.addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const address = document.getElementById('unlock-address').value.trim().toLowerCase();
    const passcode = document.getElementById('unlock-passcode').value;
    if (!address || !passcode) {
      toast(t('unlock.required'), 'error');
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
        toast(t('unlock.invalid'), 'error');
      } else if (err instanceof ApiError && err.status === 429) {
        toast('Too many attempts — wait a minute', 'error');
      } else {
        toast(t('toast.network'), 'error');
      }
    } finally {
      submit.disabled = false;
    }
  });
}

export function openUnlockDialog() {
  const dlg = document.getElementById('unlock-dialog');
  if (!dlg.open) dlg.showModal();
  setTimeout(() => document.getElementById('unlock-address')?.focus(), 0);
}
