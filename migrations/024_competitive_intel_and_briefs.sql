-- ============================================================
-- SBrandOps — Competitive Intel Watchlists + Content Briefs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.competitive_watchlists (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name            text NOT NULL,
    query           text NOT NULL,
    competitors     text[] NOT NULL DEFAULT '{}',
    keywords        text[] NOT NULL DEFAULT '{}',
    last_run_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitive_watchlists_brand_created
    ON public.competitive_watchlists(brand_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competitive_watchlists_brand_name
    ON public.competitive_watchlists(brand_id, lower(name));

ALTER TABLE public.competitive_watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Competitive watchlists follow brand ownership" ON public.competitive_watchlists;
CREATE POLICY "Competitive watchlists follow brand ownership"
    ON public.competitive_watchlists FOR ALL
    USING (brand_id = ANY(public.crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

DROP TRIGGER IF EXISTS trg_competitive_watchlists_updated_at ON public.competitive_watchlists;
CREATE TRIGGER trg_competitive_watchlists_updated_at
    BEFORE UPDATE ON public.competitive_watchlists
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS public.content_briefs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    source              text NOT NULL DEFAULT 'social-search',
    title               text NOT NULL,
    query               text,
    objective           text NOT NULL,
    angle               text NOT NULL,
    competitors         text[] NOT NULL DEFAULT '{}',
    keywords            text[] NOT NULL DEFAULT '{}',
    hashtags            text[] NOT NULL DEFAULT '{}',
    suggested_platforms text[] NOT NULL DEFAULT '{}',
    cta                 text,
    notes               text[] NOT NULL DEFAULT '{}',
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_briefs_brand_created
    ON public.content_briefs(brand_id, created_at DESC);

ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Content briefs follow brand ownership" ON public.content_briefs;
CREATE POLICY "Content briefs follow brand ownership"
    ON public.content_briefs FOR ALL
    USING (brand_id = ANY(public.crm_user_brand_ids()))
    WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

DROP TRIGGER IF EXISTS trg_content_briefs_updated_at ON public.content_briefs;
CREATE TRIGGER trg_content_briefs_updated_at
    BEFORE UPDATE ON public.content_briefs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
