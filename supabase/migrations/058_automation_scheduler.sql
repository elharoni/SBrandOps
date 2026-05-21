-- ============================================================
-- Migration 058: Automation Scheduler
-- ============================================================
-- Enables pg_cron + pg_net for scheduled decision automation.
-- Adds auto_executed_at / auto_actor tracking on ad_decisions.
-- Creates bmb_scheduler_log observability table.
-- Creates queue_automation_jobs() DB function.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ── ad_decisions: automation tracking columns ─────────────────────────────────

ALTER TABLE ad_decisions
    ADD COLUMN IF NOT EXISTS auto_executed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auto_actor       TEXT NOT NULL DEFAULT 'human';
-- 'human' | 'automation'

CREATE INDEX IF NOT EXISTS idx_ad_decisions_auto_history
    ON ad_decisions (brand_id, auto_executed_at DESC)
    WHERE auto_actor = 'automation';

-- ── bmb_scheduler_log ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bmb_scheduler_log (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    trigger                 TEXT        NOT NULL DEFAULT 'pg_cron',
    -- 'pg_cron' | 'manual'
    brands_processed        INTEGER     NOT NULL DEFAULT 0,
    decisions_generated     INTEGER     NOT NULL DEFAULT 0,
    decisions_auto_executed INTEGER     NOT NULL DEFAULT 0,
    decisions_kept_pending  INTEGER     NOT NULL DEFAULT 0,
    duration_ms             INTEGER,
    error                   TEXT,
    detail                  JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_bmb_scheduler_log_run_at ON bmb_scheduler_log (run_at DESC);

ALTER TABLE bmb_scheduler_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'bmb_scheduler_log'
          AND policyname = 'bmb_scheduler_log_read_authenticated'
    ) THEN
        CREATE POLICY "bmb_scheduler_log_read_authenticated"
            ON bmb_scheduler_log FOR SELECT
            USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- ── queue_automation_jobs() ───────────────────────────────────────────────────
-- Inserts 'scheduled_decisions' jobs for each AUTO/TIERED brand.
-- Called by pg_cron every 4 hours. Idempotent — same slot = no-op.

CREATE OR REPLACE FUNCTION queue_automation_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_brand_id UUID;
    v_ikey     TEXT;
    v_count    INTEGER := 0;
    v_slot     TEXT;
BEGIN
    -- 4-hour aligned slot for idempotency key
    v_slot := to_char(
        date_trunc('hour', now()) -
        ((EXTRACT(hour FROM now())::integer % 4) * INTERVAL '1 hour'),
        'YYYY-MM-DD-HH24'
    );

    FOR v_brand_id IN
        SELECT brand_id FROM automation_policies WHERE mode IN ('auto', 'tiered')
    LOOP
        v_ikey := 'brand:' || v_brand_id || ':scheduled_decisions:' || v_slot;

        INSERT INTO bmb_job_queue (brand_id, job_type, idempotency_key, payload)
        VALUES (v_brand_id, 'scheduled_decisions', v_ikey, '{}'::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING;

        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION queue_automation_jobs() TO service_role;

-- ── pg_cron Schedule A: queue automation jobs every 4 hours ───────────────────

DO $$
BEGIN
    BEGIN
        PERFORM cron.unschedule('bmb-queue-auto-jobs');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
        'bmb-queue-auto-jobs',
        '0 */4 * * *',
        'SELECT queue_automation_jobs()'
    );
END $$;

-- ── pg_cron Schedule B: call bmb-scheduler EF via pg_net ─────────────────────
-- NOTE: This schedule requires your Supabase project URL and service_role key.
-- After deployment, activate it from the Supabase SQL editor:
--
--   SELECT cron.schedule(
--       'bmb-process-scheduler',
--       '*/15 * * * *',
--       $$SELECT net.http_post(
--           url        := 'https://<PROJECT_REF>.supabase.co/functions/v1/bmb-scheduler',
--           headers    := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--           body       := '{}'::jsonb,
--           timeout_milliseconds := 60000
--       )$$
--   );
--
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> with your actual values.
-- These are visible in: Supabase Dashboard → Settings → API.
