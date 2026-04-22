-- ══════════════════════════════════════════════════════════════════════════════
-- 049: Design Workflows — add missing columns + fix RLS for INSERT
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Add missing columns ────────────────────────────────────────────────────

ALTER TABLE public.design_workflows
    ADD COLUMN IF NOT EXISTS name_en    text,
    ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Back-fill name_en from name for existing rows
UPDATE public.design_workflows SET name_en = name WHERE name_en IS NULL;

-- ── 2. Fix RLS: ensure INSERT is allowed (WITH CHECK required) ────────────────

DROP POLICY IF EXISTS "brand_access"           ON public.design_workflows;
DROP POLICY IF EXISTS "design_workflows_secure" ON public.design_workflows;

CREATE POLICY "design_workflows_secure"
    ON public.design_workflows FOR ALL
    USING     (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- ── 3. Same fix for design_assets and design_jobs (same pattern) ──────────────

DROP POLICY IF EXISTS "brand_access"        ON public.design_assets;
DROP POLICY IF EXISTS "design_assets_secure" ON public.design_assets;

CREATE POLICY "design_assets_secure"
    ON public.design_assets FOR ALL
    USING     (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "brand_access"      ON public.design_jobs;
DROP POLICY IF EXISTS "design_jobs_secure" ON public.design_jobs;

CREATE POLICY "design_jobs_secure"
    ON public.design_jobs FOR ALL
    USING     (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
