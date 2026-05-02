-- ============================================================
-- Migration 057: Media Plans, BMB Runs, Decisions, Job Queue
-- ============================================================
-- Adds the BMB orchestration layer tables:
--   media_plans    — structured campaign plan produced by BMB
--   bmb_runs       — audit log of every BMB invocation
--   ad_decisions   — KILL / SCALE / DUPLICATE / REFRESH proposals
--   bmb_job_queue  — replaces BullMQ: pg_cron-polled async jobs
-- Also resolves the media_plan_id FK stub on ad_campaigns (056).
-- ============================================================

-- ── media_plans ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_plans (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id         UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    objective        TEXT        NOT NULL,
    -- 'OUTCOME_AWARENESS' | 'OUTCOME_TRAFFIC' | 'OUTCOME_LEADS' | 'OUTCOME_SALES'
    status           TEXT        NOT NULL DEFAULT 'draft',
    -- 'draft' | 'pending_approval' | 'approved' | 'executing' | 'live' | 'completed' | 'rejected'
    total_budget     NUMERIC(12, 2) NOT NULL,
    currency         TEXT        NOT NULL DEFAULT 'EGP',
    start_date       DATE,
    end_date         DATE,
    brief            TEXT,
    -- operator's original brief (Arabic)
    strategy_summary TEXT,
    -- BMB-generated strategy summary
    funnel_layers    JSONB       NOT NULL DEFAULT '{}',
    -- { tofu: { budget, kpis, audience_notes }, mofu: {...}, bofu: {...} }
    kpis             JSONB       NOT NULL DEFAULT '{}',
    -- { cpa_target, roas_target, impression_target }
    creative_briefs  JSONB       NOT NULL DEFAULT '[]',
    -- array of creative brief objects per funnel layer
    audience_plan    JSONB       NOT NULL DEFAULT '[]',
    -- array of audience specs (not yet pushed to Meta)
    approved_by      UUID        REFERENCES auth.users(id),
    approved_at      TIMESTAMPTZ,
    rejected_reason  TEXT,
    bmb_run_id       UUID,
    -- FK resolved after bmb_runs table below
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_plans_brand_status ON media_plans (brand_id, status);

ALTER TABLE media_plans ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'media_plans' AND policyname = 'media_plans_brand_members'
    ) THEN
        CREATE POLICY "media_plans_brand_members"
            ON media_plans FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── bmb_runs ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bmb_runs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id     UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    run_type     TEXT        NOT NULL,
    -- 'on_demand' | 'scheduled_insights' | 'scheduled_decisions' | 'scheduled_pl'
    -- | 'triggered_fatigue' | 'triggered_cpa_breach' | 'triggered_disapproval'
    trigger      TEXT        NOT NULL,
    -- 'operator' | 'pg_cron' | 'webhook'
    status       TEXT        NOT NULL DEFAULT 'running',
    -- 'running' | 'completed' | 'failed' | 'timeout'
    input        JSONB       NOT NULL DEFAULT '{}',
    -- operator brief or trigger payload
    output       JSONB,
    -- structured output (plan, decisions, report)
    tool_calls   JSONB       NOT NULL DEFAULT '[]',
    -- array of tool invocations with latency
    model        TEXT        NOT NULL DEFAULT 'gemini-2.5-pro',
    input_tokens  INTEGER,
    output_tokens INTEGER,
    cost_usd      NUMERIC(10, 6),
    latency_ms    INTEGER,
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bmb_runs_brand ON bmb_runs (brand_id, run_type, created_at DESC);

ALTER TABLE bmb_runs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'bmb_runs' AND policyname = 'bmb_runs_brand_members'
    ) THEN
        CREATE POLICY "bmb_runs_brand_members"
            ON bmb_runs FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── Resolve FKs now that both tables exist ────────────────────────────────────

ALTER TABLE media_plans
    ADD CONSTRAINT fk_media_plans_bmb_run
    FOREIGN KEY (bmb_run_id) REFERENCES bmb_runs(id) ON DELETE SET NULL
    NOT VALID;

ALTER TABLE ad_campaigns
    ADD CONSTRAINT fk_ad_campaigns_media_plan
    FOREIGN KEY (media_plan_id) REFERENCES media_plans(id) ON DELETE SET NULL
    NOT VALID;

-- ── ad_decisions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ad_decisions (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id           UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    bmb_run_id         UUID        REFERENCES bmb_runs(id) ON DELETE SET NULL,
    target_type        TEXT        NOT NULL,
    -- 'campaign' | 'adset' | 'ad'
    target_id          UUID        NOT NULL,
    -- references ad_campaigns.id | ad_adsets.id | ad_ads.id
    decision_type      TEXT        NOT NULL,
    -- 'scale' | 'kill' | 'duplicate' | 'refresh' | 'review' | 'hold'
    status             TEXT        NOT NULL DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
    reasoning          TEXT        NOT NULL,
    supporting_metrics JSONB       NOT NULL DEFAULT '{}',
    -- { cpa, target_cpa, cpa_multiplier, frequency, ctr_drop_pct, spend, conversions }
    scale_percent      INTEGER,
    -- if decision_type = 'scale' (horizontal, vertical)
    new_budget         NUMERIC(12, 2),
    -- if decision_type = 'scale' (vertical budget change)
    source_id          UUID,
    -- if decision_type = 'duplicate', the source adset/ad UUID
    approved_by        UUID        REFERENCES auth.users(id),
    approved_at        TIMESTAMPTZ,
    rejected_reason    TEXT,
    executed_at        TIMESTAMPTZ,
    fbtrace_id         TEXT,
    error_message      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_decisions_brand_status ON ad_decisions (brand_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_decisions_pending      ON ad_decisions (brand_id, status) WHERE status = 'pending';

ALTER TABLE ad_decisions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ad_decisions' AND policyname = 'ad_decisions_brand_members'
    ) THEN
        CREATE POLICY "ad_decisions_brand_members"
            ON ad_decisions FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── bmb_job_queue ─────────────────────────────────────────────────────────────
-- Replaces BullMQ. bmb-scheduler polls this table every 5 min via pg_cron.

CREATE TABLE IF NOT EXISTS bmb_job_queue (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id         UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    job_type         TEXT        NOT NULL,
    -- 'scheduled_insights' | 'scheduled_decisions' | 'scheduled_pl'
    -- | 'triggered_fatigue' | 'triggered_cpa_breach' | 'triggered_disapproval'
    payload          JSONB       NOT NULL DEFAULT '{}',
    status           TEXT        NOT NULL DEFAULT 'pending',
    -- 'pending' | 'running' | 'completed' | 'retry' | 'dead'
    idempotency_key  TEXT        UNIQUE,
    -- brand:{id}:{job_type}:{date} — prevents duplicate jobs
    attempts         INTEGER     NOT NULL DEFAULT 0,
    max_attempts     INTEGER     NOT NULL DEFAULT 5,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bmb_job_queue_pending ON bmb_job_queue (status, next_attempt_at)
    WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS idx_bmb_job_queue_brand ON bmb_job_queue (brand_id, status);

-- bmb_job_queue is written by service role only (pg_cron + EFs)
-- Operators can read their brand's queue for debugging
ALTER TABLE bmb_job_queue ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'bmb_job_queue' AND policyname = 'bmb_job_queue_brand_members'
    ) THEN
        CREATE POLICY "bmb_job_queue_brand_members"
            ON bmb_job_queue FOR SELECT
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;
