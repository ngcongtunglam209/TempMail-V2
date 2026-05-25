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

## Programmatic access

Scripts can drive the API with admin-issued API keys.

1. Set `ADMIN_TOKEN` in `apps/api/.env` and restart the API.
2. Open `/admin`, sign in, then issue a key under **API keys**. Copy the
   plaintext value (`lk_...`) — it's shown only once.
3. Use it via either header:
   - `X-Api-Key: lk_...`
   - `Authorization: Bearer lk_...`

Quickstart with curl:

```bash
API=https://api.example.com
KEY=lk_...

# Create a disposable mailbox (defaults: 1-hour TTL, MAIL_DOMAIN)
curl -s "$API/v1/api/mailboxes" -H "X-Api-Key: $KEY" \
  -H 'content-type: application/json' \
  -d '{"ttlSeconds": 3600}'

# List messages
curl -s "$API/v1/api/mailboxes/abc@example.com/messages" -H "X-Api-Key: $KEY"

# Stream new mail in real time (SSE)
curl -N "$API/v1/api/mailboxes/abc@example.com/stream" -H "X-Api-Key: $KEY"
```

A complete reference client (create + stream) lives at
`apps/api/scripts/example-client.mjs`:

```bash
API_BASE=https://api.example.com API_KEY=lk_... \
  node apps/api/scripts/example-client.mjs
```

Endpoints (all under `/v1/api/`, all require an API key):

| Method | Path                              | Purpose                       |
|--------|-----------------------------------|-------------------------------|
| POST   | `/mailboxes`                      | create disposable mailbox     |
| GET    | `/mailboxes`                      | list every mailbox            |
| DELETE | `/mailboxes/:address`             | delete mailbox + messages     |
| GET    | `/mailboxes/:address/messages`    | list messages                 |
| GET    | `/mailboxes/:address/messages/:id`| full message JSON             |
| DELETE | `/mailboxes/:address/messages/:id`| delete one message            |
| GET    | `/mailboxes/:address/stream`      | SSE stream of inbound mail    |

## License

MIT — see [LICENSE](LICENSE).
