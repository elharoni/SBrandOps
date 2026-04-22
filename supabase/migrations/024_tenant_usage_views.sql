-- Live views for tenant commercial metrics.
-- Replaces the denormalized brands_count / users_count columns as the
-- authoritative read path for billing logic and admin dashboards.

-- ── 1. Current brand count per tenant ────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_tenant_brand_counts AS
SELECT
    t.id              AS tenant_id,
    t.owner_id,
    COUNT(b.id)::int  AS brands_count
FROM   public.tenants t
LEFT JOIN public.brands b ON b.user_id = t.owner_id
GROUP BY t.id, t.owner_id;

-- ── 2. Monthly AI token usage per tenant (current calendar month) ─────────────
CREATE OR REPLACE VIEW public.v_tenant_ai_usage_month AS
SELECT
    t.id                                                AS tenant_id,
    t.owner_id,
    date_trunc('month', now())::date                    AS period_month,
    COALESCE(SUM(l.input_tokens + l.output_tokens), 0)::bigint AS tokens_used_month
FROM   public.tenants t
LEFT JOIN public.ai_usage_logs l
       ON l.user_id = t.owner_id
      AND l.created_at >= date_trunc('month', now())
GROUP BY t.id, t.owner_id;

-- ── 3. Tenant plan limits + live usage — used by admin dashboard ──────────────
CREATE OR REPLACE VIEW public.v_tenant_summary AS
SELECT
    t.id,
    t.name,
    t.status,
    t.plan_id,
    t.trial_ends_at,
    t.owner_id,
    sp.max_brands                AS effective_brand_limit,
    sp.max_users                 AS effective_user_limit,
    sp.ai_tokens_monthly         AS effective_ai_token_limit,
    bc.brands_count,
    au.tokens_used_month
FROM      public.tenants t
LEFT JOIN public.subscription_plans    sp ON sp.id = t.plan_id
LEFT JOIN public.v_tenant_brand_counts bc ON bc.tenant_id = t.id
LEFT JOIN public.v_tenant_ai_usage_month au ON au.tenant_id = t.id;

-- Grant read access to authenticated users (RLS on base tables still applies)
GRANT SELECT ON public.v_tenant_brand_counts    TO authenticated;
GRANT SELECT ON public.v_tenant_ai_usage_month  TO authenticated;
GRANT SELECT ON public.v_tenant_summary         TO authenticated, service_role;
