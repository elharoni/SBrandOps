-- 050: support tickets table for CRM module

CREATE TABLE IF NOT EXISTS public.crm_tickets (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id          UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    customer_id       UUID        REFERENCES public.crm_customers(id) ON DELETE SET NULL,
    subject           TEXT        NOT NULL,
    description       TEXT,
    status            TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority          TEXT        NOT NULL DEFAULT 'medium'
                                  CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    source            TEXT        DEFAULT 'manual'
                                  CHECK (source IN ('email', 'chat', 'phone', 'social', 'manual')),
    -- assignee_id: FK for proper team assignment (assignee_name kept for display cache)
    assignee_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    assignee_name     TEXT,
    due_date          TIMESTAMPTZ,                      -- SLA deadline
    first_response_at TIMESTAMPTZ,
    resolved_at       TIMESTAMPTZ,
    tags              TEXT[]      NOT NULL DEFAULT '{}',
    metadata          JSONB       NOT NULL DEFAULT '{}',-- extensible: email thread IDs, chat session, etc.
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'crm_tickets'
          AND policyname = 'crm_tickets_brand_access'
    ) THEN
        CREATE POLICY crm_tickets_brand_access ON public.crm_tickets
            FOR ALL TO authenticated
            USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
            WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
    END IF;
END $$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS crm_tickets_brand_idx      ON public.crm_tickets (brand_id);
CREATE INDEX IF NOT EXISTS crm_tickets_status_idx     ON public.crm_tickets (brand_id, status);
CREATE INDEX IF NOT EXISTS crm_tickets_priority_idx   ON public.crm_tickets (brand_id, priority);
CREATE INDEX IF NOT EXISTS crm_tickets_customer_idx   ON public.crm_tickets (brand_id, customer_id);
CREATE INDEX IF NOT EXISTS crm_tickets_assignee_idx   ON public.crm_tickets (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_tickets_due_date_idx   ON public.crm_tickets (brand_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_tickets_created_idx    ON public.crm_tickets (created_at DESC);

-- Full-text search on subject + description
CREATE INDEX IF NOT EXISTS crm_tickets_search_idx     ON public.crm_tickets USING gin(
    to_tsvector('simple',
        coalesce(subject, '') || ' ' || coalesce(description, '')
    )
);

-- ── updated_at trigger (reuses set_updated_at() from migration 016) ──────────
DROP TRIGGER IF EXISTS crm_tickets_updated_at ON public.crm_tickets;
CREATE TRIGGER crm_tickets_updated_at
    BEFORE UPDATE ON public.crm_tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
