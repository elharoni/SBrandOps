-- ============================================================
-- Migration 042: Additional Performance Indexes (P4-04)
-- ============================================================
-- Targets:
--   • integration_health view — join on social_accounts (brand_id, platform, sync_status)
--   • brand_knowledge active reads (brand_id, type)
--   • oauth_tokens expiry check (expires_at, is_valid)
--   • analytics_page_facts + seo_page_facts fact table scans
--   • ad_campaign_facts provider filter
--   • analytics_sync_jobs per-brand per-provider lookups
-- ============================================================

-- ── social_accounts ───────────────────────────────────────────────────────────

-- integration_health view + scope checks: WHERE brand_id=? AND platform=?
CREATE INDEX IF NOT EXISTS idx_social_accounts_brand_platform
    ON social_accounts (brand_id, platform);

-- IntegrationHealthCenter counts (healthy / warnings / critical)
CREATE INDEX IF NOT EXISTS idx_social_accounts_brand_status
    ON social_accounts (brand_id, sync_status, is_primary);

-- ── brand_knowledge ───────────────────────────────────────────────────────────

-- AI knowledge retrieval: WHERE brand_id=? AND type=? AND is_active=true
CREATE INDEX IF NOT EXISTS idx_brand_knowledge_brand_type_active
    ON brand_knowledge (brand_id, type)
    WHERE is_active = true;

-- ── oauth_tokens ──────────────────────────────────────────────────────────────

-- Token refresh cron: WHERE expires_at < now() + interval AND is_valid=true
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expiry_valid
    ON oauth_tokens (expires_at)
    WHERE is_valid = true;

-- ── analytics_page_facts ──────────────────────────────────────────────────────

-- WebsiteTab: WHERE brand_id=? AND fact_date >= ?
CREATE INDEX IF NOT EXISTS idx_analytics_page_facts_brand_date
    ON analytics_page_facts (brand_id, fact_date DESC);

-- ── seo_page_facts ────────────────────────────────────────────────────────────

-- SEOTab getSEOBreakdown: WHERE brand_id=? AND fact_date >= ?
CREATE INDEX IF NOT EXISTS idx_seo_page_facts_brand_date
    ON seo_page_facts (brand_id, fact_date DESC);

-- ── ad_campaign_facts ─────────────────────────────────────────────────────────

-- AdsTab: WHERE brand_id=? AND fact_date >= ? ORDER BY fact_date DESC
CREATE INDEX IF NOT EXISTS idx_ad_campaign_facts_brand_date
    ON ad_campaign_facts (brand_id, fact_date DESC);

-- Provider filter: WHERE brand_id=? AND provider=?
CREATE INDEX IF NOT EXISTS idx_ad_campaign_facts_brand_provider
    ON ad_campaign_facts (brand_id, provider);

-- ── analytics_sync_jobs ───────────────────────────────────────────────────────

-- SyncStatusBar getLastSyncJobs: WHERE brand_id=? ORDER BY started_at DESC
CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_brand_started
    ON analytics_sync_jobs (brand_id, started_at DESC);

-- ── social_messages ───────────────────────────────────────────────────────────

-- Inbox fetch: WHERE brand_id=? ORDER BY priority_score DESC
CREATE INDEX IF NOT EXISTS idx_social_messages_brand_priority
    ON social_messages (brand_id, priority_score DESC);

-- Mark as read: WHERE brand_id=? AND provider=? AND external_thread_id=?
CREATE INDEX IF NOT EXISTS idx_social_messages_brand_thread
    ON social_messages (brand_id, provider, external_thread_id);
