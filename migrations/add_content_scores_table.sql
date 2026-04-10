-- ================================================================
-- Migration: add_content_scores_table.sql
-- AI Content Scoring — جدول نتائج تقييم المحتوى
-- Run this in: Supabase Dashboard → SQL Editor
-- ================================================================

-- ── إنشاء الجدول ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL,
  content_id    TEXT NOT NULL,           -- معرّف المحتوى (UUID كـ text أو slug)

  -- الأبعاد الثلاثة
  total_score       INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  dna_score         INTEGER NOT NULL CHECK (dna_score BETWEEN 0 AND 100),
  history_score     INTEGER NOT NULL CHECK (history_score BETWEEN 0 AND 100),
  cross_brand_score INTEGER NOT NULL CHECK (cross_brand_score BETWEEN 0 AND 100),

  -- التفاصيل الكاملة (feedback لكل بُعد)
  breakdown         JSONB NOT NULL DEFAULT '{}',

  -- التحسين المقترح والـ CTR المتوقع
  top_improvement   TEXT,
  predicted_ctr     TEXT CHECK (predicted_ctr IN ('low', 'medium', 'high')),

  -- بعد ربط actual CTR من Meta/Google Ads (يُملأ لاحقاً بـ ScoringAccuracyJob)
  actual_ctr        NUMERIC,
  accuracy_delta    NUMERIC,     -- الفرق بين predicted وactual (للـ feedback loop)
  published_at      TIMESTAMPTZ, -- متى نُشر المحتوى فعلاً

  scored_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────

-- جلب آخر score لمحتوى معيّن (الاستخدام الأكثر تكراراً)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_scores_content_id
  ON public.content_scores (content_id);

-- تحليلات البراند الكاملة
CREATE INDEX IF NOT EXISTS idx_content_scores_brand_id
  ON public.content_scores (brand_id, scored_at DESC);

-- فلترة بالـ score (لاستخراج أعلى وأدنى المحتوى)
CREATE INDEX IF NOT EXISTS idx_content_scores_total_score
  ON public.content_scores (brand_id, total_score DESC);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE public.content_scores ENABLE ROW LEVEL SECURITY;

-- المستخدم يقرأ/يكتب scores الـ brands المرتبطة به فقط
CREATE POLICY "Users can manage their brand scores"
  ON public.content_scores
  FOR ALL
  USING (
    brand_id IN (
      SELECT id FROM public.brands WHERE user_id = auth.uid()
    )
  );

-- ── View: Brand Score Dashboard ───────────────────────────────

CREATE OR REPLACE VIEW public.brand_score_stats AS
SELECT
  brand_id,
  COUNT(*)::INTEGER                                    AS total_scored,
  ROUND(AVG(total_score))::INTEGER                     AS avg_score,
  ROUND(AVG(dna_score))::INTEGER                       AS avg_dna_score,
  ROUND(AVG(history_score))::INTEGER                   AS avg_history_score,
  ROUND(AVG(cross_brand_score))::INTEGER               AS avg_cross_brand_score,
  COUNT(*) FILTER (WHERE total_score >= 80)::INTEGER   AS excellent_count,
  COUNT(*) FILTER (WHERE total_score >= 65
                     AND total_score < 80)::INTEGER    AS good_count,
  COUNT(*) FILTER (WHERE total_score >= 50
                     AND total_score < 65)::INTEGER    AS acceptable_count,
  COUNT(*) FILTER (WHERE total_score < 50)::INTEGER    AS weak_count,
  COUNT(*) FILTER (WHERE predicted_ctr = 'high')::INTEGER   AS high_ctr_predicted,
  COUNT(*) FILTER (WHERE actual_ctr IS NOT NULL)::INTEGER   AS feedback_loop_count,
  -- Scoring Accuracy Rate (لو في actual CTR مرتبط)
  CASE
    WHEN COUNT(*) FILTER (WHERE actual_ctr IS NOT NULL) = 0 THEN NULL
    ELSE ROUND(
      100.0 - AVG(ABS(accuracy_delta)) FILTER (WHERE accuracy_delta IS NOT NULL)
    )
  END AS scoring_accuracy_rate
FROM public.content_scores
GROUP BY brand_id;

-- ================================================================
-- كيفية التشغيل:
-- 1. افتح Supabase Dashboard
-- 2. اختر مشروعك → SQL Editor
-- 3. انسخ هذا الـ SQL والصقه → Run
-- ================================================================
