-- ============================================================
-- Migration 025: Ensure oauth_tokens table + social_accounts.platform_user_id
-- ============================================================
-- Migrations 001–014 are applied directly to production and not in the repo.
-- This migration is idempotent (IF NOT EXISTS everywhere) so it is safe
-- to run even if the objects already exist.
-- ============================================================

-- ── oauth_tokens table ────────────────────────────────────────────────────────
-- Stores encrypted OAuth tokens for each social account.
-- Tokens are encrypted by the connect-accounts Edge Function (AES-256-GCM)
-- before being written here. Plaintext tokens are NEVER stored.

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    social_account_id   UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
    provider            TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    provider_name       TEXT,
    -- Plaintext columns kept nullable for legacy rows (should be NULL in practice)
    access_token        TEXT,
    refresh_token       TEXT,
    -- Encrypted columns (AES-256-GCM, base64url(12-byte IV || ciphertext))
    access_token_enc    TEXT,
    refresh_token_enc   TEXT,
    token_type          TEXT NOT NULL DEFAULT 'bearer',
    scopes              TEXT[] DEFAULT '{}',
    expires_at          TIMESTAMPTZ,
    is_valid            BOOLEAN NOT NULL DEFAULT true,
    raw_metadata        JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for upsert in connect-accounts Edge Function
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'oauth_tokens_brand_provider_account_unique'
    ) THEN
        ALTER TABLE oauth_tokens
            ADD CONSTRAINT oauth_tokens_brand_provider_account_unique
            UNIQUE (brand_id, provider, provider_account_id);
    END IF;
END $$;

-- ── social_accounts: ensure platform_user_id column exists ───────────────────
-- Used as the natural identifier for upsert (brand_id, platform, platform_user_id).
ALTER TABLE social_accounts
    ADD COLUMN IF NOT EXISTS platform_user_id TEXT;

-- Unique constraint for upsert in connect-accounts Edge Function
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_accounts_brand_platform_user_unique'
    ) THEN
        ALTER TABLE social_accounts
            ADD CONSTRAINT social_accounts_brand_platform_user_unique
            UNIQUE (brand_id, platform, platform_user_id);
    END IF;
END $$;

-- ── RLS on oauth_tokens ───────────────────────────────────────────────────────
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Service role (Edge Functions) has full access via service role key — no RLS needed.
-- Regular users should never read tokens directly from the client.
-- This policy intentionally denies all client access to raw tokens.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'oauth_tokens' AND policyname = 'oauth_tokens_no_client_access'
    ) THEN
        CREATE POLICY "oauth_tokens_no_client_access"
            ON oauth_tokens
            FOR ALL
            USING (false);
    END IF;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_brand_provider
    ON oauth_tokens (brand_id, provider);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_social_account
    ON oauth_tokens (social_account_id)
    WHERE social_account_id IS NOT NULL;

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_oauth_tokens_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oauth_tokens_updated_at ON oauth_tokens;
CREATE TRIGGER trg_oauth_tokens_updated_at
    BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_oauth_tokens_updated_at();

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE oauth_tokens IS
    'Encrypted OAuth tokens for social accounts. Tokens are AES-256-GCM encrypted by Edge Functions. Never store plaintext tokens here.';
COMMENT ON COLUMN oauth_tokens.access_token_enc IS
    'AES-256-GCM encrypted access token. Format: base64url(12-byte IV || ciphertext). Key in OAUTH_ENCRYPTION_KEY Edge Function secret.';
COMMENT ON COLUMN oauth_tokens.refresh_token_enc IS
    'AES-256-GCM encrypted refresh token.';
COMMENT ON COLUMN social_accounts.platform_user_id IS
    'The user-level ID from the social platform (e.g. Facebook user ID). Used as upsert key alongside brand_id and platform.';
