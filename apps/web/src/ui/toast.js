// LamMail web — toast notifications

const root = () => document.getElementById('toasts');

export function toast(message, type = 'info', durationMs = 3200) {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  root().appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms ease, transform 200ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 220);
  }, durationMs);
}
