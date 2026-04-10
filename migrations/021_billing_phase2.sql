-- Migration 021: Billing Phase 2
-- Finalized plan catalog + Paddle billing model + admin-only access

-- Finalize plan catalog
ALTER TABLE public.subscription_plans
    ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS tagline text,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS badge text,
    ADD COLUMN IF NOT EXISTS highlighted boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 14,
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS paddle_product_id text,
    ADD COLUMN IF NOT EXISTS paddle_price_id_monthly text,
    ADD COLUMN IF NOT EXISTS paddle_price_id_yearly text;

INSERT INTO public.subscription_plans (
    id, name, price_monthly, price_yearly, max_brands, max_users, ai_tokens_monthly, features,
    currency, tagline, description, badge, highlighted, trial_days, sort_order, is_active
)
VALUES
    (
        'starter',
        'Starter',
        29,
        290,
        1,
        2,
        1000000,
        '["1 brand workspace","Content calendar and publishing","Basic analytics and reporting","Starter AI credits","Core team access"]'::jsonb,
        'USD',
        'Launch one brand fast',
        'For solo operators and small brands that need core publishing, content planning, and basic analytics.',
        null,
        false,
        14,
        10,
        true
    ),
    (
        'growth',
        'Growth',
        99,
        990,
        5,
        10,
        5000000,
        '["Everything in Starter","Ads analytics and campaign visibility","SEO writer and briefs","Inbox lite and workflow automations","Advanced reporting"]'::jsonb,
        'USD',
        'Scale execution with one team',
        'For growing brands that need campaign execution, SEO, inbox workflows, and better reporting.',
        'Recommended',
        true,
        14,
        20,
        true
    ),
    (
        'agency',
        'Agency',
        249,
        2490,
        25,
        50,
        10000000,
        '["Everything in Growth","Multiple brand workspaces","Roles, permissions, and approvals","Expanded analytics and webhook logs","Higher AI and publishing limits"]'::jsonb,
        'USD',
        'Operate multiple brands with controls',
        'For agencies and multi-brand teams that need approvals, client workflows, and higher usage ceilings.',
        null,
        false,
        14,
        30,
        true
    ),
    (
        'enterprise',
        'Enterprise',
        0,
        0,
        999,
        999,
        50000000,
        '["Custom onboarding and migration","SSO and security review","Custom integrations","Priority support and success plan","Commercial terms by agreement"]'::jsonb,
        'USD',
        'Custom rollout and governance',
        'For larger organizations that need custom onboarding, SSO, security review, and tailored integrations.',
        'Custom',
        false,
        0,
        40,
        true
    )
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    max_brands = EXCLUDED.max_brands,
    max_users = EXCLUDED.max_users,
    ai_tokens_monthly = EXCLUDED.ai_tokens_monthly,
    features = EXCLUDED.features,
    currency = EXCLUDED.currency,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    badge = EXCLUDED.badge,
    highlighted = EXCLUDED.highlighted,
    trial_days = EXCLUDED.trial_days,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

UPDATE public.tenants
SET plan_id = 'growth'
WHERE plan_id = 'pro';

UPDATE public.subscription_plans
SET is_active = false, name = 'Legacy Pro'
WHERE id = 'pro';

CREATE TABLE IF NOT EXISTS public.billing_customers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    paddle_customer_id text NOT NULL UNIQUE,
    email text,
    full_name text,
    country_code text,
    marketing_consent boolean NOT NULL DEFAULT false,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_tenant_id ON public.billing_customers(tenant_id);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.billing_customers(id) ON DELETE SET NULL,
    plan_id text NOT NULL REFERENCES public.subscription_plans(id),
    paddle_subscription_id text UNIQUE,
    paddle_customer_id text,
    customer_email text,
    status text NOT NULL DEFAULT 'trialing',
    billing_cycle text NOT NULL DEFAULT 'monthly',
    currency text NOT NULL DEFAULT 'USD',
    amount numeric NOT NULL DEFAULT 0,
    quantity integer NOT NULL DEFAULT 1,
    trial_ends_at timestamptz,
    started_at timestamptz,
    current_period_starts_at timestamptz,
    current_period_ends_at timestamptz,
    next_billed_at timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    canceled_at timestamptz,
    paused_at timestamptz,
    is_current boolean NOT NULL DEFAULT true,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_tenant_id ON public.billing_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_current ON public.billing_subscriptions(is_current);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
    paddle_transaction_id text UNIQUE,
    invoice_number text,
    invoice_url text,
    amount numeric NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'USD',
    status text NOT NULL DEFAULT 'draft',
    billed_at timestamptz,
    paid_at timestamptz,
    refunded_at timestamptz,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant_id ON public.billing_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON public.billing_invoices(status);

CREATE TABLE IF NOT EXISTS public.billing_checkout_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id text REFERENCES public.subscription_plans(id),
    billing_cycle text NOT NULL DEFAULT 'monthly',
    status text NOT NULL DEFAULT 'open',
    paddle_transaction_id text UNIQUE,
    checkout_url text,
    custom_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    expires_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_checkout_sessions_tenant_id ON public.billing_checkout_sessions(tenant_id);

CREATE TABLE IF NOT EXISTS public.billing_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    source text NOT NULL DEFAULT 'paddle',
    paddle_event_id text NOT NULL UNIQUE,
    event_type text NOT NULL,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    subscription_id uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
    invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
    processing_status text NOT NULL DEFAULT 'received',
    error_message text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_id ON public.billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_status ON public.billing_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_billing_events_occurred_at ON public.billing_events(occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.tenant_usage (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_month date NOT NULL,
    users_used integer NOT NULL DEFAULT 0,
    brands_used integer NOT NULL DEFAULT 0,
    ai_tokens_used bigint NOT NULL DEFAULT 0,
    publish_ops_used integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_id ON public.tenant_usage(tenant_id);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins see billing_customers" ON public.billing_customers;
DROP POLICY IF EXISTS "Only admins see billing_subscriptions" ON public.billing_subscriptions;
DROP POLICY IF EXISTS "Only admins see billing_invoices" ON public.billing_invoices;
DROP POLICY IF EXISTS "Only admins see billing_checkout_sessions" ON public.billing_checkout_sessions;
DROP POLICY IF EXISTS "Only admins see billing_events" ON public.billing_events;
DROP POLICY IF EXISTS "Only admins see tenant_usage" ON public.tenant_usage;

CREATE POLICY "Only admins see billing_customers"
    ON public.billing_customers FOR ALL
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'));

CREATE POLICY "Only admins see billing_subscriptions"
    ON public.billing_subscriptions FOR ALL
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'));

CREATE POLICY "Only admins see billing_invoices"
    ON public.billing_invoices FOR ALL
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'));

CREATE POLICY "Only admins see billing_checkout_sessions"
    ON public.billing_checkout_sessions FOR ALL
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'));

CREATE POLICY "Only admins see billing_events"
    ON public.billing_events FOR ALL
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'));

CREATE POLICY "Only admins see tenant_usage"
    ON public.tenant_usage FOR ALL
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'));
