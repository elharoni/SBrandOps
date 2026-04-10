-- Migration 014: Brand Integrations
-- Tracks which 3rd-party integrations are connected per brand

CREATE TABLE IF NOT EXISTS public.brand_integrations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    integration_id text NOT NULL,         -- slug e.g. 'slack', 'google-analytics'
    is_connected   boolean NOT NULL DEFAULT false,
    access_token   text,                  -- encrypted in production
    refresh_token  text,
    token_expires_at timestamptz,
    metadata    jsonb DEFAULT '{}',       -- extra config per integration
    connected_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(brand_id, integration_id)
);

-- RLS
ALTER TABLE public.brand_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_integrations_owner"
    ON public.brand_integrations
    FOR ALL
    USING (brand_id IN (
        SELECT id FROM public.brands WHERE user_id = auth.uid()
    ));

-- Trigger: updated_at
CREATE TRIGGER trg_brand_integrations_updated_at
    BEFORE UPDATE ON public.brand_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
