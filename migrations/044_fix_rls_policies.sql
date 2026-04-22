-- ============================================================
-- Migration 044: Fix Critical Open RLS Policies
-- ⚠️  الأمان: حذف السياسات المفتوحة واستبدالها بسياسات تعتمد
--     على ملكية البراند (brand.user_id = auth.uid())
-- ============================================================

-- ── 1. brands ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brands;
DROP POLICY IF EXISTS "brands_owner_only"                         ON public.brands;

CREATE POLICY "brands_owner_only"
    ON public.brands FOR ALL
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── 2. brand_profiles ────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brand_profiles;
DROP POLICY IF EXISTS "brand_profiles_secure"                     ON public.brand_profiles;

CREATE POLICY "brand_profiles_secure"
    ON public.brand_profiles FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── 3. social_accounts ───────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.social_accounts;
DROP POLICY IF EXISTS "social_accounts_secure"                    ON public.social_accounts;

CREATE POLICY "social_accounts_secure"
    ON public.social_accounts FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── 4. content_pieces ────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.content_pieces;
DROP POLICY IF EXISTS "content_pieces_secure"                     ON public.content_pieces;

CREATE POLICY "content_pieces_secure"
    ON public.content_pieces FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── 5. scheduled_posts ───────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.scheduled_posts;
DROP POLICY IF EXISTS "scheduled_posts_secure"                    ON public.scheduled_posts;

CREATE POLICY "scheduled_posts_secure"
    ON public.scheduled_posts FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── 6. marketing_plans ───────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.marketing_plans;
DROP POLICY IF EXISTS "marketing_plans_secure"                    ON public.marketing_plans;

CREATE POLICY "marketing_plans_secure"
    ON public.marketing_plans FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── 7. post_analytics ────────────────────────────────────────
DROP POLICY IF EXISTS "Enable access for all users" ON public.post_analytics;
DROP POLICY IF EXISTS "post_analytics_secure"       ON public.post_analytics;

CREATE POLICY "post_analytics_secure"
    ON public.post_analytics FOR ALL
    USING (post_id IN (
        SELECT sp.id
        FROM   public.scheduled_posts sp
        JOIN   public.brands b ON b.id = sp.brand_id
        WHERE  b.user_id = auth.uid()
    ));

-- ── 8. activity_logs ─────────────────────────────────────────
DROP POLICY IF EXISTS "Enable access for all users" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_secure"        ON public.activity_logs;

CREATE POLICY "activity_logs_secure"
    ON public.activity_logs FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── 9. inbox_conversations ───────────────────────────────────
DROP POLICY IF EXISTS "Enable access for all users"   ON public.inbox_conversations;
DROP POLICY IF EXISTS "inbox_conversations_secure"    ON public.inbox_conversations;

CREATE POLICY "inbox_conversations_secure"
    ON public.inbox_conversations FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── 10. inbox_messages ───────────────────────────────────────
DROP POLICY IF EXISTS "Enable access for all users" ON public.inbox_messages;
DROP POLICY IF EXISTS "inbox_messages_secure"       ON public.inbox_messages;

CREATE POLICY "inbox_messages_secure"
    ON public.inbox_messages FOR ALL
    USING (conversation_id IN (
        SELECT ic.id
        FROM   public.inbox_conversations ic
        JOIN   public.brands b ON b.id = ic.brand_id
        WHERE  b.user_id = auth.uid()
    ));

-- ── 11. ad_campaigns ─────────────────────────────────────────
DROP POLICY IF EXISTS "Enable access for all users" ON public.ad_campaigns;
DROP POLICY IF EXISTS "ad_campaigns_secure"         ON public.ad_campaigns;

CREATE POLICY "ad_campaigns_secure"
    ON public.ad_campaigns FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── الجداول الجديدة (design ops) — تأكيد الـ RLS الصح ────────
-- brand_access عليها مكتوبة صح في supabase_schema.sql لكن نضيف WITH CHECK
DROP POLICY IF EXISTS "brand_access"          ON public.design_assets;
DROP POLICY IF EXISTS "design_assets_secure"  ON public.design_assets;
DROP POLICY IF EXISTS "brand_access"          ON public.design_workflows;
DROP POLICY IF EXISTS "design_workflows_secure" ON public.design_workflows;
DROP POLICY IF EXISTS "brand_access"          ON public.design_jobs;
DROP POLICY IF EXISTS "design_jobs_secure"    ON public.design_jobs;

CREATE POLICY "design_assets_secure"
    ON public.design_assets FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "design_workflows_secure"
    ON public.design_workflows FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "design_jobs_secure"
    ON public.design_jobs FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
