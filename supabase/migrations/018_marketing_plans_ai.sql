-- Migration 018: Extend marketing_plans with AI-generated content
-- Adds AI plan, priority recommendations, and monthly plan columns

ALTER TABLE marketing_plans
    ADD COLUMN IF NOT EXISTS target_audience  text    DEFAULT '',
    ADD COLUMN IF NOT EXISTS kpis             jsonb   DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS channels         jsonb   DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS ai_plan          jsonb   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ai_priorities    jsonb   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS monthly_plan     jsonb   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

-- Trigger to auto-update updated_at
CREATE TRIGGER set_marketing_plans_updated_at
    BEFORE UPDATE ON marketing_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
