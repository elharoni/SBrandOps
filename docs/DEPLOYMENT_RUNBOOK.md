# Deployment Runbook

## Prerequisites

- Node.js 20+
- Supabase CLI: `npm i -g supabase`
- Access to the Supabase project (project ref and service role key)

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_APP_URL=https://yourdomain.com
VITE_SENTRY_DSN=<optional>
VITE_FACEBOOK_APP_ID=<optional>
VITE_LINKEDIN_CLIENT_ID=<optional>
VITE_TIKTOK_CLIENT_KEY=<optional>
```

### Edge Function Secrets (Supabase Dashboard → Settings → Edge Functions)
| Secret | Required | Description |
|--------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Gemini AI key — never goes to browser |
| `OAUTH_ENCRYPTION_KEY` | Yes | 64-char hex for AES-256-GCM token encryption |
| `WEBHOOK_SECRET` | Yes | Shared secret for provider webhooks |
| `PADDLE_WEBHOOK_SECRET` | Yes | HMAC secret from Paddle dashboard |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth app client secret |
| `FRONTEND_ORIGIN` | Yes | Frontend URL for CORS (e.g. https://yourdomain.com) |
| `AI_DAILY_TOKEN_LIMIT` | No | Per-user daily token cap, default 100000 |
| `BILLING_RETRY_CRON_SECRET` | No | Secret for paddle retry cron job |

## Deployment Steps

### 1. Database Migrations

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

If migrations fail with "already exists" errors, mark them as applied:
```bash
npx supabase migration repair --status applied <version>
npx supabase db push
```

### 2. Deploy Edge Functions

```bash
# Deploy all functions at once
npm run supabase:functions:deploy

# Or deploy a single function
npx supabase functions deploy ai-proxy
```

### 3. Build and Deploy Frontend

```bash
npm run build
# Upload dist/ to your hosting provider (Vercel, Netlify, Cloudflare Pages, etc.)
```

## Rollback Steps

### Roll back a migration

Migrations are additive — avoid rollbacks if possible. If needed:
1. Write a new migration that reverses the change (e.g. `DROP COLUMN`, `DROP TABLE`)
2. Apply it with `npx supabase db push`

### Roll back an Edge Function

Redeploy the previous version from git:
```bash
git checkout <previous-sha> -- supabase/functions/<function-name>/
npx supabase functions deploy <function-name>
git checkout HEAD -- supabase/functions/<function-name>/
```

### Roll back the frontend

Redeploy the previous build artifact from your hosting provider, or redeploy from a previous git tag.

## Health Checks

After deploying, verify:

- [ ] `/functions/v1/ai-proxy` returns 401 without a JWT
- [ ] Login flow works end-to-end
- [ ] A scheduled post can be created and published
- [ ] Supabase Dashboard → Edge Functions → Logs shows no 5xx errors
- [ ] Supabase Dashboard → Database → RLS policies are enabled on all tables
