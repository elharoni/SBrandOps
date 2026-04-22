-- ============================================================
-- Migration 042: Enhance Existing Tables
-- توسيع الجداول الموجودة بحقول ناقصة
-- A. brand_profiles  — بيانات الهوية البصرية والجمهور
-- B. ad_campaigns    — أرقام الأداء الحقيقية
-- C. workflows       — إحصائيات التشغيل
-- D. brand_integrations — دعم Webhooks والـ Config
-- E. workflow_runs   — جدول جديد لسجل التنفيذ
-- ============================================================

-- ── دالة مشتركة (CREATE OR REPLACE لضمان وجودها) ─────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

-- ── A. brand_profiles ────────────────────────────────────────
ALTER TABLE public.brand_profiles
    ADD COLUMN IF NOT EXISTS industry             TEXT,
    ADD COLUMN IF NOT EXISTS website_url          TEXT,
    ADD COLUMN IF NOT EXISTS tagline              TEXT,
    ADD COLUMN IF NOT EXISTS brand_colors         TEXT[]      DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS brand_fonts          TEXT[]      DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS audience_description TEXT,
    ADD COLUMN IF NOT EXISTS tone_strength        NUMERIC(3,2) DEFAULT 0.5
                                                  CHECK (tone_strength BETWEEN 0 AND 1),
    ADD COLUMN IF NOT EXISTS tone_sentiment       NUMERIC(3,2) DEFAULT 0.5
                                                  CHECK (tone_sentiment BETWEEN 0 AND 1),
    ADD COLUMN IF NOT EXISTS consistency_score    INTEGER     DEFAULT 0
                                                  CHECK (consistency_score BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS brand_audiences      JSONB       NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS voice_guidelines     JSONB       NOT NULL DEFAULT '{"dos": [], "donts": []}',
    ADD COLUMN IF NOT EXISTS style_guidelines     JSONB       NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS last_memory_update   TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT now();

-- Trigger لتحديث updated_at إذا لم يكن موجوداً
DROP TRIGGER IF EXISTS trg_brand_profiles_updated_at ON public.brand_profiles;
CREATE TRIGGER trg_brand_profiles_updated_at
    BEFORE UPDATE ON public.brand_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ── B. ad_campaigns ──────────────────────────────────────────
ALTER TABLE public.ad_campaigns
    ADD COLUMN IF NOT EXISTS ad_account_id     TEXT,
    ADD COLUMN IF NOT EXISTS currency          TEXT        NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS spent             NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS impressions_count BIGINT      NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS clicks_count      BIGINT      NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS conversions_count INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reach_count       BIGINT      NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS roas              NUMERIC(7,2),   -- Return on Ad Spend
    ADD COLUMN IF NOT EXISTS cpa               NUMERIC(10,2),  -- Cost Per Acquisition
    ADD COLUMN IF NOT EXISTS ctr               NUMERIC(6,4),   -- Click-Through Rate
    ADD COLUMN IF NOT EXISTS cpm               NUMERIC(10,2),  -- Cost Per Mille
    ADD COLUMN IF NOT EXISTS last_synced_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sync_status       TEXT        DEFAULT 'idle'
                                               CHECK (sync_status IN ('idle','syncing','error')),
    ADD COLUMN IF NOT EXISTS platform_data     JSONB       NOT NULL DEFAULT '{}';

-- ── C. workflows ─────────────────────────────────────────────
ALTER TABLE public.workflows
    ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS run_count         INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_run_status   TEXT,
    ADD COLUMN IF NOT EXISTS last_run_error    TEXT,
    ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT now();

DROP TRIGGER IF EXISTS trg_workflows_updated_at ON public.workflows;
CREATE TRIGGER trg_workflows_updated_at
    BEFORE UPDATE ON public.workflows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ── D. brand_integrations ────────────────────────────────────
ALTER TABLE public.brand_integrations
    ADD COLUMN IF NOT EXISTS webhook_url      TEXT,
    ADD COLUMN IF NOT EXISTS webhook_secret   TEXT,            -- سر التحقق من Webhooks
    ADD COLUMN IF NOT EXISTS last_sync_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_event_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sync_status      TEXT        DEFAULT 'idle'
                                              CHECK (sync_status IN ('idle','syncing','error','connected')),
    ADD COLUMN IF NOT EXISTS error_message    TEXT,
    ADD COLUMN IF NOT EXISTS config           JSONB       NOT NULL DEFAULT '{}',   -- إعدادات خاصة بالتكامل
    ADD COLUMN IF NOT EXISTS sync_frequency   TEXT        DEFAULT 'daily';         -- 'realtime' | 'hourly' | 'daily'

-- ── E. workflow_runs — سجل تنفيذ الـ Workflows (جديد) ────────
CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    brand_id        UUID        NOT NULL REFERENCES public.brands(id)   ON DELETE CASCADE,

    -- تفاصيل التشغيل
    trigger_type    TEXT        NOT NULL,   -- 'post_scheduled' | 'post_published' | 'manual' | 'cron'
    trigger_data    JSONB       NOT NULL DEFAULT '{}',   -- بيانات الـ trigger (مثلاً: post_id)

    -- النتيجة
    status          TEXT        NOT NULL DEFAULT 'running'
                                CHECK (status IN ('running', 'success', 'failed', 'partial', 'cancelled')),
    steps_log       JSONB       NOT NULL DEFAULT '[]',   -- خطوات التنفيذ مع نتائجها
    steps_completed INTEGER     NOT NULL DEFAULT 0,
    steps_total     INTEGER     NOT NULL DEFAULT 0,
    error           TEXT,

    -- التوقيت
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER     -- يُحسب تلقائياً عبر Trigger عند اكتمال التشغيل
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow
    ON public.workflow_runs (workflow_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_brand
    ON public.workflow_runs (brand_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
    ON public.workflow_runs (status)
    WHERE status IN ('running', 'failed');

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_runs_brand_owner"
    ON public.workflow_runs FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- Trigger: تحديث إحصائيات الـ workflow عند اكتمال تشغيل + حساب المدة
CREATE OR REPLACE FUNCTION public.update_workflow_stats_after_run()
RETURNS TRIGGER AS $$
BEGIN
    -- احسب المدة عند الاكتمال
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        NEW.duration_ms := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER * 1000;
    END IF;

    IF NEW.status IN ('success','failed','partial','cancelled') AND OLD.status = 'running' THEN
        UPDATE public.workflows
        SET
            run_count         = run_count + 1,
            last_triggered_at = NEW.started_at,
            last_run_status   = NEW.status,
            last_run_error    = NEW.error
        WHERE id = NEW.workflow_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_workflow_stats ON public.workflow_runs;
CREATE TRIGGER trg_update_workflow_stats
    BEFORE UPDATE ON public.workflow_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_workflow_stats_after_run();

COMMENT ON TABLE public.workflow_runs IS
    'سجل تنفيذ الـ Workflows — يتتبع كل تشغيل مع خطواته ونتيجته';
