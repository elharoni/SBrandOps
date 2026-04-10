-- Migration: Add Saved Replies Table
-- تاريخ: 2025-11-20

-- إنشاء جدول الردود المحفوظة
CREATE TABLE IF NOT EXISTS public.saved_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    variables TEXT[] DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_saved_replies_brand_id ON public.saved_replies(brand_id);
CREATE INDEX IF NOT EXISTS idx_saved_replies_category ON public.saved_replies(category);
CREATE INDEX IF NOT EXISTS idx_saved_replies_usage_count ON public.saved_replies(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_saved_replies_tags ON public.saved_replies USING GIN(tags);

-- تفعيل RLS
ALTER TABLE public.saved_replies ENABLE ROW LEVEL SECURITY;

-- سياسات RLS
CREATE POLICY "Users can view saved replies for their brands"
    ON public.saved_replies FOR SELECT
    USING (true); -- للتطوير، يجب تحديثها في الإنتاج

CREATE POLICY "Users can create saved replies for their brands"
    ON public.saved_replies FOR INSERT
    WITH CHECK (true); -- للتطوير

CREATE POLICY "Users can update their saved replies"
    ON public.saved_replies FOR UPDATE
    USING (true); -- للتطوير

CREATE POLICY "Users can delete their saved replies"
    ON public.saved_replies FOR DELETE
    USING (true); -- للتطوير

-- Trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_saved_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_replies_updated_at
    BEFORE UPDATE ON public.saved_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_replies_updated_at();

-- إضافة تعليقات
COMMENT ON TABLE public.saved_replies IS 'جدول الردود المحفوظة للتعليقات والرسائل';
COMMENT ON COLUMN public.saved_replies.variables IS 'المتغيرات المستخدمة في المحتوى مثل {name}, {product}';
COMMENT ON COLUMN public.saved_replies.usage_count IS 'عدد مرات استخدام الرد';
COMMENT ON COLUMN public.saved_replies.last_used_at IS 'آخر مرة تم استخدام الرد فيها';
