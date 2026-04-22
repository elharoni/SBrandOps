-- ============================================================
-- Migration 039: AI Usage Logging
-- تسجيل تفصيلي لكل استدعاء Gemini API
-- يُستخدم لـ: احتساب الفاتورة، تحديد Limits، مراقبة الأداء
-- ============================================================

-- حذف الجدول إذا كان فشل الإنشاء السابق أنشأه بشكل جزئي
DROP TABLE IF EXISTS public.ai_usage_logs CASCADE;

CREATE TABLE public.ai_usage_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- الربط بالـ Tenant والبراند والمستخدم
    tenant_id       UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
    brand_id        UUID        REFERENCES public.brands(id)  ON DELETE CASCADE,
    user_id         UUID        REFERENCES auth.users(id)     ON DELETE SET NULL,

    -- تفاصيل الاستدعاء
    feature         TEXT        NOT NULL,
    -- 'content_gen' | 'hashtag' | 'caption_analyze' | 'image_gen' | 'seo_writer' | 'idea_ops'
    model           TEXT        NOT NULL DEFAULT 'gemini-2.0-flash',
    prompt_chars    INTEGER     NOT NULL DEFAULT 0,
    input_tokens    INTEGER     NOT NULL DEFAULT 0,
    output_tokens   INTEGER     NOT NULL DEFAULT 0,
    total_tokens    INTEGER     NOT NULL DEFAULT 0,
    -- total_tokens يُحسب ويُخزَّن عبر Trigger أدناه

    -- الأداء
    latency_ms      INTEGER,

    -- النتيجة
    status          TEXT        NOT NULL DEFAULT 'success'
                                CHECK (status IN ('success', 'error', 'timeout', 'quota_exceeded')),
    error_message   TEXT,
    error_code      TEXT,

    -- بيانات إضافية
    metadata        JSONB       NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Trigger: حساب total_tokens تلقائياً عند INSERT ───────────
CREATE OR REPLACE FUNCTION public.calc_ai_total_tokens()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.total_tokens := NEW.input_tokens + NEW.output_tokens;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_usage_calc_tokens ON public.ai_usage_logs;
CREATE TRIGGER trg_ai_usage_calc_tokens
    BEFORE INSERT OR UPDATE ON public.ai_usage_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.calc_ai_total_tokens();

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_ai_usage_tenant_time
    ON public.ai_usage_logs (tenant_id, created_at DESC);

CREATE INDEX idx_ai_usage_brand_time
    ON public.ai_usage_logs (brand_id, created_at DESC);

CREATE INDEX idx_ai_usage_feature
    ON public.ai_usage_logs (feature, created_at DESC);

CREATE INDEX idx_ai_usage_status
    ON public.ai_usage_logs (status, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_brand_owner"
    ON public.ai_usage_logs FOR SELECT
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

CREATE POLICY "ai_usage_service_insert"
    ON public.ai_usage_logs FOR INSERT
    WITH CHECK (true);

-- ── Function: إجمالي tokens لـ Tenant في شهر معيّن ───────────
CREATE OR REPLACE FUNCTION public.get_tenant_ai_usage(
    p_tenant_id UUID,
    p_month     DATE DEFAULT date_trunc('month', now())::date
)
RETURNS TABLE (
    feature         TEXT,
    model           TEXT,
    total_calls     BIGINT,
    total_tokens    BIGINT,
    avg_latency_ms  NUMERIC,
    error_rate      NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT
        feature,
        model,
        COUNT(*)::BIGINT                                                AS total_calls,
        COALESCE(SUM(input_tokens + output_tokens), 0)::BIGINT         AS total_tokens,
        ROUND(AVG(latency_ms), 0)                                      AS avg_latency_ms,
        ROUND(
            COUNT(*) FILTER (WHERE status <> 'success')::NUMERIC /
            NULLIF(COUNT(*), 0) * 100, 2
        )                                                               AS error_rate
    FROM public.ai_usage_logs
    WHERE tenant_id  = p_tenant_id
      AND created_at >= p_month
      AND created_at <  p_month + INTERVAL '1 month'
    GROUP BY feature, model
    ORDER BY total_tokens DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_ai_usage(UUID, DATE) TO authenticated;

-- ── Function: ملخص AI لبراند معيّن ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_brand_ai_usage_summary(
    p_brand_id UUID,
    p_days     INTEGER DEFAULT 30
)
RETURNS TABLE (
    feature      TEXT,
    total_calls  BIGINT,
    total_tokens BIGINT,
    last_used_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
    SELECT
        feature,
        COUNT(*)::BIGINT                                               AS total_calls,
        COALESCE(SUM(input_tokens + output_tokens), 0)::BIGINT        AS total_tokens,
        MAX(created_at)                                                AS last_used_at
    FROM public.ai_usage_logs
    WHERE brand_id   = p_brand_id
      AND created_at >= now() - (p_days || ' days')::INTERVAL
    GROUP BY feature
    ORDER BY total_tokens DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_brand_ai_usage_summary(UUID, INTEGER) TO authenticated;

COMMENT ON TABLE public.ai_usage_logs IS
    'تسجيل تفصيلي لكل استدعاء Gemini API — للفوترة والرقابة وتحليل الأداء';
