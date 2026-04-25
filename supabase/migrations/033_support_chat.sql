-- ============================================================
-- Migration 033: Support Chat System
-- ============================================================
-- support_chat_sessions  : جلسات المحادثة لكل مستخدم
-- support_chat_messages  : رسائل كل جلسة (user | ai | agent)
-- support_tickets        : تذاكر الدعم الرسمية
-- support_ticket_replies : ردود الأدمن + ملاحظات داخلية
-- ============================================================

-- ── support_chat_sessions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_chat_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id    UUID        REFERENCES brands(id) ON DELETE SET NULL,
    language    TEXT        NOT NULL DEFAULT 'ar',   -- 'ar' | 'en'
    status      TEXT        NOT NULL DEFAULT 'active', -- 'active' | 'resolved' | 'closed'
    title       TEXT,                                  -- auto-generated from first message
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_user   ON support_chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_support_sessions_status ON support_chat_sessions (status);

ALTER TABLE support_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users see only their own sessions; admins/support see all
CREATE POLICY support_sessions_user_access ON support_chat_sessions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY support_sessions_admin_access ON support_chat_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
              AND (auth.users.raw_user_meta_data->>'role' IN ('admin', 'support_agent'))
        )
    );

-- ── support_chat_messages ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_chat_messages (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID        NOT NULL REFERENCES support_chat_sessions(id) ON DELETE CASCADE,
    sender_type  TEXT        NOT NULL,   -- 'user' | 'ai' | 'agent'
    sender_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    content      TEXT        NOT NULL,
    metadata     JSONB       DEFAULT '{}',  -- { category, priority, canResolve, suggestTicket }
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_session ON support_chat_messages (session_id, created_at);

ALTER TABLE support_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_messages_access ON support_chat_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM support_chat_sessions s
            WHERE s.id = support_chat_messages.session_id
              AND s.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
              AND (auth.users.raw_user_meta_data->>'role' IN ('admin', 'support_agent'))
        )
    );

-- ── support_tickets ───────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START 1000;

CREATE TABLE IF NOT EXISTS support_tickets (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number   INTEGER     NOT NULL DEFAULT nextval('support_ticket_number_seq'),
    session_id      UUID        REFERENCES support_chat_sessions(id) ON DELETE SET NULL,
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id        UUID        REFERENCES brands(id) ON DELETE SET NULL,

    title           TEXT        NOT NULL,
    description     TEXT        NOT NULL,
    priority        TEXT        NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high' | 'urgent'
    status          TEXT        NOT NULL DEFAULT 'open',    -- 'open' | 'in_progress' | 'resolved' | 'closed'
    category        TEXT        NOT NULL DEFAULT 'other',   -- 'technical' | 'billing' | 'feature' | 'bug' | 'other'
    language        TEXT        NOT NULL DEFAULT 'ar',

    assigned_to     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets (ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user   ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_brand  ON support_tickets (brand_id);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users see their own tickets
CREATE POLICY support_tickets_user_access ON support_tickets
    FOR ALL USING (user_id = auth.uid());

-- Admin/support_agent see all tickets
CREATE POLICY support_tickets_admin_access ON support_tickets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
              AND (auth.users.raw_user_meta_data->>'role' IN ('admin', 'support_agent'))
        )
    );

-- ── support_ticket_replies ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_ticket_replies (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id    UUID        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_type  TEXT        NOT NULL,   -- 'user' | 'admin' | 'support_agent'
    content      TEXT        NOT NULL,
    is_internal  BOOLEAN     NOT NULL DEFAULT false,  -- internal notes (not visible to user)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON support_ticket_replies (ticket_id, created_at);

ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Users see non-internal replies on their own tickets
CREATE POLICY ticket_replies_user_access ON support_ticket_replies
    FOR SELECT USING (
        is_internal = false
        AND EXISTS (
            SELECT 1 FROM support_tickets t
            WHERE t.id = support_ticket_replies.ticket_id
              AND t.user_id = auth.uid()
        )
    );

-- Users can insert replies on their own tickets
CREATE POLICY ticket_replies_user_insert ON support_ticket_replies
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM support_tickets t
            WHERE t.id = support_ticket_replies.ticket_id
              AND t.user_id = auth.uid()
        )
    );

-- Admin/support_agent see + write all replies
CREATE POLICY ticket_replies_admin_access ON support_ticket_replies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
              AND (auth.users.raw_user_meta_data->>'role' IN ('admin', 'support_agent'))
        )
    );

COMMENT ON TABLE support_chat_sessions    IS 'Support chat sessions per user';
COMMENT ON TABLE support_chat_messages    IS 'Messages within a support chat session';
COMMENT ON TABLE support_tickets          IS 'Formal support tickets with sequential numbering';
COMMENT ON TABLE support_ticket_replies   IS 'Agent and user replies on support tickets';
