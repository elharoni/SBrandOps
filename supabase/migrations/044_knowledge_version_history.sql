-- Migration 044: Knowledge Base Version History
-- Creates brand_knowledge_history table + trigger to capture versions on update

CREATE TABLE IF NOT EXISTS public.brand_knowledge_history (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_id    uuid NOT NULL REFERENCES public.brand_knowledge(id) ON DELETE CASCADE,
    brand_id        uuid NOT NULL,
    version_number  integer NOT NULL DEFAULT 1,
    title           text NOT NULL,
    content         text NOT NULL,
    metadata        jsonb DEFAULT '{}',
    changed_at      timestamptz NOT NULL DEFAULT now(),
    changed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for fast history lookup per entry
CREATE INDEX IF NOT EXISTS idx_knowledge_history_knowledge_id
    ON public.brand_knowledge_history(knowledge_id, version_number DESC);

-- Auto-compute version_number from existing history count
CREATE OR REPLACE FUNCTION public.capture_knowledge_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_next_version integer;
BEGIN
    -- Only snapshot when title or content actually changed
    IF OLD.title IS DISTINCT FROM NEW.title OR OLD.content IS DISTINCT FROM NEW.content THEN
        SELECT COALESCE(MAX(version_number), 0) + 1
          INTO v_next_version
          FROM public.brand_knowledge_history
         WHERE knowledge_id = OLD.id;

        INSERT INTO public.brand_knowledge_history
            (knowledge_id, brand_id, version_number, title, content, metadata, changed_at)
        VALUES
            (OLD.id, OLD.brand_id, v_next_version, OLD.title, OLD.content, OLD.metadata, now());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_version ON public.brand_knowledge;
CREATE TRIGGER trg_knowledge_version
    BEFORE UPDATE ON public.brand_knowledge
    FOR EACH ROW EXECUTE FUNCTION public.capture_knowledge_version();

-- RLS: users can only see history for their own brand entries
ALTER TABLE public.brand_knowledge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_history_select_own"
    ON public.brand_knowledge_history
    FOR SELECT
    USING (
        brand_id IN (
            SELECT id FROM public.brands WHERE owner_id = auth.uid()
        )
    );
