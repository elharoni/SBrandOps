-- ============================================================
-- Migration 040: Platform Publish Results
-- سجل تفصيلي لكل عملية نشر على كل منصة
-- يحتوي على Platform Post ID، رابط المنشور، الأخطاء، وإعادة المحاولة
-- ============================================================

-- ── دالة مشتركة (CREATE OR REPLACE لضمان وجودها) ─────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.platform_publish_results (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- الروابط الأساسية
    post_id             UUID        NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
    brand_id            UUID        NOT NULL REFERENCES public.brands(id)          ON DELETE CASCADE,
    social_account_id   UUID        REFERENCES public.social_accounts(id)         ON DELETE SET NULL,
    oauth_token_id      UUID        REFERENCES public.oauth_tokens(id)            ON DELETE SET NULL,

    -- بيانات النشر
    platform            TEXT        NOT NULL,  -- 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok'
    platform_account_id TEXT,                  -- Page ID / User ID على المنصة
    platform_post_id    TEXT,                  -- ID المنشور من المنصة بعد النجاح
    platform_url        TEXT,                  -- رابط مباشر للمنشور المنشور

    -- حالة النشر
    status              TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','success','failed','rate_limited','skipped')),

    -- الأخطاء
    error_code          TEXT,
    error_message       TEXT,
    error_details       JSONB       NOT NULL DEFAULT '{}',

    -- Retry Logic
    retry_count         INTEGER     NOT NULL DEFAULT 0,
    max_retries         INTEGER     NOT NULL DEFAULT 3,
    next_retry_at       TIMESTAMPTZ,

    -- التوقيت
    attempted_at        TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,
    duration_ms         INTEGER,               -- وقت تنفيذ عملية النشر

    -- الـ Response الكامل من المنصة
    response_raw        JSONB       NOT NULL DEFAULT '{}',

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────
-- جلب نتائج منشور بعينه
CREATE INDEX IF NOT EXISTS idx_publish_results_post_id
    ON public.platform_publish_results (post_id);

-- لوحة تحكم البراند — آخر عمليات النشر
CREATE INDEX IF NOT EXISTS idx_publish_results_brand_time
    ON public.platform_publish_results (brand_id, created_at DESC);

-- مراقبة الفشل والـ Retry
CREATE INDEX IF NOT EXISTS idx_publish_results_failed
    ON public.platform_publish_results (status, next_retry_at)
    WHERE status IN ('failed', 'pending') AND next_retry_at IS NOT NULL;

-- البحث بالـ Platform Post ID (للتحديث من Webhook)
CREATE INDEX IF NOT EXISTS idx_publish_results_platform_post
    ON public.platform_publish_results (platform, platform_post_id)
    WHERE platform_post_id IS NOT NULL;

-- ── Trigger: auto-update updated_at ─────────────────────────
CREATE OR REPLACE TRIGGER trg_platform_publish_results_updated_at
    BEFORE UPDATE ON public.platform_publish_results
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ── Trigger: مزامنة حالة scheduled_posts تلقائياً ─────────────
CREATE OR REPLACE FUNCTION public.sync_post_status_from_results()
RETURNS TRIGGER AS $$
DECLARE
    v_total_platforms    INTEGER;
    v_success_count      INTEGER;
    v_failed_count       INTEGER;
    v_new_status         TEXT;
    v_platform_statuses  JSONB;
BEGIN
    -- احسب إجمالي منصات المنشور وحالة كل منها
    SELECT
        COUNT(*)                                           AS total,
        COUNT(*) FILTER (WHERE status = 'success')        AS successes,
        COUNT(*) FILTER (WHERE status = 'failed')         AS failures,
        jsonb_object_agg(platform, status)                AS statuses
    INTO v_total_platforms, v_success_count, v_failed_count, v_platform_statuses
    FROM public.platform_publish_results
    WHERE post_id = NEW.post_id;

    -- حدّد الحالة الإجمالية للمنشور
    IF v_success_count = v_total_platforms THEN
        v_new_status := 'published';
    ELSIF v_failed_count = v_total_platforms THEN
        v_new_status := 'failed';
    ELSIF v_success_count > 0 THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := 'scheduled';  -- لا تزال محاولة
    END IF;

    -- حدّث scheduled_posts
    UPDATE public.scheduled_posts
    SET
        status           = v_new_status,
        platform_statuses = v_platform_statuses,
        published_at     = CASE WHEN v_new_status IN ('published','partial')
                               THEN COALESCE(published_at, now())
                               ELSE published_at END
    WHERE id = NEW.post_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_post_status ON public.platform_publish_results;
CREATE TRIGGER trg_sync_post_status
    AFTER INSERT OR UPDATE ON public.platform_publish_results
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_post_status_from_results();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.platform_publish_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "publish_results_brand_owner"
    ON public.platform_publish_results FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ))
    WITH CHECK (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- ── Helper: جلب منشورات فشلت وتحتاج retry ─────────────────
CREATE OR REPLACE FUNCTION public.get_pending_retries(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    result_id   UUID,
    post_id     UUID,
    brand_id    UUID,
    platform    TEXT,
    retry_count INTEGER,
    next_retry_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT id, post_id, brand_id, platform, retry_count, next_retry_at
    FROM public.platform_publish_results
    WHERE status       = 'failed'
      AND retry_count  < max_retries
      AND next_retry_at <= now()
    ORDER BY next_retry_at ASC
    LIMIT p_limit;
$$;

COMMENT ON TABLE public.platform_publish_results IS
    'سجل تفصيلي لكل عملية نشر على كل منصة — يدعم الـ Retry ومزامنة الحالة';
