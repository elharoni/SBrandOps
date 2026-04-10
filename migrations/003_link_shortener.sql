-- Migration: Add Link Shortener Tables
-- تاريخ: 2025-11-20

-- جدول الروابط المختصرة
CREATE TABLE IF NOT EXISTS public.short_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    title TEXT,
    description TEXT,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    last_clicked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول النقرات
CREATE TABLE IF NOT EXISTS public.link_clicks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    link_id UUID NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    referer TEXT,
    country TEXT,
    city TEXT,
    device TEXT,
    browser TEXT,
    os TEXT,
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_short_links_brand_id ON public.short_links(brand_id);
CREATE INDEX IF NOT EXISTS idx_short_links_short_code ON public.short_links(short_code);
CREATE INDEX IF NOT EXISTS idx_short_links_is_active ON public.short_links(is_active);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON public.link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON public.link_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_clicks_ip_address ON public.link_clicks(ip_address);

-- RLS
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view short links for their brands"
    ON public.short_links FOR SELECT
    USING (true);

CREATE POLICY "Users can create short links for their brands"
    ON public.short_links FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their short links"
    ON public.short_links FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete their short links"
    ON public.short_links FOR DELETE
    USING (true);

CREATE POLICY "Anyone can view link clicks"
    ON public.link_clicks FOR SELECT
    USING (true);

CREATE POLICY "System can insert link clicks"
    ON public.link_clicks FOR INSERT
    WITH CHECK (true);

-- Trigger
CREATE OR REPLACE FUNCTION update_short_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER short_links_updated_at
    BEFORE UPDATE ON public.short_links
    FOR EACH ROW
    EXECUTE FUNCTION update_short_links_updated_at();

-- Comments
COMMENT ON TABLE public.short_links IS 'جدول الروابط المختصرة';
COMMENT ON TABLE public.link_clicks IS 'جدول تتبع النقرات على الروابط';
COMMENT ON COLUMN public.short_links.short_code IS 'الكود القصير الفريد للرابط';
COMMENT ON COLUMN public.short_links.clicks IS 'إجمالي عدد النقرات';
COMMENT ON COLUMN public.short_links.unique_clicks IS 'عدد النقرات الفريدة (حسب IP)';
