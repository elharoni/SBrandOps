-- ============================================================
-- Migration 020: Performance Indexes for High-Frequency Queries
-- ============================================================
-- These indexes target the hottest read paths:
--   • auto-publisher cron (every minute) — scheduled_posts by status + time
--   • publish-now idempotency check — platform_publish_results by post_id
--   • OAuth callback lookup — brand_connections by brand + provider
--   • Brand-level listings — social_accounts, scheduled_posts by brand_id

-- ── scheduled_posts ───────────────────────────────────────────────────────────

-- auto-publisher: WHERE status = 'Scheduled' AND scheduled_at <= now()
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time
    ON scheduled_posts (status, scheduled_at)
    WHERE status IN ('Scheduled', 'Publishing');

-- Brand dashboard: WHERE brand_id = $1 ORDER BY scheduled_at DESC
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_brand_time
    ON scheduled_posts (brand_id, scheduled_at DESC);

-- ── platform_publish_results ──────────────────────────────────────────────────

-- publish-now idempotency: WHERE post_id = $1 AND status = 'success'
CREATE INDEX IF NOT EXISTS idx_publish_results_post_status
    ON platform_publish_results (post_id, status);

-- ── brand_connections ─────────────────────────────────────────────────────────

-- OAuth callback: WHERE brand_id = $1 AND provider = $2 ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_brand_connections_brand_provider
    ON brand_connections (brand_id, provider, updated_at DESC);

-- ── social_accounts ───────────────────────────────────────────────────────────

-- Account listing per brand: WHERE brand_id = $1
CREATE INDEX IF NOT EXISTS idx_social_accounts_brand
    ON social_accounts (brand_id);

-- ── ai_usage_logs ─────────────────────────────────────────────────────────────

-- Usage reporting per user: WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_time
    ON ai_usage_logs (user_id, created_at DESC);

-- ── billing_subscriptions ─────────────────────────────────────────────────────

-- Active subscription lookup: WHERE tenant_id = $1 AND is_current = true
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_tenant_current
    ON billing_subscriptions (tenant_id, is_current)
    WHERE is_current = true;
