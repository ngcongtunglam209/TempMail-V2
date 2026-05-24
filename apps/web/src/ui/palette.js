// LamMail web — Cmd/Ctrl+K command palette

import { t } from './i18n.js';

let commands = [];
let filtered = [];
let cursor = 0;

function fuzzy(text, query) {
  if (!query) return true;
  const a = text.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  for (const ch of q) {
    const idx = a.indexOf(ch, i);
    if (idx < 0) return false;
    i = idx + 1;
  }
  return true;
}

function render() {
  const list = document.getElementById('palette-list');
  list.innerHTML = filtered.map((c, i) => `
    <li class="palette__item" role="option" aria-selected="${i === cursor}" data-index="${i}">
      <span>${c.icon || '·'}</span>
      <span>${c.label}</span>
      ${c.hint ? `<span class="palette__hint">${c.hint}</span>` : ''}
    </li>
  `).join('');
}

function update(query = '') {
  filtered = commands.filter((c) => fuzzy(c.label, query));
  cursor = 0;
  render();
}

export function setCommands(items) {
  commands = items;
}

export function openPalette() {
  const dlg = document.getElementById('palette');
  const input = document.getElementById('palette-input');
  input.value = '';
  input.placeholder = t('palette.placeholder');
  update('');
  dlg.showModal();
  setTimeout(() => input.focus(), 0);
}

export function closePalette() {
  const dlg = document.getElementById('palette');
  if (dlg.open) dlg.close();
}

export function bindPalette() {
  const dlg = document.getElementById('palette');
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-list');

  document.addEventListener('keydown', (e) => {
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
    if (isCmdK) {
      e.preventDefault();
      dlg.open ? closePalette() : openPalette();
    }
  });

  input.addEventListener('input', () => update(input.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.min(filtered.length - 1, cursor + 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(0, cursor - 1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[cursor];
      if (cmd) {
        closePalette();
        cmd.run?.();
      }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('[data-index]');
    if (!item) return;
    const cmd = filtered[Number(item.dataset.index)];
    closePalette();
    cmd?.run?.();
  });

  document.getElementById('palette-btn').addEventListener('click', openPalette);
}
