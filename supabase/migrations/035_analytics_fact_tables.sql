-- ============================================================
-- Migration 035: Analytics Fact Tables + Sync Jobs
-- ============================================================
-- analytics_page_facts : GA4 daily metrics per landing page
-- seo_page_facts       : Search Console daily metrics per page/query
-- ad_campaign_facts    : Meta Ads / Google Ads campaign daily metrics
-- analytics_sync_jobs  : Audit log for every sync run (status + errors)
-- ============================================================

-- ── analytics_page_facts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_page_facts (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id                UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    connection_id           UUID        NOT NULL REFERENCES brand_connections(id) ON DELETE CASCADE,
    analytics_property_id   TEXT        NOT NULL DEFAULT '',
    fact_date               DATE        NOT NULL,
    landing_page            TEXT        NOT NULL DEFAULT '',
    sessions                INTEGER     NOT NULL DEFAULT 0,
    engaged_sessions        INTEGER     NOT NULL DEFAULT 0,
    bounced_sessions        INTEGER     NOT NULL DEFAULT 0,
    new_users               INTEGER     NOT NULL DEFAULT 0,
    key_events              INTEGER     NOT NULL DEFAULT 0,
    transactions            INTEGER     NOT NULL DEFAULT 0,
    revenue                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    avg_engagement_time_sec NUMERIC(8,2)  NOT NULL DEFAULT 0,
    pulled_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT analytics_page_facts_uniq
        UNIQUE (brand_id, connection_id, fact_date, landing_page)
);

CREATE INDEX IF NOT EXISTS idx_apf_brand_date
    ON analytics_page_facts (brand_id, fact_date DESC);

CREATE INDEX IF NOT EXISTS idx_apf_connection_date
    ON analytics_page_facts (connection_id, fact_date DESC);

-- ── seo_page_facts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_page_facts (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id                    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    connection_id               UUID        NOT NULL REFERENCES brand_connections(id) ON DELETE CASCADE,
    search_console_property_id  TEXT        NOT NULL DEFAULT '',
    fact_date                   DATE        NOT NULL,
    page_url                    TEXT        NOT NULL DEFAULT '',
    query                       TEXT        NOT NULL DEFAULT '',
    clicks                      INTEGER     NOT NULL DEFAULT 0,
    impressions                 INTEGER     NOT NULL DEFAULT 0,
    ctr                         NUMERIC(5,4) NOT NULL DEFAULT 0,
    position                    NUMERIC(6,2) NOT NULL DEFAULT 0,
    pulled_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT seo_page_facts_uniq
        UNIQUE (brand_id, connection_id, fact_date, page_url, query)
);

CREATE INDEX IF NOT EXISTS idx_spf_brand_date
    ON seo_page_facts (brand_id, fact_date DESC);

CREATE INDEX IF NOT EXISTS idx_spf_connection_date
    ON seo_page_facts (connection_id, fact_date DESC);

-- ── ad_campaign_facts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_campaign_facts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    connection_id   UUID        REFERENCES brand_connections(id) ON DELETE SET NULL,
    provider        TEXT        NOT NULL,  -- meta_ads | google_ads
    campaign_id     TEXT        NOT NULL,
    ad_account_id   TEXT        NOT NULL DEFAULT '',
    campaign_name   TEXT        NOT NULL DEFAULT '',
    fact_date       DATE        NOT NULL,
    impressions     INTEGER     NOT NULL DEFAULT 0,
    reach           INTEGER     NOT NULL DEFAULT 0,
    clicks          INTEGER     NOT NULL DEFAULT 0,
    spend           NUMERIC(12,2) NOT NULL DEFAULT 0,
    ctr             NUMERIC(8,6)  NOT NULL DEFAULT 0,
    cpc             NUMERIC(10,4),
    cpm             NUMERIC(10,4),
    conversions     NUMERIC(10,2) NOT NULL DEFAULT 0,
    roas            NUMERIC(10,4),
    cpa             NUMERIC(10,4),
    pulled_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ad_campaign_facts_uniq
        UNIQUE (brand_id, provider, fact_date, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_acf_brand_date
    ON ad_campaign_facts (brand_id, fact_date DESC);

CREATE INDEX IF NOT EXISTS idx_acf_brand_provider
    ON ad_campaign_facts (brand_id, provider, fact_date DESC);

-- ── analytics_sync_jobs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_sync_jobs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    provider        TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'success', 'failed')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    error_message   TEXT,
    records_synced  INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_asj_brand_provider
    ON analytics_sync_jobs (brand_id, provider, started_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE analytics_page_facts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_page_facts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaign_facts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sync_jobs   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'analytics_page_facts' AND policyname = 'apf_brand_access') THEN
        CREATE POLICY apf_brand_access ON analytics_page_facts
            FOR ALL USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seo_page_facts' AND policyname = 'spf_brand_access') THEN
        CREATE POLICY spf_brand_access ON seo_page_facts
            FOR ALL USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ad_campaign_facts' AND policyname = 'acf_brand_access') THEN
        CREATE POLICY acf_brand_access ON ad_campaign_facts
            FOR ALL USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'analytics_sync_jobs' AND policyname = 'asj_brand_access') THEN
        CREATE POLICY asj_brand_access ON analytics_sync_jobs
            FOR ALL USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
    END IF;
END $$;

-- ── Cron: data-sync every 6 hours ─────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'data-sync') THEN
        PERFORM cron.unschedule('data-sync');
    END IF;
END $$;

SELECT cron.schedule(
    'data-sync',
    '0 */6 * * *',
    $$
    SELECT net.http_post(
        url      := current_setting('app.supabase_url') || '/functions/v1/data-sync',
        headers  := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body     := '{}'
    )
    $$
);

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE analytics_page_facts IS
    'Daily GA4 metrics per landing page per brand connection — written by data-sync Edge Function.';
COMMENT ON TABLE seo_page_facts IS
    'Daily Search Console metrics per page/query per brand connection — written by data-sync Edge Function.';
COMMENT ON TABLE ad_campaign_facts IS
    'Daily campaign-level metrics from Meta Ads and Google Ads — written by data-sync / meta-ads-sync Edge Functions.';
COMMENT ON TABLE analytics_sync_jobs IS
    'Audit log for every analytics sync run. Used by Sync Status UI and retry logic.';
