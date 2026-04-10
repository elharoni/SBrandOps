-- ============================================================
-- Migration 015: Edge Function Cron Jobs + Analytics Snapshots
-- ============================================================

-- ── Analytics Snapshots Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,
    account_id      UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
    metric_name     TEXT NOT NULL,
    metric_value    NUMERIC,
    period_start    TIMESTAMPTZ NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to allow upsert
ALTER TABLE analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_unique
    UNIQUE (brand_id, platform, metric_name, period_start);

-- Index for fast brand-level queries
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_brand_platform
    ON analytics_snapshots (brand_id, platform, recorded_at DESC);

-- ── Publish Results Column on scheduled_posts ─────────────────────────────────
ALTER TABLE scheduled_posts
    ADD COLUMN IF NOT EXISTS publish_results  JSONB,
    ADD COLUMN IF NOT EXISTS published_at     TIMESTAMPTZ;

-- ── Platform Account ID on social_accounts ───────────────────────────────────
-- Needed by edge functions to call platform APIs
ALTER TABLE social_accounts
    ADD COLUMN IF NOT EXISTS platform_account_id TEXT,
    ADD COLUMN IF NOT EXISTS access_token         TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token        TEXT,
    ADD COLUMN IF NOT EXISTS token_expires_at     TIMESTAMPTZ;

-- ── RLS Policies ──────────────────────────────────────────────────────────────
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_snapshots_brand_access" ON analytics_snapshots
    FOR ALL USING (
        brand_id IN (
            SELECT id FROM brands WHERE user_id = auth.uid()
        )
    );

-- ── pg_cron Jobs ──────────────────────────────────────────────────────────────
-- Requires pg_cron extension + pg_net extension
-- Enable in Supabase dashboard: Database > Extensions

-- Auto-publisher: runs every minute
SELECT cron.schedule(
    'auto-publisher',
    '* * * * *',
    $$
    SELECT net.http_post(
        url      := current_setting('app.supabase_url') || '/functions/v1/auto-publisher',
        headers  := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body     := '{}'
    )
    $$
);

-- Analytics aggregator: runs every 6 hours
SELECT cron.schedule(
    'analytics-aggregator',
    '0 */6 * * *',
    $$
    SELECT net.http_post(
        url      := current_setting('app.supabase_url') || '/functions/v1/analytics-aggregator',
        headers  := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body     := '{}'
    )
    $$
);

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE analytics_snapshots IS
    'Time-series snapshots of platform analytics metrics synced by the analytics-aggregator edge function.';
