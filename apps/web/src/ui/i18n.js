// LamMail web — i18n
// Lightweight EN/VI translation engine. Applies on init and when locale changes.

const TRANSLATIONS = {
  en: {
    'header.tagline': 'Disposable email on your domain',
    'palette.open': 'Open command palette',
    'actions.copy': 'Copy address',
    'actions.refresh': 'Refresh',
    'actions.new': 'New address',
    'actions.unlock': 'Unlock mailbox',
    'actions.signout': 'Sign out',
    'actions.claim': 'Claim alias',
    'actions.auto': 'Auto',
    'actions.deleteMailbox': 'Delete mailbox',
    'inbox.title': 'Inbox',
    'inbox.search': 'Search by subject or sender…',
    'filter.all': 'All',
    'filter.starred': 'Starred',
    'filter.verification': 'Verifications',
    'empty.title': 'No emails yet',
    'empty.hint': "Send a message to your address — it'll show up here.",
    'tag.verification': 'Verification',
    'tag.security': 'Security',
    'tag.marketing': 'Marketing',
    'tag.testing': 'Testing',
    'toast.copied': 'Address copied',
    'toast.copyFail': 'Could not copy',
    'toast.created': 'New address generated',
    'toast.deleted': 'Mailbox deleted',
    'toast.maxTabs': 'Maximum 5 mailboxes',
    'toast.refreshed': 'Inbox refreshed',
    'toast.network': 'Network error',
    'toast.aliasTaken': 'That alias is already taken',
    'toast.aliasInvalid': 'Alias must be 3-32 chars (letters, digits, . _ -)',
    'alias.title': 'Claim a custom alias',
    'alias.hint': 'Pick the part before the @. 3-32 letters, digits, dot, dash, underscore.',
    'alias.cancel': 'Cancel',
    'alias.submit': 'Claim',
    'unlock.title': 'Unlock your mailbox',
    'unlock.hint': 'Enter the address and passcode the admin gave you.',
    'unlock.cancel': 'Cancel',
    'unlock.submit': 'Unlock',
    'unlock.invalid': 'Invalid address or passcode',
    'unlock.success': 'Mailbox unlocked',
    'unlock.required': 'Enter both address and passcode',
    'ttl.persistent': 'persistent',
    'session.expired': 'Session expired — unlock again',
    'palette.placeholder': 'Type a command or search…',
    'cmd.refresh': 'Refresh inbox',
    'cmd.new': 'Generate new address',
    'cmd.unlock': 'Unlock another mailbox',
    'cmd.signout': 'Sign out of current mailbox',
    'cmd.copy': 'Copy email address',
    'cmd.theme': 'Toggle theme',
    'cmd.lang': 'Switch language',
    'cmd.delete': 'Delete current mailbox',
    'cmd.tab': 'Switch to mailbox',
    'cmd.claim': 'Claim a custom alias',
  },
  vi: {
    'header.tagline': 'Email tạm thời trên domain của bạn',
    'palette.open': 'Mở bảng lệnh',
    'actions.copy': 'Sao chép địa chỉ',
    'actions.refresh': 'Làm mới',
    'actions.new': 'Địa chỉ mới',
    'actions.unlock': 'Mở khoá hộp thư',
    'actions.signout': 'Đăng xuất',
    'actions.claim': 'Đặt tên riêng',
    'actions.auto': 'Tự động',
    'actions.deleteMailbox': 'Xoá hộp thư',
    'inbox.title': 'Hộp thư',
    'inbox.search': 'Tìm theo tiêu đề hoặc người gửi…',
    'filter.all': 'Tất cả',
    'filter.starred': 'Đã gắn sao',
    'filter.verification': 'Xác minh',
    'empty.title': 'Chưa có email',
    'empty.hint': 'Gửi thư tới địa chỉ của bạn — sẽ hiện ở đây.',
    'tag.verification': 'Xác minh',
    'tag.security': 'Bảo mật',
    'tag.marketing': 'Quảng cáo',
    'tag.testing': 'Thử nghiệm',
    'toast.copied': 'Đã sao chép',
    'toast.copyFail': 'Không thể sao chép',
    'toast.created': 'Đã tạo địa chỉ mới',
    'toast.deleted': 'Đã xoá hộp thư',
    'toast.maxTabs': 'Tối đa 5 hộp thư',
    'toast.refreshed': 'Đã làm mới',
    'toast.network': 'Lỗi kết nối',
    'toast.aliasTaken': 'Tên này đã có người dùng',
    'toast.aliasInvalid': 'Tên phải dài 3-32 ký tự (chữ, số, . _ -)',
    'alias.title': 'Đặt tên hộp thư riêng',
    'alias.hint': 'Chọn phần trước @. 3-32 ký tự: chữ, số, dấu chấm, gạch dưới, gạch ngang.',
    'alias.cancel': 'Huỷ',
    'alias.submit': 'Tạo',
    'unlock.title': 'Mở khoá hộp thư',
    'unlock.hint': 'Nhập địa chỉ và mã quản trị viên đã cấp cho bạn.',
    'unlock.cancel': 'Huỷ',
    'unlock.submit': 'Mở khoá',
    'unlock.invalid': 'Địa chỉ hoặc mã không đúng',
    'unlock.success': 'Đã mở khoá hộp thư',
    'unlock.required': 'Nhập cả địa chỉ và mã',
    'ttl.persistent': 'cố định',
    'session.expired': 'Phiên đã hết — vui lòng mở khoá lại',
    'palette.placeholder': 'Nhập lệnh hoặc tìm kiếm…',
    'cmd.refresh': 'Làm mới hộp thư',
    'cmd.new': 'Tạo địa chỉ mới',
    'cmd.unlock': 'Mở khoá hộp thư khác',
    'cmd.signout': 'Đăng xuất hộp thư',
    'cmd.copy': 'Sao chép địa chỉ',
    'cmd.theme': 'Đổi giao diện',
    'cmd.lang': 'Đổi ngôn ngữ',
    'cmd.delete': 'Xoá hộp thư hiện tại',
    'cmd.tab': 'Chuyển sang hộp thư',
    'cmd.claim': 'Đặt tên hộp thư riêng',
  },
};

let current = 'en';
const subs = new Set();

export function t(key) {
  const dict = TRANSLATIONS[current] || TRANSLATIONS.en;
  return dict[key] ?? TRANSLATIONS.en[key] ?? key;
}

export function setLocale(locale) {
  current = TRANSLATIONS[locale] ? locale : 'en';
  applyDom();
  for (const fn of subs) fn(current);
}

export function getLocale() {
  return current;
}

export function onLocaleChange(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function applyDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    const pairs = el.dataset.i18nAttr.split(';');
    for (const pair of pairs) {
      const [attr, key] = pair.split(':').map((s) => s && s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
  document.documentElement.setAttribute('lang', current);
}
