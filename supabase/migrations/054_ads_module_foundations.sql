-- ============================================================
-- Migration 054: Ads Module Foundations
-- ============================================================
-- Adds the core tables for the Brand Media Buyer (BMB) system:
--   ad_accounts        — real ad account records per brand (replaces mock)
--   cpa_targets        — per-brand per-funnel CPA targets for BMB decisions
--   automation_policies— MANUAL / AUTO / TIERED mode per brand
--   rate_limit_states  — Meta API rate limit tracking per ad account
--   ads_audit_log      — append-only audit trail for all campaign state changes
-- Also extends ad_campaigns with funnel_layer + internal_status columns.
-- ============================================================

-- ── ad_accounts ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ad_accounts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    provider            TEXT        NOT NULL,
    -- 'meta' | 'google_ads' | 'tiktok_ads'
    external_id         TEXT        NOT NULL,
    -- Meta: act_xxxxxxxxx (without "act_" prefix stored separately — full string here)
    name                TEXT        NOT NULL,
    currency            TEXT        NOT NULL DEFAULT 'EGP',
    timezone_name       TEXT        NOT NULL DEFAULT 'Africa/Cairo',
    business_id         TEXT,
    page_id             TEXT,
    ig_account_id       TEXT,
    pixel_id            TEXT,
    token_ref           UUID        REFERENCES oauth_tokens(id) ON DELETE SET NULL,
    connection_health   TEXT        NOT NULL DEFAULT 'healthy',
    -- 'healthy' | 'degraded' | 'disconnected'
    meta_connected      BOOLEAN     NOT NULL DEFAULT false,
    connected_at        TIMESTAMPTZ,
    last_verified_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ad_accounts_brand_provider_unique UNIQUE (brand_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_brand    ON ad_accounts (brand_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_provider ON ad_accounts (provider, connection_health);

ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ad_accounts' AND policyname = 'ad_accounts_brand_members'
    ) THEN
        CREATE POLICY "ad_accounts_brand_members"
            ON ad_accounts FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── cpa_targets ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cpa_targets (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    funnel_layer    TEXT        NOT NULL,
    -- 'tofu' | 'mofu' | 'bofu'
    target_cpa      NUMERIC(12, 2) NOT NULL,
    currency        TEXT        NOT NULL DEFAULT 'EGP',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID        REFERENCES auth.users(id),
    CONSTRAINT cpa_targets_brand_layer_unique UNIQUE (brand_id, funnel_layer)
);

ALTER TABLE cpa_targets ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cpa_targets' AND policyname = 'cpa_targets_brand_members'
    ) THEN
        CREATE POLICY "cpa_targets_brand_members"
            ON cpa_targets FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── automation_policies ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_policies (
    id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id                        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    mode                            TEXT        NOT NULL DEFAULT 'manual',
    -- 'manual' | 'auto' | 'tiered'
    max_auto_launch_adset_budget    NUMERIC(12, 2) NOT NULL DEFAULT 500,
    approved_template_ids           TEXT[]      NOT NULL DEFAULT '{}',
    max_auto_scale_percent          INTEGER     NOT NULL DEFAULT 20,
    kill_cpa_multiplier             NUMERIC(4, 2)  NOT NULL DEFAULT 2.0,
    kill_window_hours               INTEGER     NOT NULL DEFAULT 48,
    max_daily_spend_per_campaign    NUMERIC(12, 2) NOT NULL DEFAULT 2000,
    max_adsets_per_campaign         INTEGER     NOT NULL DEFAULT 10,
    max_concurrent_live_campaigns   INTEGER     NOT NULL DEFAULT 15,
    tiered_auto_launch_layers       TEXT[]      NOT NULL DEFAULT '{tofu}',
    monthly_budget                  NUMERIC(12, 2),
    -- if set: auto-launch blocked when MTD spend > 90% of this value
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by                      UUID        REFERENCES auth.users(id),
    CONSTRAINT automation_policies_brand_unique UNIQUE (brand_id)
);

ALTER TABLE automation_policies ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'automation_policies' AND policyname = 'automation_policies_brand_members'
    ) THEN
        CREATE POLICY "automation_policies_brand_members"
            ON automation_policies FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── rate_limit_states ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limit_states (
    id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_account_id                   UUID        NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
    bucket                          TEXT        NOT NULL,
    -- 'app' | 'ad_account' | 'page'
    call_count_pct                  NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_cputime_pct               NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_time_pct                  NUMERIC(5, 2) NOT NULL DEFAULT 0,
    type                            TEXT,
    estimated_time_to_regain_access INTEGER,
    -- seconds until limit resets (from Meta header)
    observed_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rate_limit_states_account_bucket UNIQUE (ad_account_id, bucket)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_states_account ON rate_limit_states (ad_account_id);

-- rate_limit_states is internal — no RLS needed (only written by service role)

-- ── ads_audit_log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ads_audit_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    entity_type     TEXT        NOT NULL,
    -- 'ad_account' | 'campaign' | 'adset' | 'ad' | 'decision' | 'policy' | 'media_plan'
    entity_id       UUID        NOT NULL,
    action          TEXT        NOT NULL,
    -- 'created' | 'status_changed' | 'budget_updated' | 'approved' | 'rejected'
    -- | 'executed' | 'connected' | 'disconnected' | 'policy_updated'
    actor_type      TEXT        NOT NULL,
    -- 'operator' | 'bmb' | 'system'
    actor_id        TEXT,
    -- user UUID or 'bmb:{run_id}'
    before_state    JSONB,
    after_state     JSONB,
    mode_at_time    TEXT,
    -- automation policy mode at the time of this action
    fbtrace_id      TEXT,
    -- Meta fbtrace_id from the API call that triggered this change (if any)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_audit_log_entity ON ads_audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_audit_log_brand  ON ads_audit_log (brand_id, created_at DESC);

ALTER TABLE ads_audit_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ads_audit_log' AND policyname = 'ads_audit_log_brand_members'
    ) THEN
        CREATE POLICY "ads_audit_log_brand_members"
            ON ads_audit_log FOR SELECT
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── Extend ad_campaigns ───────────────────────────────────────────────────────

ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS funnel_layer     TEXT        NOT NULL DEFAULT 'tofu',
    ADD COLUMN IF NOT EXISTS internal_status  TEXT        NOT NULL DEFAULT 'live',
    -- default 'live' for existing rows synced from Meta
    -- new rows: 'draft' | 'pending_approval' | 'submitted' | 'live' | 'paused' | 'killed' | 'error'
    ADD COLUMN IF NOT EXISTS ad_account_uuid  UUID        REFERENCES ad_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS error_message    TEXT,
    ADD COLUMN IF NOT EXISTS fbtrace_id       TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_funnel   ON ad_campaigns (brand_id, funnel_layer);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_internal ON ad_campaigns (brand_id, internal_status);
