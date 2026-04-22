-- ============================================================
-- Migration 022: JSONB Column Constraints
-- ============================================================
-- Prevents corrupted data from being written to critical JSONB
-- columns by enforcing type at the database level.

-- ── marketing_plans: arrays must be arrays ────────────────────────────────────
ALTER TABLE marketing_plans
    ADD CONSTRAINT chk_marketing_plans_kpis
        CHECK (kpis IS NULL OR jsonb_typeof(kpis) = 'array'),
    ADD CONSTRAINT chk_marketing_plans_channels
        CHECK (channels IS NULL OR jsonb_typeof(channels) = 'array');

-- ── scheduled_posts: publish_results must be an object if set ────────────────
ALTER TABLE scheduled_posts
    ADD CONSTRAINT chk_scheduled_posts_publish_results
        CHECK (publish_results IS NULL OR jsonb_typeof(publish_results) = 'object');
