-- ============================================================
-- Migration 017: CRM Inbox Links + Roles + Analytics tables
-- ============================================================

-- ── crm_conversation_links ────────────────────────────────────────────────────
-- Links inbox_conversations to crm_customers (1-to-1 per conversation)
CREATE TABLE IF NOT EXISTS crm_conversation_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,                          -- inbox_conversations.id (TEXT type in that table)
    customer_id     UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    matched_by      TEXT NOT NULL DEFAULT 'manual',         -- email | phone | order_id | manual
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_conv_links_customer ON crm_conversation_links (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_conv_links_brand    ON crm_conversation_links (brand_id);

ALTER TABLE crm_conversation_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_conv_links_brand_access ON crm_conversation_links
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));

-- ── crm_roles ────────────────────────────────────────────────────────────────
-- CRM-specific role definitions per brand
CREATE TABLE IF NOT EXISTS crm_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    role_key    TEXT NOT NULL,      -- owner | admin | sales_manager | sales_rep | support_agent | analyst | read_only_client
    name        TEXT NOT NULL,
    name_ar     TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',  -- array of permission strings
    is_system   BOOLEAN DEFAULT false,        -- built-in, cannot be deleted
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, role_key)
);

-- ── crm_user_roles ────────────────────────────────────────────────────────────
-- Assigns a CRM role to a user within a brand
CREATE TABLE IF NOT EXISTS crm_user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_key    TEXT NOT NULL,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_user_roles_brand_user ON crm_user_roles (brand_id, user_id);

ALTER TABLE crm_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_roles_brand_access ON crm_roles
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_user_roles_brand_access ON crm_user_roles
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));

-- ── crm_rfm_scores ────────────────────────────────────────────────────────────
-- Pre-computed RFM scores refreshed periodically
CREATE TABLE IF NOT EXISTS crm_rfm_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    recency_days    INTEGER NOT NULL DEFAULT 0,   -- days since last order
    frequency       INTEGER NOT NULL DEFAULT 0,   -- total orders
    monetary        NUMERIC(12,2) NOT NULL DEFAULT 0, -- total spent
    r_score         SMALLINT NOT NULL DEFAULT 1,  -- 1-5
    f_score         SMALLINT NOT NULL DEFAULT 1,
    m_score         SMALLINT NOT NULL DEFAULT 1,
    rfm_score       SMALLINT NOT NULL DEFAULT 3,  -- composite 1-15 (r+f+m)
    rfm_segment     TEXT NOT NULL DEFAULT 'cant_lose', -- champions | loyal | potential_loyal | new_customers | promising | need_attention | about_to_sleep | at_risk | cant_lose | lost
    calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_rfm_brand   ON crm_rfm_scores (brand_id, rfm_segment);
CREATE INDEX IF NOT EXISTS idx_crm_rfm_score   ON crm_rfm_scores (brand_id, rfm_score DESC);

ALTER TABLE crm_rfm_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_rfm_brand_access ON crm_rfm_scores
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));

-- ── crm_retention_cohorts ─────────────────────────────────────────────────────
-- Monthly retention cohort snapshots
CREATE TABLE IF NOT EXISTS crm_retention_cohorts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    cohort_month    TEXT NOT NULL,          -- e.g. '2024-01'
    period_number   INTEGER NOT NULL,       -- months after acquisition (0, 1, 2, ...)
    cohort_size     INTEGER NOT NULL,
    retained_count  INTEGER NOT NULL DEFAULT 0,
    retention_rate  NUMERIC(5,2) DEFAULT 0, -- percentage
    calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, cohort_month, period_number)
);

CREATE INDEX IF NOT EXISTS idx_crm_cohorts_brand ON crm_retention_cohorts (brand_id, cohort_month);

ALTER TABLE crm_retention_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_cohorts_brand_access ON crm_retention_cohorts
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));

COMMENT ON TABLE crm_conversation_links IS 'Links inbox conversations to CRM customers via email/phone/order_id resolution';
COMMENT ON TABLE crm_roles              IS 'CRM-specific role definitions with granular permissions per brand';
COMMENT ON TABLE crm_rfm_scores         IS 'Pre-computed RFM (Recency-Frequency-Monetary) customer scores';
COMMENT ON TABLE crm_retention_cohorts  IS 'Monthly retention cohort data for analytics';
