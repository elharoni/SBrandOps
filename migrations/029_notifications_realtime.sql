-- Migration 029: Notifications System + Realtime
-- جدول الإشعارات الكاملة مع Realtime subscription

-- ── جدول الإشعارات ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'info',
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    icon        TEXT,
    link        TEXT,
    priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category    TEXT NOT NULL DEFAULT 'general',
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    metadata    JSONB DEFAULT '{}',
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── جدول قواعد الإشعارات ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    trigger     TEXT NOT NULL,
    conditions  JSONB DEFAULT '[]',
    actions     JSONB DEFAULT '[]',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_brand_id    ON public.notifications(brand_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read     ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority    ON public.notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notification_rules_brand  ON public.notification_rules(brand_id);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
CREATE POLICY "notifications_all" ON public.notifications FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "notification_rules_all" ON public.notification_rules;
CREATE POLICY "notification_rules_all" ON public.notification_rules FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- ── تفعيل Realtime على جدول notifications ───────────────────────
-- يجب تشغيله من لوحة Supabase > Database > Replication
-- أو عبر CLI: supabase db push --include-all
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

SELECT 'Notifications system ready with Realtime!' AS status;
