-- ============================================================
-- Migration 027: Fix Supabase Security Advisor Warnings
--
-- Fixes:
-- 1. CRITICAL: 7 views recreated WITH (security_invoker = true)
--    so RLS on underlying tables is enforced for the calling user.
-- 2. MEDIUM: RLS policies on brands + tenants updated to use
--    (select auth.uid()) instead of auth.uid() — prevents
--    per-row re-evaluation (Auth RLS Initialization Plan warning).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Auth RLS Initialization Plan fixes
-- ──────────────────────────────────────────────────────────────

-- brands: (select auth.uid()) evaluated once per query, not per row
DROP POLICY IF EXISTS "brands_owner_only" ON public.brands;
CREATE POLICY "brands_owner_only"
    ON public.brands FOR ALL
    USING     (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- tenants: admin policy — wrap is_super_admin/is_admin too
DROP POLICY IF EXISTS "Admins manage tenants" ON public.tenants;
CREATE POLICY "Admins manage tenants"
    ON public.tenants FOR ALL
    USING (public.is_super_admin() OR public.is_admin());

-- tenants: owner self-access policy (if exists from older migration)
DROP POLICY IF EXISTS "Tenant owner access" ON public.tenants;
CREATE POLICY "Tenant owner access"
    ON public.tenants FOR ALL
    USING     (owner_id = (SELECT auth.uid()))
    WITH CHECK (owner_id = (SELECT auth.uid()));

-- ──────────────────────────────────────────────────────────────
-- 2. Security Definer View fixes — all views recreated with
--    security_invoker = true so caller's RLS is applied
-- ──────────────────────────────────────────────────────────────

-- 2a. v_tenant_brand_counts
CREATE OR REPLACE VIEW public.v_tenant_brand_counts
    WITH (security_invoker = true)
AS
SELECT
    t.id             AS tenant_id,
    t.owner_id,
    COUNT(b.id)::int AS brands_count
FROM   public.tenants t
LEFT JOIN public.brands b ON b.user_id = t.owner_id
GROUP BY t.id, t.owner_id;

GRANT SELECT ON public.v_tenant_brand_counts TO authenticated;

-- 2b. v_tenant_ai_usage_month
CREATE OR REPLACE VIEW public.v_tenant_ai_usage_month
    WITH (security_invoker = true)
AS
SELECT
    t.id                                                              AS tenant_id,
    t.owner_id,
    date_trunc('month', now())::date                                  AS period_month,
    COALESCE(SUM(l.input_tokens + l.output_tokens), 0)::bigint        AS tokens_used_month
FROM   public.tenants t
LEFT JOIN public.ai_usage_logs l
       ON l.user_id = t.owner_id
      AND l.created_at >= date_trunc('month', now())
GROUP BY t.id, t.owner_id;

GRANT SELECT ON public.v_tenant_ai_usage_month TO authenticated;

-- 2c. v_tenant_summary
CREATE OR REPLACE VIEW public.v_tenant_summary
    WITH (security_invoker = true)
AS
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
LEFT JOIN public.subscription_plans     sp ON sp.id        = t.plan_id
LEFT JOIN public.v_tenant_brand_counts  bc ON bc.tenant_id = t.id
LEFT JOIN public.v_tenant_ai_usage_month au ON au.tenant_id = t.id;

GRANT SELECT ON public.v_tenant_summary TO authenticated, service_role;

-- 2d. brand_score_stats
CREATE OR REPLACE VIEW public.brand_score_stats
    WITH (security_invoker = true)
AS
SELECT
    brand_id,
    COUNT(*)::INTEGER                                                 AS total_scored,
    ROUND(AVG(total_score))::INTEGER                                  AS avg_score,
    ROUND(AVG(dna_score))::INTEGER                                    AS avg_dna_score,
    ROUND(AVG(history_score))::INTEGER                                AS avg_history_score,
    ROUND(AVG(cross_brand_score))::INTEGER                            AS avg_cross_brand_score,
    COUNT(*) FILTER (WHERE total_score >= 80)::INTEGER                AS excellent_count,
    COUNT(*) FILTER (WHERE total_score >= 65 AND total_score < 80)::INTEGER AS good_count,
    COUNT(*) FILTER (WHERE total_score >= 50 AND total_score < 65)::INTEGER AS acceptable_count,
    COUNT(*) FILTER (WHERE total_score < 50)::INTEGER                 AS weak_count,
    COUNT(*) FILTER (WHERE predicted_ctr = 'high')::INTEGER           AS high_ctr_predicted,
    COUNT(*) FILTER (WHERE actual_ctr IS NOT NULL)::INTEGER           AS feedback_loop_count,
    CASE
        WHEN COUNT(*) FILTER (WHERE actual_ctr IS NOT NULL) = 0 THEN NULL
        ELSE ROUND(
            100.0 - AVG(ABS(accuracy_delta)) FILTER (WHERE accuracy_delta IS NOT NULL)
        )
    END AS scoring_accuracy_rate
FROM public.content_scores
GROUP BY brand_id;

GRANT SELECT ON public.brand_score_stats TO authenticated;

-- 2e. brand_skill_stats
CREATE OR REPLACE VIEW public.brand_skill_stats
    WITH (security_invoker = true)
AS
SELECT
    e.brand_id,
    e.skill_type,
    COUNT(*)                                                                AS total_evaluations,
    ROUND(AVG(CASE WHEN e.signal = 'used'      THEN 1.0 ELSE 0.0 END) * 100, 1) AS used_pct,
    ROUND(AVG(CASE WHEN e.signal = 'edited'    THEN 1.0 ELSE 0.0 END) * 100, 1) AS edited_pct,
    ROUND(AVG(CASE WHEN e.signal = 'rejected'  THEN 1.0 ELSE 0.0 END) * 100, 1) AS rejected_pct,
    ROUND(AVG(CASE WHEN e.signal = 'converted' THEN 1.0 ELSE 0.0 END) * 100, 1) AS conversion_pct,
    ROUND(AVG(e.rating), 2)                                                 AS avg_rating
FROM public.skill_evaluations e
GROUP BY e.brand_id, e.skill_type;

GRANT SELECT ON public.brand_skill_stats TO authenticated;

-- 2f. media_project_summary
CREATE OR REPLACE VIEW public.media_project_summary
    WITH (security_invoker = true)
AS
SELECT
    p.id,
    p.brand_id,
    p.title,
    p.goal,
    p.output_type,
    p.campaign,
    p.platforms,
    p.deadline,
    p.priority,
    p.status,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT pc.id)                                              AS pieces_count,
    COUNT(DISTINCT pc.id) FILTER (WHERE pc.is_master)                 AS master_count,
    COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'approved')       AS approved_pieces,
    COUNT(DISTINCT r.id)  FILTER (WHERE r.status  = 'pending')        AS pending_reviews
FROM public.media_projects p
LEFT JOIN public.media_project_pieces  pc ON pc.project_id = p.id
LEFT JOIN public.media_project_reviews r  ON r.project_id  = p.id
GROUP BY p.id;

GRANT SELECT ON public.media_project_summary TO authenticated;

-- 2g. integration_health
CREATE OR REPLACE VIEW public.integration_health
    WITH (security_invoker = true)
AS
SELECT
    sa.id,
    sa.brand_id,
    sa.platform,
    sa.asset_type,
    sa.username           AS asset_name,
    sa.avatar_url,
    sa.followers_count,
    sa.purposes,
    sa.market,
    sa.is_primary,
    sa.sync_status,
    sa.last_synced_at,
    sa.sync_error,
    sa.webhook_active,
    sa.scopes_granted,
    sa.status             AS connection_status,
    CASE
        WHEN ot.expires_at IS NULL              THEN false
        WHEN ot.expires_at < now()              THEN true
        WHEN ot.expires_at < now() + INTERVAL '7 days' THEN true
        ELSE false
    END                   AS token_expiring_soon,
    ot.expires_at         AS token_expires_at,
    ot.is_valid           AS token_is_valid,
    sa.created_at,
    sa.updated_at
FROM public.social_accounts sa
LEFT JOIN public.oauth_tokens ot ON ot.social_account_id = sa.id;

GRANT SELECT ON public.integration_health TO authenticated;
