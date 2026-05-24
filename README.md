# LamMail

Self-hosted ephemeral disposable email service. Receives real mail on your own
domain, holds messages for one hour, then auto-purges. No accounts, no logs.

- Frontend: `https://lammail.vietkieu.edu.pl`
- API: `https://api.lammail.vietkieu.edu.pl`
- MX: `mail.vietkieu.edu.pl` (apex MX for `vietkieu.edu.pl`)

## Architecture

- `apps/api` — Fastify REST API + SMTP receiver, SQLite storage
- `apps/web` — Vite + vanilla JS frontend
- `deploy/` — Caddyfile, systemd units, install script

## Local development

```bash
npm install
npm run dev:api      # API on :3001, dev SMTP on :2525
npm run dev:web      # Vite dev server
```

## License

MIT — see [LICENSE](LICENSE).
