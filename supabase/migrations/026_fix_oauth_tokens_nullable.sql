-- Migration 026: Fix oauth_tokens.access_token NOT NULL constraint
--
-- The connect-accounts Edge Function stores tokens encrypted in access_token_enc.
-- The plaintext access_token column should be nullable (kept only for legacy rows).
--
ALTER TABLE oauth_tokens ALTER COLUMN access_token DROP NOT NULL;
