// LamMail web — store
// Reactive-ish state in localStorage with subscriptions.

const KEY = 'lammail.state.v1';
const MAX_SESSIONS = 5;

const defaultState = () => ({
  sessions: [],          // { address, token, expiresAt, knownIds: [] }
  activeIndex: -1,
  starred: {},           // address -> [messageId]
  prefs: {
    theme: null,         // null = follow system, 'dark' | 'light'
    locale: 'en',
    autoRefresh: false,
    autoIntervalSec: 30,
    blockRemoteImages: true,
  },
  welcomeSeen: false,
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, prefs: { ...defaultState().prefs, ...(parsed.prefs || {}) } };
  } catch {
    return defaultState();
  }
}

function persist(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota errors etc. */
  }
}

class Store {
  constructor() {
    this.state = load();
    this._subs = new Set();
    this._dropExpired();
  }

  get() {
    return this.state;
  }

  active() {
    const i = this.state.activeIndex;
    return i >= 0 ? this.state.sessions[i] : null;
  }

  set(updater) {
    const next = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater };
    this.state = next;
    persist(this.state);
    for (const fn of this._subs) fn(this.state);
  }

  subscribe(fn) {
    this._subs.add(fn);
    fn(this.state);
    return () => this._subs.delete(fn);
  }

  setPrefs(patch) {
    this.set({ prefs: { ...this.state.prefs, ...patch } });
  }

  setActive(index) {
    if (index < 0 || index >= this.state.sessions.length) return;
    this.set({ activeIndex: index });
  }

  addSession(session) {
    if (this.state.sessions.length >= MAX_SESSIONS) {
      const err = new Error(`Maximum ${MAX_SESSIONS} mailboxes`);
      err.code = 'LIMIT';
      throw err;
    }
    const sessions = [...this.state.sessions, { ...session, knownIds: [] }];
    this.set({ sessions, activeIndex: sessions.length - 1 });
  }

  replaceActiveSession(session) {
    if (this.state.activeIndex < 0) {
      this.addSession(session);
      return;
    }
    const sessions = [...this.state.sessions];
    sessions[this.state.activeIndex] = { ...session, knownIds: [] };
    this.set({ sessions });
  }

  removeSession(index) {
    const sessions = this.state.sessions.filter((_, i) => i !== index);
    let activeIndex = this.state.activeIndex;
    if (activeIndex === index) activeIndex = sessions.length ? 0 : -1;
    else if (activeIndex > index) activeIndex -= 1;
    this.set({ sessions, activeIndex });
  }

  recordKnownIds(ids) {
    const i = this.state.activeIndex;
    if (i < 0) return;
    const sessions = [...this.state.sessions];
    sessions[i] = { ...sessions[i], knownIds: ids };
    this.set({ sessions });
  }

  toggleStar(address, messageId) {
    const list = new Set(this.state.starred[address] || []);
    if (list.has(messageId)) list.delete(messageId);
    else list.add(messageId);
    this.set({ starred: { ...this.state.starred, [address]: [...list] } });
  }

  isStarred(address, messageId) {
    return (this.state.starred[address] || []).includes(messageId);
  }

  _dropExpired() {
    const now = Date.now();
    const sessions = this.state.sessions.filter((s) => s.expiresAt > now);
    if (sessions.length !== this.state.sessions.length) {
      const activeIndex = sessions.length ? Math.min(this.state.activeIndex, sessions.length - 1) : -1;
      this.set({ sessions, activeIndex });
    }
  }
}

export const store = new Store();
export const MAX_MAILBOXES = MAX_SESSIONS;
