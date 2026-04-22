# Architecture Overview

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| State management | Zustand (global), TanStack Query (server state) |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Edge Functions | Deno (Supabase hosted) |
| AI | Google Gemini (via server-side ai-proxy Edge Function) |
| Billing | Paddle (webhooks + checkout) |
| Error tracking | Sentry |

## Frontend

```
components/
├── App.tsx                  # Root router — renders brand or admin pages
├── Sidebar.tsx              # Main navigation
├── Publisher.tsx            # Post composer
├── AIAssistant.tsx          # AI chat panel
├── AIImageGeneratorModal.tsx
├── pages/                   # One component per route
│   ├── ContentOpsPage.tsx
│   ├── MarketingPlansPage.tsx
│   ├── SEOOpsPageV2.tsx
│   ├── IntegrationsPage.tsx
│   └── ...
├── admin/                   # Admin-only pages
│   ├── AdminHeader.tsx
│   ├── AdminSidebar.tsx
│   └── pages/
│       ├── AdminUsersPage.tsx
│       ├── AdminSettingsPage.tsx
│       ├── BillingPage.tsx
│       ├── TenantsPage.tsx
│       └── AIProviderKeysPage.tsx
└── seo/
    ├── LocalSEOManager.tsx
    └── TechnicalSEOAudit.tsx

services/                    # All Supabase + external API calls
hooks/                       # Custom React hooks
config/                      # App configuration, pricing plans, routes
```

### Routing

`App.tsx` reads `activeBrandPage` / `activeAdminPage` from `useAppRouting` and renders the matching component. There is no React Router path-based routing — navigation is state-based.

## Database

All tables have Row Level Security (RLS) enabled. The core ownership chain is:

```
auth.users
  └── tenants (owner_id = auth.uid())
        └── brands (user_id = auth.uid())
              ├── social_accounts      (display only — no tokens)
              ├── scheduled_posts
              ├── content_pieces
              ├── marketing_plans
              ├── activity_logs
              ├── brand_connections    (tokens encrypted)
              └── oauth_tokens         (single source of truth for tokens)
```

### Key tables

| Table | Purpose |
|-------|---------|
| `tenants` | One per user — billing plan, brand/user limits |
| `subscription_plans` | Plan definitions (max_brands, max_users, ai_tokens_monthly) |
| `brands` | User workspaces |
| `oauth_tokens` | Encrypted OAuth access/refresh tokens (AES-256-GCM) |
| `social_accounts` | Connected social accounts — display metadata only |
| `scheduled_posts` | Posts queued for publishing |
| `ai_usage_logs` | Per-request AI token usage — used for daily spend cap |
| `billing_subscriptions` | Active Paddle subscriptions |

### Migrations

Migrations live in `supabase/migrations/`. Apply with `npx supabase db push`.
The `migrations/` folder (root) contains historical SQL applied manually — do not re-run these.

### Views

| View | Purpose |
|------|---------|
| `v_tenant_brand_counts` | Live brand count per tenant |
| `v_tenant_ai_usage_month` | Monthly AI token usage per tenant |
| `v_tenant_summary` | Plan limits + live usage — used by admin dashboard |

## Edge Functions

See [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) for full contracts.

```
supabase/functions/
├── _shared/
│   ├── auth.ts          # verifyJWT, assertBrandOwnership, buildCorsHeaders
│   ├── tokens.ts        # encryptToken / decryptToken (AES-256-GCM)
│   └── paddleBilling.ts # Paddle helpers
├── ai-proxy/            # Gemini AI proxy — JWT required
├── publish-now/         # Manual publish — JWT required
├── connect-accounts/    # OAuth token storage — JWT required
├── manage-social-account/
├── provider-oauth-callback/
├── google-oauth/        # Google OAuth redirect flow
├── provider-webhook/    # Social platform webhooks
├── paddle-webhook/      # Billing webhooks (HMAC)
├── paddle-checkout/
├── paddle-billing-manage/
├── paddle-webhook-retry/
├── paddle-webhook-auto-retry/
├── analytics-aggregator/ # Cron — service role only
├── data-sync/            # Cron — service role only
└── auto-publisher/       # Cron — service role only
```

## Security model

1. **Client** holds only the Supabase anon key — safe to expose
2. **RLS** on every table restricts reads/writes to the owning user
3. **Edge Functions** verify JWT before any data access
4. **Secrets** (Gemini key, OAuth secrets, webhook secrets) live only in Edge Function environment — never in the frontend bundle
5. **OAuth tokens** are encrypted at rest with AES-256-GCM before writing to the DB
