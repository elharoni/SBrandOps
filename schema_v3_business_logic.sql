-- ═══════════════════════════════════════════════════════════════════════════
-- SBrandOps — schema_v3_business_logic.sql
-- Brand-Centric Operating System: Additive to schema_v2.sql
--
-- PHILOSOPHY:
--   Brand owns ALL data. User is a member with permissions on the Brand.
--   Every connection, fact, and asset is owned by the Brand — not the User.
--   Do NOT depend on live reads from external APIs in dashboards.
--   Pull → Normalize → Store Facts → Build Read Models → Serve UI.
--
-- EXECUTION ORDER: Run schema_v2.sql first, then this file.
-- ═══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 1: RBAC — Roles & Permission Policies
-- Upgrade team_members from text role to full RBAC
-- ──────────────────────────────────────────────────────────────────────────

-- Predefined role catalog per brand
CREATE TABLE IF NOT EXISTS public.brand_roles (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name            text NOT NULL,       -- owner | admin | strategist | content_manager | designer | media_buyer | seo_specialist | sales | support | viewer
    display_name    text,
    is_system_role  boolean DEFAULT false, -- system roles cannot be deleted
    permissions     jsonb NOT NULL DEFAULT '{}',
    -- permissions structure:
    -- {
    --   "brand_hub":     {"view": true,  "edit": false},
    --   "content_ops":   {"view": true,  "create": true, "edit": true, "approve": false, "publish": false, "delete": false},
    --   "social_ops":    {"view": true,  "publish": true},
    --   "ads_ops":       {"view": true,  "create": false, "edit": false},
    --   "seo_ops":       {"view": true,  "edit": false},
    --   "inbox":         {"view": true,  "reply": true},
    --   "crm":           {"view": true,  "edit": false, "export": false},
    --   "analytics":     {"view": true,  "export": false},
    --   "integrations":  {"view": false, "connect": false, "disconnect": false},
    --   "team":          {"view": false, "manage": false},
    --   "billing":       {"view": false, "manage": false},
    --   "settings":      {"view": false, "edit": false}
    -- }
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, name)
);

CREATE INDEX IF NOT EXISTS idx_brand_roles_brand ON public.brand_roles(brand_id);
ALTER TABLE public.brand_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand roles follow brand ownership" ON public.brand_roles FOR ALL
    USING  (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all brand roles" ON public.brand_roles FOR ALL USING (is_super_admin());

CREATE TRIGGER trg_brand_roles_updated_at
    BEFORE UPDATE ON public.brand_roles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed system roles for a brand (call after brand creation)
CREATE OR REPLACE FUNCTION seed_brand_system_roles(p_brand_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.brand_roles (brand_id, name, display_name, is_system_role, permissions) VALUES
    (p_brand_id, 'owner', 'Owner', true, '{
        "brand_hub":{"view":true,"edit":true},
        "content_ops":{"view":true,"create":true,"edit":true,"approve":true,"publish":true,"delete":true},
        "social_ops":{"view":true,"publish":true},
        "ads_ops":{"view":true,"create":true,"edit":true},
        "seo_ops":{"view":true,"edit":true},
        "inbox":{"view":true,"reply":true},
        "crm":{"view":true,"edit":true,"export":true},
        "analytics":{"view":true,"export":true},
        "integrations":{"view":true,"connect":true,"disconnect":true},
        "team":{"view":true,"manage":true},
        "billing":{"view":true,"manage":true},
        "settings":{"view":true,"edit":true}
    }'),
    (p_brand_id, 'admin', 'Admin', true, '{
        "brand_hub":{"view":true,"edit":true},
        "content_ops":{"view":true,"create":true,"edit":true,"approve":true,"publish":true,"delete":false},
        "social_ops":{"view":true,"publish":true},
        "ads_ops":{"view":true,"create":true,"edit":true},
        "seo_ops":{"view":true,"edit":true},
        "inbox":{"view":true,"reply":true},
        "crm":{"view":true,"edit":true,"export":true},
        "analytics":{"view":true,"export":true},
        "integrations":{"view":true,"connect":true,"disconnect":false},
        "team":{"view":true,"manage":true},
        "billing":{"view":true,"manage":false},
        "settings":{"view":true,"edit":false}
    }'),
    (p_brand_id, 'content_manager', 'Content Manager', true, '{
        "brand_hub":{"view":true,"edit":false},
        "content_ops":{"view":true,"create":true,"edit":true,"approve":false,"publish":false,"delete":false},
        "social_ops":{"view":true,"publish":false},
        "ads_ops":{"view":false},
        "seo_ops":{"view":true,"edit":false},
        "inbox":{"view":true,"reply":false},
        "crm":{"view":false},
        "analytics":{"view":true,"export":false},
        "integrations":{"view":false},
        "team":{"view":false},
        "billing":{"view":false},
        "settings":{"view":false}
    }'),
    (p_brand_id, 'media_buyer', 'Media Buyer', true, '{
        "brand_hub":{"view":true,"edit":false},
        "content_ops":{"view":true,"create":false,"edit":false},
        "social_ops":{"view":true,"publish":false},
        "ads_ops":{"view":true,"create":true,"edit":true},
        "seo_ops":{"view":false},
        "inbox":{"view":false},
        "crm":{"view":false},
        "analytics":{"view":true,"export":true},
        "integrations":{"view":false},
        "team":{"view":false},
        "billing":{"view":false},
        "settings":{"view":false}
    }'),
    (p_brand_id, 'viewer', 'Viewer', true, '{
        "brand_hub":{"view":true,"edit":false},
        "content_ops":{"view":true},
        "social_ops":{"view":true,"publish":false},
        "ads_ops":{"view":true},
        "seo_ops":{"view":true},
        "inbox":{"view":false},
        "crm":{"view":false},
        "analytics":{"view":true,"export":false},
        "integrations":{"view":false},
        "team":{"view":false},
        "billing":{"view":false},
        "settings":{"view":false}
    }')
    ON CONFLICT (brand_id, name) DO NOTHING;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 2: BRAND ASSETS
-- Every external property / account is an asset owned by the Brand
-- ──────────────────────────────────────────────────────────────────────────

-- Websites / Domains
CREATE TABLE IF NOT EXISTS public.brand_websites (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    url             text NOT NULL,
    domain          text NOT NULL,
    platform        text,           -- wordpress | shopify | webflow | custom
    cms_version     text,
    is_primary      boolean DEFAULT false,
    status          text DEFAULT 'active',  -- active | paused | removed
    metadata        jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, domain)
);

ALTER TABLE public.brand_websites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand websites follow brand ownership" ON public.brand_websites FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE TRIGGER trg_brand_websites_updated_at BEFORE UPDATE ON public.brand_websites
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ad Accounts (Meta, Google Ads, TikTok Ads, Snapchat Ads)
CREATE TABLE IF NOT EXISTS public.brand_ad_accounts (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    provider            text NOT NULL,          -- meta | google_ads | tiktok | snapchat | linkedin | x
    external_account_id text NOT NULL,
    account_name        text,
    currency            text DEFAULT 'USD',
    timezone            text,
    status              text DEFAULT 'active',  -- active | disabled | error
    monthly_budget      numeric(14,2),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, provider, external_account_id)
);

ALTER TABLE public.brand_ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand ad accounts follow brand ownership" ON public.brand_ad_accounts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE TRIGGER trg_brand_ad_accounts_updated_at BEFORE UPDATE ON public.brand_ad_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Analytics Properties (GA4)
CREATE TABLE IF NOT EXISTS public.brand_analytics_properties (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    website_id          uuid REFERENCES public.brand_websites(id) ON DELETE SET NULL,
    provider            text NOT NULL DEFAULT 'ga4',    -- ga4 | ua (legacy)
    property_id         text NOT NULL,                  -- GA4: "properties/123456"
    property_name       text,
    measurement_id      text,                           -- G-XXXXXXX
    is_primary          boolean DEFAULT false,
    status              text DEFAULT 'active',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, provider, property_id)
);

ALTER TABLE public.brand_analytics_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Analytics properties follow brand ownership" ON public.brand_analytics_properties FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE TRIGGER trg_brand_analytics_props_updated_at BEFORE UPDATE ON public.brand_analytics_properties
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Search Console Properties
CREATE TABLE IF NOT EXISTS public.brand_search_console_properties (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    website_id      uuid REFERENCES public.brand_websites(id) ON DELETE SET NULL,
    site_url        text NOT NULL,      -- "https://example.com/" OR "sc-domain:example.com"
    property_type   text DEFAULT 'url', -- url | domain
    permission_level text,              -- siteOwner | siteFullUser | siteRestrictedUser | siteUnverifiedUser
    is_verified     boolean DEFAULT false,
    verified_at     timestamptz,
    status          text DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (brand_id, site_url)
);

ALTER TABLE public.brand_search_console_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Search console props follow brand ownership" ON public.brand_search_console_properties FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE TRIGGER trg_brand_sc_props_updated_at BEFORE UPDATE ON public.brand_search_console_properties
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 3: UNIFIED BRAND CONNECTIONS
-- One table for ALL external provider connections
-- Replaces/extends the fragmented brand_integrations + crm_store_connections
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_connections (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Provider identification
    provider            text NOT NULL,
    -- meta | instagram | google | ga4 | search_console | google_ads
    -- wordpress | woocommerce | shopify | x | linkedin | tiktok | snapchat | youtube

    provider_version    text DEFAULT 'v1',     -- API version in use

    -- Linked assets (optional - links to specific properties)
    ad_account_id       uuid REFERENCES public.brand_ad_accounts(id) ON DELETE SET NULL,
    analytics_property_id uuid REFERENCES public.brand_analytics_properties(id) ON DELETE SET NULL,
    search_console_property_id uuid REFERENCES public.brand_search_console_properties(id) ON DELETE SET NULL,
    website_id          uuid REFERENCES public.brand_websites(id) ON DELETE SET NULL,
    social_account_id   uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,

    -- External identifiers
    external_account_id text,           -- page_id / account_id / property_id
    external_account_name text,

    -- OAuth / Credentials (store encrypted; raw tokens for server-side use)
    access_token        text,           -- encrypted at application layer
    refresh_token       text,
    token_expires_at    timestamptz,
    scopes              text[],         -- granted OAuth scopes

    -- Connection health
    status              text NOT NULL DEFAULT 'connected',
    -- connected | expired | needs_reauth | paused | error | disconnected

    sync_health         text DEFAULT 'healthy',
    -- healthy | degraded | failing | unknown

    last_error          text,
    last_error_at       timestamptz,
    error_count         integer DEFAULT 0,

    -- Sync tracking
    last_sync_at        timestamptz,
    last_successful_sync_at timestamptz,
    sync_frequency_minutes integer DEFAULT 60,

    -- Feature flags per connection
    sync_history        boolean DEFAULT true,
    sync_history_days   integer DEFAULT 90,

    metadata            jsonb DEFAULT '{}',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    UNIQUE (brand_id, provider, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_connections_brand    ON public.brand_connections(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_connections_provider ON public.brand_connections(brand_id, provider);
CREATE INDEX IF NOT EXISTS idx_brand_connections_status   ON public.brand_connections(status);

ALTER TABLE public.brand_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand connections follow brand ownership" ON public.brand_connections FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all brand connections" ON public.brand_connections FOR ALL USING (is_super_admin());

CREATE TRIGGER trg_brand_connections_updated_at
    BEFORE UPDATE ON public.brand_connections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 4: SYNC INFRASTRUCTURE
-- Track state of every sync operation across all providers
-- ──────────────────────────────────────────────────────────────────────────

-- Sync Cursors — track "where we left off" per connection + data type
CREATE TABLE IF NOT EXISTS public.sync_cursors (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id       uuid NOT NULL REFERENCES public.brand_connections(id) ON DELETE CASCADE,

    data_type           text NOT NULL,
    -- social_posts | seo_pages | seo_queries | url_inspection
    -- analytics_pages | ad_spend | ad_creatives | orders | customers

    -- Cursor state
    last_synced_date    date,           -- "2025-12-31" — for date-ranged APIs
    last_synced_id      text,           -- last record ID processed
    next_page_token     text,           -- pagination cursor from API
    cursor_metadata     jsonb DEFAULT '{}', -- provider-specific extra state

    -- Stats
    total_records_synced bigint DEFAULT 0,
    last_sync_status    text DEFAULT 'idle',  -- idle | running | completed | failed
    last_sync_error     text,
    last_sync_at        timestamptz,
    last_successful_sync_at timestamptz,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    UNIQUE (connection_id, data_type)
);

CREATE INDEX IF NOT EXISTS idx_sync_cursors_brand      ON public.sync_cursors(brand_id);
CREATE INDEX IF NOT EXISTS idx_sync_cursors_connection ON public.sync_cursors(connection_id);

ALTER TABLE public.sync_cursors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync cursors follow brand ownership" ON public.sync_cursors FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all sync cursors" ON public.sync_cursors FOR ALL USING (is_super_admin());

CREATE TRIGGER trg_sync_cursors_updated_at
    BEFORE UPDATE ON public.sync_cursors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- General Sync Jobs (all providers, not just CRM)
CREATE TABLE IF NOT EXISTS public.sync_jobs (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id       uuid REFERENCES public.brand_connections(id) ON DELETE SET NULL,
    cursor_id           uuid REFERENCES public.sync_cursors(id) ON DELETE SET NULL,

    job_type            text NOT NULL DEFAULT 'incremental',
    -- full_initial | incremental | on_demand | webhook_triggered

    data_type           text NOT NULL,
    status              text NOT NULL DEFAULT 'pending',
    -- pending | queued | running | completed | failed | cancelled

    -- Date range for this job
    sync_from           date,
    sync_to             date,

    -- Progress
    records_fetched     integer DEFAULT 0,
    records_inserted    integer DEFAULT 0,
    records_updated     integer DEFAULT 0,
    records_skipped     integer DEFAULT 0,
    records_errored     integer DEFAULT 0,

    -- Error details
    error_message       text,
    error_details       jsonb DEFAULT '{}',

    -- Timing
    queued_at           timestamptz DEFAULT now(),
    started_at          timestamptz,
    completed_at        timestamptz,
    duration_seconds    integer GENERATED ALWAYS AS
        (EXTRACT(EPOCH FROM (completed_at - started_at))::integer) STORED,

    triggered_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_brand      ON public.sync_jobs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_connection ON public.sync_jobs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status     ON public.sync_jobs(status);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync jobs follow brand ownership" ON public.sync_jobs FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all sync jobs" ON public.sync_jobs FOR ALL USING (is_super_admin());

-- General Webhook Events (all providers)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid REFERENCES public.brands(id) ON DELETE SET NULL,
    connection_id   uuid REFERENCES public.brand_connections(id) ON DELETE SET NULL,

    provider        text NOT NULL,
    event_type      text NOT NULL,
    external_id     text,               -- provider's event ID (for deduplication)
    payload         jsonb NOT NULL DEFAULT '{}',
    raw_headers     jsonb DEFAULT '{}',

    -- Processing
    status          text DEFAULT 'pending',  -- pending | processing | processed | failed | ignored
    processed_at    timestamptz,
    error           text,
    retry_count     integer DEFAULT 0,

    received_at     timestamptz NOT NULL DEFAULT now(),

    UNIQUE (provider, external_id)   -- dedup by provider + event ID
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_brand    ON public.webhook_events(brand_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status   ON public.webhook_events(status);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Webhook events follow brand ownership" ON public.webhook_events FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all webhook events" ON public.webhook_events FOR ALL USING (is_super_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 5: SOCIAL POST FACTS
-- Historical content pulled from Meta / IG / LinkedIn / X / TikTok
-- Built from: Pages API, IG Media, LinkedIn UGC Posts, X Timeline
-- Used for: Historical Calendar, Content Rhythm, Best Times, Seasonal Patterns
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_post_facts (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id           uuid REFERENCES public.brand_connections(id) ON DELETE SET NULL,
    social_account_id       uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,

    -- Identification
    platform                text NOT NULL,
    -- facebook | instagram | x | linkedin | tiktok | youtube | snapchat

    channel_id              text NOT NULL,      -- page_id / account_id
    external_post_id        text NOT NULL,
    permalink               text,

    -- Content
    post_type               text,
    -- image | video | reel | story | carousel | text | link | live | short
    caption                 text,
    media_urls              text[],
    thumbnail_url           text,
    link_url                text,
    hashtags                text[],

    -- Classification
    campaign_label          text,               -- manually or auto-tagged
    content_pillar          text,               -- education | entertainment | promotion | engagement
    language                text,

    -- Timing
    published_at            timestamptz NOT NULL,
    day_of_week             smallint GENERATED ALWAYS AS (EXTRACT(DOW FROM published_at)::smallint) STORED,
    hour_of_day             smallint GENERATED ALWAYS AS (EXTRACT(HOUR FROM published_at)::smallint) STORED,

    -- Engagement snapshot at time of pull
    likes_count             integer DEFAULT 0,
    comments_count          integer DEFAULT 0,
    shares_count            integer DEFAULT 0,
    saves_count             integer DEFAULT 0,
    reach                   integer DEFAULT 0,
    impressions             integer DEFAULT 0,
    video_views             integer DEFAULT 0,
    video_view_rate         numeric(6,4),       -- views / impressions
    engagement_rate         numeric(6,4),       -- (likes+comments+shares) / reach
    link_clicks             integer DEFAULT 0,

    -- Status
    is_deleted              boolean DEFAULT false,
    pulled_at               timestamptz NOT NULL DEFAULT now(),
    last_refreshed_at       timestamptz,

    UNIQUE (brand_id, platform, external_post_id)
);

CREATE INDEX IF NOT EXISTS idx_spf_brand_platform   ON public.social_post_facts(brand_id, platform);
CREATE INDEX IF NOT EXISTS idx_spf_published_at     ON public.social_post_facts(brand_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_spf_channel          ON public.social_post_facts(channel_id);
CREATE INDEX IF NOT EXISTS idx_spf_content_pillar   ON public.social_post_facts(brand_id, content_pillar);

ALTER TABLE public.social_post_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social post facts follow brand ownership" ON public.social_post_facts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all social post facts" ON public.social_post_facts FOR ALL USING (is_super_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 6: SEO FACTS
-- Data from Search Console + URL Inspection
-- ──────────────────────────────────────────────────────────────────────────

-- Page-level performance (Search Console searchAnalytics)
CREATE TABLE IF NOT EXISTS public.seo_page_facts (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id           uuid REFERENCES public.brand_connections(id) ON DELETE SET NULL,
    search_console_property_id uuid REFERENCES public.brand_search_console_properties(id) ON DELETE SET NULL,

    -- Dimensions
    fact_date               date NOT NULL,
    page_url                text NOT NULL,
    country                 text,           -- ISO 3166 alpha-2
    device                  text,           -- DESKTOP | MOBILE | TABLET
    search_type             text DEFAULT 'web',  -- web | image | video | news | discover | googleNews

    -- Metrics
    clicks                  integer DEFAULT 0,
    impressions             integer DEFAULT 0,
    ctr                     numeric(8,6),        -- 0.0 – 1.0
    position                numeric(6,2),        -- average position

    -- Derived (computed on insert)
    opportunity_score       numeric(5,2),        -- impressions * (1 - ctr) → traffic opportunity
    pulled_at               timestamptz NOT NULL DEFAULT now(),

    UNIQUE (brand_id, fact_date, page_url, country, device, search_type)
);

CREATE INDEX IF NOT EXISTS idx_seo_page_brand_date  ON public.seo_page_facts(brand_id, fact_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_page_url         ON public.seo_page_facts(brand_id, page_url, fact_date DESC);

ALTER TABLE public.seo_page_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SEO page facts follow brand ownership" ON public.seo_page_facts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all seo page facts" ON public.seo_page_facts FOR ALL USING (is_super_admin());

-- Query-level performance (Search Console searchAnalytics)
CREATE TABLE IF NOT EXISTS public.seo_query_facts (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id           uuid REFERENCES public.brand_connections(id) ON DELETE SET NULL,
    search_console_property_id uuid REFERENCES public.brand_search_console_properties(id) ON DELETE SET NULL,

    -- Dimensions
    fact_date               date NOT NULL,
    query                   text NOT NULL,
    page_url                text,
    country                 text,
    device                  text,
    search_type             text DEFAULT 'web',

    -- Metrics
    clicks                  integer DEFAULT 0,
    impressions             integer DEFAULT 0,
    ctr                     numeric(8,6),
    position                numeric(6,2),

    -- Classification (for reporting)
    query_intent            text,    -- informational | navigational | transactional | commercial
    is_branded              boolean DEFAULT false,
    topic_cluster           text,

    pulled_at               timestamptz NOT NULL DEFAULT now(),

    UNIQUE (brand_id, fact_date, query, page_url, country, device, search_type)
);

CREATE INDEX IF NOT EXISTS idx_seo_query_brand_date ON public.seo_query_facts(brand_id, fact_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_query_text        ON public.seo_query_facts(brand_id, query);
CREATE INDEX IF NOT EXISTS idx_seo_query_position    ON public.seo_query_facts(brand_id, position);

ALTER TABLE public.seo_query_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SEO query facts follow brand ownership" ON public.seo_query_facts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all seo query facts" ON public.seo_query_facts FOR ALL USING (is_super_admin());

-- URL Inspection Snapshots (Google URL Inspection API)
CREATE TABLE IF NOT EXISTS public.url_inspection_facts (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id           uuid REFERENCES public.brand_connections(id) ON DELETE SET NULL,
    search_console_property_id uuid REFERENCES public.brand_search_console_properties(id) ON DELETE SET NULL,

    url                     text NOT NULL,
    inspection_date         date NOT NULL DEFAULT CURRENT_DATE,

    -- Index coverage
    verdict                 text,    -- PASS | PARTIAL | FAIL | NEUTRAL
    index_status            text,    -- INDEXED | NOT_INDEXED | EXCLUDED
    coverage_state          text,    -- e.g. "Submitted and indexed", "Crawled - currently not indexed"

    -- Canonicalization
    canonical_url           text,    -- Google's chosen canonical
    user_canonical_url      text,    -- declared by page

    -- Crawl info
    last_crawl_time         timestamptz,
    crawl_allowed           boolean,
    page_fetch_state        text,    -- SUCCESSFUL | SOFT_404 | BLOCKED_ROBOTS | NOT_FOUND | SERVER_ERROR

    -- Rich results
    rich_result_types       text[],
    mobile_usability        text,    -- MOBILE_FRIENDLY | NOT_MOBILE_FRIENDLY

    raw_response            jsonb DEFAULT '{}',
    pulled_at               timestamptz NOT NULL DEFAULT now(),

    UNIQUE (brand_id, url, inspection_date)
);

CREATE INDEX IF NOT EXISTS idx_url_inspection_brand ON public.url_inspection_facts(brand_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_url_inspection_url   ON public.url_inspection_facts(brand_id, url);

ALTER TABLE public.url_inspection_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "URL inspection facts follow brand ownership" ON public.url_inspection_facts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 7: ANALYTICS FACTS (GA4)
-- Landing page behavior from Google Analytics Data API
-- Used for: Funnel analysis, Content performance, Revenue attribution
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analytics_page_facts (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id           uuid REFERENCES public.brand_connections(id) ON DELETE SET NULL,
    analytics_property_id   uuid REFERENCES public.brand_analytics_properties(id) ON DELETE SET NULL,

    -- Dimensions
    fact_date               date NOT NULL,
    landing_page            text NOT NULL,      -- pagePath
    session_source          text,               -- organic | paid | direct | referral | email
    session_medium          text,               -- search | cpc | organic | none | referral
    session_campaign        text,
    country                 text,
    device_category         text,               -- desktop | mobile | tablet

    -- Metrics
    sessions                integer DEFAULT 0,
    engaged_sessions        integer DEFAULT 0,
    bounced_sessions        integer DEFAULT 0,
    new_users               integer DEFAULT 0,
    total_users             integer DEFAULT 0,
    avg_engagement_time_sec numeric(10,2),
    key_events              integer DEFAULT 0,
    transactions            integer DEFAULT 0,
    revenue                 numeric(14,2) DEFAULT 0,

    -- Derived
    engagement_rate         numeric(6,4) GENERATED ALWAYS AS
        (CASE WHEN sessions > 0 THEN engaged_sessions::numeric / sessions ELSE 0 END) STORED,

    pulled_at               timestamptz NOT NULL DEFAULT now(),

    UNIQUE (brand_id, fact_date, landing_page, session_source, session_medium, country, device_category)
);

CREATE INDEX IF NOT EXISTS idx_apf_brand_date    ON public.analytics_page_facts(brand_id, fact_date DESC);
CREATE INDEX IF NOT EXISTS idx_apf_landing_page  ON public.analytics_page_facts(brand_id, landing_page, fact_date DESC);
CREATE INDEX IF NOT EXISTS idx_apf_source        ON public.analytics_page_facts(brand_id, session_source, fact_date DESC);

ALTER TABLE public.analytics_page_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Analytics page facts follow brand ownership" ON public.analytics_page_facts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all analytics page facts" ON public.analytics_page_facts FOR ALL USING (is_super_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 8: ADS FACTS
-- Pulled from Meta Ads API / Google Ads API / TikTok Ads API
-- Used for: ROAS, CPA, CVR, MER, budget pacing, creative performance
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ad_spend_facts (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id                uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    connection_id           uuid REFERENCES public.brand_connections(id) ON DELETE SET NULL,
    ad_account_id           uuid REFERENCES public.brand_ad_accounts(id) ON DELETE SET NULL,

    -- Dimensions
    fact_date               date NOT NULL,
    provider                text NOT NULL,   -- meta | google_ads | tiktok | snapchat | linkedin
    campaign_id             text,
    campaign_name           text,
    ad_set_id               text,
    ad_set_name             text,
    ad_id                   text,
    ad_name                 text,

    objective               text,           -- awareness | traffic | engagement | leads | sales
    status                  text,           -- active | paused | deleted

    -- Delivery metrics
    impressions             integer DEFAULT 0,
    reach                   integer DEFAULT 0,
    clicks                  integer DEFAULT 0,
    link_clicks             integer DEFAULT 0,
    ctr                     numeric(8,6),       -- clicks / impressions
    cpp                     numeric(14,4),      -- cost per 1000 people reached

    -- Financial metrics
    spend                   numeric(14,4) DEFAULT 0,
    currency                text DEFAULT 'USD',

    -- Conversion metrics
    results                 integer DEFAULT 0,  -- primary result (defined by objective)
    cost_per_result         numeric(14,4),      -- CPA
    purchases               integer DEFAULT 0,
    purchase_value          numeric(14,4) DEFAULT 0,
    roas                    numeric(10,4),      -- purchase_value / spend
    add_to_cart             integer DEFAULT 0,
    initiate_checkout       integer DEFAULT 0,
    leads                   integer DEFAULT 0,
    cost_per_lead           numeric(14,4),

    -- Quality metrics
    frequency               numeric(6,2),       -- impressions / reach
    quality_ranking         text,               -- ABOVE_AVERAGE | AVERAGE | BELOW_AVERAGE_*

    pulled_at               timestamptz NOT NULL DEFAULT now(),

    UNIQUE (brand_id, provider, fact_date, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_brand_date    ON public.ad_spend_facts(brand_id, fact_date DESC);
CREATE INDEX IF NOT EXISTS idx_ads_provider      ON public.ad_spend_facts(brand_id, provider, fact_date DESC);
CREATE INDEX IF NOT EXISTS idx_ads_campaign      ON public.ad_spend_facts(brand_id, campaign_id, fact_date DESC);

ALTER TABLE public.ad_spend_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ad spend facts follow brand ownership" ON public.ad_spend_facts FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all ad spend facts" ON public.ad_spend_facts FOR ALL USING (is_super_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 9: CONTENT MANAGEMENT
-- Versioned content items with calendar slots
-- Brand-owned — not tied to a specific user
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_items (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Classification
    title               text,
    content_type        text NOT NULL DEFAULT 'social_post',
    -- social_post | blog_post | email | ad_creative | story | reel | short | landing_page

    platform            text,           -- target platform (if single-platform)
    platforms           text[],         -- for multi-platform content

    content_pillar      text,           -- education | entertainment | promotion | engagement
    campaign_label      text,

    -- Content body (versioned — see content_versions)
    current_version_id  uuid,           -- FK added after content_versions exists

    -- Status & Approval
    status              text NOT NULL DEFAULT 'draft',
    -- draft | in_review | approved | scheduled | published | rejected | archived

    -- Ownership (who in the team, not the brand owner)
    created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to         uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Scheduling
    target_publish_at   timestamptz,
    published_at        timestamptz,

    -- Linked post fact (once published and synced back)
    linked_post_fact_id uuid REFERENCES public.social_post_facts(id) ON DELETE SET NULL,

    -- Tags
    tags                text[],
    metadata            jsonb DEFAULT '{}',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_items_brand   ON public.content_items(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_content_items_publish ON public.content_items(brand_id, target_publish_at);
CREATE INDEX IF NOT EXISTS idx_content_items_status  ON public.content_items(status, brand_id);

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Content items follow brand ownership" ON public.content_items FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
CREATE POLICY "Super admin all content items" ON public.content_items FOR ALL USING (is_super_admin());

CREATE TRIGGER trg_content_items_updated_at
    BEFORE UPDATE ON public.content_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Versioned content body
CREATE TABLE IF NOT EXISTS public.content_versions (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_item_id     uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    version_number      integer NOT NULL DEFAULT 1,

    -- Body
    caption             text,
    body                text,           -- for long-form content
    headline            text,
    cta_text            text,
    media_urls          text[],
    hashtags            text[],
    emojis              text[],

    -- AI generation info
    ai_generated        boolean DEFAULT false,
    ai_model            text,
    ai_prompt_used      text,
    generation_params   jsonb DEFAULT '{}',

    -- Review
    review_status       text DEFAULT 'pending',  -- pending | approved | rejected
    reviewed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at         timestamptz,
    review_notes        text,

    created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_versions_item ON public.content_versions(content_item_id, version_number DESC);

ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Content versions follow brand ownership" ON public.content_versions FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- Add FK after both tables exist
ALTER TABLE public.content_items
    ADD COLUMN IF NOT EXISTS current_version_id uuid REFERENCES public.content_versions(id) ON DELETE SET NULL;

-- Calendar Slots — planning grid
CREATE TABLE IF NOT EXISTS public.calendar_slots (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- Time
    slot_date           date NOT NULL,
    slot_time           time,
    slot_datetime       timestamptz,

    -- Classification
    platform            text,
    content_pillar      text,
    content_type        text,

    -- Linked item (if planned)
    content_item_id     uuid REFERENCES public.content_items(id) ON DELETE SET NULL,

    -- State
    status              text DEFAULT 'empty',  -- empty | planned | approved | published | missed

    notes               text,
    color_label         text,           -- UI color code

    created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_slots_brand_date ON public.calendar_slots(brand_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_calendar_slots_platform   ON public.calendar_slots(brand_id, platform, slot_date);

ALTER TABLE public.calendar_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Calendar slots follow brand ownership" ON public.calendar_slots FOR ALL
    USING (brand_id = ANY(crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE TRIGGER trg_calendar_slots_updated_at
    BEFORE UPDATE ON public.calendar_slots
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- MODULE 10: USEFUL VIEWS (Read Models)
-- Pre-built aggregates for dashboards — no live API calls needed
-- ──────────────────────────────────────────────────────────────────────────

-- Active brand connections overview
CREATE OR REPLACE VIEW public.v_brand_connections_overview AS
SELECT
    bc.brand_id,
    bc.provider,
    bc.status,
    bc.sync_health,
    bc.last_sync_at,
    bc.last_successful_sync_at,
    sc.last_sync_status AS cursor_status,
    sc.total_records_synced,
    bc.error_count,
    bc.last_error
FROM public.brand_connections bc
LEFT JOIN public.sync_cursors sc ON sc.connection_id = bc.id AND sc.data_type = bc.provider
ORDER BY bc.brand_id, bc.provider;

-- Social content calendar (historical + planned)
CREATE OR REPLACE VIEW public.v_content_calendar AS
SELECT
    COALESCE(cs.slot_date, spf.published_at::date)          AS calendar_date,
    COALESCE(cs.platform, spf.platform)                      AS platform,
    COALESCE(cs.status, CASE WHEN spf.id IS NOT NULL THEN 'published' ELSE NULL END) AS status,
    cs.id                                                     AS slot_id,
    ci.id                                                     AS content_item_id,
    ci.status                                                 AS item_status,
    spf.id                                                    AS post_fact_id,
    COALESCE(cv.caption, spf.caption)                        AS caption,
    COALESCE(ci.content_pillar, spf.content_pillar)          AS content_pillar,
    spf.likes_count,
    spf.comments_count,
    spf.engagement_rate,
    spf.reach,
    COALESCE(cs.brand_id, spf.brand_id)                      AS brand_id
FROM public.calendar_slots cs
FULL OUTER JOIN public.social_post_facts spf
    ON cs.brand_id = spf.brand_id
    AND cs.slot_date = spf.published_at::date
    AND cs.platform  = spf.platform
LEFT JOIN public.content_items ci ON ci.id = cs.content_item_id
LEFT JOIN public.content_versions cv ON cv.id = ci.current_version_id;

-- SEO top pages summary (last 30 days)
CREATE OR REPLACE VIEW public.v_seo_top_pages AS
SELECT
    brand_id,
    page_url,
    SUM(clicks)                                         AS total_clicks,
    SUM(impressions)                                    AS total_impressions,
    ROUND(AVG(position)::numeric, 1)                    AS avg_position,
    ROUND((SUM(clicks)::numeric / NULLIF(SUM(impressions),0))::numeric, 4) AS avg_ctr,
    COUNT(DISTINCT fact_date)                           AS days_with_data
FROM public.seo_page_facts
WHERE fact_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY brand_id, page_url
ORDER BY total_clicks DESC;

-- Ads performance summary (last 30 days)
CREATE OR REPLACE VIEW public.v_ads_performance AS
SELECT
    brand_id,
    provider,
    SUM(spend)                                          AS total_spend,
    SUM(impressions)                                    AS total_impressions,
    SUM(clicks)                                         AS total_clicks,
    SUM(purchases)                                      AS total_purchases,
    SUM(purchase_value)                                 AS total_revenue,
    ROUND((SUM(purchase_value) / NULLIF(SUM(spend),0))::numeric, 2) AS roas,
    ROUND((SUM(spend) / NULLIF(SUM(purchases),0))::numeric, 2)      AS cpa,
    ROUND((SUM(clicks)::numeric / NULLIF(SUM(impressions),0))::numeric, 4) AS avg_ctr,
    COUNT(DISTINCT fact_date)                           AS days_with_data
FROM public.ad_spend_facts
WHERE fact_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY brand_id, provider
ORDER BY total_spend DESC;

-- ──────────────────────────────────────────────────────────────────────────
-- END OF schema_v3_business_logic.sql
-- ══════════════════════════════════════════════════════════════════════════
-- EXECUTION SUMMARY:
-- New tables added:       14
-- New views added:         4
-- New functions added:     1 (seed_brand_system_roles)
-- All tables: brand-owned, RLS-enabled, no direct user ownership of data
-- ──────────────────────────────────────────────────────────────────────────
