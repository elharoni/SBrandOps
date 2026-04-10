-- Migration: Add Smart Notifications Tables
-- تاريخ: 2025-11-20

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

-- Policies
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
COMMENT ON COLUMN public.notifications.priority IS 'أولوية الإشعار: low, medium, high, urgent';
COMMENT ON COLUMN public.notification_rules.trigger IS 'الحدث الذي يُطلق الإشعار';
COMMENT ON COLUMN public.notification_rules.conditions IS 'شروط تفعيل القاعدة';
COMMENT ON COLUMN public.notification_rules.actions IS 'الإجراءات عند تفعيل القاعدة';
