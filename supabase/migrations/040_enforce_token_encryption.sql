-- ============================================================
-- Migration 040: Enforce Token Encryption Constraints
-- ============================================================
-- الهدف: منع إدخال توكنات جديدة بدون تشفير + تسجيل ميتاداتا التدقيق
-- يُنفَّذ بعد: migration 021 (إضافة أعمدة _enc)
-- ============================================================

-- ── 1. CHECK constraints: لا توكن جديد plaintext ──────────────────────────────
-- القاعدة: يُسمح بإدخال صف فقط إذا كان access_token = NULL أو access_token_enc مملوء

ALTER TABLE social_accounts
    ADD CONSTRAINT chk_sa_token_encrypted
        CHECK (
            access_token IS NULL
            OR (access_token IS NOT NULL AND access_token_enc IS NOT NULL)
        );

ALTER TABLE oauth_tokens
    ADD CONSTRAINT chk_ot_token_encrypted
        CHECK (
            access_token IS NULL
            OR (access_token IS NOT NULL AND access_token_enc IS NOT NULL)
        );

ALTER TABLE brand_connections
    ADD CONSTRAINT chk_bc_token_encrypted
        CHECK (
            access_token IS NULL
            OR (access_token IS NOT NULL AND access_token_enc IS NOT NULL)
        );

-- ── 2. جدول تدقيق تشفير التوكنات ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_encryption_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    table_name    TEXT NOT NULL,
    rows_found    INT  NOT NULL DEFAULT 0,
    rows_updated  INT  NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    run_by        TEXT NOT NULL DEFAULT 'system'
);

COMMENT ON TABLE token_encryption_log IS 'سجل تشغيل Edge Function تشفير التوكنات القديمة';

-- ── 3. View: توكنات تحتاج تشفير ───────────────────────────────────────────────

CREATE OR REPLACE VIEW plaintext_tokens_audit AS
SELECT
    'social_accounts' AS table_name,
    COUNT(*) FILTER (WHERE access_token  IS NOT NULL AND access_token_enc  IS NULL) AS unencrypted_access,
    COUNT(*) FILTER (WHERE refresh_token IS NOT NULL AND refresh_token_enc IS NULL) AS unencrypted_refresh,
    COUNT(*) AS total_rows
FROM social_accounts
UNION ALL
SELECT
    'oauth_tokens',
    COUNT(*) FILTER (WHERE access_token  IS NOT NULL AND access_token_enc  IS NULL),
    COUNT(*) FILTER (WHERE refresh_token IS NOT NULL AND refresh_token_enc IS NULL),
    COUNT(*)
FROM oauth_tokens
UNION ALL
SELECT
    'brand_connections',
    COUNT(*) FILTER (WHERE access_token  IS NOT NULL AND access_token_enc  IS NULL),
    COUNT(*) FILTER (WHERE refresh_token IS NOT NULL AND refresh_token_enc IS NULL),
    COUNT(*)
FROM brand_connections;

COMMENT ON VIEW plaintext_tokens_audit IS 'يُظهر عدد التوكنات غير المشفرة في كل جدول — يُستخدم قبل وبعد تشغيل encrypt-existing-tokens';
