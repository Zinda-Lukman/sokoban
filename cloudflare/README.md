# Sokoban Cloudflare Worker API

This folder contains a Cloudflare Worker version of the existing Sokoban API. It keeps the original Node.js server intact and exposes the same path names so the frontend can switch between the two backends.

## What is included

- Health check endpoint: `/health`
- Storage proxies:
  - `GET /api/storage/user/:userId`
  - `POST /api/storage/user/:userId`
  - `GET /api/storage/leaderboard`
  - `POST /api/storage/leaderboard`
- Payment endpoints:
  - `POST /api/invoice`
  - `POST /api/purchase/status`
- Telegram webhook endpoint:
  - `POST /telegram-webhook`

## Environment variables / secrets

Set all secrets in Cloudflare using Wrangler, not in the repo:

```bash
cd cloudflare
npx wrangler secret put BOT_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put CLIENT_API_KEY
npx wrangler secret put ADMIN_CHAT_ID
```

For local development, you can also set non-secret values in `wrangler.jsonc` or use `.dev.vars`:

```bash
cat > .dev.vars <<'EOF'
BOT_TOKEN=your-bot-token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CLIENT_API_KEY=your-shared-api-key
ADMIN_CHAT_ID=your-admin-chat-id
EOF
```

Do not commit real credentials.

## Local development

```bash
cd cloudflare
npm install
npm run dev
```

Then test:

```bash
curl http://127.0.0.1:8787/health
```

## Deployment

```bash
cd cloudflare
npx wrangler deploy
```

After deployment, set your Telegram webhook to your Worker URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/telegram-webhook"
```

## Frontend switching

Set a global value before the app loads:

```html
<script>
  window.APP_CONFIG = {
    apiBaseUrl: 'https://your-worker.example.workers.dev'
  };
</script>
```

With no value set, the app keeps using the existing Node.js API at the same relative paths.

## Notes

- The original Express server in `server/purchaseServer.js` is left untouched.
- The Worker intentionally mirrors the same API routes and auth behavior wherever possible.
- Direct PostgreSQL access is not available in Workers, so the Cloudflare version uses Supabase for the same persistence flow.



What would you like your workers.dev subdomain to be? It will be accessible at https://<subdomain>.workers.dev … lookmans
✔ Creating a workers.dev subdomain for your account at https://lookmans.workers.dev. Ok to proceed? … yes
Success! It may take a few minutes for DNS records to update.
Visit https://dash.cloudflare.com/022ab6e3cd477b754cb87611ae0f86c0/workers/subdomain to edit your workers.dev subdomain
Deployed sokoban-cloudflare-api triggers (60.05 sec)
  https://sokoban-cloudflare-api.lookmans.workers.dev
Current Version ID: adaf4f23-0322-438e-8322-9790a1b73c06