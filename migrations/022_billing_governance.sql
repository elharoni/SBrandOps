ALTER TABLE public.billing_events
    ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_retry_reason text,
    ADD COLUMN IF NOT EXISTS last_retry_by uuid;

CREATE TABLE IF NOT EXISTS public.billing_audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    subscription_id uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
    actor_user_id uuid,
    actor_scope text NOT NULL DEFAULT 'system',
    action text NOT NULL,
    reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_tenant_id ON public.billing_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_subscription_id ON public.billing_audit_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_created_at ON public.billing_audit_logs(created_at DESC);

ALTER TABLE public.billing_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins see billing_audit_logs" ON public.billing_audit_logs;

CREATE POLICY "Only admins see billing_audit_logs"
    ON public.billing_audit_logs FOR ALL
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'));
