# Ads Module — Phase 1: Discovery & Audit

**Date:** 2026-05-02
**Author:** Lead AI/Backend Engineer (BMB Agent Build)
**Branch:** main (commit 32df817)

---

## ⚠️ CRITICAL: Stack Mismatch

The system prompt specifies **Next.js App Router · Nest.js · Prisma · Redis · BullMQ · Docker**.
The actual repo is a completely different stack. Every architectural decision in Phase 2 must target the real stack.

| Spec assumed | Actual |
|---|---|
| Next.js App Router | Vite + React 19.2 + React Router 7 |
| Nest.js (modules/controllers/services) | Supabase Edge Functions (Deno, serverless) |
| Prisma ORM | Supabase PostgreSQL (raw SQL migrations) |
| Redis | Supabase Realtime + pg_cron (no Redis) |
| BullMQ | pg_cron (scheduled) + Supabase Queue (no BullMQ) |
| Docker | Vercel (frontend) + Supabase Cloud (backend) |

All architecture, schemas, and API endpoints in Phase 2 will be designed for this stack.

---

## 1. Repository Map

```
e:/sbrandops---v1.0541/
├── components/
│   ├── ads/
│   │   ├── AdAnalytics.tsx          (5.4 KB)  — metrics display
│   │   ├── AdsDashboard.tsx         (11.4 KB) — overview + campaign list
│   │   ├── CampaignsList.tsx        (4.2 KB)  — sortable table
│   │   └── CreateCampaignWizard.tsx (38.3 KB) — 4-step wizard [NOT PERSISTED]
│   ├── pages/
│   │   ├── DesignOpsPage.tsx        — image generation
│   │   └── ...
│   ├── BrandOnboardingWizard.tsx
│   ├── BrandBrainReviewScreen.tsx
│   └── AIImageGeneratorModal.tsx
├── services/
│   ├── adsService.ts                — reads ad_campaigns + ad_insights from DB
│   ├── adAccountService.ts          — [FULLY MOCKED — hardcoded fake accounts]
│   ├── campaignBrainService.ts      — Campaign Brain CRUD (content ops, not paid ads)
│   ├── campaignBrainAgents.ts       — 10 Gemini AI agents (content lifecycle)
│   ├── brandBrainService.ts         — brand DNA + system prompt builder
│   ├── brandConnectionService.ts    — OAuth token + platform connection CRUD
│   ├── geminiService.ts             — Gemini API calls (generateAdCreative, generateTargetingSuggestions)
│   └── analyticsService.ts          — analytics aggregation
├── hooks/
│   ├── usePageAds.ts                — React Query, 5min stale time
│   ├── useBrandData.ts
│   └── ...
├── supabase/
│   ├── functions/                   — 34 Deno Edge Functions
│   │   ├── meta-ads-oauth/          — Facebook OAuth (ads_read, ads_management, business_management)
│   │   ├── ads-sync/                — Daily campaign+insights pull from Meta + Google Ads
│   │   ├── ai-proxy/                — Server-side Gemini/OpenAI proxy (rate-limited)
│   │   ├── connect-accounts/        — Social OAuth callback (FB page, IG, Google, TikTok, etc.)
│   │   ├── analytics-aggregator/    — Meta Insights API (page/account level)
│   │   ├── analytics-learning/      — Gemini per-post analysis
│   │   ├── get-platform-assets/     — List ad accounts, pages, IG accounts
│   │   ├── token-refresh/           — OAuth token renewal
│   │   ├── provider-oauth-callback/ — Universal OAuth router
│   │   ├── sync-engine/             — Posts/messages/products sync
│   │   ├── _shared/
│   │   │   ├── auth.ts              — JWT verify, brand ownership assertion, CORS
│   │   │   └── tokens.ts            — AES-256-GCM token decrypt
│   │   └── ...
│   └── migrations/
│       ├── 025_oauth_tokens_and_platform_user_id.sql
│       ├── 030_campaign_brain.sql
│       ├── 035_analytics_fact_tables.sql
│       ├── 037_integration_system.sql   — ad_campaigns + ad_insights + webhook_events
│       └── ... (up to 052)
├── types.ts                         — Centralized TS types (650+ lines)
├── .env.example                     — VITE_ + Supabase secrets
└── docs/
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT_RUNBOOK.md
    ├── EDGE_FUNCTIONS.md
    ├── INCIDENT_RESPONSE.md
    └── security/
```

---

## 2. Existing Ads-Related Code Summary

### 2.1 Supabase Tables (migration 037)

```sql
ad_campaigns (
  id UUID PK, brand_id UUID FK,
  provider TEXT,               -- 'meta' | 'google_ads' | 'tiktok_ads' | 'linkedin_ads'
  external_campaign_id TEXT,
  name TEXT, status TEXT, objective TEXT,
  budget_daily NUMERIC, budget_lifetime NUMERIC, budget_currency TEXT DEFAULT 'SAR',
  start_date DATE, end_date DATE,
  ad_account_id TEXT,          -- act_xxxxxxxxx
  metadata JSONB,
  synced_at TIMESTAMPTZ, created_at, updated_at
)

ad_insights (
  id UUID PK, brand_id UUID FK, campaign_id UUID FK,
  provider TEXT,
  external_object_id TEXT,     -- campaign/adset/ad id on Meta
  object_type TEXT,            -- 'campaign' | 'adset' | 'ad'
  date DATE,
  spend NUMERIC, impressions BIGINT, clicks BIGINT, reach BIGINT,
  conversions BIGINT, conversion_value NUMERIC,
  ctr NUMERIC, cpc NUMERIC, cpm NUMERIC, cpa NUMERIC, roas NUMERIC,
  extra_metrics JSONB
)

webhook_events (
  id UUID PK, brand_id UUID FK,
  provider TEXT, event_type TEXT, event_id TEXT (UNIQUE per provider),
  payload JSONB, processed BOOL, processed_at TIMESTAMPTZ,
  error_message TEXT, received_at TIMESTAMPTZ
)

sync_jobs (id, brand_id, provider, job_type, status, cursor, idempotency_key, ...)
oauth_tokens (brand_id, provider, access_token_enc [AES-256-GCM], is_valid, scopes_granted, ...)
brand_connections (brand_id, provider, ad_account_id, status, metadata JSONB, ...)
```

### 2.2 Edge Functions (Ads-related)

| Function | Type | Status |
|---|---|---|
| `meta-ads-oauth` | OAuth flow | Partially built — init + callback work, but state has no CSRF signature (see §4) |
| `ads-sync` | Scheduled READ | Working — daily pull from Meta v23.0 + Google Ads v19, retry on 429 |
| `get-platform-assets` | Auth | Returns list of ad accounts, pages for connected brands |
| `analytics-aggregator` | Scheduled READ | Working — Meta Insights at page/account level |
| `token-refresh` | Scheduled | Working — refreshes expired oauth_tokens |

### 2.3 Frontend Components

| Component | Status | Gap |
|---|---|---|
| `AdsDashboard.tsx` | Reads from `ad_campaigns` via `adsService.ts` | No BMB panel, no funnel-layer grouping, no Decision queue |
| `CampaignsList.tsx` | Displays synced campaigns | Status field is free-text, no automation policy badge |
| `AdAnalytics.tsx` | Shows spend/ROAS/CPA/CTR | Basic, no sparklines, no TOFU/MOFU/BOFU breakdown |
| `CreateCampaignWizard.tsx` | 4-step wizard, Gemini targeting suggestions | **State only, no DB save, no Meta API execution** |

### 2.4 Services

| Service | Status | Gap |
|---|---|---|
| `adsService.ts` | Reads DB → `AdCampaign` type | No writes, no Meta execution |
| `adAccountService.ts` | **FULLY MOCKED** (hardcoded `act_123456789012345`) | Must be replaced entirely |
| `campaignBrainAgents.ts` | 10 Gemini agents for content/post lifecycle | Not for paid ads — separate concern |
| `geminiService.ts` | `generateAdCreative()`, `generateTargetingSuggestions()` | Called client-side, VITE_GEMINI_API_KEY exposed |

---

## 3. Gap Matrix

| Component | Exists? | Status | Gap | Risk |
|---|---|---|---|---|
| Meta OAuth (init + callback) | Yes | Partial | No CSRF state signature; token not saved to DB at end of callback (returns to frontend via postMessage — frontend must save) | HIGH — CSRF attack possible |
| Meta token storage (encrypted) | Yes | Working | AES-256-GCM in `oauth_tokens`. No KMS — master key is hardcoded in `_shared/tokens.ts` | MEDIUM — key rotation impossible without downtime |
| Meta token → System User migration | No | Missing | Long-lived 60-day tokens expire; no System User token upgrade path | HIGH — connections break every 60 days |
| Token decrypt audit log | No | Missing | No log of who/when/why decrypted a token | MEDIUM — compliance gap |
| Ads daily sync (read) | Yes | Working | Syncs campaigns + insights. No adset/ad granularity yet. No rate-limit header tracking | LOW |
| Meta rate limit tracking | No | Missing | `RateLimitState` table doesn't exist; X-Business-Use-Case-Usage headers not parsed | HIGH — will get blocked at scale |
| Meta webhook endpoint | No | Missing | `webhook_events` table exists but no `/webhooks/meta` Edge Function; HMAC verification absent | HIGH — no disapproval alerts, no lead form events |
| MediaPlan entity | No | Missing | No table, no types, no service | HIGH — core BMB output |
| AdSet / Ad entities | No | Missing | Only `ad_campaigns`. No adset or ad rows in our DB | HIGH — can't track spend at adset/ad level |
| Creative entity | No | Missing | `AdCreative` type exists in types.ts but no DB table; wizard state only | HIGH — creatives lost on page refresh |
| Audience entity | No | Missing | No table for Custom/Lookalike/Saved audiences | HIGH |
| Decision entity | No | Missing | No table, no service, no UI queue | HIGH — core BMB output |
| AutomationPolicy entity | No | Missing | No table; no MANUAL/AUTO/TIERED mode enforcement | HIGH |
| BMBRun audit log | No | Missing | No invocation audit trail (input, output, token cost, latency) | MEDIUM |
| Meta API write operations | No | Missing | ads-sync is read-only. No create campaign/adset/ad on Meta | HIGH — core execution layer |
| Audience builder (Meta push) | No | Missing | No Custom Audience push, no PII SHA-256 hashing, no Lookalike creation | HIGH |
| Creative pusher (Meta upload) | No | Missing | No media upload, no ad creative creation on Meta | HIGH |
| AutomationPolicy enforcement | No | Missing | No PAUSED-by-default logic; no budget cap checks | HIGH — could launch active ads accidentally |
| CAPI gateway endpoint | No | Missing | No `/brands/:id/capi/event` endpoint | LOW |
| Pixel linkage per brand | No | Missing | pixelId not stored in brand_connections or any table | MEDIUM |
| Funnel layer tagging (TOFU/MOFU/BOFU) | No | Missing | No `funnel_layer` column on campaigns or adsets | HIGH — BMB decision tree requires it |
| Decision execution engine | No | Missing | No CPA-first decision loop (kill/scale/duplicate/refresh) | HIGH |
| Scheduled BMB runs | No | Missing | No pg_cron jobs for BMB: insight review (06:00), decision proposal (09:00), weekly P&L (Sun 21:00) | HIGH |
| Weekly P&L report | No | Missing | No report generation, no PDF/email, no channel | MEDIUM |
| Brand Cockpit UI | No | Missing | No header with automation mode badge, no pending decisions panel, no BMB chat panel | HIGH |
| Sandbox mode per brand | No | Missing | No flag to toggle test vs production Meta account | MEDIUM |
| Multi-brand Operator Layer | No | Missing | No cross-brand benchmark aggregation | LOW |
| Idempotency on Meta writes | No | Missing | No pre-check before POST + no reconciliation poll on 5xx | HIGH — duplicate campaigns possible |
| `adAccountService.ts` mock | Mock only | Blocking | Must read from `brand_connections` + `oauth_tokens` tables | HIGH — all ad account UI is fake |
| `CreateCampaignWizard` persistence | Partial | Blocking | 38KB wizard state never saved to DB; no Meta execution at submit | HIGH |
| RBAC per brand (viewer/manager/operator) | Partial | Partial | `brand_members` exists, `PermissionGuard` exists but no ads-specific permissions | MEDIUM |
| Gemini API key exposure | VITE_ prefix | Security | `VITE_GEMINI_API_KEY` is a public client-side env var — any user can extract it | HIGH — see §4 |

---

## 4. Security & Data Issues

### S1 — CRITICAL: VITE_GEMINI_API_KEY exposed client-side
`services/geminiService.ts` calls Gemini directly from the browser using `VITE_GEMINI_API_KEY`. This key is shipped in the JS bundle and visible to any user. The `ai-proxy` Edge Function already exists — all Gemini calls for ads features must route through it.

### S2 — HIGH: OAuth state has no CSRF signature
`meta-ads-oauth/index.ts` line 42:
```ts
const state = btoa(encodeURIComponent(JSON.stringify({ b: brandId })));
```
`btoa` is reversible encoding, not signing. Any attacker who knows a brand UUID can forge a valid `state`. Fix: sign with HMAC-SHA256 using `FACEBOOK_APP_SECRET` + short TTL (10 min).

### S3 — HIGH: Meta token returned to frontend in plain HTML payload
The OAuth callback sends the raw `accessToken` to the frontend via `postMessage` (`htmlResponse` line 111). The frontend must then call a backend endpoint to save it. If the frontend has no secure save endpoint, the token flows through the browser unencrypted. Audit whether the save endpoint exists and whether it stores tokens only server-side.

### S4 — HIGH: No Meta webhook HMAC verification
No `/webhooks/meta` Edge Function exists. When it is built, it must verify `X-Hub-Signature-256 = HMAC-SHA256(app_secret, raw_body)` before processing any payload.

### S5 — MEDIUM: No token encryption key rotation path
Token encryption uses AES-256-GCM in `_shared/tokens.ts`. The encryption key is a Supabase secret (`TOKEN_ENCRYPTION_KEY`). There is no key version field, no re-encryption job, and no fallback for rotation. Add a `key_version` column to `oauth_tokens` before the ads write path is built.

### S6 — MEDIUM: No decrypt audit log
Every call to `decryptToken()` should append a row to an `token_decrypt_logs` table (brand_id, purpose, requestor, timestamp). Currently there is no such log.

### S7 — LOW: `adAccountService.ts` mock contains a real-looking fake account ID
`act_123456789012345` — if any part of the system tried to use this against Meta's API it would get a permission error. Acceptable for dev but must be deleted before M0 ships.

---

## 5. Top 10 Blockers

| # | Blocker | Impact | Required For |
|---|---|---|---|
| 1 | **No Meta write operations exist** | Cannot create any campaign/adset/ad on Meta | M4 execution |
| 2 | **`adAccountService.ts` is 100% mocked** | All ad account UI shows fake data; OAuth save path unclear | M0 |
| 3 | **OAuth state is unsigned (CSRF)** | Security vulnerability in the only existing OAuth flow | M0 |
| 4 — | **`CreateCampaignWizard` never persists to DB** | 38KB of UI work lost on navigation; no campaign creation path | M3 |
| 5 | **No AutomationPolicy entity** | Cannot enforce MANUAL/AUTO/TIERED; all execution is unsafe | M4 |
| 6 | **No AdSet / Ad / Creative / Audience DB entities** | Can't track performance below campaign level; can't build BMB decision tree | M1–M4 |
| 7 | **No Meta webhook endpoint** | No disapproval alerts, no lead forms, no real-time feedback loop | M1 |
| 8 | **No rate-limit state tracking** | Will hit Meta BUC limits silently; jobs will fail with no retry intelligence | M0 |
| 9 | **No MediaPlan / Decision entities** | Core BMB inputs/outputs don't exist in DB | M2–M3 |
| 10 | **`VITE_GEMINI_API_KEY` is public** | Any user can extract the key and exhaust quota; ads AI calls must go through `ai-proxy` | M2 |

---

## 6. Brand Memory Layer Assessment

**Exists:** Yes, partially.

| Layer | Location | Status |
|---|---|---|
| Brand DNA (positioning, voice, audiences, ICP) | `brand_profiles.extended_profile` (JSONB) | Exists — populated by OpenAI analysis of uploaded brand docs |
| Brand Audience personas | `brand_profiles.extended_profile.brandAudiences` | Exists — `BrandAudience[]` type |
| Historical CPAs by funnel layer | Nowhere | **Missing** — no `cpa_targets` or `historical_cpa` fields |
| Past creative performance | `ad_insights` (campaign level) | Partial — no adset/ad/creative granularity |
| pgvector long-term memory | Nowhere | **Missing** — no vector embeddings, no similarity search |
| Episodic Campaign Memory | Nowhere | **Missing** |
| BMB working memory | Nowhere | **Missing** (would use Supabase edge function context, not Redis) |

The `buildBrandSystemPrompt()` function in `brandBrainService.ts` injects brand DNA into prompts — this pattern is reusable for the BMB system prompt composer.

---

## 7. Scheduled Jobs Assessment

| Scheduled Task | Mechanism | Status |
|---|---|---|
| Daily ads sync (05:00 UTC) | pg_cron → `ads-sync` EF via CRON_SECRET | Working |
| Analytics aggregation | pg_cron → `analytics-aggregator` EF | Working |
| Token refresh | pg_cron → `token-refresh` EF | Working |
| BMB insight review (06:00 brand-tz) | None | Missing |
| BMB decision proposal (09:00 brand-tz) | None | Missing |
| Weekly P&L report (Sunday 21:00) | None | Missing |
| Rate-limit state cleanup | None | Missing |

Note: Supabase pg_cron runs at database level, not per-brand timezone. Per-brand scheduled BMB runs must be implemented as Supabase Queue or a dispatcher EF that fans out per brand and respects `brand.timezone`.

---

## 8. Existing Patterns to Reuse

These patterns are well-established in the codebase and must be followed:

- **Auth pattern:** `verifyJWT` + `assertBrandOwnership` from `_shared/auth.ts` — use on every new Edge Function
- **Token decrypt:** `decryptToken` from `_shared/tokens.ts` — use via wrapper only, never raw
- **AI proxy routing:** all Gemini/OpenAI calls → `ai-proxy` EF with JWT; never call AI SDKs from client
- **Migrations:** numbered SQL files in `supabase/migrations/` with `IF NOT EXISTS` guards + RLS policies per table
- **Brand-scoped RLS:** every new table must have `brand_id` FK + RLS policy via `brand_members`
- **Bilingual UI:** Egyptian Arabic primary, English technical labels, `brand.language` field for per-brand override

---

## 9. Open Questions for Operator

1. **Token vault upgrade:** Current AES-256-GCM key is a flat Supabase secret. Do we integrate AWS KMS / GCP KMS, or is a versioned key stored in Supabase Vault sufficient?
2. **System User tokens:** Does the operator already have a Meta Business Manager System User set up, or should the onboarding flow guide them to create one?
3. **Meta App Review status:** Is the Meta App in Live mode with `ads_management` scope approved for all connected accounts, or still in Development mode (limited to app admins only)?
4. **Supabase Queue:** The codebase uses pg_cron for scheduling. Do we adopt Supabase Queue (beta) for job queuing, or implement a simpler polling pattern with a `job_queue` table?
5. **Pixel/CAPI:** Are pixels already installed on brand websites (e.g. via PixelYourSite PRO), or is the CAPI gateway a prerequisite for conversion tracking?
6. **Google Ads & TikTok:** The spec focuses on Meta. Should M4 execution cover Meta only, with Google/TikTok as later milestones?
7. **Data retention:** `ad_insights` rows will grow fast (daily per campaign/adset/ad). Define retention window (90 days? 1 year?) and archival strategy before M1.
8. **CreateCampaignWizard:** Should the existing 38KB wizard be refactored into the new BMB media plan flow, or replaced entirely by the BMB-driven approach?

---

**End of Phase 1 Audit.**
**Awaiting operator review before proceeding to Phase 2 — Architecture & Plan.**
