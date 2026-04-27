-- ============================================================
-- Migration 041: Page–Brand Match Score
-- ============================================================
-- يُضيف أعمدة لتخزين نتيجة مطابقة الصفحة مع البراند
-- بعد أن يُقرّ المستخدم الربط عبر شاشة التأكيد.
-- ============================================================

ALTER TABLE social_accounts
    ADD COLUMN IF NOT EXISTS match_score      SMALLINT,
    ADD COLUMN IF NOT EXISTS confirmed_by_user BOOLEAN   DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS confirmed_at     TIMESTAMPTZ;

COMMENT ON COLUMN social_accounts.match_score       IS 'نتيجة مطابقة الصفحة مع بيانات البراند (0-100)';
COMMENT ON COLUMN social_accounts.confirmed_by_user IS 'TRUE إذا أكّد المستخدم الربط عبر شاشة المطابقة';
COMMENT ON COLUMN social_accounts.confirmed_at      IS 'وقت تأكيد الربط';
