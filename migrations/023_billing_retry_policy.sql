ALTER TABLE public.billing_events
    ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_billing_events_next_retry_at
    ON public.billing_events(next_retry_at)
    WHERE processing_status = 'failed' AND next_retry_at IS NOT NULL;
