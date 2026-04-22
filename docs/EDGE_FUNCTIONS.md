# Edge Functions — Contracts and Auth

All Edge Functions live in `supabase/functions/`. Every function that accepts user input requires a Supabase JWT unless noted otherwise.

## Auth Patterns

| Pattern | Used by | How |
|---------|---------|-----|
| JWT (user session) | User-facing functions | `Authorization: Bearer <jwt>` header, verified via `verifyJWT()` in `_shared/auth.ts` |
| HMAC signature | `paddle-webhook` | `Paddle-Signature` header verified against `PADDLE_WEBHOOK_SECRET` |
| Shared secret | `provider-webhook` | `X-Webhook-Secret` header compared to `WEBHOOK_SECRET` env var |
| Service role key | Cron functions | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` |
| Super-admin JWT | `paddle-webhook-retry` | JWT + `role === 'super_admin'` in user metadata |

## Functions

### `ai-proxy`
- **Auth:** JWT required
- **Method:** POST
- **Body:** `{ mode, model, prompt?, contents?, schema?, feature?, brand_id?, count?, aspect_ratio? }`
- **Modes:** `text` (default) | `image`
- **Allowed text models:** gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro
- **Allowed image models:** imagen-4.0-generate-001, imagen-3.0-generate-002
- **Rate limit:** Daily token cap per user (default 100K, set via `AI_DAILY_TOKEN_LIMIT`)
- **Response headers:** `X-Tokens-Used-Today`, `X-Tokens-Limit-Today`
- **Errors:** 403 if trial expired or account suspended; 429 if daily cap exceeded; 503 if no API key configured

### `publish-now`
- **Auth:** JWT required
- **Method:** POST
- **Body:** `{ post_id, account_ids[] }`
- **Idempotent:** Yes — checks existing results before publishing
- **Notes:** Reads OAuth tokens from `oauth_tokens` table (encrypted); decrypts before calling platform APIs

### `connect-accounts`
- **Auth:** JWT required
- **Method:** POST
- **Body:** `{ provider, access_token, refresh_token?, expires_at?, platform_account_id, name, avatar_url?, brand_id }`
- **Notes:** Encrypts tokens before writing; verifies brand ownership via `assertBrandOwnership()`

### `manage-social-account`
- **Auth:** JWT required
- **Methods:** GET, DELETE, PATCH
- **Query params:** `brand_id`, `account_id`
- **Notes:** All operations verify account ownership before proceeding

### `provider-oauth-callback`
- **Auth:** JWT required
- **Method:** POST
- **Body:** `{ provider, code, redirect_uri, brand_id }`
- **Notes:** Exchanges auth code for tokens; encrypts before storing

### `provider-webhook`
- **Auth:** `X-Webhook-Secret` header (set `WEBHOOK_SECRET` env var)
- **Method:** POST
- **Notes:** Called by external social platforms; no user JWT available

### `google-oauth`
- **Auth:** None (OAuth redirect flow — called by Google)
- **Routes:** `/init?provider=&brand_id=` → redirects to Google; `/callback` → exchanges code, stores tokens
- **Notes:** Legitimately open — security relies on Google's OAuth state parameter

### `paddle-webhook`
- **Auth:** HMAC signature (`Paddle-Signature` header)
- **Method:** POST
- **Notes:** Handles billing events from Paddle; updates `billing_subscriptions`, `billing_invoices`

### `paddle-checkout`
- **Auth:** JWT required
- **Method:** POST
- **Body:** `{ price_id, success_url, cancel_url }`

### `paddle-billing-manage`
- **Auth:** JWT required
- **Method:** POST
- **Body:** `{ subscription_id, action }` — action: `cancel` | `pause` | `resume`

### `analytics-aggregator`
- **Auth:** Service role key required (cron use only)
- **Method:** POST

### `data-sync`
- **Auth:** Service role key required (cron use only)
- **Method:** POST

### `auto-publisher`
- **Auth:** Service role key required (cron use only)
- **Method:** POST
- **Notes:** Claims scheduled posts with a lock to prevent double-publishing

## Shared Utilities (`_shared/`)

- **`auth.ts`** — `verifyJWT()`, `assertBrandOwnership()`, `assertAccountOwnership()`, `buildCorsHeaders()`
- **`tokens.ts`** — `encryptToken()` / `decryptToken()` using AES-256-GCM + `OAUTH_ENCRYPTION_KEY`
- **`paddleBilling.ts`** — Shared Paddle billing helpers and Supabase client
