-- ═══════════════════════════════════════════════════════════════════
-- Migration 035: Admin Bootstrap — Run ONCE in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════
-- This migration:
--   1. Creates is_super_admin() and is_admin() helper functions
--   2. Fixes RLS policies to use these functions consistently
--   3. Grants your account super admin access
--   4. Registers you in admin_users table
--
-- ▶ STEP 1: Replace the email below with your actual email, then run.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Create is_super_admin() helper ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN (
        -- Check user_metadata.role (set by our admin bootstrap)
        (auth.jwt() -> 'user_metadata' ->> 'role') IN ('SUPER_ADMIN', 'super_admin')
        OR
        -- Check app_metadata.role (set by Supabase Auth hooks or manually)
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('SUPER_ADMIN', 'super_admin', 'admin')
        OR
        -- Check is_admin flag
        (auth.jwt() -> 'user_metadata' ->> 'is_admin') = 'true'
    );
END;
$$;

-- ── 2. Create is_admin() helper (broader — includes all admin roles) ──────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN (
        public.is_super_admin()
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'MODERATOR', 'SUPPORT')
        OR (auth.jwt() -> 'user_metadata' ->> 'is_admin') = 'true'
    );
END;
$$;

-- ── 3. Create set_updated_at() if not exists ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ── 4. Fix tenants RLS policy to use is_super_admin() ────────────────────────

DROP POLICY IF EXISTS "Only admins see tenants"      ON public.tenants;
DROP POLICY IF EXISTS "Admins manage tenants"         ON public.tenants;

CREATE POLICY "Admins manage tenants"
    ON public.tenants FOR ALL
    USING (public.is_super_admin() OR public.is_admin());

-- ── 5. Fix admin_users RLS to be more permissive during bootstrap ─────────────

DROP POLICY IF EXISTS "Super admins manage admin users"  ON public.admin_users;
DROP POLICY IF EXISTS "Admins read admin users"          ON public.admin_users;
DROP POLICY IF EXISTS "Super admins write admin users"   ON public.admin_users;
DROP POLICY IF EXISTS "Super admins update admin users"  ON public.admin_users;
DROP POLICY IF EXISTS "Super admins delete admin users"  ON public.admin_users;

CREATE POLICY "Admins read admin users"
    ON public.admin_users FOR SELECT
    USING (public.is_admin() OR email = auth.jwt() ->> 'email');

CREATE POLICY "Super admins write admin users"
    ON public.admin_users FOR INSERT
    WITH CHECK (
        public.is_super_admin()
        OR (email = auth.jwt() ->> 'email' AND public.is_admin())
    );

CREATE POLICY "Super admins update admin users"
    ON public.admin_users FOR UPDATE
    USING (public.is_super_admin());

CREATE POLICY "Super admins delete admin users"
    ON public.admin_users FOR DELETE
    USING (public.is_super_admin());

-- ── 6. Fix system_settings RLS ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Super admins manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins read system settings"         ON public.system_settings;
DROP POLICY IF EXISTS "Super admins write system settings"  ON public.system_settings;

CREATE POLICY "Admins read system settings"
    ON public.system_settings FOR SELECT
    USING (public.is_admin() OR true);

CREATE POLICY "Super admins write system settings"
    ON public.system_settings FOR ALL
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ── 7. Fix admin_audit_logs RLS ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins read audit logs"  ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins write audit logs" ON public.admin_audit_logs;

CREATE POLICY "Admins read audit logs"
    ON public.admin_audit_logs FOR SELECT
    USING (public.is_admin());

-- ── 8. Grant your account SUPER_ADMIN access ─────────────────────────────────
-- ▶ CHANGE THIS EMAIL to your actual Supabase account email:

DO $$
DECLARE
    v_email text := 'aboda.elharoni@gmail.com';  -- ← CHANGE THIS
    v_uid   uuid;
BEGIN
    -- Get user ID from auth.users
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;

    IF v_uid IS NULL THEN
        RAISE NOTICE 'User not found: %. Make sure the email is correct.', v_email;
        RETURN;
    END IF;

    -- Grant super admin in user_metadata (makes JWT claims work immediately after re-login)
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data
        || '{"role": "SUPER_ADMIN", "is_admin": true}'::jsonb
    WHERE id = v_uid;

    RAISE NOTICE 'Granted SUPER_ADMIN to %', v_email;

    -- Register in admin_users table
    INSERT INTO public.admin_users (email, role, tenant_name, created_at, updated_at)
    VALUES (v_email, 'SUPER_ADMIN', 'System', now(), now())
    ON CONFLICT (email) DO UPDATE SET
        role = 'SUPER_ADMIN',
        updated_at = now();

    RAISE NOTICE 'Registered % in admin_users', v_email;
END;
$$;

-- ── 9. Insert default system settings if missing ─────────────────────────────

INSERT INTO public.system_settings (key, value) VALUES
    ('appName',                   'SBrandOps'),
    ('maintenanceMode',           'false'),
    ('defaultLanguage',           'ar'),
    ('supportEmail',              'support@sbrandops.com'),
    ('passwordMinLength',         '8'),
    ('passwordRequiresUppercase', 'true'),
    ('passwordRequiresNumber',    'true'),
    ('passwordRequiresSymbol',    'false'),
    ('sessionTimeout',            '60'),
    ('require2FAForAdmins',       'false'),
    ('logoUrl',                   ''),
    ('supportWebsite',            ''),
    ('announcementEnabled',       'false'),
    ('announcementText',          ''),
    ('announcementType',          'info')
ON CONFLICT (key) DO NOTHING;

-- ── 10. Add name column to admin_users if not exists ─────────────────────────

ALTER TABLE public.admin_users
    ADD COLUMN IF NOT EXISTS name text;

UPDATE public.admin_users
SET name = split_part(email, '@', 1)
WHERE name IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- Done! After running:
--   1. Log out and log back in (to refresh JWT with new role claims)
--   2. Reload the admin panel — tenants and admin users will work
-- ═══════════════════════════════════════════════════════════════════
