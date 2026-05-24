// LamMail web — toast notifications
//
// Repeated calls with the same message + type don't stack: the existing
// toast's timer is reset and an unobtrusive count badge is updated. Toasts
// are also capped so a runaway loop can't fill the screen.

const MAX_VISIBLE = 4;
const root = () => document.getElementById('toasts');

// key (`type|message`) -> { el, timer, count }
const live = new Map();

function dismiss(key) {
  const entry = live.get(key);
  if (!entry) return;
  live.delete(key);
  clearTimeout(entry.timer);
  entry.el.style.transition = 'opacity 200ms ease, transform 200ms ease';
  entry.el.style.opacity = '0';
  entry.el.style.transform = 'translateY(8px)';
  setTimeout(() => entry.el.remove(), 220);
}

export function toast(message, type = 'info', durationMs = 3200) {
  const key = `${type}|${message}`;
  const existing = live.get(key);

  if (existing) {
    existing.count += 1;
    let badge = existing.el.querySelector('.toast__count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'toast__count';
      badge.style.cssText = 'margin-left:8px;opacity:0.7;font-size:11.5px;';
      existing.el.appendChild(badge);
    }
    badge.textContent = `×${existing.count}`;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => dismiss(key), durationMs);
    return;
  }

  // Cap visible toasts: drop the oldest when over the limit.
  if (live.size >= MAX_VISIBLE) {
    const oldestKey = live.keys().next().value;
    if (oldestKey) dismiss(oldestKey);
  }

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  root().appendChild(el);

  const timer = setTimeout(() => dismiss(key), durationMs);
  live.set(key, { el, timer, count: 1 });
}
