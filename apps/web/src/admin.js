// LamMail web — admin console entry
// Hidden /admin page. Uses ADMIN_TOKEN held in sessionStorage to drive the
// /v1/admin/* endpoints. Token never persists to localStorage or disk.

import './styles/tokens.css';
import './styles/layout.css';

import { api, ApiError } from './apiClient.js';
import { toast } from './ui/toast.js';

const TOKEN_KEY = 'lammail.admin.token';

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

function setToken(value) {
  if (value) sessionStorage.setItem(TOKEN_KEY, value);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

function showSignedIn(signedIn) {
  document.getElementById('admin-login').hidden = signedIn;
  document.getElementById('admin-create').hidden = !signedIn;
  document.getElementById('admin-list-card').hidden = !signedIn;
  document.getElementById('admin-keys-card').hidden = !signedIn;
  document.getElementById('admin-signout').hidden = !signedIn;
}

function generatePasscode(len = 12) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (let i = 0; i < len; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function loadDomain() {
  try {
    const list = await api.domains();
    if (Array.isArray(list) && list[0]?.domain) {
      document.getElementById('admin-suffix').textContent = `@${list[0].domain}`;
    }
  } catch {
    /* keep default suffix */
  }
}

async function loadList() {
  const token = getToken();
  if (!token) return;
  try {
    const { mailboxes } = await api.admin.list(token);
    const list = document.getElementById('admin-list');
    document.getElementById('admin-count').textContent = String(mailboxes.length);
    if (!mailboxes.length) {
      list.innerHTML = `<div class="empty"><div class="empty__title">No mailboxes yet</div><div class="empty__hint">Create one above and share the passcode with a visitor.</div></div>`;
      return;
    }
    list.innerHTML = mailboxes
      .map(
        (m) => `
        <div class="row" data-address="${escape(m.address)}">
          <div class="avatar" style="background:linear-gradient(135deg,#7C5CFF,#22D3EE)" aria-hidden="true">${escape(
            m.address.slice(0, 1).toUpperCase(),
          )}</div>
          <div class="row__main">
            <div class="row__head">
              <span class="row__from">${escape(m.address)}</span>
              ${m.persistent ? '<span class="tag tag--verification">persistent</span>' : ''}
            </div>
            <div class="row__preview">
              created ${escape(new Date(m.createdAt).toLocaleString())}
              · ${m.messageCount} message${m.messageCount === 1 ? '' : 's'}
            </div>
          </div>
          <div class="row__side" style="gap:6px">
            <button class="btn" data-action="rotate">Rotate passcode</button>
            <button class="btn btn--danger" data-action="delete">Delete</button>
          </div>
        </div>`,
      )
      .join('');
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      toast('Token rejected', 'error');
      setToken('');
      showSignedIn(false);
    } else {
      toast('Could not load mailboxes', 'error');
    }
  }
}

async function createMailbox(e) {
  e.preventDefault();
  const token = getToken();
  if (!token) return;
  const errEl = document.getElementById('admin-create-error');
  const revealEl = document.getElementById('admin-create-reveal');
  errEl.hidden = true;
  errEl.textContent = '';
  revealEl.hidden = true;
  revealEl.innerHTML = '';

  const localPart = document.getElementById('admin-localPart').value.trim().toLowerCase();
  let passcode = document.getElementById('admin-passcode').value;
  if (!passcode) {
    passcode = generatePasscode();
    document.getElementById('admin-passcode').value = passcode;
  }

  // Match the server-side regex up front so the user gets a clear error
  // instead of a generic 400.
  if (localPart && !/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(localPart)) {
    errEl.hidden = false;
    errEl.textContent =
      'Local part must be 3-32 chars: letters, digits, dot, dash, underscore. Must start and end with a letter or digit.';
    return;
  }
  if (passcode.length < 4 || passcode.length > 128) {
    errEl.hidden = false;
    errEl.textContent = 'Passcode must be 4-128 characters.';
    return;
  }

  try {
    const body = { passcode };
    if (localPart) body.localPart = localPart;
    const result = await api.admin.create(token, body);
    revealEl.hidden = false;
    revealEl.innerHTML = `
      <div style="margin-bottom:6px"><strong>Mailbox created</strong> — share these with the visitor.</div>
      <div style="display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font:12.5px ui-monospace, monospace; align-items:center">
        <span style="opacity:0.7">address</span>
        <code style="word-break:break-all">${escape(result.address)}</code>
        <span style="opacity:0.7">passcode</span>
        <code style="word-break:break-all">${escape(result.passcode)}</code>
      </div>
      <div style="margin-top:6px">
        <button type="button" class="btn" data-copy="${escape(result.address)}|${escape(result.passcode)}">Copy address + passcode</button>
      </div>
    `;
    const copyBtn = revealEl.querySelector('[data-copy]');
    copyBtn?.addEventListener('click', async () => {
      const [addr, pc] = copyBtn.dataset.copy.split('|');
      try {
        await navigator.clipboard.writeText(`${addr}\n${pc}`);
        toast('Copied', 'success');
      } catch {
        toast('Could not copy', 'error');
      }
    });
    toast(`Created ${result.address}`, 'success');
    document.getElementById('admin-localPart').value = '';
    document.getElementById('admin-passcode').value = '';
    await loadList();
  } catch (err) {
    if (err instanceof ApiError) {
      errEl.hidden = false;
      errEl.textContent = err.message || `Error ${err.status}`;
    } else {
      errEl.hidden = false;
      errEl.textContent = 'Network error';
    }
  }
}

async function rowAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const row = btn.closest('[data-address]');
  if (!row) return;
  const address = row.dataset.address;
  const token = getToken();
  if (!token) return;
  if (btn.dataset.action === 'delete') {
    if (!confirm(`Delete ${address}? This also removes all messages and active sessions.`)) return;
    try {
      await api.admin.delete(token, address);
      toast('Deleted', 'success');
      await loadList();
    } catch {
      toast('Delete failed', 'error');
    }
    return;
  }
  if (btn.dataset.action === 'rotate') {
    const next = prompt(
      `New passcode for ${address} (4-128 chars). Leave blank to auto-generate.`,
    );
    if (next === null) return;
    const passcode = next || generatePasscode();
    try {
      const result = await api.admin.rotate(token, address, passcode);
      toast(`New passcode: ${result.passcode}`, 'success');
      // Show the value next to the row so it can be copied.
      const side = row.querySelector('.row__side');
      const note = document.createElement('span');
      note.style.cssText = 'font:12px ui-monospace, monospace; color:var(--c-text);';
      note.textContent = result.passcode;
      side.prepend(note);
    } catch {
      toast('Rotate failed', 'error');
    }
  }
}

async function signIn(e) {
  e.preventDefault();
  const value = document.getElementById('admin-token-input').value.trim();
  if (!value) return;
  setToken(value);
  // Verify by hitting the list endpoint once.
  try {
    await api.admin.list(value);
    showSignedIn(true);
    document.getElementById('admin-token-input').value = '';
    await Promise.all([loadList(), loadKeys()]);
  } catch (err) {
    setToken('');
    if (err instanceof ApiError && err.status === 503) {
      toast('Admin is disabled — set ADMIN_TOKEN on the server', 'error');
    } else {
      toast('Token rejected', 'error');
    }
  }
}

function signOut() {
  setToken('');
  showSignedIn(false);
}

async function loadKeys() {
  const token = getToken();
  if (!token) return;
  try {
    const { keys } = await api.admin.listKeys(token);
    document.getElementById('admin-keys-count').textContent = String(keys.length);
    const list = document.getElementById('admin-keys-list');
    if (!keys.length) {
      list.innerHTML = `<div class="empty"><div class="empty__title">No API keys</div><div class="empty__hint">Issue one above to let scripts use /v1/api/*.</div></div>`;
      return;
    }
    list.innerHTML = keys
      .map((k) => {
        const status = k.revokedAt
          ? `<span class="tag tag--security">revoked</span>`
          : `<span class="tag tag--verification">active</span>`;
        const last = k.lastUsedAt
          ? `last used ${escape(new Date(k.lastUsedAt).toLocaleString())}`
          : 'never used';
        return `
          <div class="row" data-key-id="${escape(k.id)}">
            <div class="avatar" style="background:linear-gradient(135deg,#22D3EE,#10B981)" aria-hidden="true">K</div>
            <div class="row__main">
              <div class="row__head">
                <span class="row__from">${escape(k.label || 'unlabeled')}</span>
                ${status}
              </div>
              <div class="row__preview">
                <code style="font-size:11.5px">${escape(k.id)}</code>
                · created ${escape(new Date(k.createdAt).toLocaleString())}
                · ${last}
              </div>
            </div>
            <div class="row__side" style="gap:6px">
              ${k.revokedAt ? '' : '<button class="btn btn--danger" data-action="revoke">Revoke</button>'}
            </div>
          </div>`;
      })
      .join('');
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      toast('Token rejected', 'error');
      setToken('');
      showSignedIn(false);
    } else {
      toast('Could not load API keys', 'error');
    }
  }
}

async function issueKey(e) {
  e.preventDefault();
  const token = getToken();
  if (!token) return;
  const label = document.getElementById('admin-key-label').value.trim();
  try {
    const result = await api.admin.createKey(token, label || undefined);
    document.getElementById('admin-key-label').value = '';
    const reveal = document.getElementById('admin-key-reveal');
    reveal.hidden = false;
    reveal.innerHTML = `
      <div style="margin-bottom:6px"><strong>New API key</strong> — copy now, it won't be shown again.</div>
      <code style="display:block; word-break:break-all; font-size:12.5px">${escape(result.key)}</code>
    `;
    toast('Key issued', 'success');
    await loadKeys();
  } catch (err) {
    if (err instanceof ApiError) toast(err.message || `Error ${err.status}`, 'error');
    else toast('Network error', 'error');
  }
}

async function keyAction(e) {
  const btn = e.target.closest('[data-action="revoke"]');
  if (!btn) return;
  const row = btn.closest('[data-key-id]');
  if (!row) return;
  const id = row.dataset.keyId;
  const token = getToken();
  if (!token) return;
  if (!confirm(`Revoke key ${id}? Scripts using it will start getting 401s.`)) return;
  try {
    await api.admin.revokeKey(token, id);
    toast('Revoked', 'success');
    await loadKeys();
  } catch {
    toast('Revoke failed', 'error');
  }
}

function main() {
  document.getElementById('admin-login-form').addEventListener('submit', signIn);
  document.getElementById('admin-create-form').addEventListener('submit', createMailbox);
  document.getElementById('admin-passcode-gen').addEventListener('click', () => {
    document.getElementById('admin-passcode').value = generatePasscode();
  });
  document.getElementById('admin-refresh').addEventListener('click', loadList);
  document.getElementById('admin-list').addEventListener('click', rowAction);
  document.getElementById('admin-signout').addEventListener('click', signOut);
  document.getElementById('admin-keys-form').addEventListener('submit', issueKey);
  document.getElementById('admin-keys-refresh').addEventListener('click', loadKeys);
  document.getElementById('admin-keys-list').addEventListener('click', keyAction);

  loadDomain();
  if (getToken()) {
    showSignedIn(true);
    loadList();
    loadKeys();
  } else {
    showSignedIn(false);
  }
}

main();
