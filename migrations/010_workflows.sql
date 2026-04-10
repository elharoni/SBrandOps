-- Migration 010: Workflows & Automation Tables
-- ══════════════════════════════════════════════

-- Workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name        text NOT NULL,
    description text,
    trigger_type text NOT NULL DEFAULT 'manual',
    -- trigger_type: 'post_scheduled' | 'post_published' | 'content_approved' | 'manual'
    is_active   boolean NOT NULL DEFAULT true,
    steps       jsonb NOT NULL DEFAULT '[]',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_brand_id ON public.workflows(brand_id);

-- RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand workflows"
    ON public.workflows FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS public.workflow_logs (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    trigger_ref text,   -- e.g., post ID that triggered this run
    status      text NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
    log_entries jsonb NOT NULL DEFAULT '[]',
    started_at  timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own workflow logs"
    ON public.workflow_logs FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
