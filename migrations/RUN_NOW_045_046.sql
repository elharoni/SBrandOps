-- ══════════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE SQL EDITOR
-- يشغّل المايجريشنز 045 و046 دفعة واحدة
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 045: Brand Knowledge Base ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_knowledge (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    type        text NOT NULL CHECK (type IN (
                    'product',
                    'faq',
                    'policy',
                    'competitor',
                    'scenario_script'
                )),
    title       text NOT NULL,
    content     text NOT NULL,
    metadata    jsonb DEFAULT '{}',
    sort_order  integer DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_knowledge_brand_id
    ON public.brand_knowledge(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_knowledge_brand_type
    ON public.brand_knowledge(brand_id, type)
    WHERE is_active = true;

ALTER TABLE public.brand_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own brand knowledge" ON public.brand_knowledge;
CREATE POLICY "Users manage own brand knowledge"
    ON public.brand_knowledge FOR ALL
    USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admin all brand knowledge" ON public.brand_knowledge;
CREATE POLICY "Super admin all brand knowledge"
    ON public.brand_knowledge FOR ALL
    USING (is_super_admin());

DROP TRIGGER IF EXISTS trg_brand_knowledge_updated_at ON public.brand_knowledge;
CREATE TRIGGER trg_brand_knowledge_updated_at
    BEFORE UPDATE ON public.brand_knowledge
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_knowledge TO authenticated;

-- ── 046: Skill Engine ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.skill_executions (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    skill_type          text NOT NULL,
    input               jsonb DEFAULT '{}',
    output              jsonb DEFAULT '{}',
    raw_output          text,
    confidence          numeric(4,3) DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
    brand_policy_passed boolean NOT NULL DEFAULT true,
    requires_approval   boolean NOT NULL DEFAULT false,
    execution_time_ms   integer,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_brand_id   ON public.skill_executions(brand_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_brand_skill ON public.skill_executions(brand_id, skill_type);
CREATE INDEX IF NOT EXISTS idx_skill_executions_created_at  ON public.skill_executions(created_at DESC);

ALTER TABLE public.skill_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own skill executions" ON public.skill_executions;
CREATE POLICY "Users see own skill executions"
    ON public.skill_executions FOR ALL
    USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admin all skill executions" ON public.skill_executions;
CREATE POLICY "Super admin all skill executions"
    ON public.skill_executions FOR ALL
    USING (is_super_admin());

CREATE TABLE IF NOT EXISTS public.skill_evaluations (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id    uuid REFERENCES public.skill_executions(id) ON DELETE SET NULL,
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    skill_type      text NOT NULL,
    signal          text NOT NULL CHECK (signal IN (
                        'used','edited','rejected','converted','human_escalated','rated'
                    )),
    original_output text,
    edited_output   text,
    rating          integer CHECK (rating BETWEEN 1 AND 5),
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_evaluations_brand_id    ON public.skill_evaluations(brand_id);
CREATE INDEX IF NOT EXISTS idx_skill_evaluations_brand_skill  ON public.skill_evaluations(brand_id, skill_type);
CREATE INDEX IF NOT EXISTS idx_skill_evaluations_signal       ON public.skill_evaluations(brand_id, signal);
CREATE INDEX IF NOT EXISTS idx_skill_evaluations_execution    ON public.skill_evaluations(execution_id);

ALTER TABLE public.skill_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own skill evaluations" ON public.skill_evaluations;
CREATE POLICY "Users manage own skill evaluations"
    ON public.skill_evaluations FOR ALL
    USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admin all skill evaluations" ON public.skill_evaluations;
CREATE POLICY "Super admin all skill evaluations"
    ON public.skill_evaluations FOR ALL
    USING (is_super_admin());

CREATE OR REPLACE VIEW public.brand_skill_stats AS
SELECT
    e.brand_id,
    e.skill_type,
    COUNT(*)                                                                          AS total_evaluations,
    ROUND(AVG(CASE WHEN e.signal = 'used'      THEN 1.0 ELSE 0.0 END) * 100, 1)    AS used_pct,
    ROUND(AVG(CASE WHEN e.signal = 'edited'    THEN 1.0 ELSE 0.0 END) * 100, 1)    AS edited_pct,
    ROUND(AVG(CASE WHEN e.signal = 'rejected'  THEN 1.0 ELSE 0.0 END) * 100, 1)    AS rejected_pct,
    ROUND(AVG(CASE WHEN e.signal = 'converted' THEN 1.0 ELSE 0.0 END) * 100, 1)    AS conversion_pct,
    ROUND(AVG(e.rating), 2)                                                          AS avg_rating
FROM public.skill_evaluations e
GROUP BY e.brand_id, e.skill_type;

GRANT SELECT ON public.brand_skill_stats TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_executions  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_evaluations TO authenticated;
