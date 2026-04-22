-- ============================================================
-- Migration 041: SEO Data Tables
-- جداول تخزين بيانات SEO الحقيقية
-- ============================================================

-- ── دالة مشتركة (CREATE OR REPLACE لضمان وجودها) ─────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

-- ── A. جدول صفحات SEO ────────────────────────────────────────
DROP TABLE IF EXISTS public.seo_pages CASCADE;

CREATE TABLE public.seo_pages (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id         UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    url              TEXT        NOT NULL,
    page_title       TEXT,
    meta_description TEXT,
    h1               TEXT,
    canonical_url    TEXT,

    content_score    INTEGER     CHECK (content_score    BETWEEN 0 AND 100),
    technical_score  INTEGER     CHECK (technical_score  BETWEEN 0 AND 100),
    seo_score        INTEGER     CHECK (seo_score        BETWEEN 0 AND 100),
    audit_results    JSONB       NOT NULL DEFAULT '{}',

    source           TEXT        NOT NULL DEFAULT 'manual',
    status           TEXT        NOT NULL DEFAULT 'active',

    impressions_30d  INTEGER     DEFAULT 0,
    clicks_30d       INTEGER     DEFAULT 0,
    avg_position     NUMERIC(5,2),

    last_audited_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_seo_pages_brand_url UNIQUE (brand_id, url)
);

CREATE INDEX idx_seo_pages_brand
    ON public.seo_pages (brand_id, updated_at DESC);

CREATE INDEX idx_seo_pages_score
    ON public.seo_pages (brand_id, seo_score ASC NULLS LAST);

DROP TRIGGER IF EXISTS trg_seo_pages_updated_at ON public.seo_pages;
CREATE TRIGGER trg_seo_pages_updated_at
    BEFORE UPDATE ON public.seo_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_pages_brand_owner"
    ON public.seo_pages FOR ALL
    USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- ── B. جدول الكلمات المفتاحية ────────────────────────────────
DROP TABLE IF EXISTS public.seo_keyword_history CASCADE;
DROP TABLE IF EXISTS public.seo_keywords CASCADE;

CREATE TABLE public.seo_keywords (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id         UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    seo_page_id      UUID        REFERENCES public.seo_pages(id) ON DELETE SET NULL,

    keyword          TEXT        NOT NULL,
    language         TEXT        NOT NULL DEFAULT 'ar',
    location         TEXT,

    search_volume    INTEGER,
    difficulty       INTEGER     CHECK (difficulty BETWEEN 0 AND 100),
    cpc              NUMERIC(10,2),

    current_rank     INTEGER,
    previous_rank    INTEGER,
    rank_change      INTEGER     DEFAULT 0,
    -- rank_change يُحسب تلقائياً عبر Trigger أدناه
    best_rank        INTEGER,

    impressions_7d   INTEGER     DEFAULT 0,
    clicks_7d        INTEGER     DEFAULT 0,
    avg_position_7d  NUMERIC(5,2),

    featured_snippet BOOLEAN     NOT NULL DEFAULT false,
    people_also_ask  BOOLEAN     NOT NULL DEFAULT false,

    source           TEXT        NOT NULL DEFAULT 'manual',
    last_checked_at  TIMESTAMPTZ,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_seo_keywords_brand_keyword UNIQUE (brand_id, keyword)
);

CREATE INDEX idx_seo_keywords_brand
    ON public.seo_keywords (brand_id, updated_at DESC);

CREATE INDEX idx_seo_keywords_rank
    ON public.seo_keywords (brand_id, current_rank ASC NULLS LAST);

CREATE INDEX idx_seo_keywords_volume
    ON public.seo_keywords (brand_id, search_volume DESC NULLS LAST);

-- Trigger: حساب rank_change تلقائياً عند UPDATE
CREATE OR REPLACE FUNCTION public.calc_keyword_rank_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- حفظ الرتبة السابقة
    IF NEW.current_rank IS DISTINCT FROM OLD.current_rank THEN
        NEW.previous_rank := OLD.current_rank;
        NEW.rank_change   := COALESCE(OLD.current_rank, 0) - COALESCE(NEW.current_rank, 0);

        -- تحديث best_rank إذا تحسّنت الرتبة
        IF NEW.current_rank IS NOT NULL THEN
            IF OLD.best_rank IS NULL OR NEW.current_rank < OLD.best_rank THEN
                NEW.best_rank := NEW.current_rank;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seo_keywords_rank_change ON public.seo_keywords;
CREATE TRIGGER trg_seo_keywords_rank_change
    BEFORE UPDATE ON public.seo_keywords
    FOR EACH ROW
    EXECUTE FUNCTION public.calc_keyword_rank_change();

DROP TRIGGER IF EXISTS trg_seo_keywords_updated_at ON public.seo_keywords;
CREATE TRIGGER trg_seo_keywords_updated_at
    BEFORE UPDATE ON public.seo_keywords
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_keywords_brand_owner"
    ON public.seo_keywords FOR ALL
    USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- ── C. سجل تاريخ الرتب (Rank History) ──────────────────────
CREATE TABLE public.seo_keyword_history (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id     UUID        NOT NULL REFERENCES public.seo_keywords(id) ON DELETE CASCADE,
    brand_id       UUID        NOT NULL REFERENCES public.brands(id)       ON DELETE CASCADE,
    rank           INTEGER     NOT NULL,
    impressions    INTEGER     DEFAULT 0,
    clicks         INTEGER     DEFAULT 0,
    recorded_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (keyword_id, recorded_date)
);

CREATE INDEX idx_seo_keyword_history_keyword
    ON public.seo_keyword_history (keyword_id, recorded_date DESC);

ALTER TABLE public.seo_keyword_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_keyword_history_brand_owner"
    ON public.seo_keyword_history FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- ── Helper: ملخص SEO للبراند ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_seo_summary(p_brand_id UUID)
RETURNS TABLE (
    total_pages        BIGINT,
    pages_with_issues  BIGINT,
    total_keywords     BIGINT,
    keywords_top10     BIGINT,
    keywords_gaining   BIGINT,
    avg_seo_score      NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
    SELECT
        (SELECT COUNT(*) FROM public.seo_pages    WHERE brand_id = p_brand_id)                      AS total_pages,
        (SELECT COUNT(*) FROM public.seo_pages    WHERE brand_id = p_brand_id AND seo_score < 60)   AS pages_with_issues,
        (SELECT COUNT(*) FROM public.seo_keywords WHERE brand_id = p_brand_id)                      AS total_keywords,
        (SELECT COUNT(*) FROM public.seo_keywords WHERE brand_id = p_brand_id
                                                    AND current_rank BETWEEN 1 AND 10)              AS keywords_top10,
        (SELECT COUNT(*) FROM public.seo_keywords WHERE brand_id = p_brand_id
                                                    AND rank_change > 0)                            AS keywords_gaining,
        (SELECT ROUND(AVG(seo_score), 1) FROM public.seo_pages
         WHERE brand_id = p_brand_id AND seo_score IS NOT NULL)                                    AS avg_seo_score;
$$;

GRANT EXECUTE ON FUNCTION public.get_seo_summary(UUID) TO authenticated;

COMMENT ON TABLE public.seo_pages           IS 'صفحات الموقع المتابَعة مع نتائج الـ SEO Audit';
COMMENT ON TABLE public.seo_keywords        IS 'الكلمات المفتاحية المتتبَّعة والرتبة الحالية';
COMMENT ON TABLE public.seo_keyword_history IS 'سجل تاريخي لتغيّر رتب الكلمات المفتاحية';
