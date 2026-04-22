-- ══════════════════════════════════════════════════════════════════════════════
-- 050: Learning Loop — performance tracking + campaign insights
-- يربط كل قطعة إنتاج بالمنشور المنشور ويحفظ الدروس المستفادة
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Link pieces to their published posts ───────────────────────────────────

ALTER TABLE public.media_project_pieces
    ADD COLUMN IF NOT EXISTS published_post_id UUID REFERENCES public.scheduled_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_media_pieces_post
    ON public.media_project_pieces (published_post_id)
    WHERE published_post_id IS NOT NULL;

-- ── 2. Campaign insights table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.media_campaign_insights (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id                  UUID        NOT NULL REFERENCES public.media_projects(id)   ON DELETE CASCADE,
    brand_id                    UUID        NOT NULL REFERENCES public.brands(id)            ON DELETE CASCADE,

    -- AI-generated debrief
    what_worked                 TEXT,
    what_to_improve             TEXT,
    next_campaign_recommendation TEXT,
    creative_score              INTEGER     CHECK (creative_score BETWEEN 0 AND 100),

    -- Snapshot of pieces at generation time
    pieces_summary              JSONB       NOT NULL DEFAULT '[]',

    generated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_campaign_insights_project
    ON public.media_campaign_insights (project_id);

CREATE INDEX IF NOT EXISTS idx_campaign_insights_brand_time
    ON public.media_campaign_insights (brand_id, generated_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.media_campaign_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_insights_owner"
    ON public.media_campaign_insights FOR ALL
    USING     (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

COMMENT ON TABLE public.media_campaign_insights IS
    'AI-generated campaign debrief per project — what worked, what to improve, next recommendation';
