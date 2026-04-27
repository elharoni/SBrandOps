-- ============================================================
-- Migration 036: Cron Jobs for New Integration Engine Functions
-- ============================================================
-- Registers pg_cron schedules for:
--   sync-engine      — daily analytics + orders sync (06:00 UTC)
--   inbox-aggregator — every 15 minutes inbox polling
--   ads-sync         — daily ads insights sync (05:00 UTC)
--   token-refresh    — every 6 hours token health check
-- ============================================================

-- ── Extend analytics_snapshots for new source-keyed upsert ───────────────────
-- The sync-engine upserts using (brand_id, source, date, metric_name).
-- Add columns if the table was created with the old schema.

ALTER TABLE analytics_snapshots
    ADD COLUMN IF NOT EXISTS source      TEXT,    -- 'ga4' | 'gsc' | 'facebook' | 'instagram' | …
    ADD COLUMN IF NOT EXISTS date        DATE,    -- calendar date (replaces period_start for daily)
    ADD COLUMN IF NOT EXISTS value       NUMERIC, -- primary metric value
    ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}';

-- New unique constraint for source-based upsert (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'analytics_snapshots_source_date_metric_uniq'
    ) THEN
        ALTER TABLE analytics_snapshots
            ADD CONSTRAINT analytics_snapshots_source_date_metric_uniq
            UNIQUE (brand_id, source, date, metric_name)
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- Index for source-filtered queries (used by analytics tabs)
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_source_date
    ON analytics_snapshots (brand_id, source, date DESC)
    WHERE source IS NOT NULL;

-- ── Remove old cron jobs if they conflict ─────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'token-refresh')    THEN PERFORM cron.unschedule('token-refresh');    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-engine')      THEN PERFORM cron.unschedule('sync-engine');      END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inbox-aggregator') THEN PERFORM cron.unschedule('inbox-aggregator'); END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ads-sync')         THEN PERFORM cron.unschedule('ads-sync');         END IF;
END $$;

-- ── sync-engine: daily at 06:00 UTC ──────────────────────────────────────────
SELECT cron.schedule(
    'sync-engine',
    '0 6 * * *',
    $$
    SELECT net.http_post(
        url      := current_setting('app.supabase_url') || '/functions/v1/sync-engine',
        headers  := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.cron_secret')
        ),
        body     := '{}'
    )
    $$
);

-- ── inbox-aggregator: every 15 minutes ───────────────────────────────────────
SELECT cron.schedule(
    'inbox-aggregator',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url      := current_setting('app.supabase_url') || '/functions/v1/inbox-aggregator',
        headers  := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.cron_secret')
        ),
        body     := '{}'
    )
    $$
);

-- ── ads-sync: daily at 05:00 UTC ─────────────────────────────────────────────
SELECT cron.schedule(
    'ads-sync',
    '0 5 * * *',
    $$
    SELECT net.http_post(
        url      := current_setting('app.supabase_url') || '/functions/v1/ads-sync',
        headers  := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.cron_secret')
        ),
        body     := '{}'
    )
    $$
);

-- ── token-refresh: every 6 hours ──────────────────────────────────────────────
SELECT cron.schedule(
    'token-refresh',
    '0 */6 * * *',
    $$
    SELECT net.http_post(
        url      := current_setting('app.supabase_url') || '/functions/v1/token-refresh',
        headers  := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.cron_secret')
        ),
        body     := '{}'
    )
    $$
);

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON COLUMN analytics_snapshots.source IS
    'Data source key: ga4 | gsc | facebook | instagram | tiktok | youtube | linkedin | x. Used to separate analytics tabs.';
COMMENT ON COLUMN analytics_snapshots.date IS
    'Calendar date (YYYY-MM-DD) for daily analytics rows. Replaces period_start for new sync-engine data.';
