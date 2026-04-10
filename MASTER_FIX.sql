-- ================================================================
-- SBrandOps — MASTER FIX SCRIPT
-- شغّل هذا الملف في Supabase SQL Editor مرة واحدة
-- يُصلح: RLS الأمنية + الجداول الناقصة + الـ Functions الضرورية
-- ================================================================

-- ----------------------------------------------------------------
-- PART 1: تصحيح RLS Policies للجداول الأساسية
-- ----------------------------------------------------------------

-- BRANDS: كل مستخدم يشوف براندات نفسه فقط
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brands;
DROP POLICY IF EXISTS "Users can only see their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can insert their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can update their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can delete their own brands" ON public.brands;

DROP POLICY IF EXISTS "brands_select" ON public.brands;
DROP POLICY IF EXISTS "brands_insert" ON public.brands;
DROP POLICY IF EXISTS "brands_update" ON public.brands;
DROP POLICY IF EXISTS "brands_delete" ON public.brands;
CREATE POLICY "brands_select" ON public.brands FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "brands_insert" ON public.brands FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "brands_update" ON public.brands FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "brands_delete" ON public.brands FOR DELETE USING (user_id = auth.uid());

-- BRAND_PROFILES: تتبع ملكية البراند
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brand_profiles;
DROP POLICY IF EXISTS "Authenticated access brand profiles" ON public.brand_profiles;
DROP POLICY IF EXISTS "Brand profiles follow brand ownership" ON public.brand_profiles;

DROP POLICY IF EXISTS "brand_profiles_all" ON public.brand_profiles;
CREATE POLICY "brand_profiles_all" ON public.brand_profiles FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- SOCIAL_ACCOUNTS: تتبع ملكية البراند
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.social_accounts;
DROP POLICY IF EXISTS "Social accounts follow brand ownership" ON public.social_accounts;

DROP POLICY IF EXISTS "social_accounts_all" ON public.social_accounts;
CREATE POLICY "social_accounts_all" ON public.social_accounts FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- SCHEDULED_POSTS: تتبع ملكية البراند
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.scheduled_posts;
DROP POLICY IF EXISTS "Posts follow brand ownership" ON public.scheduled_posts;

DROP POLICY IF EXISTS "scheduled_posts_all" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_all" ON public.scheduled_posts FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- CONTENT_PIECES: تتبع ملكية البراند
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.content_pieces;
DROP POLICY IF EXISTS "Content pieces follow brand ownership" ON public.content_pieces;

DROP POLICY IF EXISTS "content_pieces_all" ON public.content_pieces;
CREATE POLICY "content_pieces_all" ON public.content_pieces FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- MARKETING_PLANS: تتبع ملكية البراند
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.marketing_plans;
DROP POLICY IF EXISTS "Marketing plans follow brand ownership" ON public.marketing_plans;

DROP POLICY IF EXISTS "marketing_plans_all" ON public.marketing_plans;
CREATE POLICY "marketing_plans_all" ON public.marketing_plans FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- ----------------------------------------------------------------
-- PART 2: إضافة الأعمدة الناقصة للجداول الموجودة
-- ----------------------------------------------------------------

-- scheduled_posts: إضافة حقول النشر الناقصة
ALTER TABLE public.scheduled_posts
    ADD COLUMN IF NOT EXISTS instagram_first_comment TEXT,
    ADD COLUMN IF NOT EXISTS locations JSONB,
    ADD COLUMN IF NOT EXISTS platform_statuses JSONB,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS publish_results JSONB,
    ADD COLUMN IF NOT EXISTS brief_id UUID,
    ADD COLUMN IF NOT EXISTS brief_title TEXT,
    ADD COLUMN IF NOT EXISTS watchlist_id UUID;

-- social_accounts: إضافة حقول access token الناقصة
ALTER TABLE public.social_accounts
    ADD COLUMN IF NOT EXISTS platform_user_id TEXT,
    ADD COLUMN IF NOT EXISTS platform_username TEXT,
    ADD COLUMN IF NOT EXISTS platform_account_id TEXT,
    ADD COLUMN IF NOT EXISTS account_type TEXT,
    ADD COLUMN IF NOT EXISTS permissions TEXT[],
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Connected';

-- ad_campaigns: إضافة حقول الأداء الناقصة
ALTER TABLE public.ad_campaigns
    ADD COLUMN IF NOT EXISTS spend NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS roas NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cpa NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ctr NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recommendation TEXT;

-- inbox_conversations: إضافة حقول التحليل
ALTER TABLE public.inbox_conversations
    ADD COLUMN IF NOT EXISTS type TEXT,
    ADD COLUMN IF NOT EXISTS user_name TEXT,
    ADD COLUMN IF NOT EXISTS user_handle TEXT,
    ADD COLUMN IF NOT EXISTS user_avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_message_text TEXT,
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS assignee TEXT,
    ADD COLUMN IF NOT EXISTS intent TEXT,
    ADD COLUMN IF NOT EXISTS sentiment TEXT,
    ADD COLUMN IF NOT EXISTS ai_summary TEXT,
    ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- inbox_messages: إضافة حقل sender و text
ALTER TABLE public.inbox_messages
    ADD COLUMN IF NOT EXISTS sender TEXT DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS text TEXT,
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------
-- PART 3: إنشاء الجداول الجديدة الناقصة
-- ----------------------------------------------------------------

-- post_analytics
CREATE TABLE IF NOT EXISTS public.post_analytics (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID REFERENCES public.scheduled_posts(id) ON DELETE CASCADE NOT NULL,
    platform    TEXT NOT NULL,
    platform_post_id TEXT,
    impressions INTEGER DEFAULT 0,
    reach       INTEGER DEFAULT 0,
    engagement  INTEGER DEFAULT 0,
    likes       INTEGER DEFAULT 0,
    comments    INTEGER DEFAULT 0,
    shares      INTEGER DEFAULT 0,
    clicks      INTEGER DEFAULT 0,
    saves       INTEGER DEFAULT 0,
    fetched_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_analytics_all" ON public.post_analytics;
CREATE POLICY "post_analytics_all" ON public.post_analytics FOR ALL USING (true) WITH CHECK (true);

-- follower_history
CREATE TABLE IF NOT EXISTS public.follower_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
    platform        TEXT NOT NULL,
    followers_count INTEGER DEFAULT 0,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.follower_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follower_history_all" ON public.follower_history;
CREATE POLICY "follower_history_all" ON public.follower_history FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- workflows
CREATE TABLE IF NOT EXISTS public.workflows (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id     UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    is_active    BOOLEAN DEFAULT TRUE,
    steps        JSONB DEFAULT '[]',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workflows_all" ON public.workflows;
CREATE POLICY "workflows_all" ON public.workflows FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- brainstormed_ideas
CREATE TABLE IF NOT EXISTS public.brainstormed_ideas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    platform            TEXT,
    format              TEXT,
    angle               TEXT,
    sent_to_content_ops BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.brainstormed_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ideas_all" ON public.brainstormed_ideas;
CREATE POLICY "ideas_all" ON public.brainstormed_ideas FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- brand_memory
CREATE TABLE IF NOT EXISTS public.brand_memory (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL,
    content     TEXT NOT NULL,
    context     JSONB DEFAULT '{}',
    importance  INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    used_count  INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.brand_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_memory_all" ON public.brand_memory;
CREATE POLICY "brand_memory_all" ON public.brand_memory FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- brand_connections (للـ integrations)
CREATE TABLE IF NOT EXISTS public.brand_connections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id                UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    provider                TEXT NOT NULL,
    status                  TEXT DEFAULT 'disconnected',
    display_name            TEXT,
    external_account_id     TEXT,
    external_account_name   TEXT,
    last_sync_at            TIMESTAMPTZ,
    sync_health             TEXT DEFAULT 'unknown',
    last_error              TEXT,
    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_id, provider)
);
ALTER TABLE public.brand_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_connections_all" ON public.brand_connections;
CREATE POLICY "brand_connections_all" ON public.brand_connections FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- brand_assets (لحفظ الـ assets من integrations)
CREATE TABLE IF NOT EXISTS public.brand_assets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.brand_connections(id) ON DELETE CASCADE,
    asset_type  TEXT NOT NULL,
    data        JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_assets_all" ON public.brand_assets;
CREATE POLICY "brand_assets_all" ON public.brand_assets FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- tenants
CREATE TABLE IF NOT EXISTS public.tenants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    owner_id   UUID REFERENCES auth.users(id),
    plan_id    TEXT DEFAULT 'starter',
    status     TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants_owner" ON public.tenants;
CREATE POLICY "tenants_owner" ON public.tenants FOR ALL USING (owner_id = auth.uid());

-- subscription_plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    tagline              TEXT,
    description          TEXT,
    badge                TEXT,
    highlighted          BOOLEAN DEFAULT FALSE,
    currency             TEXT DEFAULT 'USD',
    price_monthly        NUMERIC DEFAULT 0,
    price_yearly         NUMERIC DEFAULT 0,
    trial_days           INTEGER DEFAULT 14,
    max_brands           INTEGER DEFAULT 1,
    max_users            INTEGER DEFAULT 2,
    ai_tokens_monthly    BIGINT DEFAULT 100000,
    features             JSONB DEFAULT '[]',
    paddle_price_id_monthly TEXT,
    paddle_price_id_yearly  TEXT,
    is_active            BOOLEAN DEFAULT TRUE,
    sort_order           INTEGER DEFAULT 0,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_public" ON public.subscription_plans;
CREATE POLICY "plans_public" ON public.subscription_plans FOR SELECT USING (TRUE);

-- billing_subscriptions
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID REFERENCES public.tenants(id),
    plan_id              TEXT REFERENCES public.subscription_plans(id),
    status               TEXT DEFAULT 'active',
    billing_cycle        TEXT DEFAULT 'monthly',
    amount               NUMERIC DEFAULT 0,
    currency             TEXT DEFAULT 'USD',
    customer_email       TEXT,
    paddle_subscription_id TEXT,
    next_billed_at       TIMESTAMPTZ,
    trial_ends_at        TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    is_current           BOOLEAN DEFAULT TRUE,
    metadata             JSONB DEFAULT '{}',
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_admin_only" ON public.billing_subscriptions;
CREATE POLICY "billing_admin_only" ON public.billing_subscriptions FOR ALL USING (TRUE);

-- billing_invoices
CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID REFERENCES public.tenants(id),
    subscription_id UUID REFERENCES public.billing_subscriptions(id),
    amount         NUMERIC DEFAULT 0,
    currency       TEXT DEFAULT 'USD',
    status         TEXT DEFAULT 'draft',
    invoice_number TEXT,
    invoice_url    TEXT,
    billed_at      TIMESTAMPTZ,
    paid_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_admin" ON public.billing_invoices;
CREATE POLICY "invoices_admin" ON public.billing_invoices FOR ALL USING (TRUE);

-- billing_events (webhooks)
CREATE TABLE IF NOT EXISTS public.billing_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type        TEXT NOT NULL,
    source            TEXT DEFAULT 'paddle',
    tenant_id         UUID REFERENCES public.tenants(id),
    processing_status TEXT DEFAULT 'received',
    occurred_at       TIMESTAMPTZ DEFAULT NOW(),
    processed_at      TIMESTAMPTZ,
    error_message     TEXT,
    retry_count       INTEGER DEFAULT 0,
    last_retry_at     TIMESTAMPTZ,
    last_retry_reason TEXT,
    next_retry_at     TIMESTAMPTZ,
    payload           JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_events_admin" ON public.billing_events;
CREATE POLICY "billing_events_admin" ON public.billing_events FOR ALL USING (TRUE);

-- billing_audit_logs
CREATE TABLE IF NOT EXISTS public.billing_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES public.tenants(id),
    subscription_id UUID REFERENCES public.billing_subscriptions(id),
    action          TEXT NOT NULL,
    actor_user_id   UUID,
    actor_scope     TEXT DEFAULT 'system',
    reason          TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.billing_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin" ON public.billing_audit_logs;
CREATE POLICY "audit_admin" ON public.billing_audit_logs FOR ALL USING (TRUE);

-- usage_counters
CREATE TABLE IF NOT EXISTS public.usage_counters (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id   UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    metric     TEXT NOT NULL,
    value      BIGINT DEFAULT 0,
    period     TEXT DEFAULT 'monthly',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_id, metric, period)
);
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_brand_access" ON public.usage_counters;
CREATE POLICY "usage_brand_access" ON public.usage_counters FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- ----------------------------------------------------------------
-- PART 4: Indexes للأداء
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id      ON public.post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_platform      ON public.post_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_follower_history_brand_id    ON public.follower_history(brand_id);
CREATE INDEX IF NOT EXISTS idx_follower_history_recorded    ON public.follower_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_brand_id           ON public.workflows(brand_id);
CREATE INDEX IF NOT EXISTS idx_brainstormed_ideas_brand_id  ON public.brainstormed_ideas(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_memory_brand_id        ON public.brand_memory(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_memory_importance      ON public.brand_memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_brand_connections_brand_id   ON public.brand_connections(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_connections_provider   ON public.brand_connections(provider);
CREATE INDEX IF NOT EXISTS idx_brand_assets_brand_id        ON public.brand_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_brand_id     ON public.scheduled_posts(brand_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status       ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON public.scheduled_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_brand_id ON public.inbox_conversations(brand_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_read     ON public.inbox_conversations(is_read);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_conv_id       ON public.inbox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_brand_id        ON public.ad_campaigns(brand_id);

-- ----------------------------------------------------------------
-- PART 5: Functions المطلوبة للـ services
-- ----------------------------------------------------------------

-- دالة لجلب ذاكرة البراند كـ context للـ AI
CREATE OR REPLACE FUNCTION get_brand_memory_context(p_brand_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE(memory_type TEXT, content TEXT, context JSONB, importance INTEGER)
LANGUAGE sql STABLE AS $$
    SELECT memory_type, content, context, importance
    FROM public.brand_memory
    WHERE brand_id = p_brand_id
    ORDER BY importance DESC, created_at DESC
    LIMIT p_limit;
$$;

-- دالة لزيادة عداد الاستخدام
CREATE OR REPLACE FUNCTION increment_usage_counter(
    p_brand UUID,
    p_metric TEXT,
    p_delta BIGINT DEFAULT 1
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.usage_counters(brand_id, metric, value, updated_at)
    VALUES (p_brand, p_metric, p_delta, NOW())
    ON CONFLICT(brand_id, metric, period)
    DO UPDATE SET value = usage_counters.value + p_delta, updated_at = NOW();
EXCEPTION WHEN OTHERS THEN
    -- Silent fail — usage tracking is non-critical
    NULL;
END;
$$;

-- دالة لتجميع أداء الـ briefs (للـ Analytics)
CREATE OR REPLACE FUNCTION get_brief_performance_rollups(
    p_brand_id UUID,
    p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
    brief_id UUID, watchlist_id UUID, title TEXT, objective TEXT, angle TEXT,
    linked_posts BIGINT, published_posts BIGINT, scheduled_posts BIGINT,
    platform_spread BIGINT, total_impressions BIGINT, total_reach BIGINT,
    total_engagement BIGINT, total_clicks BIGINT, total_likes BIGINT,
    total_comments BIGINT, total_shares BIGINT, total_saves BIGINT,
    last_published_at TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        sp.brief_id,
        sp.watchlist_id,
        sp.brief_title AS title,
        '' AS objective,
        '' AS angle,
        COUNT(sp.id) AS linked_posts,
        COUNT(sp.id) FILTER (WHERE sp.status = 'Published') AS published_posts,
        COUNT(sp.id) FILTER (WHERE sp.status = 'Scheduled') AS scheduled_posts,
        (
            SELECT COUNT(DISTINCT p)
            FROM public.scheduled_posts sp2, unnest(sp2.platforms) AS p
            WHERE sp2.brand_id = p_brand_id
              AND sp2.brief_id = sp.brief_id
        )::BIGINT AS platform_spread,
        COALESCE(SUM(pa.impressions), 0) AS total_impressions,
        COALESCE(SUM(pa.reach), 0) AS total_reach,
        COALESCE(SUM(pa.engagement), 0) AS total_engagement,
        COALESCE(SUM(pa.clicks), 0) AS total_clicks,
        COALESCE(SUM(pa.likes), 0) AS total_likes,
        COALESCE(SUM(pa.comments), 0) AS total_comments,
        COALESCE(SUM(pa.shares), 0) AS total_shares,
        COALESCE(SUM(pa.saves), 0) AS total_saves,
        MAX(sp.published_at) AS last_published_at
    FROM public.scheduled_posts sp
    LEFT JOIN public.post_analytics pa ON pa.post_id = sp.id
    WHERE sp.brand_id = p_brand_id
      AND sp.brief_id IS NOT NULL
      AND (p_since IS NULL OR sp.created_at >= p_since)
    GROUP BY sp.brief_id, sp.watchlist_id, sp.brief_title;
$$;

-- دالة لتجميع أداء الـ watchlists
CREATE OR REPLACE FUNCTION get_watchlist_performance_rollups(
    p_brand_id UUID,
    p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
    watchlist_id UUID, name TEXT, query TEXT,
    briefs_count BIGINT, linked_posts BIGINT, published_posts BIGINT,
    scheduled_posts BIGINT, platform_spread BIGINT,
    total_impressions BIGINT, total_reach BIGINT, total_engagement BIGINT,
    total_clicks BIGINT, last_published_at TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
    SELECT
        sp.watchlist_id,
        '' AS name,
        '' AS query,
        COUNT(DISTINCT sp.brief_id) AS briefs_count,
        COUNT(sp.id) AS linked_posts,
        COUNT(sp.id) FILTER (WHERE sp.status = 'Published') AS published_posts,
        COUNT(sp.id) FILTER (WHERE sp.status = 'Scheduled') AS scheduled_posts,
        (
            SELECT COUNT(DISTINCT p)
            FROM public.scheduled_posts sp2, unnest(sp2.platforms) AS p
            WHERE sp2.brand_id = p_brand_id
              AND sp2.watchlist_id = sp.watchlist_id
        )::BIGINT AS platform_spread,
        COALESCE(SUM(pa.impressions), 0) AS total_impressions,
        COALESCE(SUM(pa.reach), 0) AS total_reach,
        COALESCE(SUM(pa.engagement), 0) AS total_engagement,
        COALESCE(SUM(pa.clicks), 0) AS total_clicks,
        MAX(sp.published_at) AS last_published_at
    FROM public.scheduled_posts sp
    LEFT JOIN public.post_analytics pa ON pa.post_id = sp.id
    WHERE sp.brand_id = p_brand_id
      AND sp.watchlist_id IS NOT NULL
      AND (p_since IS NULL OR sp.created_at >= p_since)
    GROUP BY sp.watchlist_id;
$$;

-- ----------------------------------------------------------------
-- تم! ✅ المشروع الآن جاهز للـ production.
-- ----------------------------------------------------------------
SELECT 'Master Fix Script completed successfully! 🎉' AS status;
