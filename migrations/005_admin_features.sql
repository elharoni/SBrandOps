-- Migration: Admin Features
-- Adds tables for AI provider keys, admin audit logs, and system settings

-- ── AI Provider Keys ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        text NOT NULL CHECK (provider IN ('gemini', 'openai', 'anthropic', 'stability', 'replicate')),
    name            text NOT NULL,
    key_value       text NOT NULL,           -- stored encrypted in production
    key_masked      text NOT NULL,           -- e.g. "sk-...ab12"
    is_active       boolean DEFAULT false,
    test_status     text DEFAULT 'untested' CHECK (test_status IN ('ok', 'failed', 'untested')),
    last_tested_at  timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- Only one active key per provider at a time (enforced by service logic + unique partial index)
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_active_provider
    ON public.ai_provider_keys (provider)
    WHERE is_active = true;

-- RLS: only super admins can manage AI keys
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage AI keys" ON public.ai_provider_keys
    FOR ALL USING (is_super_admin());

-- ── System Settings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_settings (
    key         text PRIMARY KEY,
    value       text NOT NULL,
    updated_at  timestamptz DEFAULT now()
);

-- Default values
INSERT INTO public.system_settings (key, value) VALUES
    ('appName',                  'SBrandOps'),
    ('maintenanceMode',          'false'),
    ('defaultLanguage',          'ar'),
    ('supportEmail',             'support@sbrandops.com'),
    ('passwordMinLength',        '8'),
    ('passwordRequiresUppercase','true'),
    ('passwordRequiresNumber',   'true'),
    ('passwordRequiresSymbol',   'false'),
    ('sessionTimeout',           '60'),
    ('require2FAForAdmins',      'false')
ON CONFLICT (key) DO NOTHING;

-- RLS: only super admins can manage system settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage system settings" ON public.system_settings
    FOR ALL USING (is_super_admin());

-- ── Admin Users Table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text NOT NULL UNIQUE,
    role        text NOT NULL DEFAULT 'SUPPORT'
                    CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT')),
    tenant_name text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage admin users" ON public.admin_users
    FOR ALL USING (is_super_admin());

-- ── Admin Audit Logs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_name   text NOT NULL,
    admin_email  text,
    action       text NOT NULL,
    entity_type  text,
    entity_id    uuid,
    metadata     jsonb,
    created_at   timestamptz DEFAULT now()
);

-- All admins can read logs, super admins can write
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs
    FOR SELECT USING (is_super_admin());

CREATE POLICY "System inserts audit logs" ON public.admin_audit_logs
    FOR INSERT WITH CHECK (true);

-- Index for fast time-ordered queries
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
    ON public.admin_audit_logs (created_at DESC);

-- ── Trigger: auto-update updated_at ──────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_ai_provider_keys_updated_at
    BEFORE UPDATE ON public.ai_provider_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER set_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
