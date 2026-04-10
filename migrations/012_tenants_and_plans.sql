-- Migration 012: Tenants & Subscription Plans
-- ══════════════════════════════════════════════

-- Subscription plans (seed data)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id              text PRIMARY KEY,  -- 'starter' | 'pro' | 'agency'
    name            text NOT NULL,
    price_monthly   numeric NOT NULL DEFAULT 0,
    price_yearly    numeric NOT NULL DEFAULT 0,
    max_brands      integer NOT NULL DEFAULT 1,
    max_users       integer NOT NULL DEFAULT 2,
    ai_tokens_monthly bigint NOT NULL DEFAULT 1000000,
    features        jsonb NOT NULL DEFAULT '[]',
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed default plans
INSERT INTO public.subscription_plans (id, name, price_monthly, price_yearly, max_brands, max_users, ai_tokens_monthly, features)
VALUES
    ('starter', 'Starter',  29,  290, 1,  2,  1000000,   '["Social Publishing", "Basic Analytics", "Content Ops"]'),
    ('pro',     'Pro',      99,  990, 5,  10, 5000000,   '["Everything in Starter", "Advanced Analytics", "Ads Ops", "Inbox", "API Access"]'),
    ('agency',  'Agency',   249, 2490, 25, 50, 10000000, '["Everything in Pro", "White Label", "Priority Support", "Custom Workflows", "SEO Tools"]')
ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        price_monthly = EXCLUDED.price_monthly,
        price_yearly = EXCLUDED.price_yearly,
        max_brands = EXCLUDED.max_brands,
        max_users = EXCLUDED.max_users,
        ai_tokens_monthly = EXCLUDED.ai_tokens_monthly,
        features = EXCLUDED.features;

-- Tenants (SaaS customers / organizations)
CREATE TABLE IF NOT EXISTS public.tenants (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text NOT NULL,
    owner_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    plan_id     text NOT NULL DEFAULT 'starter' REFERENCES public.subscription_plans(id),
    status      text NOT NULL DEFAULT 'active',
    -- status: 'active' | 'suspended' | 'cancelled' | 'trial'
    trial_ends_at timestamptz,
    ai_tokens_used bigint NOT NULL DEFAULT 0,
    brands_count  integer NOT NULL DEFAULT 0,
    users_count   integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON public.tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id  ON public.tenants(plan_id);

-- Note: tenants table is admin-only, RLS blocks regular users
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins see tenants"
    ON public.tenants FOR ALL
    USING (auth.uid() IN (
        SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'
    ));

-- Billing / payment records
CREATE TABLE IF NOT EXISTS public.payment_records (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    brand_id    uuid REFERENCES public.brands(id) ON DELETE SET NULL,
    amount      numeric NOT NULL,
    currency    text NOT NULL DEFAULT 'USD',
    status      text NOT NULL DEFAULT 'pending', -- 'paid' | 'failed' | 'refunded'
    invoice_url text,
    paid_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own payment records"
    ON public.payment_records FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
