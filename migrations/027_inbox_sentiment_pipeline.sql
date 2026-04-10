-- Migration 027: Inbox sentiment pipeline
-- Adds persisted AI analysis fields used by Analytics and Inbox Ops.

ALTER TABLE public.inbox_conversations
    ADD COLUMN IF NOT EXISTS sentiment text,
    ADD COLUMN IF NOT EXISTS ai_summary text,
    ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inbox_conversations_sentiment_check'
    ) THEN
        ALTER TABLE public.inbox_conversations
            ADD CONSTRAINT inbox_conversations_sentiment_check
            CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative'));
    END IF;
END $$;

UPDATE public.inbox_conversations
SET analyzed_at = COALESCE(analyzed_at, last_message_at, created_at)
WHERE sentiment IS NOT NULL
  AND analyzed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_brand_sentiment
    ON public.inbox_conversations(brand_id, sentiment)
    WHERE sentiment IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_brand_analyzed_at
    ON public.inbox_conversations(brand_id, analyzed_at DESC)
    WHERE analyzed_at IS NOT NULL;
