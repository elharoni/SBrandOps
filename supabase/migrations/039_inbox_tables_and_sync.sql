-- ============================================================
-- Migration 039: Inbox Tables + Sync Support
-- ============================================================
-- Creates inbox_conversations and inbox_messages tables if they
-- don't exist, then adds all columns required by:
--   • inboxService.ts (status, priority, tags, crm_customer_id, account_name, account_id)
--   • sync-inbox Edge Function (external_id + unique constraint for upsert deduplication)
--   • inbox_messages.external_message_id for message deduplication
-- All ALTER TABLE statements are idempotent (IF NOT EXISTS).
-- ============================================================

-- ── inbox_conversations ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inbox_conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'Message',
    external_id         TEXT,
    user_name           TEXT,
    user_handle         TEXT,
    user_avatar_url     TEXT,
    last_message_text   TEXT DEFAULT '',
    last_message_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read             BOOLEAN NOT NULL DEFAULT false,
    assignee            TEXT,
    intent              TEXT,
    sentiment           TEXT,
    ai_summary          TEXT,
    analyzed_at         TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'open',
    priority            TEXT NOT NULL DEFAULT 'medium',
    tags                TEXT[] NOT NULL DEFAULT '{}',
    crm_customer_id     UUID,
    account_name        TEXT,
    account_id          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns to existing table (safe to run repeatedly)
ALTER TABLE public.inbox_conversations
    ADD COLUMN IF NOT EXISTS external_id         TEXT,
    ADD COLUMN IF NOT EXISTS status              TEXT NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS priority            TEXT NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS tags                TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS crm_customer_id     UUID,
    ADD COLUMN IF NOT EXISTS account_name        TEXT,
    ADD COLUMN IF NOT EXISTS account_id          TEXT,
    ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT now();

-- Unique constraint for sync-inbox upsert deduplication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'inbox_conversations_brand_platform_external_id_key'
    ) THEN
        ALTER TABLE public.inbox_conversations
            ADD CONSTRAINT inbox_conversations_brand_platform_external_id_key
            UNIQUE (brand_id, platform, external_id);
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbox_conv_brand_platform ON public.inbox_conversations (brand_id, platform);
CREATE INDEX IF NOT EXISTS idx_inbox_conv_brand_status   ON public.inbox_conversations (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_inbox_conv_last_msg       ON public.inbox_conversations (brand_id, last_message_at DESC);

-- RLS
ALTER TABLE public.inbox_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inbox_conversations' AND policyname = 'inbox_conversations_brand_access'
    ) THEN
        CREATE POLICY inbox_conversations_brand_access ON public.inbox_conversations
            FOR ALL USING (
                brand_id IN (
                    SELECT id FROM brands WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── inbox_messages ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inbox_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    sender              TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'agent'
    text                TEXT NOT NULL DEFAULT '',
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    external_message_id TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns
ALTER TABLE public.inbox_messages
    ADD COLUMN IF NOT EXISTS brand_id            UUID REFERENCES brands(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS external_message_id TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbox_msg_conv    ON public.inbox_messages (conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_inbox_msg_brand   ON public.inbox_messages (brand_id);

-- RLS
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inbox_messages' AND policyname = 'inbox_messages_brand_access'
    ) THEN
        CREATE POLICY inbox_messages_brand_access ON public.inbox_messages
            FOR ALL USING (
                brand_id IN (
                    SELECT id FROM brands WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── inbox_keyword_rules ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inbox_keyword_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    keyword     TEXT NOT NULL,
    tag         TEXT NOT NULL,
    priority    TEXT NOT NULL DEFAULT 'medium',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, keyword)
);

ALTER TABLE public.inbox_keyword_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inbox_keyword_rules' AND policyname = 'inbox_keyword_rules_brand_access'
    ) THEN
        CREATE POLICY inbox_keyword_rules_brand_access ON public.inbox_keyword_rules
            FOR ALL USING (
                brand_id IN (
                    SELECT id FROM brands WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ── inbox_conversation_notes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inbox_conversation_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES auth.users(id),
    note            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_conversation_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inbox_conversation_notes' AND policyname = 'inbox_notes_brand_access'
    ) THEN
        CREATE POLICY inbox_notes_brand_access ON public.inbox_conversation_notes
            FOR ALL USING (
                brand_id IN (
                    SELECT id FROM brands WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;
