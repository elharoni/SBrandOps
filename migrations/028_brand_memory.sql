-- Migration 028: Brand Memory System
-- يحفظ ذاكرة الـ AI لكل براند — يتعلم من التفاعلات ويحسّن الاقتراحات

CREATE TABLE IF NOT EXISTS public.brand_memory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    memory_type     TEXT NOT NULL CHECK (memory_type IN (
                        'approved_caption',    -- محتوى أُجيز من العميل
                        'rejected_caption',    -- محتوى رُفض أو عُدّل كثيراً
                        'tone_correction',     -- تصحيح نبرة يدوي
                        'audience_insight',    -- رؤية حول الجمهور
                        'high_performing_post',-- منشور حقق تفاعل عالٍ
                        'avoided_topic'        -- موضوع تجنّبه البراند
                    )),
    content         TEXT NOT NULL,
    context         JSONB DEFAULT '{}',        -- بيانات سياق إضافية (platform, engagement, etc.)
    importance      INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    used_count      INTEGER DEFAULT 0,         -- كم مرة استُخدمت هذه الذاكرة
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_brand_memory_brand_id    ON public.brand_memory(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_memory_type        ON public.brand_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_brand_memory_importance  ON public.brand_memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_brand_memory_created     ON public.brand_memory(created_at DESC);

-- RLS
ALTER TABLE public.brand_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand memory follows brand ownership"
    ON public.brand_memory FOR ALL
    USING (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    )
    WITH CHECK (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    );

-- دالة: جلب أهم ذكريات البراند (للـ AI context)
CREATE OR REPLACE FUNCTION get_brand_memory_context(p_brand_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE(memory_type TEXT, content TEXT, context JSONB, importance INTEGER)
LANGUAGE sql STABLE
AS $$
    SELECT memory_type, content, context, importance
    FROM public.brand_memory
    WHERE brand_id = p_brand_id
    ORDER BY importance DESC, created_at DESC
    LIMIT p_limit;
$$;

COMMENT ON TABLE public.brand_memory IS 'ذاكرة الـ AI لكل براند — يتعلم من التفاعلات ويحسّن الاقتراحات';
