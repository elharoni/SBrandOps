# SBrandOps TODO

This checklist is based on the current repository state and the validated production-readiness findings.

## P0 - Launch Blockers

- [x] Rotate the Gemini API key currently stored in `.env`.
- [x] Remove all browser-side Gemini usage and move AI calls behind a server-side proxy or Edge Function.
- [x] Remove `--no-verify-jwt` from `deploy.ps1`.
- [x] Add JWT verification to `supabase/functions/publish-now/index.ts`.
- [x] Add JWT verification to `supabase/functions/manage-social-account/index.ts`.
- [x] Add JWT verification to `supabase/functions/connect-accounts/index.ts`.
- [x] Add JWT verification to `supabase/functions/provider-oauth-callback/index.ts`.
- [x] Add webhook secret validation to `supabase/functions/provider-webhook/index.ts`.
- [x] Add brand/account ownership checks to every Edge Function that accepts `brand_id`, `account_id`, or `connection_id`.
- [x] Replace `Access-Control-Allow-Origin: *` with an explicit allowlist in exposed Edge Functions.
- [x] Remove the `import.meta.env.DEV` admin fallback in `components/App.tsx`.
- [x] Fix `window.opener.postMessage(payload, '*')` in `supabase/functions/google-oauth/index.ts`.
- [x] Verify that `migrations/044_fix_rls_policies.sql` has been applied in production.
- [x] Encrypt OAuth access and refresh tokens instead of storing them as plaintext. (AES-256-GCM via _shared/tokens.ts — requires OAUTH_ENCRYPTION_KEY env var + migration 021 + backfill)
- [x] Stop duplicating raw OAuth tokens into multiple tables unless strictly required. (social_accounts display-only; oauth_tokens is single source of truth)
- [x] Move AI provider key reads and key testing off the client.

## P1 - Backend Safety and Data Integrity

- [x] Add idempotency support to `supabase/functions/publish-now/index.ts`.
- [x] Add locking or claim logic to `supabase/functions/auto-publisher/index.ts` to prevent double publishing.
- [x] Add request size limits to exposed Edge Functions.
- [x] Add maximum array length validation for bulk payloads like `accounts[]` and `assets[]`.
- [x] Remove sensitive request-body logging and token logging from Edge Functions.
- [x] Standardize Edge Function error responses into one JSON error shape.
- [x] Review every function using the service role key for missing authorization guards. (analytics-aggregator + data-sync now require service role key; paddle-webhook uses HMAC; paddle-webhook-auto-retry uses BILLING_RETRY_CRON_SECRET)
- [x] Confirm only intended functions are deployed publicly. (all user-facing functions require JWT; webhooks use HMAC/shared secret; cron functions require service role key)

## P2 - Database Hardening

- [x] Update `migrations/038_oauth_tokens.sql` to use encrypted token storage. (021_encrypt_oauth_tokens.sql created — requires OAUTH_ENCRYPTION_KEY env var and manual backfill)
- [x] Add a migration path for token backfill from plaintext to encrypted columns. (included as comments in 021_encrypt_oauth_tokens.sql)
- [x] Remove or guard destructive `DROP TABLE IF EXISTS ... CASCADE` patterns in migrations. (none found — not applicable)
- [x] Add missing indexes for high-frequency operational queries. (020_perf_indexes.sql created)
- [x] Review soft-delete behavior and ensure `deleted_at IS NULL` is enforced where needed. (no deleted_at columns in schema — soft-delete not used, N/A)
- [x] Add validation for important `jsonb` columns. (022_jsonb_constraints.sql)
- [ ] Plan partitioning for `activity_logs`, `ai_usage_logs`, and `post_analytics` as data grows.
- [x] Document migration rollback or recovery steps for production incidents. (docs/DEPLOYMENT_RUNBOOK.md)

## P3 - Frontend Architecture and UX

- [ ] Break down `components/App.tsx` into smaller routing and layout units.
- [ ] Reduce prop drilling by introducing focused providers/contexts where appropriate.
- [x] Remove unused legacy SEO implementation if `SEOOpsPage.tsx` is no longer part of the active route path.
- [x] Add route-level error boundaries instead of relying only on the app-wide boundary.
- [ ] Standardize loading states, empty states, and error states across major pages.
- [x] Audit icon buttons and custom controls for missing `aria-label` and keyboard support.
- [ ] Improve mobile behavior for critical product flows.
- [ ] Add virtualization or pagination for large data tables.

## P4 - Product and Commercial Controls

- [x] Enforce quotas server-side, not only in the client. (brand limit check in addBrand via tenant plan; atomic decrement in deleteBrand via DB function in migration 023)
- [x] Add tenant-level AI spend caps. (100K tokens/day per user, configurable via AI_DAILY_TOKEN_LIMIT env var)
- [ ] Add upgrade and quota-reached flows in-product.
- [ ] Add seat enforcement by plan.
- [x] Implement a clear trial state machine. (ai-proxy blocks suspended/cancelled accounts and expired trials with 403)
- [x] Add usage alerts at meaningful thresholds. (ai-proxy returns X-Tokens-Used-Today / X-Tokens-Limit-Today headers on every response)
- [x] Move important commercial calculations to database views or server-side logic. (migration 024: v_tenant_brand_counts, v_tenant_ai_usage_month, v_tenant_summary views)

## P5 - Testing and Operations

- [ ] Add unit tests for exposed Edge Functions.
- [ ] Add smoke tests for login, account connection, scheduling, publishing, and billing flows.
- [ ] Add end-to-end tests for the most critical user journeys.
- [x] Add security scanning in CI (`gitleaks`, dependency audit, SAST). (gitleaks-action + npm audit --audit-level=high in ci.yml)
- [x] Add a real lint configuration and ensure CI fails on lint errors. (eslint.config.js + CI lint job uses npm run lint without --if-present)
- [ ] Add monitoring for cron health, webhook failures, and Edge Function error rates.
- [ ] Add alerting for failed publishing, failed billing webhooks, and stalled background jobs.
- [ ] Verify staging and production are clearly separated.

## P6 - Docs and Repository Hygiene

- [x] Update `README.md` so setup instructions reflect the real migration and deployment path.
- [x] Add a short architecture overview for frontend, database, and Edge Functions. (docs/ARCHITECTURE.md)
- [x] Document Edge Function contracts and auth expectations. (docs/EDGE_FUNCTIONS.md)
- [x] Add a deployment runbook and rollback checklist. (docs/DEPLOYMENT_RUNBOOK.md)
- [x] Add an incident response checklist for publishing and billing failures. (docs/INCIDENT_RESPONSE.md)
- [x] Add `.editorconfig`.
- [x] Add Prettier config.
- [x] Add ESLint config.
- [ ] Clean up mojibake / encoding issues in comments and docs.
- [x] Decide whether `supabase.exe` should live in the repo; remove it if not required. (added supabase.exe to .gitignore — install via npm/brew instead)

## Suggested Execution Order

- [ ] Finish every P0 item before onboarding paying customers.
- [ ] Tackle P1 and P2 in the same hardening sprint.
- [ ] Use P3 and P4 as the next product stabilization sprint.
- [ ] Keep P5 and P6 running in parallel as ongoing engineering hygiene.
