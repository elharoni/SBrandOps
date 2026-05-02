-- ============================================================
-- Migration 056: Ad Entities — Adsets, Ads, Creatives, Audiences
-- ============================================================
-- Adds the sub-campaign level tables required for M1 insights
-- and M4 execution:
--   ad_adsets    — Meta/Google ad sets under each campaign
--   ad_ads       — Individual ads under each adset
--   ad_creatives — Creative assets (copy + media) per brand
--   ad_audiences — Custom/Lookalike/Saved audiences per brand
-- Also adds media_plan_id FK stub on ad_campaigns (FK resolved in 057).
-- ============================================================

-- ── ad_adsets ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ad_adsets (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    campaign_id         UUID        NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    ad_account_uuid     UUID        REFERENCES ad_accounts(id) ON DELETE SET NULL,
    external_id         TEXT,
    -- Meta adset ID (null until submitted to Meta)
    name                TEXT        NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'active',
    -- Meta-reported status: 'active' | 'paused' | 'deleted' | 'archived'
    internal_status     TEXT        NOT NULL DEFAULT 'draft',
    -- 'draft' | 'pending_approval' | 'submitted' | 'live' | 'paused' | 'killed' | 'error'
    funnel_layer        TEXT        NOT NULL DEFAULT 'tofu',
    -- 'tofu' | 'mofu' | 'bofu'
    daily_budget        NUMERIC(12, 2),
    lifetime_budget     NUMERIC(12, 2),
    bid_strategy        TEXT,
    -- 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'BID_CAP'
    targeting           JSONB       NOT NULL DEFAULT '{}',
    optimization_goal   TEXT,
    billing_event       TEXT,
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    frequency           NUMERIC(6, 2),
    -- latest frequency value from Meta insights
    error_message       TEXT,
    fbtrace_id          TEXT,
    synced_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_adsets_campaign     ON ad_adsets (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_adsets_brand        ON ad_adsets (brand_id, internal_status);
CREATE INDEX IF NOT EXISTS idx_ad_adsets_external     ON ad_adsets (brand_id, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE ad_adsets ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ad_adsets' AND policyname = 'ad_adsets_brand_members'
    ) THEN
        CREATE POLICY "ad_adsets_brand_members"
            ON ad_adsets FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── ad_creatives ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ad_creatives (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    external_id     TEXT,
    -- Meta AdCreative ID after upload
    name            TEXT        NOT NULL,
    headline        TEXT,
    primary_text    TEXT,
    description     TEXT,
    call_to_action  TEXT,
    -- 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | 'CONTACT_US' | 'BOOK_NOW'
    media_urls      TEXT[]      NOT NULL DEFAULT '{}',
    -- uploaded asset URLs (Supabase Storage)
    framework_tag   TEXT,
    -- 'EIDA' | 'AIDA' | 'AR_HPESOS' | 'TEASER_BUILD_OWN'
    language        TEXT        NOT NULL DEFAULT 'ar',
    status          TEXT        NOT NULL DEFAULT 'draft',
    -- 'draft' | 'uploaded' | 'active' | 'fatigued' | 'error'
    fatigue_score   NUMERIC(5, 2),
    -- 0-100 computed from frequency + CTR drop
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_creatives_brand ON ad_creatives (brand_id, status);

ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ad_creatives' AND policyname = 'ad_creatives_brand_members'
    ) THEN
        CREATE POLICY "ad_creatives_brand_members"
            ON ad_creatives FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── ad_ads ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ad_ads (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    adset_id        UUID        NOT NULL REFERENCES ad_adsets(id) ON DELETE CASCADE,
    external_id     TEXT,
    -- Meta ad ID (null until submitted)
    name            TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'active',
    internal_status TEXT        NOT NULL DEFAULT 'draft',
    creative_id     UUID        REFERENCES ad_creatives(id) ON DELETE SET NULL,
    error_message   TEXT,
    fbtrace_id      TEXT,
    synced_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_ads_adset    ON ad_ads (adset_id);
CREATE INDEX IF NOT EXISTS idx_ad_ads_brand    ON ad_ads (brand_id, internal_status);
CREATE INDEX IF NOT EXISTS idx_ad_ads_external ON ad_ads (brand_id, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE ad_ads ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ad_ads' AND policyname = 'ad_ads_brand_members'
    ) THEN
        CREATE POLICY "ad_ads_brand_members"
            ON ad_ads FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── ad_audiences ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ad_audiences (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    ad_account_uuid UUID        REFERENCES ad_accounts(id) ON DELETE SET NULL,
    external_id     TEXT,
    -- Meta audience ID after push
    name            TEXT        NOT NULL,
    audience_type   TEXT        NOT NULL,
    -- 'custom' | 'lookalike' | 'saved'
    source          TEXT,
    -- 'customer_list' | 'website' | 'engagement' | 'lookalike_source_id'
    source_size     INTEGER,
    approx_size     INTEGER,
    -- Meta estimated reach size
    status          TEXT        NOT NULL DEFAULT 'pending',
    -- 'pending' | 'ready' | 'error'
    spec            JSONB       NOT NULL DEFAULT '{}',
    -- full audience spec — no PII, only hashed references
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_audiences_brand ON ad_audiences (brand_id, status);

ALTER TABLE ad_audiences ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ad_audiences' AND policyname = 'ad_audiences_brand_members'
    ) THEN
        CREATE POLICY "ad_audiences_brand_members"
            ON ad_audiences FOR ALL
            USING (
                brand_id IN (
                    SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── Stub media_plan_id on ad_campaigns ────────────────────────────────────────
-- FK constraint added in migration 057 after media_plans table is created.

ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS media_plan_id UUID;
-- FK: ALTER TABLE ad_campaigns ADD CONSTRAINT fk_ad_campaigns_media_plan
--       FOREIGN KEY (media_plan_id) REFERENCES media_plans(id) ON DELETE SET NULL;
-- Added in migration 057.

-- ── Extend ad_insights unique constraint to cover adset/ad levels ──────────────
-- The existing constraint covers (brand_id, provider, external_object_id, object_type, date).
-- object_type = 'adset' | 'ad' uses external_object_id = adset/ad external ID.
-- No schema change needed — the existing constraint handles all three levels.
