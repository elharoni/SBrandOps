-- ══════════════════════════════════════════════════════════════════════════════
-- 047: Media Production Flow
-- Creative Studio — خط إنتاج الميديا الكامل للبراند
-- ══════════════════════════════════════════════════════════════════════════════

-- ── media_projects: المشروع الإبداعي الرئيسي ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_projects (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- الطلب الأساسي
    title           text NOT NULL,
    goal            text NOT NULL CHECK (goal IN (
                        'awareness','engagement','conversion',
                        'leads','retention','traffic'
                    )),
    output_type     text NOT NULL CHECK (output_type IN (
                        'static','carousel','reel','story','ad','motion','mixed'
                    )),
    campaign        text,
    product_offer   text,
    cta             text,
    platforms       text[] DEFAULT '{}',
    deadline        date,
    priority        text NOT NULL DEFAULT 'normal' CHECK (priority IN (
                        'low','normal','high','urgent'
                    )),

    -- حالة المشروع عبر مراحل الإنتاج
    status          text NOT NULL DEFAULT 'request' CHECK (status IN (
                        'request','brief','matrix','production',
                        'review','approved','published','archived'
                    )),

    -- مخرجات AI
    brief           jsonb DEFAULT '{}',       -- AI-generated structured brief
    idea_matrix     jsonb DEFAULT '[]',       -- [{angle, hook, formats:[{type,description}]}]

    -- ربط الأداء بعد النشر
    performance     jsonb DEFAULT '{}',

    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_projects_brand_id
    ON public.media_projects(brand_id);
CREATE INDEX IF NOT EXISTS idx_media_projects_brand_status
    ON public.media_projects(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_media_projects_created_at
    ON public.media_projects(created_at DESC);

ALTER TABLE public.media_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own media projects" ON public.media_projects;
CREATE POLICY "Users manage own media projects"
    ON public.media_projects FOR ALL
    USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admin all media projects" ON public.media_projects;
CREATE POLICY "Super admin all media projects"
    ON public.media_projects FOR ALL
    USING (is_super_admin());

DROP TRIGGER IF EXISTS trg_media_projects_updated_at ON public.media_projects;
CREATE TRIGGER trg_media_projects_updated_at
    BEFORE UPDATE ON public.media_projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_projects TO authenticated;

-- ── media_project_pieces: القطع الإبداعية داخل المشروع ───────────────────────
CREATE TABLE IF NOT EXISTS public.media_project_pieces (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      uuid NOT NULL REFERENCES public.media_projects(id) ON DELETE CASCADE,
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    is_master       boolean NOT NULL DEFAULT false,  -- الـ Hero piece
    variant_of      uuid REFERENCES public.media_project_pieces(id) ON DELETE SET NULL,

    title           text NOT NULL,
    content         text DEFAULT '',
    track           text CHECK (track IN ('design','video','copy')),
    format          text,       -- Static / Reel / Carousel / Story / Ad / etc.
    angle           text,       -- الزاوية الإبداعية
    hook            text,       -- الـ hook المختار
    script          text,       -- للفيديو
    platform        text,       -- المنصة المستهدفة
    variant_label   text,       -- '1:1' / '9:16' / 'Arabic' / 'No-audio' / etc.

    status          text NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft','in_progress','review','approved','published'
                    )),
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_pieces_project_id  ON public.media_project_pieces(project_id);
CREATE INDEX IF NOT EXISTS idx_mp_pieces_brand_id    ON public.media_project_pieces(brand_id);

ALTER TABLE public.media_project_pieces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own mp pieces" ON public.media_project_pieces;
CREATE POLICY "Users manage own mp pieces"
    ON public.media_project_pieces FOR ALL
    USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admin all mp pieces" ON public.media_project_pieces;
CREATE POLICY "Super admin all mp pieces"
    ON public.media_project_pieces FOR ALL
    USING (is_super_admin());

DROP TRIGGER IF EXISTS trg_mp_pieces_updated_at ON public.media_project_pieces;
CREATE TRIGGER trg_mp_pieces_updated_at
    BEFORE UPDATE ON public.media_project_pieces
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_project_pieces TO authenticated;

-- ── media_project_reviews: المراجعات والموافقات ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_project_reviews (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      uuid NOT NULL REFERENCES public.media_projects(id) ON DELETE CASCADE,
    brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    piece_id        uuid REFERENCES public.media_project_pieces(id) ON DELETE SET NULL,

    review_level    text NOT NULL CHECK (review_level IN (
                        'internal','marketing','client'
                    )),
    status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending','approved','changes_requested','rejected'
                    )),
    reviewer_name   text,
    comment         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_reviews_project_id ON public.media_project_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_mp_reviews_brand_id   ON public.media_project_reviews(brand_id);

ALTER TABLE public.media_project_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own mp reviews" ON public.media_project_reviews;
CREATE POLICY "Users manage own mp reviews"
    ON public.media_project_reviews FOR ALL
    USING  (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admin all mp reviews" ON public.media_project_reviews;
CREATE POLICY "Super admin all mp reviews"
    ON public.media_project_reviews FOR ALL
    USING (is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_project_reviews TO authenticated;

-- ── view: ملخص مشاريع البراند ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.media_project_summary AS
SELECT
    p.id,
    p.brand_id,
    p.title,
    p.goal,
    p.output_type,
    p.campaign,
    p.platforms,
    p.deadline,
    p.priority,
    p.status,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT pc.id)                                          AS pieces_count,
    COUNT(DISTINCT pc.id) FILTER (WHERE pc.is_master)             AS master_count,
    COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'approved')   AS approved_pieces,
    COUNT(DISTINCT r.id)  FILTER (WHERE r.status = 'pending')     AS pending_reviews
FROM public.media_projects p
LEFT JOIN public.media_project_pieces  pc ON pc.project_id = p.id
LEFT JOIN public.media_project_reviews r  ON r.project_id  = p.id
GROUP BY p.id;

GRANT SELECT ON public.media_project_summary TO authenticated;
