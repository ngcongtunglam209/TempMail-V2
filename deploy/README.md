# LamMail Deployment Guide

Single-server Linux deployment with **two domains**:

| Domain                     | Role                                                   |
| -------------------------- | ------------------------------------------------------ |
| `a.bond` (example webmail) | Webmail UI users visit                                 |
| `vietkieu.edu.pl`          | Where mail addresses live (e.g. `random@vietkieu.edu.pl`) |

Targets Debian 12+ or Ubuntu 22.04+.

## What you'll have when this is done

- Frontend at `https://a.bond` (and `https://www.a.bond`)
- API at `https://api.a.bond`
- Inbound SMTP on `mail.vietkieu.edu.pl:25`
- TLS via Let's Encrypt (auto-renewed by Caddy)
- API + SMTP managed by `systemd` as a single unit (`lammail.service`)
- Data in `/opt/lammail/data/mail.db` (auto-purged after 1 hour)

> The webmail domain and the mail domain are **independent**. The webmail
> domain has no MX records; the mail domain has no webmail records. Pick any
> short domain you own for the webmail side; this guide uses `a.bond` as the
> example.

## Prerequisites

- A Linux server with a public IPv4 address
- Inbound port **25** open at the provider firewall (you've confirmed this)
- DNS control of **both** domains
- Root or sudo access on the server

## DNS records

Add these at your registrars **before** running the installer (so Caddy can
issue certs on first boot).

### Webmail domain — `a.bond`

| Name           | Type | Value     |
| -------------- | ---- | --------- |
| `a.bond` (apex) | A   | SERVER_IP |
| `www`          | A    | SERVER_IP |
| `api`          | A    | SERVER_IP |

No MX records. The webmail domain never receives mail.

### Mail domain — `vietkieu.edu.pl`

| Name                          | Type | Value                                        |
| ----------------------------- | ---- | -------------------------------------------- |
| `mail.vietkieu.edu.pl`        | A    | SERVER_IP                                    |
| `vietkieu.edu.pl` (apex)      | MX   | `10 mail.vietkieu.edu.pl.`                   |
| `vietkieu.edu.pl` (apex)      | TXT  | `v=spf1 a:mail.vietkieu.edu.pl -all` (optional) |
| `_dmarc.vietkieu.edu.pl`      | TXT  | `v=DMARC1; p=none;` (optional)               |

> **Heads up:** the apex MX setting routes ALL mail for `vietkieu.edu.pl` to
> LamMail. If you have other mail on this domain, switch to a subdomain MX
> (e.g. `tmp.vietkieu.edu.pl MX 10 mail.vietkieu.edu.pl.`) and set
> `MAIL_DOMAIN=tmp.vietkieu.edu.pl` in `apps/api/.env`.

> **Reverse DNS (PTR):** ask your VPS provider to set the PTR record for your
> server IP to `mail.vietkieu.edu.pl`. Without it, some senders (Gmail in
> particular) will mark your server as suspicious.

## Configure for your real domains

The repo ships configured for `a.bond` (webmail) and `vietkieu.edu.pl` (mail).
If your webmail domain is something else, edit two files **before** running
the installer:

1. `deploy/Caddyfile` — replace `a.bond` and `api.a.bond` with your real
   webmail hostnames.
2. `deploy/install.sh` — change `CORS_ORIGINS=https://a.bond,...` to match.

## Install

```bash
ssh root@SERVER_IP

git clone https://github.com/<you>/lammail /tmp/lammail
sudo bash /tmp/lammail/deploy/install.sh
```

The installer will:

1. Install Node 20, Caddy, UFW
2. Create the `lammail` system user
3. `npm install` and build the frontend
4. Drop a production `.env` in `apps/api/.env` (you can edit it later)
5. Install and start the `lammail` systemd unit
6. Install the Caddyfile and reload Caddy
7. Open ports 22, 25, 80, 443 in UFW

## Verify

```bash
# API is up
curl -s https://api.a.bond/v1/health | jq

# Webmail is up
curl -sI https://a.bond/ | head -n1

# SMTP banner (should show LamMail ESMTP)
nc -v mail.vietkieu.edu.pl 25 < /dev/null

# Tail server logs
sudo journalctl -u lammail -f
```

Then send a real email from Gmail to `<random>@vietkieu.edu.pl` (an address
you generated through the UI on `a.bond`). It should appear in the inbox
within a few seconds.

## Update

```bash
cd /opt/lammail/app
sudo -u lammail git pull
sudo -u lammail npm install
sudo -u lammail npm run build:web
sudo systemctl restart lammail
sudo systemctl reload caddy
```

## Common issues

**Caddy keeps trying to issue a cert and failing**
DNS isn't pointing at the server yet, or port 80 is blocked. Run
`dig a.bond` and `dig api.a.bond` to confirm A records resolve to your
server IP. Make sure UFW shows 80 and 443 allowed.

**Mail to my address never arrives**
Check the SMTP banner with `nc -v mail.vietkieu.edu.pl 25` from a different
machine. If that fails, port 25 is blocked at the provider edge or by `ufw`.
Run `sudo ufw status verbose` to confirm.

**Browser can't reach the API (CORS error)**
The API's `CORS_ORIGINS` in `apps/api/.env` must include your real webmail
origin (`https://a.bond`). Edit and `sudo systemctl restart lammail`.

**Node can't bind port 25**
The systemd unit grants `CAP_NET_BIND_SERVICE` so the `lammail` user can bind
low ports. If you run the API outside of systemd (e.g. for debugging), either
run as root for that session or run:

```bash
sudo setcap 'cap_net_bind_service=+ep' "$(readlink -f $(which node))"
```

**My database is huge after a week**
It shouldn't be — the cleanup job runs every 60 s and purges anything past 1
hour. Check `journalctl -u lammail | grep cleanup`.

**I want to switch to upstream Mail.tm**
Edit `/opt/lammail/app/apps/api/.env`, set `PROVIDER=upstream`, and restart.
(Note: the upstream adapter is currently a stub.)

## Backup

Data is ephemeral by design but you can snapshot the DB if you want:

```bash
sudo sqlite3 /opt/lammail/data/mail.db ".backup /var/backups/lammail-$(date +%F).db"
```

## Uninstall

```bash
sudo systemctl disable --now lammail
sudo rm /etc/systemd/system/lammail.service
sudo systemctl daemon-reload
sudo rm -rf /opt/lammail
sudo userdel -r lammail
sudo rm /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo ufw delete allow 25/tcp
```
