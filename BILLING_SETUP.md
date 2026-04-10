# Billing Setup

## 1) Apply database migrations
- Run `C:\Users\aboda\Downloads\sbrandops---v1.0541\migrations\012_tenants_and_plans.sql`
- Run `C:\Users\aboda\Downloads\sbrandops---v1.0541\migrations\021_billing_phase2.sql`
- Run `C:\Users\aboda\Downloads\sbrandops---v1.0541\migrations\022_billing_governance.sql`
- Run `C:\Users\aboda\Downloads\sbrandops---v1.0541\migrations\023_billing_retry_policy.sql`

## 2) Configure Supabase Edge secrets
Set these secrets for Edge Functions:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_API_KEY`
- `BILLING_RETRY_CRON_SECRET`
- `PADDLE_STARTER_MONTHLY_PRICE_ID`
- `PADDLE_STARTER_YEARLY_PRICE_ID`
- `PADDLE_GROWTH_MONTHLY_PRICE_ID`
- `PADDLE_GROWTH_YEARLY_PRICE_ID`
- `PADDLE_AGENCY_MONTHLY_PRICE_ID`
- `PADDLE_AGENCY_YEARLY_PRICE_ID`

## 3) Configure public pricing IDs
Set these public variables in the frontend environment:

- `VITE_PADDLE_ENV`
- `VITE_PADDLE_STARTER_MONTHLY_PRICE_ID`
- `VITE_PADDLE_STARTER_YEARLY_PRICE_ID`
- `VITE_PADDLE_GROWTH_MONTHLY_PRICE_ID`
- `VITE_PADDLE_GROWTH_YEARLY_PRICE_ID`
- `VITE_PADDLE_AGENCY_MONTHLY_PRICE_ID`
- `VITE_PADDLE_AGENCY_YEARLY_PRICE_ID`

## 4) Deploy Edge Functions
- `npm run supabase:functions:deploy:paddle-webhook`
- `npm run supabase:functions:deploy:paddle-webhook-retry`
- `npm run supabase:functions:deploy:paddle-webhook-auto-retry`
- `npm run supabase:functions:deploy:paddle-checkout`
- `npm run supabase:functions:deploy:paddle-billing-manage`

Or deploy all:

- `npm run supabase:functions:deploy`

## 5) Configure Paddle webhook
Create a webhook endpoint in Paddle that points to:

- `https://<your-project-ref>.supabase.co/functions/v1/paddle-webhook`

Recommended events:

- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.paused`
- `subscription.resumed`
- `transaction.completed`
- `transaction.updated`
- `transaction.paid`

## 6) Checkout flow
- Authenticated user clicks a paid plan in `/pricing` or `/admin/billing`
- Frontend calls `paddle-checkout`
- Edge function resolves or creates a tenant using `owner_id = auth.uid()`
- If there is no current subscription, it creates a hosted checkout transaction and redirects to `checkout.url`
- If there is a current subscription on a different plan, it updates the Paddle subscription directly
- Webhooks keep `billing_subscriptions`, `billing_invoices`, and `tenants` synchronized
## 7) What the webhook updates
- `billing_customers`
- `billing_subscriptions`
- `billing_invoices`
- `billing_events`
- `payment_records`
- `tenants.plan_id`
- `tenants.status`

## 8) Admin page
The admin billing center reads from:

- `subscription_plans`
- `billing_subscriptions`
- `billing_invoices`
- `billing_events`
- `billing_audit_logs`

Page path:

- `C:\Users\aboda\Downloads\sbrandops---v1.0541\components\admin\pages\BillingPage.tsx`

## 9) In-app subscription management
- The in-app system page uses `paddle-billing-manage` to load the current tenant subscription for a brand.
- Supported actions:
  - `overview`
  - `portal`
  - `pause` (pause at period end)
  - `cancel` (cancel at period end)
  - `resume` (resume paused subscriptions or remove scheduled pause/cancel)
  - `change_billing_cycle`
- `/admin/billing` now supports the same management actions per tenant for super admins.
- Failed webhook rows can be retried manually from `/admin/billing` through `paddle-webhook-retry`.
- Retry metadata is stored on `billing_events`; governance actions are stored in `billing_audit_logs`.
- `/admin/billing` supports single-event retry, bulk retry for failed events, and filter/search across the audit trail.
- `/admin/billing` now uses server-side filtering and pagination for subscriptions, invoices, webhook logs, and audit logs instead of relying on the latest in-memory slice only.
- Automatic retry is handled by `paddle-webhook-auto-retry` for failed events with `next_retry_at <= now()` and a capped retry policy.
- Page path:
  - `C:\Users\aboda\Downloads\sbrandops---v1.0541\components\pages\SystemPage.tsx`
- Edge function path:
  - `C:\Users\aboda\Downloads\sbrandops---v1.0541\supabase\functions\paddle-billing-manage\index.ts`

## 11) Automatic retry scheduler
- Deploy `paddle-webhook-auto-retry`.
- Call it on a schedule (for example every 5 minutes) with either:
  - `Authorization: Bearer <BILLING_RETRY_CRON_SECRET>`
  - or `X-Cron-Secret: <BILLING_RETRY_CRON_SECRET>`
- Recommended trigger target:
  - `https://<your-project-ref>.supabase.co/functions/v1/paddle-webhook-auto-retry`
- Retry cadence is currently:
  - first retry after 5 minutes
  - second retry after 30 minutes
  - third retry after 120 minutes
  - no further automatic retries after that

## 10) Paddle permissions required
- `PADDLE_API_KEY` must include subscriptions management scopes.
- For customer portal links, the API key must include customer portal session write access.
