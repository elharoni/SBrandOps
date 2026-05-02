-- 051: improve crm_tickets — add missing columns, indexes, and updated_at trigger

-- ── New columns (safe to run even if already applied) ────────────────────────
ALTER TABLE public.crm_tickets
    ADD COLUMN IF NOT EXISTS assignee_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS due_date     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS metadata     JSONB       NOT NULL DEFAULT '{}';

-- ── New indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS crm_tickets_priority_idx ON public.crm_tickets (brand_id, priority);
CREATE INDEX IF NOT EXISTS crm_tickets_customer_idx ON public.crm_tickets (brand_id, customer_id);
CREATE INDEX IF NOT EXISTS crm_tickets_assignee_idx ON public.crm_tickets (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_tickets_due_date_idx ON public.crm_tickets (brand_id, due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_tickets_search_idx ON public.crm_tickets USING gin(
    to_tsvector('simple',
        coalesce(subject, '') || ' ' || coalesce(description, '')
    )
);

-- ── updated_at trigger (reuses set_updated_at() defined in migration 016) ────
DROP TRIGGER IF EXISTS crm_tickets_updated_at ON public.crm_tickets;
CREATE TRIGGER crm_tickets_updated_at
    BEFORE UPDATE ON public.crm_tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
