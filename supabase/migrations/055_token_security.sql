-- ============================================================
-- Migration 055: Token Security — Decrypt Audit Log + Key Versioning
-- ============================================================
-- Adds:
--   token_decrypt_logs — audit every decryptToken() call
--   key_version column on oauth_tokens — enables future key rotation
--     without invalidating all existing tokens at once
-- ============================================================

-- ── token_decrypt_logs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_decrypt_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID        REFERENCES brands(id) ON DELETE SET NULL,
    token_id    UUID        REFERENCES oauth_tokens(id) ON DELETE SET NULL,
    purpose     TEXT        NOT NULL,
    -- 'ads_sync' | 'meta_execute' | 'audience_push' | 'token_verify' | 'token_refresh'
    requestor   TEXT        NOT NULL,
    -- edge function name (e.g. 'ads-sync', 'meta-ads-execute', 'bmb-agent')
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_decrypt_logs_brand ON token_decrypt_logs (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_decrypt_logs_token ON token_decrypt_logs (token_id, created_at DESC);

-- token_decrypt_logs is write-only from service role; operators can read their brand's logs
ALTER TABLE token_decrypt_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'token_decrypt_logs' AND policyname = 'token_decrypt_logs_brand_members'
    ) THEN
        CREATE POLICY "token_decrypt_logs_brand_members"
            ON token_decrypt_logs FOR SELECT
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── key_version on oauth_tokens ───────────────────────────────────────────────
-- Allows decryptToken() to route to the correct key when the master key is rotated.
-- All existing rows default to version 1 (current key).

ALTER TABLE oauth_tokens
    ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1;
