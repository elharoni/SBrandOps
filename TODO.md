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

- [x] Break down `components/App.tsx` into smaller routing and layout units. (`BrandRouter.tsx` + `AdminRouter.tsx` extracted; App.tsx reduced from 1246 → 633 lines; publisher state and handlers moved into BrandRouter.)
- [x] Reduce prop drilling by introducing focused providers/contexts where appropriate. (Publisher state `postToEdit`/`publisherBrief` moved into BrandRouter; empty stubs `errors`, `conversations`, etc. are now internal constants instead of props.)
- [x] Remove unused legacy SEO implementation if `SEOOpsPage.tsx` is no longer part of the active route path.
- [x] Add route-level error boundaries instead of relying only on the app-wide boundary.
- [x] Standardize loading states, empty states, and error states across major pages. (`SectionError` rewritten to Tailwind tokens; `BrandsManagePage` → `EmptyBrands`; `PublisherPage` → `Spinner`; `EmptyState` action button hover fixed; `AnalyticsPage` `TabFallback` now uses `SkeletonAnalytics` instead of raw spinner.)
- [x] Audit icon buttons and custom controls for missing `aria-label` and keyboard support.
- [ ] Improve mobile behavior for critical product flows.
- [x] Add virtualization or pagination for large data tables. (`ScheduledPage`: 15 posts/page; `ErrorCenterPage`: 20 errors/page — both reset page on filter/search change.)

### UX/UI Audit Findings (2026-04-22)

#### Done
- [x] Fix `DashboardPage` Section C: replace hardcoded fake insights with 3-tier honest system (0 posts / 1–9 collecting / 10+ with real platform data + industry benchmark labels).
- [x] Fix `DashboardPage` Section C header: add live "Collecting — N/10 posts" badge and "some figures are industry benchmarks" disclaimer.
- [x] Fix `DashboardPage` `SuggestionCard` arrow direction: was always `fa-arrow-left`; now RTL-aware (`ar ? fa-arrow-left : fa-arrow-right`).
- [x] Fix `DashboardPage` `PriorityCard` color logic: replace fragile `tone.includes('rose')` string matching with a proper `PRIORITY_ICON_BG` color map (emerald and fuchsia tones previously fell back silently to brand-primary).
- [x] Fix `LoginPage` + `RegisterPage`: align with app design system — inputs and buttons now use `rounded-xl`, button hover changed from `hover:bg-brand-secondary` (jarring cyan) to `hover:bg-brand-primary/90`, focus ring updated to `ring-brand-primary/30`.
- [x] Fix `MobileHomePage`: all labels (quick actions, section headers, priority/alert text) are now bilingual — were hardcoded Arabic even in English mode.
- [x] Fix page refresh redirecting to Dashboard (`hooks/useAppRouting.ts`): added `hydrated` ref — Effect 1 (state→URL) now skips navigation on mount until Effect 2 (URL→state) has read the actual path, so refreshing `/app/publisher` stays on Publisher.
- [x] Add missing URL routes (`config/routes.ts`): `brand-brain`, `integration-os`, `crm/dashboard`, `crm/customers`, `crm/pipeline`, `crm/tickets` were absent — `pathToBrandPage()` was falling back to `'dashboard'` for all of them, causing refresh to land on Dashboard.
- [x] Fix `PublisherPage` layout (`components/pages/PublisherPage.tsx`): editor (`<Publisher>`) moved before Saved Briefs section — editor is now immediately visible below the hero; Saved Briefs is a secondary reference library below the fold.

#### Done (2026-04-23)
- [x] **Operator metrics Demo watermark** (`DashboardPage.tsx`): Added persistent "Demo" badge to all 4 tiles; disclaimer banner now always visible (not just when ads aren't linked).
- [x] **MetricTile hardcoded trends** (`DashboardPage.tsx`): Removed fake static `trend` percentage props — tiles show raw values without fabricated period-over-period badges.
- [x] **Section B silent truncation** (`DashboardPage.tsx`): Slice moved from useMemo to render; shows first 4 items then "and N more…" link when list exceeds 4.
- [x] **Sidebar Content Engine submenu** already collapses by default (`openMenus` excludes `content-engine` on mount). No change needed.
- [x] **Auth pages refactored to use shared UIComponents** (`AuthInput`, `AuthErrorBanner`, `AuthConfigWarning`, `AuthSubmitButton`, `AuthDivider` exported from `UIComponents.tsx`) — `LoginPage`, `RegisterPage`, `ForgotPasswordPage` no longer duplicate input/banner/button markup. `Button` base updated to `rounded-xl` + `hover:bg-brand-primary/90`.
- [x] **Google social login** added to `LoginPage` and `RegisterPage` — `signInWithGoogle` in `authService.ts`; Google-branded button on both pages. **Requires**: Google OAuth provider enabled in Supabase dashboard → Authentication → Providers.

## P4 - Product and Commercial Controls

- [x] Enforce quotas server-side, not only in the client. (brand limit check in addBrand via tenant plan; atomic decrement in deleteBrand via DB function in migration 023)
- [x] Add tenant-level AI spend caps. (100K tokens/day per user, configurable via AI_DAILY_TOKEN_LIMIT env var)
- [x] Add upgrade and quota-reached flows in-product. (QuotaLimitModal in PaywallGate + AIQuotaError in aiProxy + QuotaWarning in TeamManagementPage)
- [x] Add seat enforcement by plan. (inviteUser() counts active+pending members vs plan max_users; TeamManagementPage blocks invite button at limit)
- [x] Implement a clear trial state machine. (ai-proxy blocks suspended/cancelled accounts and expired trials with 403)
- [x] Add usage alerts at meaningful thresholds. (ai-proxy returns X-Tokens-Used-Today / X-Tokens-Limit-Today headers on every response)
- [x] Move important commercial calculations to database views or server-side logic. (migration 024: v_tenant_brand_counts, v_tenant_ai_usage_month, v_tenant_summary views)

## P5 - Testing and Operations

- [x] Add unit tests for exposed Edge Functions. (Deno tests in supabase/functions/_tests/ — webhookSecurity, validation, auth helpers; run via `deno test` in CI edge-function-tests job)
- [ ] Add smoke tests for login, account connection, scheduling, publishing, and billing flows.
- [ ] Add end-to-end tests for the most critical user journeys.
- [x] Add security scanning in CI (`gitleaks`, dependency audit, SAST). (gitleaks-action + npm audit --audit-level=high in ci.yml)
- [x] Add a real lint configuration and ensure CI fails on lint errors. (eslint.config.js + CI lint job uses npm run lint without --if-present)
- [x] Add monitoring for cron health, webhook failures, and Edge Function error rates. (monitor-health Edge Function — stalled posts, failed billing events, publish failure rate, retry queue)
- [x] Add alerting for failed publishing, failed billing webhooks, and stalled background jobs. (monitor-health returns 503 on down; CI + deploy notify-failure jobs post to Slack via SLACK_WEBHOOK_URL secret)
- [x] Verify staging and production are clearly separated. (.env.staging template; deploy.yml uses GitHub Environments with isolated secrets; smoke-test step runs monitor-health after every deploy)

## P6 - Docs and Repository Hygiene

- [x] Update `README.md` so setup instructions reflect the real migration and deployment path.
- [x] Add a short architecture overview for frontend, database, and Edge Functions. (docs/ARCHITECTURE.md)
- [x] Document Edge Function contracts and auth expectations. (docs/EDGE_FUNCTIONS.md)
- [x] Add a deployment runbook and rollback checklist. (docs/DEPLOYMENT_RUNBOOK.md)
- [x] Add an incident response checklist for publishing and billing failures. (docs/INCIDENT_RESPONSE.md)
- [x] Add `.editorconfig`.
- [x] Add Prettier config.
- [x] Add ESLint config.
- [x] Clean up mojibake / encoding issues in comments and docs. (fixed Arabic UTF-8 corruption in CrmIntegrationsPage.tsx, AdsOpsPage.tsx, AnalyticsPage.tsx)
- [x] Decide whether `supabase.exe` should live in the repo; remove it if not required. (added supabase.exe to .gitignore — install via npm/brew instead)

## Suggested Execution Order

- [x] Finish every P0 item before onboarding paying customers. ✓ Done
- [x] Tackle P1 and P2 in the same hardening sprint. ✓ Done (partitioning deferred — N/A until data grows)
- [x] Use P3 and P4 as the next product stabilization sprint. ✓ Done (mobile UX remaining below)
- [ ] Keep P5 and P6 running in parallel as ongoing engineering hygiene.

## What's Left (2026-04-23)

### Must-do before public launch
- [ ] **P3 — Mobile UX**: Improve critical flows on mobile (publisher, scheduler, brief creation).
- [ ] **P5 — Smoke tests**: Login, account connection, scheduling, publishing, billing.
- [ ] **P5 — E2E tests**: Top 3 user journeys (onboard → create brand → publish post).

### Deferred / When ready
- [ ] **P2 — Partitioning**: `activity_logs`, `ai_usage_logs`, `post_analytics` — revisit when table exceeds ~1M rows.
- [ ] **P5 — Staging parity**: Confirm staging and production are running the same migration version before each release.
