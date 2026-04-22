-- Migration 045: Brand Knowledge Base
-- قاعدة معرفة البراند الخاصة — المنتجات والأسئلة الشائعة والسياسات والمنافسين
-- هذا هو "العقل الدائم" للبراند الذي يُغذّي كل طلبات AI

-- ── Create table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_knowledge (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    type        text NOT NULL CHECK (type IN (
                    'product',           -- منتج أو خدمة
                    'faq',               -- سؤال شائع وإجابته
                    'policy',            -- سياسة (شحن، دفع، إرجاع)
                    'competitor',        -- معلومات منافس
                    'scenario_script'    -- سكريبت سيناريو محادثة
                )),
    title       text NOT NULL,
    content     text NOT NULL,
    metadata    jsonb DEFAULT '{}',
    sort_order  integer DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_brand_knowledge_brand_id
    ON public.brand_knowledge(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_knowledge_brand_type
    ON public.brand_knowledge(brand_id, type)
    WHERE is_active = true;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.brand_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own brand knowledge" ON public.brand_knowledge;
CREATE POLICY "Users manage own brand knowledge"
    ON public.brand_knowledge FOR ALL
    USING (
        brand_id IN (
            SELECT id FROM public.brands WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        brand_id IN (
            SELECT id FROM public.brands WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Super admin all brand knowledge" ON public.brand_knowledge;
CREATE POLICY "Super admin all brand knowledge"
    ON public.brand_knowledge FOR ALL
    USING (is_super_admin());

-- ── updated_at trigger ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_brand_knowledge_updated_at ON public.brand_knowledge;
CREATE TRIGGER trg_brand_knowledge_updated_at
    BEFORE UPDATE ON public.brand_knowledge
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Grant usage ───────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.brand_knowledge TO authenticated;
