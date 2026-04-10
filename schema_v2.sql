-- ══════════════════════════════════════════════════════════════════════════════
--  SBrandOps — schema_v2.sql
--  One-file clean schema for a fresh Supabase project
--  Run once in SQL Editor → all tables, RLS, indexes, triggers
-- ══════════════════════════════════════════════════════════════════════════════
--
--  SUPER-ADMIN CREDENTIALS (change after first login!)
--  Email    : admin@sbrandops.com
--  Password : SBrandOps@Admin2026!
--  Role     : super_admin  (stored in auth.users raw_user_meta_data->>'role')
--
--  HOW TO CREATE SUPER-ADMIN IN SUPABASE:
--  1. Go to Authentication → Users → Add User
--  2. Email: admin@sbrandops.com  |  Password: SBrandOps@Admin2026!
--  3. Run this after creation:
--
--     UPDATE auth.users
--     SET raw_user_meta_data = raw_user_meta_data || '{"role":"super_admin"}'::jsonb
--     WHERE email = 'admin@sbrandops.com';
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SHARED HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Returns all brand IDs the current user owns OR is a team member of
-- Used in RLS policies across all brand-scoped tables
-- NOTE: LANGUAGE plpgsql (not sql) so table refs are NOT validated at creation time
--       — brands & team_members tables are created later in this file
CREATE OR REPLACE FUNCTION crm_user_brand_ids()
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    RETURN ARRAY(
        SELECT id FROM public.brands WHERE user_id = auth.uid()
        UNION
        SELECT brand_id FROM public.team_members
            WHERE user_id = auth.uid() AND status = 'active'
    );
END;
$$;

-- Super-admin check
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT raw_user_meta_data->>'role' = 'super_admin'
         FROM auth.users WHERE id = auth.uid()),
        false
    );
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 1: SAAS INFRASTRUCTURE
-- Plans → Tenants → Payments
-- ═════════════════════════════════════════════════════════════════════════════

-- Subscription Plans (seed data, admin-managed)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id              text PRIMARY KEY,           -- 'starter' | 'pro' | 'agency'
    name            text NOT NULL,
    name_ar         text,
    price_monthly   numeric NOT NULL DEFAULT 0,
    price_yearly    numeric NOT NULL DEFAULT 0,
    max_brands      integer NOT NULL DEFAULT 1,
    max_users       integer NOT NULL DEFAULT 2,
    ai_tokens_monthly bigint NOT NULL DEFAULT 1000000,
    features        jsonb NOT NULL DEFAULT '[]',
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are public readable"    ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Only admins manage plans"     ON public.subscription_plans FOR ALL
    USING (is_super_admin()) WITH CHECK (is_super_admin());

INSERT INTO public.subscription_plans (id, name, name_ar, price_monthly, price_yearly, max_brands, max_users, ai_tokens_monthly, features)
VALUES
    ('starter', 'Starter', 'المبتدئ',  29,  290, 1,  2,  1000000,
     '["Social Publishing","Basic Analytics","Content Ops","Inbox","Brainstorm"]'),
    ('pro',     'Pro',     'المحترف',  99,  990, 5,  10, 5000000,
     '["Everything in Starter","Advanced Analytics","Ads Ops","SEO Tools","Workflows","API Access"]'),
    ('agency',  'Agency',  'الوكالة', 249, 2490, 25, 50, 20000000,
     '["Everything in Pro","CRM Module","White Label","Priority Support","Custom Workflows","GBP Tools"]')
ON CONFLICT (id) DO UPDATE
    SET price_monthly = EXCLUDED.price_monthly,
        price_yearly  = EXCLUDED.price_yearly,
        features      = EXCLUDED.features;

-- Tenants (SaaS customers / organizations)
CREATE TABLE IF NOT EXISTS public.tenants (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            text NOT NULL,
    owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    plan_id         text NOT NULL DEFAULT 'starter' REFERENCES public.subscription_plans(id),
    status          text NOT NULL DEFAULT 'trial',   -- trial | active | suspended | cancelled
    trial_ends_at   timestamptz,
    ai_tokens_used  bigint NOT NULL DEFAULT 0,
    brands_count    integer NOT NULL DEFAULT 0,
    users_count     integer NOT NULL DEFAULT 0,
    billing_email   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner  ON public.tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_plan   ON public.tenants(plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins see all tenants"  ON public.tenants FOR ALL USING (is_super_admin());
CREATE POLICY "Owners see their tenant"       ON public.tenants FOR SELECT
    USING (owner_id = auth.uid());

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 2: BRAND CORE
-- Brands → Brand Profiles → Social Accounts → Team Members → API Keys
-- ═════════════════════════════════════════════════════════════════════════════

-- Brands
CREATE TABLE IF NOT EXISTS public.brands (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id   uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    name        text NOT NULL,
    industry    text,
    logo_url    text,
    website_url text,
    country     text DEFAULT 'SA',
    timezone    text DEFAULT 'Asia/Riyadh',
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_user_id   ON public.brands(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_tenant_id ON public.brands(tenant_id);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own brands"     ON public.brands FOR SELECT USING (user_id = auth.uid() OR id = ANY(crm_user_brand_ids()));
CREATE POLICY "Users insert own brands"  ON public.brands FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own brands"  ON public.brands FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own brands"  ON public.brands FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Super admin all brands"   ON public.brands FOR ALL USING (is_super_admin());

CREATE TRIGGER trg_brands_updated_at
    BEFORE UPDATE ON public.brands
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Brand Profiles (AI-generated voice & audience data)
CREATE TABLE IF NOT EXISTS public.brand_profiles (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL UNIQUE REFERENCES public.brands(id) ON DELETE CASCADE,
    -- Identity
    brand_name          text,
    industry            text,
    description         text,
    -- Voice
    tone_description    text[],
    voice_keywords      text[],
    negative_keywords   text[],
    tone_strength       jsonb DEFAULT '{}',     -- {professional:80, friendly:60, ...}
    -- Audience
    target_audience     text,
    brand_audiences     jsonb DEFAULT '[]',     -- array of persona objects
    age_range           text,
    -- Values & KSPs
    values              text[],
    key_selling_points  text[],
    -- Guidelines
    voice_guidelines    jsonb DEFAULT '{"dos":[],"donts":[]}',
    -- Sentiment
    sentiment_score     integer DEFAULT 50,     -- 0-100
    -- GBP
    gbp_connected       boolean DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_brand ON public.brand_profiles(brand_id);

ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand profiles follow brand ownership" ON public.brand_profiles FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_brand_profiles_updated_at
    BEFORE UPDATE ON public.brand_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Social Accounts
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    platform            text NOT NULL,          -- facebook | instagram | x | linkedin | tiktok | youtube | snapchat
    platform_user_id    text,
    platform_username   text,
    username            text,
    avatar_url          text,
    account_type        text,                   -- page | profile | business
    followers_count     integer DEFAULT 0,
    following_count     integer DEFAULT 0,
    posts_count         integer DEFAULT 0,
    access_token        text,                   -- encrypted in production
    refresh_token       text,
    token_expires_at    timestamptz,
    status              text DEFAULT 'connected', -- connected | expired | needs_reauth | disconnected
    permissions         text[],
    metadata            jsonb DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(brand_id, platform, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_brand    ON public.social_accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON public.social_accounts(platform);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social accounts follow brand ownership" ON public.social_accounts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_social_accounts_updated_at
    BEFORE UPDATE ON public.social_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_email   text NOT NULL,
    name            text,
    role            text NOT NULL DEFAULT 'viewer', -- owner | admin | editor | viewer
    status          text NOT NULL DEFAULT 'pending', -- active | pending | suspended
    avatar_url      text,
    last_active_at  timestamptz,
    invited_at      timestamptz NOT NULL DEFAULT now(),
    accepted_at     timestamptz,
    UNIQUE(brand_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_brand  ON public.team_members(brand_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user   ON public.team_members(user_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owners manage team" ON public.team_members FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- API Keys (hashed)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name        text NOT NULL,
    key_prefix  text NOT NULL,          -- e.g. "sbrapi_1a2b"
    key_hash    text NOT NULL,          -- sha256 of full key
    scopes      text[] DEFAULT '{}',    -- read | write | publish | analytics
    last_used_at timestamptz,
    expires_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_brand ON public.api_keys(brand_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owners manage api keys" ON public.api_keys FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Payment Records
CREATE TABLE IF NOT EXISTS public.payment_records (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    brand_id    uuid REFERENCES public.brands(id) ON DELETE SET NULL,
    amount      numeric NOT NULL,
    currency    text NOT NULL DEFAULT 'USD',
    status      text NOT NULL DEFAULT 'pending', -- paid | failed | refunded | pending
    invoice_url text,
    paid_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own payments" ON public.payment_records FOR SELECT
    USING (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all payments" ON public.payment_records FOR ALL USING (is_super_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 3: CONTENT & PUBLISHING
-- Content Pieces → Scheduled Posts → Post Analytics → Follower History → Ideas
-- ═════════════════════════════════════════════════════════════════════════════

-- Content Pieces (Content Ops kanban)
CREATE TABLE IF NOT EXISTS public.content_pieces (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    title               text NOT NULL,
    type                text NOT NULL,          -- Post | Reel | Story | Article | Carousel
    status              text DEFAULT 'ideas',   -- ideas | drafting | review | approved | scheduled | published
    generated_content   text,
    platforms           text[] DEFAULT '{}',    -- array of SocialPlatform
    assignee_id         uuid REFERENCES auth.users(id),
    due_date            timestamptz,
    notes               text,
    metadata            jsonb DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_pieces_brand  ON public.content_pieces(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_pieces_status ON public.content_pieces(brand_id, status);

ALTER TABLE public.content_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Content pieces follow brand ownership" ON public.content_pieces FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_content_pieces_updated_at
    BEFORE UPDATE ON public.content_pieces
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Scheduled Posts (Publisher)
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    content                 text,
    media_urls              text[] DEFAULT '{}',
    platforms               text[] DEFAULT '{}',
    scheduled_at            timestamptz,
    status                  text DEFAULT 'draft',  -- draft | scheduled | published | failed | cancelled
    platform_statuses       jsonb DEFAULT '{}',    -- per-platform publish result
    instagram_first_comment text,
    locations               jsonb DEFAULT '[]',
    published_at            timestamptz,
    error_message           text,
    created_by              uuid REFERENCES auth.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_brand       ON public.scheduled_posts(brand_id);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled   ON public.scheduled_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_status      ON public.scheduled_posts(brand_id, status);

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts follow brand ownership" ON public.scheduled_posts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_scheduled_posts_updated_at
    BEFORE UPDATE ON public.scheduled_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Post Analytics (per-post, per-platform metrics)
CREATE TABLE IF NOT EXISTS public.post_analytics (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id         uuid NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    platform        text NOT NULL,
    platform_post_id text,
    impressions     integer DEFAULT 0,
    reach           integer DEFAULT 0,
    engagement      integer DEFAULT 0,
    likes           integer DEFAULT 0,
    comments        integer DEFAULT 0,
    shares          integer DEFAULT 0,
    clicks          integer DEFAULT 0,
    saves           integer DEFAULT 0,
    video_views     integer DEFAULT 0,
    fetched_at      timestamptz DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_post    ON public.post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_brand   ON public.post_analytics(brand_id);

ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post analytics follow brand ownership" ON public.post_analytics FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- Follower History (daily snapshots per account)
CREATE TABLE IF NOT EXISTS public.follower_history (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    account_id      uuid REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    platform        text NOT NULL,
    followers_count integer NOT NULL DEFAULT 0,
    following_count integer DEFAULT 0,
    posts_count     integer DEFAULT 0,
    engagement_rate numeric(5,2) DEFAULT 0,
    recorded_at     date NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(brand_id, platform, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_follower_history_brand ON public.follower_history(brand_id, recorded_at DESC);

ALTER TABLE public.follower_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follower history follows brand ownership" ON public.follower_history FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- Analytics Snapshots (aggregated brand-level analytics)
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    period_start    date NOT NULL,
    period_end      date NOT NULL,
    platform        text,                   -- null = all platforms
    total_reach     bigint DEFAULT 0,
    total_impressions bigint DEFAULT 0,
    total_engagement bigint DEFAULT 0,
    total_posts     integer DEFAULT 0,
    avg_engagement_rate numeric(5,2) DEFAULT 0,
    followers_gained integer DEFAULT 0,
    top_post_id     uuid REFERENCES public.scheduled_posts(id) ON DELETE SET NULL,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_brand ON public.analytics_snapshots(brand_id, period_start DESC);

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Analytics snapshots follow brand ownership" ON public.analytics_snapshots FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- Brainstormed Ideas (IdeaOps)
CREATE TABLE IF NOT EXISTS public.brainstormed_ideas (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    title                   text NOT NULL,
    description             text,
    platform                text,
    format                  text,           -- Reel | Story | Carousel | Post | Article
    angle                   text,           -- Educational | UGC | Interactive | Trending
    is_saved                boolean DEFAULT false,
    sent_to_content_ops     boolean DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ideas_brand ON public.brainstormed_ideas(brand_id);

ALTER TABLE public.brainstormed_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ideas follow brand ownership" ON public.brainstormed_ideas FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 4: MARKETING & ADS
-- Marketing Plans → Ad Campaigns
-- ═════════════════════════════════════════════════════════════════════════════

-- Marketing Plans
CREATE TABLE IF NOT EXISTS public.marketing_plans (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name            text NOT NULL,
    objective       text,
    target_audience text DEFAULT '',
    start_date      date,
    end_date        date,
    budget          numeric,
    kpis            jsonb DEFAULT '[]',
    channels        jsonb DEFAULT '[]',
    status          text DEFAULT 'draft',   -- draft | active | completed | paused
    ai_plan         jsonb DEFAULT NULL,
    ai_priorities   jsonb DEFAULT NULL,
    monthly_plan    jsonb DEFAULT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_plans_brand  ON public.marketing_plans(brand_id);
CREATE INDEX IF NOT EXISTS idx_marketing_plans_status ON public.marketing_plans(brand_id, status);

ALTER TABLE public.marketing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing plans follow brand ownership" ON public.marketing_plans FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_marketing_plans_updated_at
    BEFORE UPDATE ON public.marketing_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Marketing Plan Details (weekly/content breakdown)
CREATE TABLE IF NOT EXISTS public.marketing_plan_details (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id     uuid NOT NULL REFERENCES public.marketing_plans(id) ON DELETE CASCADE,
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    week_number integer,
    platform    text,
    content     jsonb DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_plan_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plan details follow brand ownership" ON public.marketing_plan_details FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- Ad Campaigns
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name            text NOT NULL,
    platform        text NOT NULL,          -- facebook | instagram | google | tiktok | snapchat
    objective       text,                   -- awareness | traffic | leads | conversions | sales
    status          text DEFAULT 'draft',   -- draft | active | paused | ended | archived
    budget          numeric DEFAULT 0,
    budget_type     text DEFAULT 'daily',   -- daily | lifetime
    spent           numeric DEFAULT 0,
    impressions     bigint DEFAULT 0,
    clicks          bigint DEFAULT 0,
    conversions     integer DEFAULT 0,
    revenue         numeric DEFAULT 0,
    ctr             numeric(5,2) DEFAULT 0, -- %
    cpa             numeric(10,2) DEFAULT 0,
    roas            numeric(5,2) DEFAULT 0,
    start_date      date,
    end_date        date,
    external_id     text,                   -- platform campaign ID
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_brand   ON public.ad_campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status  ON public.ad_campaigns(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_platform ON public.ad_campaigns(brand_id, platform);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ad campaigns follow brand ownership" ON public.ad_campaigns FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_ad_campaigns_updated_at
    BEFORE UPDATE ON public.ad_campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 5: SEO OPS
-- Keywords → Articles
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_keywords (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    keyword         text NOT NULL,
    search_intent   text DEFAULT 'informational', -- informational|navigational|commercial|transactional
    difficulty      text DEFAULT 'medium',         -- low | medium | high
    priority_score  integer DEFAULT 50,            -- 1-100
    monthly_volume  text DEFAULT '',
    notes           text DEFAULT '',
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_keywords_brand ON public.seo_keywords(brand_id);

ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SEO keywords follow brand ownership" ON public.seo_keywords FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_seo_keywords_updated_at
    BEFORE UPDATE ON public.seo_keywords
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.seo_articles (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    keyword_id          uuid REFERENCES public.seo_keywords(id) ON DELETE SET NULL,
    keyword             text NOT NULL,
    h1                  text DEFAULT '',
    h2s                 jsonb DEFAULT '[]',
    intro               text DEFAULT '',
    body                text DEFAULT '',
    faq                 jsonb DEFAULT '[]',
    meta_title          text DEFAULT '',
    meta_description    text DEFAULT '',
    readability_score   integer DEFAULT 0,
    keyword_density     numeric(5,2) DEFAULT 0,
    seo_score           integer DEFAULT 0,
    word_count          integer DEFAULT 0,
    status              text DEFAULT 'draft', -- draft | optimizing | ready | published
    wp_post_id          integer DEFAULT NULL,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_articles_brand  ON public.seo_articles(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_articles_status ON public.seo_articles(brand_id, status);

ALTER TABLE public.seo_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SEO articles follow brand ownership" ON public.seo_articles FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_seo_articles_updated_at
    BEFORE UPDATE ON public.seo_articles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 6: INBOX & MESSAGING
-- Conversations → Messages → Saved Replies
-- ═════════════════════════════════════════════════════════════════════════════

-- Inbox Conversations
CREATE TABLE IF NOT EXISTS public.inbox_conversations (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    platform            text NOT NULL,          -- SocialPlatform
    type                text NOT NULL DEFAULT 'message', -- message | comment | mention
    external_id         text,
    user_name           text NOT NULL,
    user_handle         text,
    user_avatar_url     text,
    last_message_text   text,
    last_message_at     timestamptz NOT NULL DEFAULT now(),
    is_read             boolean NOT NULL DEFAULT false,
    assignee            text,
    intent              text,                   -- purchase_inquiry | complaint | support | general
    sentiment           text,                   -- positive | neutral | negative
    priority            text DEFAULT 'normal',  -- urgent | high | normal | low
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(brand_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_brand       ON public.inbox_conversations(brand_id);
CREATE INDEX IF NOT EXISTS idx_inbox_unread      ON public.inbox_conversations(brand_id, is_read);
CREATE INDEX IF NOT EXISTS idx_inbox_last_msg    ON public.inbox_conversations(last_message_at DESC);

ALTER TABLE public.inbox_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inbox follows brand ownership" ON public.inbox_conversations FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_inbox_updated_at
    BEFORE UPDATE ON public.inbox_conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Inbox Messages
CREATE TABLE IF NOT EXISTS public.inbox_messages (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    sender          text NOT NULL DEFAULT 'user', -- user | agent | bot
    text            text NOT NULL,
    media_urls      text[] DEFAULT '{}',
    is_internal     boolean DEFAULT false,        -- internal note vs real reply
    sent_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_conv  ON public.inbox_messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_brand ON public.inbox_messages(brand_id);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inbox messages follow brand ownership" ON public.inbox_messages FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- Saved Replies
CREATE TABLE IF NOT EXISTS public.saved_replies (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    title       text NOT NULL,
    content     text NOT NULL,
    category    text NOT NULL,
    tags        text[] DEFAULT '{}',
    variables   text[] DEFAULT '{}',
    usage_count integer DEFAULT 0,
    last_used_at timestamptz,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_replies_brand    ON public.saved_replies(brand_id);
CREATE INDEX IF NOT EXISTS idx_saved_replies_category ON public.saved_replies(category);

ALTER TABLE public.saved_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Saved replies follow brand ownership" ON public.saved_replies FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_saved_replies_updated_at
    BEFORE UPDATE ON public.saved_replies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 7: WORKFLOWS & NOTIFICATIONS
-- Workflows → Logs → Notifications → Rules
-- ═════════════════════════════════════════════════════════════════════════════

-- Workflows
CREATE TABLE IF NOT EXISTS public.workflows (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    trigger_type    text NOT NULL DEFAULT 'manual', -- post_scheduled | post_published | content_approved | manual
    is_active       boolean NOT NULL DEFAULT true,
    steps           jsonb NOT NULL DEFAULT '[]',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_brand ON public.workflows(brand_id);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workflows follow brand ownership" ON public.workflows FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_workflows_updated_at
    BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Workflow Logs
CREATE TABLE IF NOT EXISTS public.workflow_logs (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    trigger_ref     text,
    status          text NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
    log_entries     jsonb NOT NULL DEFAULT '[]',
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON public.workflow_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_brand    ON public.workflow_logs(brand_id);

ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workflow logs follow brand ownership" ON public.workflow_logs FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()));

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES auth.users(id),
    type        text NOT NULL,
    title       text NOT NULL,
    message     text NOT NULL,
    icon        text,
    link        text,
    priority    text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    category    text DEFAULT 'general',
    is_read     boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    metadata    jsonb DEFAULT '{}',
    read_at     timestamptz,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_brand   ON public.notifications(brand_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON public.notifications(brand_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifications follow brand ownership" ON public.notifications FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()));

-- Notification Rules
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name        text NOT NULL,
    description text,
    trigger     text NOT NULL,
    conditions  jsonb DEFAULT '[]',
    actions     jsonb DEFAULT '[]',
    is_active   boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notification rules follow brand ownership" ON public.notification_rules FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_notification_rules_updated_at
    BEFORE UPDATE ON public.notification_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 8: GOOGLE BUSINESS PROFILE (GBP)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gbp_info (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL UNIQUE REFERENCES public.brands(id) ON DELETE CASCADE,
    business_name   text,
    address         text,
    phone           text,
    website         text,
    category        text,
    rating          numeric(3,2) DEFAULT 0,
    review_count    integer DEFAULT 0,
    is_verified     boolean DEFAULT false,
    hours           jsonb DEFAULT '{}',
    photos          jsonb DEFAULT '[]',
    description     text,
    metadata        jsonb DEFAULT '{}',
    synced_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gbp_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GBP info follows brand ownership" ON public.gbp_info FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_gbp_info_updated_at
    BEFORE UPDATE ON public.gbp_info
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.gbp_posts (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    type        text DEFAULT 'update',  -- update | offer | event | product
    text        text,
    image_url   text,
    cta_type    text,
    cta_url     text,
    status      text DEFAULT 'draft',  -- draft | published | scheduled
    published_at timestamptz,
    external_id text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_posts_brand ON public.gbp_posts(brand_id);
ALTER TABLE public.gbp_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GBP posts follow brand ownership" ON public.gbp_posts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.gbp_reviews (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    external_id     text,
    reviewer_name   text,
    reviewer_avatar text,
    rating          integer,           -- 1-5
    text            text,
    reply           text,
    reply_at        timestamptz,
    sentiment       text,
    is_replied      boolean DEFAULT false,
    reviewed_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_reviews_brand  ON public.gbp_reviews(brand_id);
CREATE INDEX IF NOT EXISTS idx_gbp_reviews_rating ON public.gbp_reviews(brand_id, rating);
ALTER TABLE public.gbp_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GBP reviews follow brand ownership" ON public.gbp_reviews FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.gbp_questions (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    external_id text,
    question    text NOT NULL,
    answer      text,
    answered_at timestamptz,
    asked_by    text,
    upvotes     integer DEFAULT 0,
    is_answered boolean DEFAULT false,
    asked_at    timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_questions_brand ON public.gbp_questions(brand_id);
ALTER TABLE public.gbp_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GBP questions follow brand ownership" ON public.gbp_questions FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 9: CRM — CUSTOMER HUB
-- Customers → Orders → Activities → Segments → RFM
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.crm_customers (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    external_id         text,
    first_name          text,
    last_name           text,
    email               text,
    phone               text,
    avatar_url          text,
    gender              text,
    birth_date          date,
    language            text DEFAULT 'ar',
    currency            text DEFAULT 'SAR',
    acquisition_source  text,   -- organic | paid | referral | social | email | direct
    acquisition_channel text,   -- facebook | google | instagram | etc.
    lifecycle_stage     text NOT NULL DEFAULT 'lead', -- lead|prospect|first_purchase|active|repeat|vip|at_risk|churned
    ltv                 numeric(12,2) DEFAULT 0,
    total_orders        integer DEFAULT 0,
    total_spent         numeric(12,2) DEFAULT 0,
    average_order_value numeric(12,2) DEFAULT 0,
    refund_count        integer DEFAULT 0,
    first_order_date    timestamptz,
    last_order_date     timestamptz,
    last_activity_at    timestamptz,
    assigned_to         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    notes_count         integer DEFAULT 0,
    tasks_count         integer DEFAULT 0,
    is_blocked          boolean DEFAULT false,
    marketing_consent   boolean DEFAULT false,
    sms_consent         boolean DEFAULT false,
    metadata            jsonb DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_brand   ON public.crm_customers(brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_email   ON public.crm_customers(brand_id, email);
CREATE INDEX IF NOT EXISTS idx_crm_customers_stage   ON public.crm_customers(brand_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_crm_customers_search  ON public.crm_customers USING gin(
    to_tsvector('simple',
        coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
        coalesce(email,'') || ' ' || coalesce(phone,'')
    )
);

ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM customers follow brand ownership" ON public.crm_customers FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_crm_customers_updated_at
    BEFORE UPDATE ON public.crm_customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.crm_customer_identities (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    provider    text NOT NULL,          -- woocommerce | shopify | manual
    provider_id text NOT NULL,
    store_url   text,
    raw_data    jsonb DEFAULT '{}',
    synced_at   timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, provider, provider_id)
);

ALTER TABLE public.crm_customer_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM identities follow brand ownership" ON public.crm_customer_identities FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_addresses (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    type        text DEFAULT 'shipping',    -- billing | shipping
    first_name  text, last_name text, company text,
    address_1   text, address_2 text, city text, state text,
    postcode    text, country text, phone text,
    is_default  boolean DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM addresses follow brand ownership" ON public.crm_addresses FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_orders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id     uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
    external_id     text NOT NULL,
    store_source    text NOT NULL,          -- woocommerce | shopify | manual
    store_url       text,
    status          text NOT NULL DEFAULT 'pending',
    payment_status  text DEFAULT 'pending',
    shipping_status text DEFAULT 'pending',
    currency        text DEFAULT 'SAR',
    subtotal        numeric(12,2) DEFAULT 0,
    discount_total  numeric(12,2) DEFAULT 0,
    shipping_total  numeric(12,2) DEFAULT 0,
    tax_total       numeric(12,2) DEFAULT 0,
    total           numeric(12,2) DEFAULT 0,
    refund_total    numeric(12,2) DEFAULT 0,
    payment_method  text,
    coupon_codes    text[],
    shipping_address jsonb,
    billing_address jsonb,
    notes           text,
    tracking_number text,
    order_date      timestamptz,
    paid_at         timestamptz,
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_orders_brand    ON public.crm_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_customer ON public.crm_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_date     ON public.crm_orders(brand_id, order_date DESC);

ALTER TABLE public.crm_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM orders follow brand ownership" ON public.crm_orders FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_crm_orders_updated_at
    BEFORE UPDATE ON public.crm_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.crm_order_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL REFERENCES public.crm_orders(id) ON DELETE CASCADE,
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    product_id  text,
    product_name text NOT NULL,
    sku         text,
    quantity    integer DEFAULT 1,
    unit_price  numeric(12,2) DEFAULT 0,
    total_price numeric(12,2) DEFAULT 0,
    image_url   text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM order items follow brand ownership" ON public.crm_order_items FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_customer_tags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name        text NOT NULL,
    color       text DEFAULT '#6366f1',
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(brand_id, name)
);

ALTER TABLE public.crm_customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM tags follow brand ownership" ON public.crm_customer_tags FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_customer_tag_assignments (
    customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    tag_id      uuid NOT NULL REFERENCES public.crm_customer_tags(id) ON DELETE CASCADE,
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (customer_id, tag_id)
);

ALTER TABLE public.crm_customer_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM tag assignments follow brand ownership" ON public.crm_customer_tag_assignments FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_notes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    text        text NOT NULL,
    is_pinned   boolean DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_customer ON public.crm_notes(customer_id, created_at DESC);
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM notes follow brand ownership" ON public.crm_notes FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_activities (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    event_type  text NOT NULL,  -- order_placed|page_view|email_open|sms_sent|call|meeting|note_added|tag_added|stage_change
    event_data  jsonb DEFAULT '{}',
    source      text,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_customer ON public.crm_activities(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_brand    ON public.crm_activities(brand_id, event_type);
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM activities follow brand ownership" ON public.crm_activities FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_tasks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    title       text NOT NULL,
    description text,
    type        text DEFAULT 'follow_up',   -- follow_up | call | email | demo | other
    status      text DEFAULT 'pending',     -- pending | in_progress | completed | cancelled
    priority    text DEFAULT 'medium',      -- low | medium | high | urgent
    due_at      timestamptz,
    completed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_brand    ON public.crm_tasks(brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_customer ON public.crm_tasks(customer_id);
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM tasks follow brand ownership" ON public.crm_tasks FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_crm_tasks_updated_at
    BEFORE UPDATE ON public.crm_tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.crm_segments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    is_dynamic      boolean DEFAULT true,
    customer_count  integer DEFAULT 0,
    last_synced_at  timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM segments follow brand ownership" ON public.crm_segments FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_segment_rules (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id  uuid NOT NULL REFERENCES public.crm_segments(id) ON DELETE CASCADE,
    field       text NOT NULL,
    operator    text NOT NULL,  -- equals|not_equals|gt|lt|contains|in|not_in|is_null|is_not_null
    value       text,
    value_type  text DEFAULT 'string',
    logic       text DEFAULT 'AND',
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_segment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM segment rules: owner access" ON public.crm_segment_rules FOR ALL
    USING (segment_id IN (SELECT id FROM public.crm_segments WHERE brand_id = ANY(crm_user_brand_ids())));

CREATE TABLE IF NOT EXISTS public.crm_rfm_scores (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id     uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    recency_days    integer NOT NULL DEFAULT 0,
    frequency       integer NOT NULL DEFAULT 0,
    monetary        numeric(12,2) NOT NULL DEFAULT 0,
    r_score         smallint NOT NULL DEFAULT 1,    -- 1-5
    f_score         smallint NOT NULL DEFAULT 1,
    m_score         smallint NOT NULL DEFAULT 1,
    rfm_score       smallint NOT NULL DEFAULT 3,    -- composite 1-15
    rfm_segment     text NOT NULL DEFAULT 'cant_lose',
    calculated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_rfm_brand   ON public.crm_rfm_scores(brand_id, rfm_segment);
CREATE INDEX IF NOT EXISTS idx_crm_rfm_score   ON public.crm_rfm_scores(brand_id, rfm_score DESC);
ALTER TABLE public.crm_rfm_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM RFM scores follow brand ownership" ON public.crm_rfm_scores FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_retention_cohorts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    cohort_month    text NOT NULL,          -- e.g. '2024-01'
    period_number   integer NOT NULL,       -- months after acquisition
    cohort_size     integer NOT NULL,
    retained_count  integer NOT NULL DEFAULT 0,
    retention_rate  numeric(5,2) DEFAULT 0,
    calculated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, cohort_month, period_number)
);

CREATE INDEX IF NOT EXISTS idx_crm_cohorts_brand ON public.crm_retention_cohorts(brand_id, cohort_month);
ALTER TABLE public.crm_retention_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM cohorts follow brand ownership" ON public.crm_retention_cohorts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    role_key    text NOT NULL,  -- owner|admin|sales_manager|sales_rep|support_agent|analyst|read_only_client
    name        text NOT NULL,
    name_ar     text,
    permissions jsonb NOT NULL DEFAULT '[]',
    is_system   boolean DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, role_key)
);

ALTER TABLE public.crm_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM roles follow brand ownership" ON public.crm_roles FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_user_roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_key    text NOT NULL,
    assigned_by uuid REFERENCES auth.users(id),
    assigned_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_user_roles ON public.crm_user_roles(brand_id, user_id);
ALTER TABLE public.crm_user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM user roles follow brand ownership" ON public.crm_user_roles FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_store_connections (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    provider        text NOT NULL,          -- woocommerce | shopify
    store_url       text NOT NULL,
    api_key         text,
    api_secret      text,
    access_token    text,
    status          text DEFAULT 'active',  -- active | paused | error
    last_sync_at    timestamptz,
    sync_frequency  integer DEFAULT 60,     -- minutes
    total_synced    integer DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, provider, store_url)
);

ALTER TABLE public.crm_store_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM store connections follow brand ownership" ON public.crm_store_connections FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_crm_store_connections_updated_at
    BEFORE UPDATE ON public.crm_store_connections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.crm_sync_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id   uuid NOT NULL REFERENCES public.crm_store_connections(id) ON DELETE CASCADE,
    status          text DEFAULT 'pending',     -- pending | running | completed | failed
    records_synced  integer DEFAULT 0,
    errors          jsonb DEFAULT '[]',
    started_at      timestamptz DEFAULT now(),
    completed_at    timestamptz
);

ALTER TABLE public.crm_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM sync jobs follow brand ownership" ON public.crm_sync_jobs FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_automations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name            text NOT NULL,
    trigger_event   text NOT NULL,  -- stage_change | order_placed | inactivity | rfm_change | tag_added
    conditions      jsonb DEFAULT '[]',
    actions         jsonb DEFAULT '[]',
    is_active       boolean DEFAULT true,
    run_count       integer DEFAULT 0,
    last_run_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM automations follow brand ownership" ON public.crm_automations FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_webhook_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id   uuid REFERENCES public.crm_store_connections(id) ON DELETE SET NULL,
    event_type      text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}',
    processed       boolean DEFAULT false,
    processed_at    timestamptz,
    error           text,
    created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.crm_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM webhook events follow brand ownership" ON public.crm_webhook_events FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_conversation_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
    customer_id     uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    matched_by      text NOT NULL DEFAULT 'manual',  -- email | phone | order_id | manual
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_conv_links_customer ON public.crm_conversation_links(customer_id);
ALTER TABLE public.crm_conversation_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM conv links follow brand ownership" ON public.crm_conversation_links FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_feature_flags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    flag_key    text NOT NULL,
    is_enabled  boolean DEFAULT false,
    metadata    jsonb DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, flag_key)
);

ALTER TABLE public.crm_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM feature flags follow brand ownership" ON public.crm_feature_flags FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_lifecycle_states (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id     uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    from_stage      text,
    to_stage        text NOT NULL,
    changed_by      uuid REFERENCES auth.users(id),
    reason          text,
    changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_lifecycle_customer ON public.crm_lifecycle_states(customer_id, changed_at DESC);
ALTER TABLE public.crm_lifecycle_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM lifecycle states follow brand ownership" ON public.crm_lifecycle_states FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.crm_assignments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reason      text,
    assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM assignments follow brand ownership" ON public.crm_assignments FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- ═════════════════════════════════════════════════════════════════════════════
-- MODULE 10: TOOLS & INTEGRATIONS
-- Short Links → Integrations → Activity Logs
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.short_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    original_url    text NOT NULL,
    short_code      text NOT NULL UNIQUE,
    title           text,
    description     text,
    clicks          integer DEFAULT 0,
    is_active       boolean DEFAULT true,
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_brand ON public.short_links(brand_id);
CREATE INDEX IF NOT EXISTS idx_short_links_code  ON public.short_links(short_code);
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Short links follow brand ownership" ON public.short_links FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.link_clicks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id     uuid NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    ip_hash     text,
    user_agent  text,
    referer     text,
    country     text,
    device_type text,   -- mobile | desktop | tablet
    clicked_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link  ON public.link_clicks(link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_clicks_brand ON public.link_clicks(brand_id);
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Link clicks follow brand ownership" ON public.link_clicks FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TABLE IF NOT EXISTS public.brand_integrations (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    provider        text NOT NULL,  -- wordpress | zapier | make | hubspot | mailchimp | etc.
    status          text DEFAULT 'connected',   -- connected | disconnected | error
    config          jsonb DEFAULT '{}',         -- encrypted config in production
    last_sync_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(brand_id, provider)
);

ALTER TABLE public.brand_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Integrations follow brand ownership" ON public.brand_integrations FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_brand_integrations_updated_at
    BEFORE UPDATE ON public.brand_integrations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES auth.users(id),
    action      text NOT NULL,          -- post_created | post_published | account_connected | etc.
    entity_type text,                   -- post | account | brand | content | campaign
    entity_id   uuid,
    metadata    jsonb DEFAULT '{}',
    ip_address  inet,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_brand  ON public.activity_logs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user   ON public.activity_logs(user_id);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity logs follow brand ownership" ON public.activity_logs FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- ═════════════════════════════════════════════════════════════════════════════
-- FUTURE EXPANSION PLACEHOLDERS
-- Tables reserved for upcoming features — schema defined, not yet used by app
-- ═════════════════════════════════════════════════════════════════════════════

-- AI Usage tracking (token consumption per brand)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    tenant_id   uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    feature     text NOT NULL,  -- keyword_research | seo_article | ad_copy | insights | onboarding
    model       text NOT NULL,  -- gemini-1.5-pro | etc.
    tokens_used integer NOT NULL DEFAULT 0,
    cost_usd    numeric(10,6) DEFAULT 0,
    metadata    jsonb DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_brand  ON public.ai_usage_logs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON public.ai_usage_logs(tenant_id);
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI usage logs follow brand ownership" ON public.ai_usage_logs FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- White-label config (Agency plan)
CREATE TABLE IF NOT EXISTS public.white_label_configs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    custom_domain   text,
    logo_url        text,
    primary_color   text DEFAULT '#ec4899',
    app_name        text,
    support_email   text,
    is_active       boolean DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.white_label_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "White label: super admin only" ON public.white_label_configs FOR ALL USING (is_super_admin());

-- Audit trail (compliance)
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    brand_id    uuid REFERENCES public.brands(id) ON DELETE SET NULL,
    user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action      text NOT NULL,
    table_name  text,
    record_id   uuid,
    old_data    jsonb,
    new_data    jsonb,
    ip_address  inet,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant ON public.audit_trail(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_brand  ON public.audit_trail(brand_id, created_at DESC);
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit trail: super admin only" ON public.audit_trail FOR ALL USING (is_super_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- FINAL: SUPER-ADMIN SETUP REMINDER
-- ═════════════════════════════════════════════════════════════════════════════
-- After running this schema:
--
-- Step 1: Create user in Supabase Auth Dashboard
--   Email    : admin@sbrandops.com
--   Password : SBrandOps@Admin2026!
--
-- Step 2: Run this query to grant super_admin role:
--   UPDATE auth.users
--   SET raw_user_meta_data = raw_user_meta_data || '{"role":"super_admin"}'::jsonb
--   WHERE email = 'admin@sbrandops.com';
--
-- Step 3: Verify:
--   SELECT id, email, raw_user_meta_data->>'role' as role
--   FROM auth.users WHERE email = 'admin@sbrandops.com';
--
-- ══════════════════════════════════════════════════════════════════════════════
--  END OF SCHEMA V2 — 57 tables | 10 modules | Clean RLS | Production-ready
-- ══════════════════════════════════════════════════════════════════════════════
