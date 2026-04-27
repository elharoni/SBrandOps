-- ============================================================
-- Migration 035: Integration System — Sync Jobs, Inbox, Ads, Products
-- ============================================================
-- Adds tables required for the full integration pipeline:
--   sync_jobs       — tracks every data-sync task (cursor, status, idempotency)
--   sync_logs       — per-record log entries for a sync job
--   webhook_events  — raw incoming webhook payloads (deduplication + processing)
--   social_messages — unified inbox: messages, comments, mentions from all platforms
--   ad_campaigns    — campaign records from Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads
--   ad_insights     — daily performance metrics per campaign/adset/ad
--   products        — product catalog from Shopify / WooCommerce
-- ============================================================

-- ── sync_jobs ─────────────────────────────────────────────────────────────────
-- One row per sync task execution (scheduled, manual, or webhook-triggered).
-- The cursor column stores the last-fetched page/timestamp for incremental sync.

CREATE TABLE IF NOT EXISTS sync_jobs (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id          UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    provider          TEXT        NOT NULL,          -- 'facebook' | 'google_ads' | 'shopify' …
    job_type          TEXT        NOT NULL,          -- 'posts' | 'messages' | 'ads' | 'orders' | 'products' | 'analytics'
    social_account_id UUID        REFERENCES social_accounts(id) ON DELETE SET NULL,
    status            TEXT        NOT NULL DEFAULT 'pending',
    -- status: pending | running | completed | failed | partial
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    records_synced    INTEGER     NOT NULL DEFAULT 0,
    records_failed    INTEGER     NOT NULL DEFAULT 0,
    cursor            TEXT,                          -- pagination cursor / last-fetched timestamp
    idempotency_key   TEXT        UNIQUE,            -- brand_id||provider||job_type||date
    triggered_by      TEXT        NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'manual' | 'webhook'
    error_message     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_brand        ON sync_jobs (brand_id, provider, job_type);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status       ON sync_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_idempotency  ON sync_jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_jobs' AND policyname = 'sync_jobs_brand_members') THEN
        CREATE POLICY "sync_jobs_brand_members"
            ON sync_jobs FOR SELECT
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── sync_logs ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_logs (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id    UUID        NOT NULL REFERENCES sync_jobs(id) ON DELETE CASCADE,
    level     TEXT        NOT NULL DEFAULT 'info',   -- 'info' | 'warning' | 'error'
    message   TEXT        NOT NULL,
    data      JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_job       ON sync_logs (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_level     ON sync_logs (level, created_at DESC);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_logs' AND policyname = 'sync_logs_brand_members') THEN
        CREATE POLICY "sync_logs_brand_members"
            ON sync_logs FOR SELECT
            USING (
                job_id IN (
                    SELECT id FROM sync_jobs
                    WHERE brand_id IN (
                        SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

-- ── webhook_events ────────────────────────────────────────────────────────────
-- Raw webhook payloads from all platforms. Deduplication via (provider, event_id).

CREATE TABLE IF NOT EXISTS webhook_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id     UUID        REFERENCES brands(id) ON DELETE SET NULL,
    provider     TEXT        NOT NULL,
    event_type   TEXT        NOT NULL,     -- 'messages', 'feed', 'orders/create', …
    event_id     TEXT,                     -- platform-assigned dedup ID
    payload      JSONB       NOT NULL DEFAULT '{}',
    processed    BOOLEAN     NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT webhook_events_provider_event_uniq UNIQUE (provider, event_id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_brand      ON webhook_events (brand_id, provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events (processed, received_at DESC) WHERE NOT processed;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_events' AND policyname = 'webhook_events_brand_members') THEN
        CREATE POLICY "webhook_events_brand_members"
            ON webhook_events FOR SELECT
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── social_messages ───────────────────────────────────────────────────────────
-- Unified inbox: direct messages, comments, and mentions from all platforms.

CREATE TABLE IF NOT EXISTS social_messages (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id              UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    social_account_id     UUID        REFERENCES social_accounts(id) ON DELETE SET NULL,
    provider              TEXT        NOT NULL,   -- 'facebook' | 'instagram' | 'youtube' | …
    message_type          TEXT        NOT NULL DEFAULT 'message',
    -- message_type: 'message' | 'comment' | 'mention' | 'review' | 'reply'
    external_thread_id    TEXT        NOT NULL,
    external_message_id   TEXT        NOT NULL,
    external_post_id      TEXT,                  -- parent post if comment
    sender_name           TEXT,
    sender_external_id    TEXT,
    sender_avatar_url     TEXT,
    content               TEXT        NOT NULL DEFAULT '',
    media_urls            TEXT[]      DEFAULT '{}',
    is_read               BOOLEAN     NOT NULL DEFAULT false,
    is_replied            BOOLEAN     NOT NULL DEFAULT false,
    sentiment             TEXT,       -- 'positive' | 'neutral' | 'negative'
    intent                TEXT,       -- 'buying_intent' | 'inquiry' | 'complaint' | 'spam' | 'positive_feedback'
    priority_score        INTEGER     NOT NULL DEFAULT 0 CHECK (priority_score BETWEEN 0 AND 100),
    crm_customer_id       UUID        REFERENCES crm_customers(id) ON DELETE SET NULL,
    assigned_to           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    internal_note         TEXT,
    received_at           TIMESTAMPTZ NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT social_messages_platform_thread_msg_uniq
        UNIQUE (provider, external_thread_id, external_message_id)
);

CREATE INDEX IF NOT EXISTS idx_social_messages_brand       ON social_messages (brand_id, provider, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_messages_unread      ON social_messages (brand_id, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_social_messages_intent      ON social_messages (brand_id, intent) WHERE intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_messages_assigned    ON social_messages (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_messages_crm         ON social_messages (crm_customer_id) WHERE crm_customer_id IS NOT NULL;

ALTER TABLE social_messages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'social_messages' AND policyname = 'social_messages_brand_members') THEN
        CREATE POLICY "social_messages_brand_members"
            ON social_messages FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── ad_campaigns ──────────────────────────────────────────────────────────────
-- Campaign-level records from Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads.

CREATE TABLE IF NOT EXISTS ad_campaigns (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id             UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    provider             TEXT        NOT NULL,   -- 'meta' | 'google_ads' | 'tiktok_ads' | 'linkedin_ads'
    external_campaign_id TEXT        NOT NULL,
    name                 TEXT        NOT NULL,
    status               TEXT,                   -- 'active' | 'paused' | 'completed' | 'draft'
    objective            TEXT,
    budget_daily         NUMERIC(12,2),
    budget_lifetime      NUMERIC(12,2),
    budget_currency      TEXT        DEFAULT 'SAR',
    start_date           DATE,
    end_date             DATE,
    ad_account_id        TEXT,                   -- platform ad account ID
    metadata             JSONB       DEFAULT '{}',
    synced_at            TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ad_campaigns_brand_provider_campaign_uniq
        UNIQUE (brand_id, provider, external_campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_brand    ON ad_campaigns (brand_id, provider, status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_synced   ON ad_campaigns (synced_at);

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ad_campaigns' AND policyname = 'ad_campaigns_brand_members') THEN
        CREATE POLICY "ad_campaigns_brand_members"
            ON ad_campaigns FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── ad_insights ───────────────────────────────────────────────────────────────
-- Daily performance metrics. One row per object (campaign/adset/ad) per day.

CREATE TABLE IF NOT EXISTS ad_insights (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id             UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    campaign_id          UUID        REFERENCES ad_campaigns(id) ON DELETE SET NULL,
    provider             TEXT        NOT NULL,
    external_object_id   TEXT        NOT NULL,
    object_type          TEXT        NOT NULL DEFAULT 'campaign',  -- 'campaign' | 'adset' | 'ad'
    date                 DATE        NOT NULL,
    spend                NUMERIC(12,2) NOT NULL DEFAULT 0,
    impressions          INTEGER     NOT NULL DEFAULT 0,
    clicks               INTEGER     NOT NULL DEFAULT 0,
    reach                INTEGER     NOT NULL DEFAULT 0,
    conversions          INTEGER     NOT NULL DEFAULT 0,
    conversion_value     NUMERIC(12,2) NOT NULL DEFAULT 0,
    ctr                  NUMERIC(8,4),   -- click-through rate
    cpc                  NUMERIC(10,4),  -- cost per click
    cpm                  NUMERIC(10,4),  -- cost per mille
    cpa                  NUMERIC(10,4),  -- cost per acquisition
    roas                 NUMERIC(8,4),   -- return on ad spend
    extra_metrics        JSONB       DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ad_insights_brand_provider_object_date_uniq
        UNIQUE (brand_id, provider, external_object_id, object_type, date)
);

CREATE INDEX IF NOT EXISTS idx_ad_insights_brand_date  ON ad_insights (brand_id, provider, date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_insights_campaign    ON ad_insights (campaign_id, date DESC);

ALTER TABLE ad_insights ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ad_insights' AND policyname = 'ad_insights_brand_members') THEN
        CREATE POLICY "ad_insights_brand_members"
            ON ad_insights FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── products ──────────────────────────────────────────────────────────────────
-- Product catalog from Shopify and WooCommerce.

CREATE TABLE IF NOT EXISTS products (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id             UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    provider             TEXT        NOT NULL,   -- 'shopify' | 'woocommerce'
    external_product_id  TEXT        NOT NULL,
    title                TEXT        NOT NULL,
    description          TEXT,
    price                NUMERIC(12,2),
    compare_price        NUMERIC(12,2),
    sku                  TEXT,
    stock_quantity       INTEGER,
    status               TEXT        DEFAULT 'active', -- 'active' | 'draft' | 'archived'
    images               TEXT[]      DEFAULT '{}',
    categories           TEXT[]      DEFAULT '{}',
    tags                 TEXT[]      DEFAULT '{}',
    metadata             JSONB       DEFAULT '{}',
    synced_at            TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT products_brand_provider_product_uniq
        UNIQUE (brand_id, provider, external_product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_brand    ON products (brand_id, provider, status);
CREATE INDEX IF NOT EXISTS idx_products_sku      ON products (brand_id, sku) WHERE sku IS NOT NULL;

CREATE OR REPLACE FUNCTION products_search_vector(p products) RETURNS tsvector AS $$
    SELECT to_tsvector('simple', unaccent(coalesce(p.title,'') || ' ' || coalesce(p.sku,'')));
$$ LANGUAGE sql IMMUTABLE;

CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(products_search_vector(products.*));

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_brand_members') THEN
        CREATE POLICY "products_brand_members"
            ON products FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── integration_health_snapshots ─────────────────────────────────────────────
-- Cache table for integration health scores (written by monitor-health cron).

CREATE TABLE IF NOT EXISTS integration_health_snapshots (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id                UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    provider                TEXT        NOT NULL,
    social_account_id       UUID        REFERENCES social_accounts(id) ON DELETE SET NULL,
    health_score            INTEGER     CHECK (health_score BETWEEN 0 AND 100),
    token_healthy           BOOLEAN     DEFAULT true,
    webhook_healthy         BOOLEAN     DEFAULT false,
    last_successful_sync    TIMESTAMPTZ,
    pending_permissions     TEXT[]      DEFAULT '{}',
    error_count_24h         INTEGER     DEFAULT 0,
    snapshot_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT integration_health_brand_provider_uniq
        UNIQUE (brand_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_health_brand ON integration_health_snapshots (brand_id, health_score);

ALTER TABLE integration_health_snapshots ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_health_snapshots' AND policyname = 'integration_health_brand_members') THEN
        CREATE POLICY "integration_health_brand_members"
            ON integration_health_snapshots FOR SELECT
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['sync_jobs', 'social_messages', 'ad_campaigns', 'products'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            t, t
        );
    END LOOP;
END $$;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE sync_jobs IS
    'Tracks every data-sync task. Use idempotency_key to prevent duplicate jobs. cursor stores last-fetched pagination state.';
COMMENT ON TABLE sync_logs IS
    'Detailed per-step log entries for a sync_job. Used by the Sync Logs panel in the Integration Center.';
COMMENT ON TABLE webhook_events IS
    'Raw webhook payloads from all connected platforms. Deduplication via (provider, event_id). Processed asynchronously.';
COMMENT ON TABLE social_messages IS
    'Unified inbox table: direct messages, comments, and mentions from Facebook, Instagram, YouTube, TikTok, LinkedIn, X.';
COMMENT ON TABLE ad_campaigns IS
    'Campaign records from Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads. One row per campaign per platform.';
COMMENT ON TABLE ad_insights IS
    'Daily performance metrics per ad object. UNIQUE on (brand_id, provider, external_object_id, object_type, date) for safe upsert.';
COMMENT ON TABLE products IS
    'Product catalog synced from Shopify and WooCommerce. Feeds CRM cross-sell and ecommerce analytics.';
