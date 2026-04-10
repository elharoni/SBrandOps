-- ============================================================
-- Migration 016: CRM Module — Customer Hub
-- ============================================================
-- All CRM tables are scoped by brand_id (multi-tenant)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ── crm_customers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    external_id         TEXT,                        -- store-side customer ID
    first_name          TEXT,
    last_name           TEXT,
    email               TEXT,
    phone               TEXT,
    avatar_url          TEXT,
    gender              TEXT,
    birth_date          DATE,
    language            TEXT DEFAULT 'ar',
    currency            TEXT DEFAULT 'SAR',
    acquisition_source  TEXT,                        -- organic, paid, referral, social, email, direct
    acquisition_channel TEXT,                        -- facebook, google, instagram, etc.
    lifecycle_stage     TEXT NOT NULL DEFAULT 'lead',-- lead, prospect, first_purchase, active, repeat, vip, at_risk, churned
    ltv                 NUMERIC(12,2) DEFAULT 0,
    total_orders        INTEGER DEFAULT 0,
    total_spent         NUMERIC(12,2) DEFAULT 0,
    average_order_value NUMERIC(12,2) DEFAULT 0,
    refund_count        INTEGER DEFAULT 0,
    first_order_date    TIMESTAMPTZ,
    last_order_date     TIMESTAMPTZ,
    last_activity_at    TIMESTAMPTZ,
    assigned_to         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes_count         INTEGER DEFAULT 0,
    tasks_count         INTEGER DEFAULT 0,
    is_blocked          BOOLEAN DEFAULT false,
    marketing_consent   BOOLEAN DEFAULT false,
    sms_consent         BOOLEAN DEFAULT false,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_brand   ON crm_customers (brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_email   ON crm_customers (brand_id, email);
CREATE INDEX IF NOT EXISTS idx_crm_customers_phone   ON crm_customers (brand_id, phone);
CREATE INDEX IF NOT EXISTS idx_crm_customers_stage   ON crm_customers (brand_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_crm_customers_search  ON crm_customers USING gin(
    to_tsvector('simple',
        unaccent(coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,''))
    )
);

-- ── crm_customer_identities ───────────────────────────────────────────────────
-- Normalizes same person across Woo + Shopify + manual
CREATE TABLE IF NOT EXISTS crm_customer_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,   -- woocommerce, shopify, manual
    provider_id     TEXT NOT NULL,   -- external customer ID from provider
    store_url       TEXT,
    raw_data        JSONB DEFAULT '{}',
    synced_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_identities_customer ON crm_customer_identities (customer_id);

-- ── crm_addresses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_addresses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id      UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    customer_id   UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    type          TEXT DEFAULT 'shipping',  -- billing | shipping
    first_name    TEXT,
    last_name     TEXT,
    company       TEXT,
    address_1     TEXT,
    address_2     TEXT,
    city          TEXT,
    state         TEXT,
    postcode      TEXT,
    country       TEXT,
    phone         TEXT,
    is_default    BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_addresses_customer ON crm_addresses (customer_id);

-- ── crm_orders ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    customer_id         UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
    external_id         TEXT NOT NULL,           -- order number/ID from store
    store_source        TEXT NOT NULL,           -- woocommerce | shopify | manual
    store_url           TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, on-hold, completed, cancelled, refunded, failed
    payment_status      TEXT DEFAULT 'pending',   -- pending, paid, failed, refunded, partially_refunded
    shipping_status     TEXT DEFAULT 'pending',   -- pending, processing, shipped, delivered, returned
    currency            TEXT DEFAULT 'SAR',
    subtotal            NUMERIC(12,2) DEFAULT 0,
    discount_total      NUMERIC(12,2) DEFAULT 0,
    shipping_total      NUMERIC(12,2) DEFAULT 0,
    tax_total           NUMERIC(12,2) DEFAULT 0,
    total               NUMERIC(12,2) DEFAULT 0,
    refund_total        NUMERIC(12,2) DEFAULT 0,
    payment_method      TEXT,
    coupon_codes        TEXT[],
    shipping_address    JSONB,
    billing_address     JSONB,
    notes               TEXT,
    tracking_number     TEXT,
    order_date          TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    fulfilled_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    raw_data            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, store_source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_orders_brand      ON crm_orders (brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_customer   ON crm_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_status     ON crm_orders (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_orders_date       ON crm_orders (brand_id, order_date DESC);

-- ── crm_order_items ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    order_id        UUID NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
    product_id      TEXT,
    product_name    TEXT NOT NULL,
    sku             TEXT,
    variant_name    TEXT,
    quantity        INTEGER DEFAULT 1,
    unit_price      NUMERIC(12,2) DEFAULT 0,
    subtotal        NUMERIC(12,2) DEFAULT 0,
    discount        NUMERIC(12,2) DEFAULT 0,
    total           NUMERIC(12,2) DEFAULT 0,
    image_url       TEXT,
    category        TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_order_items_order ON crm_order_items (order_id);

-- ── crm_customer_tags ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_customer_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#6366f1',
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, name)
);

CREATE TABLE IF NOT EXISTS crm_customer_tag_assignments (
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES crm_customer_tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (customer_id, tag_id)
);

-- ── crm_segments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    is_dynamic      BOOLEAN DEFAULT true,   -- auto-recalculate
    is_preset       BOOLEAN DEFAULT false,  -- built-in segment
    audience_size   INTEGER DEFAULT 0,
    rules_operator  TEXT DEFAULT 'AND',     -- AND | OR
    last_calculated TIMESTAMPTZ,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── crm_segment_rules ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_segment_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id      UUID NOT NULL REFERENCES crm_segments(id) ON DELETE CASCADE,
    field           TEXT NOT NULL,         -- e.g. total_spent, lifecycle_stage, last_order_date
    operator        TEXT NOT NULL,         -- eq, neq, gt, lt, gte, lte, contains, not_contains, in, not_in, is_null, is_not_null, between
    value           TEXT,
    value_2         TEXT,                  -- for 'between' operator
    display_label   TEXT,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_segment_rules_segment ON crm_segment_rules (segment_id);

-- ── crm_notes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content         TEXT NOT NULL,
    is_pinned       BOOLEAN DEFAULT false,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_customer ON crm_notes (customer_id, created_at DESC);

-- ── crm_activities ────────────────────────────────────────────────────────────
-- Timeline events for a customer
CREATE TABLE IF NOT EXISTS crm_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type      TEXT NOT NULL,   -- customer_created, order_placed, order_paid, order_cancelled, refunded, message_sent, note_added, tag_changed, assigned, lifecycle_changed, campaign_interaction
    title           TEXT NOT NULL,
    description     TEXT,
    metadata        JSONB DEFAULT '{}',  -- order_id, tag_name, old_stage, new_stage, etc.
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_customer ON crm_activities (customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_brand    ON crm_activities (brand_id, event_type);

-- ── crm_assignments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_assignments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id      UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    customer_id   UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    assigned_to   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by   UUID REFERENCES auth.users(id),
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes         TEXT
);

-- ── crm_tasks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES crm_customers(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES crm_orders(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    task_type       TEXT DEFAULT 'follow_up',   -- follow_up, call, email, review, support, custom
    priority        TEXT DEFAULT 'medium',       -- low, medium, high, urgent
    status          TEXT DEFAULT 'open',         -- open, in_progress, done, cancelled
    due_date        TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_customer   ON crm_tasks (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned   ON crm_tasks (brand_id, assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due        ON crm_tasks (brand_id, due_date);

-- ── crm_lifecycle_states ──────────────────────────────────────────────────────
-- Configurable per-brand lifecycle stage rules
CREATE TABLE IF NOT EXISTS crm_lifecycle_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    stage           TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    display_name_ar TEXT,
    color           TEXT DEFAULT '#6366f1',
    icon            TEXT,
    sort_order      INTEGER DEFAULT 0,
    auto_rules      JSONB DEFAULT '{}',  -- conditions for auto-transition
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, stage)
);

-- ── crm_store_connections ────────────────────────────────────────────────────
-- WooCommerce + Shopify connections per brand
CREATE TABLE IF NOT EXISTS crm_store_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    provider            TEXT NOT NULL,       -- woocommerce | shopify
    store_name          TEXT,
    store_url           TEXT NOT NULL,
    consumer_key        TEXT,                -- WooCommerce
    consumer_secret     TEXT,                -- WooCommerce
    access_token        TEXT,                -- Shopify
    webhook_secret      TEXT,
    is_active           BOOLEAN DEFAULT true,
    last_sync_at        TIMESTAMPTZ,
    sync_status         TEXT DEFAULT 'idle', -- idle, running, success, error
    sync_error          TEXT,
    customers_synced    INTEGER DEFAULT 0,
    orders_synced       INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, provider, store_url)
);

CREATE INDEX IF NOT EXISTS idx_crm_store_connections_brand ON crm_store_connections (brand_id);

-- ── crm_sync_jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_sync_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    connection_id   UUID NOT NULL REFERENCES crm_store_connections(id) ON DELETE CASCADE,
    job_type        TEXT NOT NULL,       -- full_sync | incremental | webhook
    entity_type     TEXT,               -- customers | orders | products
    status          TEXT DEFAULT 'pending',   -- pending, running, success, error, partial
    total_records   INTEGER DEFAULT 0,
    processed       INTEGER DEFAULT 0,
    failed          INTEGER DEFAULT 0,
    error_log       JSONB DEFAULT '[]',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_jobs_brand ON crm_sync_jobs (brand_id, created_at DESC);

-- ── crm_webhook_events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    connection_id   UUID REFERENCES crm_store_connections(id) ON DELETE SET NULL,
    provider        TEXT NOT NULL,
    event_type      TEXT NOT NULL,       -- order.created, customer.updated, etc.
    payload         JSONB NOT NULL DEFAULT '{}',
    processed       BOOLEAN DEFAULT false,
    processed_at    TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_webhook_events_brand ON crm_webhook_events (brand_id, processed, created_at DESC);

-- ── crm_automations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_automations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN DEFAULT true,
    trigger_type    TEXT NOT NULL,   -- customer_created, order_created, first_order_completed, order_cancelled, refund_created, customer_inactive_30d, customer_inactive_60d, customer_inactive_90d, customer_spent_over_threshold, customer_tag_added, vip_customer_detected
    trigger_config  JSONB DEFAULT '{}',   -- threshold amounts, tag names, etc.
    actions         JSONB DEFAULT '[]',   -- [{type, config}]
    run_count       INTEGER DEFAULT 0,
    last_run_at     TIMESTAMPTZ,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_automations_brand ON crm_automations (brand_id, is_active);

-- ── crm_feature_flags ─────────────────────────────────────────────────────────
-- Per-brand CRM feature access (tied to plan)
CREATE TABLE IF NOT EXISTS crm_feature_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE UNIQUE,
    plan            TEXT DEFAULT 'basic',    -- basic | pro | agency
    crm_enabled     BOOLEAN DEFAULT true,
    max_customers   INTEGER DEFAULT 1000,
    max_segments    INTEGER DEFAULT 5,
    max_automations INTEGER DEFAULT 3,
    shopify_enabled BOOLEAN DEFAULT false,
    woo_enabled     BOOLEAN DEFAULT false,
    analytics_enabled BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS Policies ──────────────────────────────────────────────────────────────
ALTER TABLE crm_customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_customer_identities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_addresses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_customer_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_customer_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_segments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_segment_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_assignments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lifecycle_states       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_store_connections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_webhook_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_feature_flags          ENABLE ROW LEVEL SECURITY;

-- Helper: brand_ids accessible to current user
CREATE OR REPLACE FUNCTION crm_user_brand_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
    SELECT id FROM brands WHERE user_id = auth.uid();
$$;

-- Generic brand-scoped policy factory
CREATE POLICY crm_customers_brand_access ON crm_customers
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_identities_brand_access ON crm_customer_identities
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_addresses_brand_access ON crm_addresses
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_orders_brand_access ON crm_orders
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_order_items_brand_access ON crm_order_items
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_tags_brand_access ON crm_customer_tags
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_tag_assignments_brand_access ON crm_customer_tag_assignments
    FOR ALL USING (
        customer_id IN (SELECT id FROM crm_customers WHERE brand_id IN (SELECT crm_user_brand_ids()))
    );
CREATE POLICY crm_segments_brand_access ON crm_segments
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_segment_rules_brand_access ON crm_segment_rules
    FOR ALL USING (
        segment_id IN (SELECT id FROM crm_segments WHERE brand_id IN (SELECT crm_user_brand_ids()))
    );
CREATE POLICY crm_notes_brand_access ON crm_notes
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_activities_brand_access ON crm_activities
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_assignments_brand_access ON crm_assignments
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_tasks_brand_access ON crm_tasks
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_lifecycle_brand_access ON crm_lifecycle_states
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_store_connections_brand_access ON crm_store_connections
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_sync_jobs_brand_access ON crm_sync_jobs
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_webhook_events_brand_access ON crm_webhook_events
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_automations_brand_access ON crm_automations
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));
CREATE POLICY crm_feature_flags_brand_access ON crm_feature_flags
    FOR ALL USING (brand_id IN (SELECT crm_user_brand_ids()));

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER crm_customers_updated_at
    BEFORE UPDATE ON crm_customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER crm_orders_updated_at
    BEFORE UPDATE ON crm_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER crm_tasks_updated_at
    BEFORE UPDATE ON crm_tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER crm_store_connections_updated_at
    BEFORE UPDATE ON crm_store_connections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER crm_automations_updated_at
    BEFORE UPDATE ON crm_automations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE crm_customers          IS 'Normalized customer profiles scoped by brand';
COMMENT ON TABLE crm_orders             IS 'Normalized orders from WooCommerce, Shopify, and manual entry';
COMMENT ON TABLE crm_segments           IS 'Dynamic and static customer segments with rule-based filters';
COMMENT ON TABLE crm_store_connections  IS 'WooCommerce and Shopify store connection credentials';
COMMENT ON TABLE crm_automations        IS 'CRM automation rules: triggers + action chains';
COMMENT ON TABLE crm_feature_flags      IS 'Per-brand CRM feature access controls tied to plan';
