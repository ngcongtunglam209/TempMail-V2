#!/usr/bin/env bash
# LamMail one-shot installer for a Debian/Ubuntu Linux server.
# Run as root or with sudo:
#   curl -fsSL https://raw.githubusercontent.com/<you>/lammail/main/deploy/install.sh | sudo bash
# Or after cloning:
#   sudo bash deploy/install.sh

set -euo pipefail

LAMMAIL_USER="lammail"
LAMMAIL_HOME="/opt/lammail"
APP_DIR="${LAMMAIL_HOME}/app"
DATA_DIR="${LAMMAIL_HOME}/data"
REPO_URL="${REPO_URL:-}"   # set REPO_URL=... to git clone instead of bind-mount

log() { printf '\033[1;36m[lammail]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[lammail]\033[0m %s\n' "$*" >&2; }

if [[ $EUID -ne 0 ]]; then
  err "Run with sudo or as root."
  exit 1
fi

. /etc/os-release || true
case "${ID:-}" in
  ubuntu|debian) ;;
  *) err "Unsupported distro: ${ID:-unknown}. This script targets Debian/Ubuntu."; exit 1 ;;
esac

log "Updating apt and installing packages…"
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl git build-essential python3 ufw \
  debian-keyring debian-archive-keyring apt-transport-https gnupg

# --- Node.js 20 LTS via NodeSource ---
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  log "Installing Node.js 20 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "node $(node -v), npm $(npm -v)"

# --- Caddy ---
if ! command -v caddy >/dev/null 2>&1; then
  log "Installing Caddy…"
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

# --- App user ---
if ! id "$LAMMAIL_USER" >/dev/null 2>&1; then
  log "Creating user $LAMMAIL_USER…"
  useradd -r -m -d "$LAMMAIL_HOME" -s /bin/bash "$LAMMAIL_USER"
fi
mkdir -p "$DATA_DIR"
chown -R "$LAMMAIL_USER:$LAMMAIL_USER" "$LAMMAIL_HOME"

# --- App code ---
if [[ -n "$REPO_URL" ]]; then
  log "Cloning $REPO_URL → $APP_DIR"
  if [[ -d "$APP_DIR/.git" ]]; then
    sudo -u "$LAMMAIL_USER" git -C "$APP_DIR" pull --ff-only
  else
    sudo -u "$LAMMAIL_USER" git clone "$REPO_URL" "$APP_DIR"
  fi
else
  if [[ ! -d "$APP_DIR" ]]; then
    err "REPO_URL not set and $APP_DIR is missing. Either:"
    err "  1. Run: REPO_URL=https://... sudo -E bash deploy/install.sh"
    err "  2. Copy the project to $APP_DIR yourself, then re-run."
    exit 1
  fi
fi
chown -R "$LAMMAIL_USER:$LAMMAIL_USER" "$APP_DIR"

# --- Install + build ---
log "Running npm install (workspaces)…"
sudo -u "$LAMMAIL_USER" --preserve-env=PATH bash -lc "cd '$APP_DIR' && npm install --omit=dev=false"

log "Building frontend…"
sudo -u "$LAMMAIL_USER" --preserve-env=PATH bash -lc "cd '$APP_DIR' && npm run build:web"

# --- API .env ---
ENV_FILE="$APP_DIR/apps/api/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  log "Writing default .env (production)…"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3001
HOST=127.0.0.1

PROVIDER=local

# Mail addresses are on this domain (must match your MX records).
MAIL_DOMAIN=vietkieu.edu.pl
ALLOWED_DOMAINS=vietkieu.edu.pl

MAILBOX_TTL_SECONDS=3600
CLEANUP_INTERVAL_SECONDS=60

SMTP_ENABLED=true
SMTP_PORT=25
SMTP_HOSTNAME=mail.vietkieu.edu.pl
SMTP_MAX_SIZE_BYTES=5242880

DB_PATH=/opt/lammail/data/mail.db

# Webmail lives on a separate domain (CORS allowlist).
CORS_ORIGINS=https://a.bond,https://www.a.bond

RATE_LIMIT_MAX_PER_MINUTE=120
RATE_LIMIT_CREATE_PER_MINUTE=10
EOF
  chown "$LAMMAIL_USER:$LAMMAIL_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

# --- systemd unit ---
log "Installing systemd unit…"
install -m 0644 "$APP_DIR/deploy/lammail.service" /etc/systemd/system/lammail.service
systemctl daemon-reload
systemctl enable --now lammail

# --- Caddy ---
log "Installing Caddyfile…"
install -m 0644 "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

# --- Firewall ---
log "Configuring UFW (allowing SSH, HTTP, HTTPS, SMTP)…"
ufw --force allow OpenSSH || ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 25/tcp
yes | ufw --force enable

log "Done."
echo ""
echo "Next steps:"
echo "  1. Add DNS records at your registrars:"
echo ""
echo "     # Webmail domain (the URL users visit)"
echo "     a.bond        A     <SERVER_IP>"
echo "     api.a.bond    A     <SERVER_IP>"
echo ""
echo "     # Mail domain (where addresses live)"
echo "     mail.vietkieu.edu.pl  A     <SERVER_IP>"
echo "     vietkieu.edu.pl       MX 10 mail.vietkieu.edu.pl."
echo ""
echo "  2. Wait for DNS to propagate (usually a few minutes)."
echo "  3. Caddy will auto-issue Let's Encrypt certs on first request."
echo "  4. Tail logs:  sudo journalctl -u lammail -f"
