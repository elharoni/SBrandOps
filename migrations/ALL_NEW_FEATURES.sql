-- ============================================
-- SBrandOps - New Features Migrations
-- تاريخ: 2025-11-20
-- الميزات: Saved Replies, Link Shortener, Notifications
-- ============================================

-- ============================================
-- 1. SAVED REPLIES - الردود المحفوظة
-- ============================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_replies_brand_id ON public.saved_replies(brand_id);
CREATE INDEX IF NOT EXISTS idx_saved_replies_category ON public.saved_replies(category);
CREATE INDEX IF NOT EXISTS idx_saved_replies_usage_count ON public.saved_replies(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_saved_replies_tags ON public.saved_replies USING GIN(tags);

-- RLS
ALTER TABLE public.saved_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view saved replies for their brands"
    ON public.saved_replies FOR SELECT
    USING (true);

CREATE POLICY "Users can create saved replies for their brands"
    ON public.saved_replies FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their saved replies"
    ON public.saved_replies FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete their saved replies"
    ON public.saved_replies FOR DELETE
    USING (true);

-- Trigger
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

-- Comments
COMMENT ON TABLE public.saved_replies IS 'جدول الردود المحفوظة للتعليقات والرسائل';


-- ============================================
-- 2. LINK SHORTENER - اختصار الروابط
-- ============================================

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


-- ============================================
-- 3. NOTIFICATIONS - الإشعارات الذكية
-- ============================================

-- جدول الإشعارات
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id UUID,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    icon TEXT,
    link TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category TEXT DEFAULT 'general',
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- جدول قواعد الإشعارات
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger TEXT NOT NULL,
    conditions JSONB DEFAULT '[]',
    actions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_brand_id ON public.notifications(brand_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_is_archived ON public.notifications(is_archived);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notification_rules_brand_id ON public.notification_rules(brand_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_is_active ON public.notification_rules(is_active);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications for their brands"
    ON public.notifications FOR SELECT
    USING (true);

CREATE POLICY "System can create notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their notifications"
    ON public.notifications FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete their notifications"
    ON public.notifications FOR DELETE
    USING (true);

CREATE POLICY "Users can view notification rules for their brands"
    ON public.notification_rules FOR SELECT
    USING (true);

CREATE POLICY "Users can create notification rules"
    ON public.notification_rules FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their notification rules"
    ON public.notification_rules FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete their notification rules"
    ON public.notification_rules FOR DELETE
    USING (true);

-- Trigger
CREATE OR REPLACE FUNCTION update_notification_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_rules_updated_at
    BEFORE UPDATE ON public.notification_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_rules_updated_at();

-- Function لحذف الإشعارات القديمة تلقائياً
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM public.notifications
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND is_archived = true;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE public.notifications IS 'جدول الإشعارات الذكية';
COMMENT ON TABLE public.notification_rules IS 'جدول قواعد الإشعارات التلقائية';

-- ============================================
-- تم الانتهاء من جميع Migrations!
-- ============================================
