-- Migration 053: Unified Inbox Enhancement
-- ═══════════════════════════════════════════════════════════════════════════════
-- Adds status, priority, tags, CRM linking to inbox_conversations
-- Adds inbox_keyword_rules for keyword-based auto-classification
-- Adds inbox_conversation_notes for internal team comments

-- ── 1. Enhance inbox_conversations ───────────────────────────────────────────

ALTER TABLE public.inbox_conversations
    ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS priority      text NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS tags          text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS crm_customer_id uuid,
    ADD COLUMN IF NOT EXISTS account_name  text,     -- which page/account
    ADD COLUMN IF NOT EXISTS account_id    text;     -- external page/account ID

-- FK to crm_customers (guard: only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'crm_customers'
    ) THEN
        BEGIN
            ALTER TABLE public.inbox_conversations
                ADD CONSTRAINT fk_inbox_conv_crm_customer
                FOREIGN KEY (crm_customer_id)
                REFERENCES crm_customers(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- Check constraints (idempotent)
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.inbox_conversations
            ADD CONSTRAINT inbox_conversations_status_chk
            CHECK (status IN ('open','pending','resolved','spam','archived'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER TABLE public.inbox_conversations
            ADD CONSTRAINT inbox_conversations_priority_chk
            CHECK (priority IN ('urgent','high','medium','low'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_inbox_status
    ON public.inbox_conversations(brand_id, status);

CREATE INDEX IF NOT EXISTS idx_inbox_priority
    ON public.inbox_conversations(brand_id, priority);

CREATE INDEX IF NOT EXISTS idx_inbox_tags
    ON public.inbox_conversations USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_inbox_crm_cust
    ON public.inbox_conversations(crm_customer_id)
    WHERE crm_customer_id IS NOT NULL;

-- ── 2. inbox_keyword_rules ────────────────────────────────────────────────────
-- Stores per-brand keyword classification rules.
-- When a keyword is detected in an incoming message, the specified tag and/or
-- priority are automatically applied to the conversation.

CREATE TABLE IF NOT EXISTS public.inbox_keyword_rules (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    keyword     text NOT NULL,
    category    text NOT NULL DEFAULT 'general',  -- sales | support | price | order | complaint | spam | delivery
    group_name  text,                             -- human label e.g. "استفسار سعر"
    language    text NOT NULL DEFAULT 'both',     -- ar | en | both
    tag_to_add  text,                             -- tag applied when keyword matches
    priority    text,                             -- priority override when keyword matches
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(brand_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_keyword_rules_brand
    ON public.inbox_keyword_rules(brand_id, is_active);

ALTER TABLE public.inbox_keyword_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    BEGIN
        CREATE POLICY "Users manage own keyword rules"
            ON public.inbox_keyword_rules FOR ALL
            USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
            WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ── 3. inbox_conversation_notes ───────────────────────────────────────────────
-- Internal team notes on a conversation (never visible to the end customer).

CREATE TABLE IF NOT EXISTS public.inbox_conversation_notes (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    author          text NOT NULL DEFAULT 'Team',
    text            text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_notes_conv
    ON public.inbox_conversation_notes(conversation_id);

ALTER TABLE public.inbox_conversation_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    BEGIN
        CREATE POLICY "Users manage own inbox notes"
            ON public.inbox_conversation_notes FOR ALL
            USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
            WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ── 4. Seed default keyword rules for all existing brands ────────────────────
-- Only inserts; ON CONFLICT DO NOTHING ensures idempotency.

INSERT INTO public.inbox_keyword_rules
    (brand_id, keyword, category, group_name, language, tag_to_add, priority)
SELECT
    b.id,
    r.keyword, r.category, r.group_name, r.language, r.tag_to_add, r.priority
FROM public.brands b
CROSS JOIN (VALUES
    -- Arabic sales / price intent
    ('سعر',          'price',     'استفسار سعر',  'ar',   'price-inquiry', 'high'),
    ('كام',           'price',     'استفسار سعر',  'ar',   'price-inquiry', 'high'),
    ('بكام',          'price',     'استفسار سعر',  'ar',   'price-inquiry', 'high'),
    ('تكلفة',         'price',     'استفسار سعر',  'ar',   'price-inquiry', 'high'),
    ('عرض سعر',       'price',     'استفسار سعر',  'ar',   'price-inquiry', 'high'),
    ('متاح',          'sales',     'نية شراء',     'ar',   'hot-lead',      'high'),
    ('اشتري',         'sales',     'نية شراء',     'ar',   'hot-lead',      'urgent'),
    ('عايز اطلب',     'sales',     'نية شراء',     'ar',   'hot-lead',      'urgent'),
    ('طلب',           'order',     'طلب شراء',     'ar',   'order-intent',  'high'),
    ('اوردر',         'order',     'طلب شراء',     'ar',   'order-intent',  'high'),
    -- Arabic support / complaint
    ('مشكلة',         'complaint', 'شكوى',         'ar',   'complaint',     'high'),
    ('شكوى',          'complaint', 'شكوى',         'ar',   'complaint',     'high'),
    ('عطل',           'support',   'دعم تقني',     'ar',   'support',       'high'),
    ('مش شغال',       'support',   'دعم تقني',     'ar',   'support',       'high'),
    -- Arabic delivery
    ('توصيل',         'delivery',  'توصيل وشحن',   'ar',   'delivery',      'medium'),
    ('شحن',           'delivery',  'توصيل وشحن',   'ar',   'delivery',      'medium'),
    ('العنوان',       'delivery',  'توصيل وشحن',   'ar',   'delivery',      'medium'),
    -- English sales / price
    ('price',         'price',     'Price Inquiry', 'en',  'price-inquiry', 'high'),
    ('cost',          'price',     'Price Inquiry', 'en',  'price-inquiry', 'high'),
    ('how much',      'price',     'Price Inquiry', 'en',  'price-inquiry', 'high'),
    ('buy',           'sales',     'Hot Lead',      'en',  'hot-lead',      'urgent'),
    ('order',         'order',     'Order Intent',  'en',  'order-intent',  'high'),
    ('purchase',      'sales',     'Hot Lead',      'en',  'hot-lead',      'high'),
    -- English support
    ('complaint',     'complaint', 'Complaint',     'en',  'complaint',     'high'),
    ('issue',         'support',   'Support',       'en',  'support',       'high'),
    ('support',       'support',   'Support',       'en',  'support',       'medium'),
    ('not working',   'support',   'Support',       'en',  'support',       'high'),
    -- English delivery
    ('delivery',      'delivery',  'Delivery',      'en',  'delivery',      'medium'),
    ('shipping',      'delivery',  'Delivery',      'en',  'delivery',      'medium')
) AS r(keyword, category, group_name, language, tag_to_add, priority)
ON CONFLICT (brand_id, keyword) DO NOTHING;
