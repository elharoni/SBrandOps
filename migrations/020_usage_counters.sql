-- Usage counters for AI tokens and publish ops
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  metric text NOT NULL,                       -- 'ai_tokens' | 'publish_ops' | ...
  period_month date NOT NULL,                 -- first day of month (YYYY-MM-01)
  value bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_uniq
  ON public.usage_counters(brand_id, metric, period_month);

CREATE INDEX IF NOT EXISTS usage_counters_brand_month
  ON public.usage_counters(brand_id, period_month DESC);

CREATE TRIGGER trg_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "uc_all" ON public.usage_counters;
CREATE POLICY "uc_all" ON public.usage_counters FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- Increment helper (service-side)
DROP FUNCTION IF EXISTS public.increment_usage_counter(uuid, text, integer);
CREATE OR REPLACE FUNCTION public.increment_usage_counter(p_brand uuid, p_metric text, p_delta integer)
RETURNS void AS $$
DECLARE
  month_start date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.usage_counters(brand_id, metric, period_month, value)
  VALUES (p_brand, p_metric, month_start, GREATEST(p_delta,0))
  ON CONFLICT (brand_id, metric, period_month)
  DO UPDATE SET value = public.usage_counters.value + GREATEST(p_delta,0), updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_usage_counter(uuid, text, integer) TO authenticated;