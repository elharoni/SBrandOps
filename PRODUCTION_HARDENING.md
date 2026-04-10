# SBrandOps — Production Hardening (Milestone 0)

This guide summarizes the P0 changes required to ship a secure, operable v1.

## 1. Apply Team-Scoped RLS (SQL)
Run `fix_rls_production.sql` in Supabase SQL editor (prod). It:
- Uses `crm_user_brand_ids()` to scope access to owner + active team members.
- Disables client SELECT on `public.social_accounts`.
- Adds secure RPC: `get_social_accounts_public(p_brand_id uuid)` to list accounts without secrets.

## 2. Deploy Edge Functions
```
supabase functions deploy publish-now
supabase functions deploy connect-accounts
```
Set `SUPABASE_SERVICE_ROLE_KEY` secret and ensure it is not exposed to the client.

## 3. Frontend Changes
- Facebook SDK is loaded dynamically via `services/facebookSDK.ts` using `VITE_FACEBOOK_APP_ID`.
- Social publishing uses `supabase.functions.invoke('publish-now')`.
- Connecting accounts uses `supabase.functions.invoke('connect-accounts')`.

## 4. Usage Counters
- `migrations/020_usage_counters.sql` creates `usage_counters` table and helper `increment_usage_counter()`.
- Use from Edge to track `publish_ops` / `ai_tokens` monthly usage.

## 5. Observability
- Edge returns `X-Correlation-Id` and logs JSON lines with `cid`, `event`, `latency_ms`.
- Enable Sentry DSN in frontend; tag `brand_id`/`user_id`/`tenant_id`.

## 6. Smoke Checklist
- Connect FB/IG via OAuth ? Edge `connect-accounts` stores rows.
- Read accounts via RPC only.
- Publish from UI ? Edge `publish-now` produces results + logs.
- RLS: users see only their brand data; non-members see nothing.
