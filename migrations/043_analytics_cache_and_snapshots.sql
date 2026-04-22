-- ============================================================
-- Migration 043: Performance & Analytics Tables
-- A. brand_analytics_cache  — Cache التحليلات لتسريع الصفحات
-- B. follower_snapshots     — لقطات يومية لنمو المتابعين
-- ============================================================

-- ── A. brand_analytics_cache ─────────────────────────────────
-- يخزّن نتائج الاستعلامات الثقيلة لمدة محدودة
-- Edge Function تحدّث الـ Cache كل 6 ساعات أو عند الطلب

CREATE TABLE IF NOT EXISTS public.brand_analytics_cache (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    UUID        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

    -- مفتاح التخزين المؤقت
    cache_key   TEXT        NOT NULL,
    period      TEXT        NOT NULL,
    -- platform: '__all__' يعني كل المنصات (بدل NULL لتجنب مشاكل UNIQUE INDEX)
    platform    TEXT        NOT NULL DEFAULT '__all__',

    -- البيانات المخزّنة
    data        JSONB       NOT NULL DEFAULT '{}',

    -- صلاحية الـ Cache
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '6 hours',

    UNIQUE (brand_id, cache_key, platform)
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_brand_expiry
    ON public.brand_analytics_cache (brand_id, expires_at DESC);

-- ملاحظة: لا نستخدم WHERE now() في الـ Index لأن now() ليست IMMUTABLE في PostgreSQL
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires_at
    ON public.brand_analytics_cache (expires_at ASC);

ALTER TABLE public.brand_analytics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_cache_brand_owner"
    ON public.brand_analytics_cache FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- دالة تنظيف الـ Cache المنتهية الصلاحية
CREATE OR REPLACE FUNCTION public.cleanup_expired_analytics_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.brand_analytics_cache
    WHERE expires_at < now() - INTERVAL '1 hour';  -- هامش ساعة بعد الانتهاء
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- جدولة التنظيف كل 12 ساعة (يتطلب pg_cron)
-- SELECT cron.schedule('cleanup-analytics-cache', '0 */12 * * *',
--     'SELECT public.cleanup_expired_analytics_cache()');

COMMENT ON TABLE public.brand_analytics_cache IS
    'Cache لنتائج التحليلات الثقيلة — يتجدد كل 6 ساعات';

-- ── B. follower_snapshots ─────────────────────────────────────
-- لقطة يومية لعدد المتابعين لكل حساب اجتماعي
-- يُستخدم لرسم منحنى نمو المتابعين في صفحة التحليلات

CREATE TABLE IF NOT EXISTS public.follower_snapshots (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    social_account_id UUID        NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    brand_id          UUID        NOT NULL REFERENCES public.brands(id)          ON DELETE CASCADE,

    -- بيانات المنصة
    platform          TEXT        NOT NULL,

    -- الأرقام
    followers_count   INTEGER     NOT NULL,
    following_count   INTEGER,
    posts_count       INTEGER,
    engagement_rate   NUMERIC(5,2),   -- متوسط معدل التفاعل لـ 7 منشورات الأخيرة

    -- التاريخ (لقطة واحدة يومياً)
    snapshot_date     DATE        NOT NULL DEFAULT CURRENT_DATE,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_follower_snapshot_account_date
        UNIQUE (social_account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_follower_snapshots_account_date
    ON public.follower_snapshots (social_account_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_follower_snapshots_brand_platform
    ON public.follower_snapshots (brand_id, platform, snapshot_date DESC);

ALTER TABLE public.follower_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follower_snapshots_brand_owner"
    ON public.follower_snapshots FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- دالة: جلب منحنى نمو المتابعين لبراند
CREATE OR REPLACE FUNCTION public.get_follower_growth(
    p_brand_id UUID,
    p_days     INTEGER DEFAULT 30,
    p_platform TEXT    DEFAULT NULL
)
RETURNS TABLE (
    snapshot_date   DATE,
    platform        TEXT,
    followers_count INTEGER,
    daily_change    INTEGER,
    pct_change      NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    WITH ranked AS (
        SELECT
            snapshot_date,
            platform,
            followers_count,
            LAG(followers_count) OVER (
                PARTITION BY social_account_id
                ORDER BY snapshot_date
            ) AS prev_count
        FROM public.follower_snapshots
        WHERE brand_id      = p_brand_id
          AND (p_platform IS NULL OR platform = p_platform)
          AND snapshot_date >= CURRENT_DATE - p_days
        ORDER BY snapshot_date
    )
    SELECT
        snapshot_date,
        platform,
        followers_count,
        (followers_count - COALESCE(prev_count, followers_count))::INTEGER AS daily_change,
        CASE
            WHEN prev_count > 0
            THEN ROUND((followers_count - prev_count)::NUMERIC / prev_count * 100, 2)
            ELSE 0
        END AS pct_change
    FROM ranked
    ORDER BY snapshot_date ASC, platform;
$$;

GRANT EXECUTE ON FUNCTION public.get_follower_growth(UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON TABLE public.follower_snapshots IS
    'لقطات يومية لعدد المتابعين — لرسم منحنى النمو في التحليلات';
