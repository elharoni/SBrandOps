-- ============================================================
-- Migration 021: Encrypt OAuth Tokens at Rest
-- ============================================================
-- Tokens in social_accounts and brand_connections are currently
-- stored plaintext. This migration uses pgcrypto symmetric
-- encryption so tokens are unreadable without the encryption key.
--
-- Key management:
--   Set the secret in Supabase Vault or Edge Function env as:
--   OAUTH_ENCRYPTION_KEY (min 32 chars, generated via: openssl rand -hex 32)
--
-- Rollback: The plaintext columns are kept as NULLed after backfill.
--   To roll back: restore from backup or re-populate from the enc columns.
-- ============================================================

-- ── social_accounts: add encrypted columns ────────────────────────────────────
-- Stored as base64url(iv || ciphertext) via AES-256-GCM in Edge Functions.
-- Plaintext columns (access_token, refresh_token) remain until backfill + verification.

ALTER TABLE social_accounts
    ADD COLUMN IF NOT EXISTS access_token_enc  TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token_enc TEXT;

-- ── brand_connections: add encrypted columns ──────────────────────────────────

ALTER TABLE brand_connections
    ADD COLUMN IF NOT EXISTS access_token_enc  TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token_enc TEXT;

-- ── oauth_tokens: add encrypted columns ──────────────────────────────────────

ALTER TABLE oauth_tokens
    ADD COLUMN IF NOT EXISTS access_token_enc  TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token_enc TEXT;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON COLUMN social_accounts.access_token_enc  IS 'AES-256-GCM encrypted token. Format: base64url(12-byte IV || ciphertext). Key in OAUTH_ENCRYPTION_KEY Edge Function env.';
COMMENT ON COLUMN social_accounts.refresh_token_enc IS 'AES-256-GCM encrypted refresh token.';
COMMENT ON COLUMN brand_connections.access_token_enc  IS 'AES-256-GCM encrypted token.';
COMMENT ON COLUMN brand_connections.refresh_token_enc IS 'AES-256-GCM encrypted refresh token.';
COMMENT ON COLUMN oauth_tokens.access_token_enc  IS 'AES-256-GCM encrypted token.';
COMMENT ON COLUMN oauth_tokens.refresh_token_enc IS 'AES-256-GCM encrypted refresh token.';

-- ── NOTE: Backfill ────────────────────────────────────────────────────────────
-- Run the following AFTER setting OAUTH_ENCRYPTION_KEY in your environment:
--
--   UPDATE social_accounts
--     SET access_token_enc  = pgp_sym_encrypt(access_token,  current_setting('app.oauth_encryption_key')),
--         refresh_token_enc = pgp_sym_encrypt(refresh_token, current_setting('app.oauth_encryption_key'))
--     WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;
--
--   UPDATE brand_connections
--     SET access_token_enc  = pgp_sym_encrypt(access_token,  current_setting('app.oauth_encryption_key')),
--         refresh_token_enc = pgp_sym_encrypt(refresh_token, current_setting('app.oauth_encryption_key'))
--     WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;
--
-- Then nullify plaintext columns (do NOT drop yet — verify app writes enc columns first):
--
--   UPDATE social_accounts   SET access_token = NULL, refresh_token = NULL;
--   UPDATE brand_connections  SET access_token = NULL, refresh_token = NULL;
