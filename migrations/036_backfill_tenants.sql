-- ═══════════════════════════════════════════════════════════════════
-- Migration 036: Backfill Tenants from Existing Brand Owners
-- ═══════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor AFTER migration 035.
--
-- What this does:
--   1. Adds billing_email column to tenants table (if missing)
--   2. Creates one tenant record per unique brand owner (user_id)
--   3. Sets brands_count and users_count per tenant
--   4. Links each brand to its tenant via tenant_id (adds column if missing)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Add missing columns to tenants ────────────────────────────────────────

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS billing_email text;

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS tenant_name text;   -- display alias if needed

-- ── 2. Add tenant_id to brands (optional link back) ──────────────────────────

ALTER TABLE public.brands
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- ── 3. Backfill one tenant per unique brand owner ────────────────────────────

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Loop through every distinct user who owns at least one brand
    FOR rec IN
        SELECT DISTINCT ON (b.user_id)
            b.user_id,
            b.name      AS first_brand_name,
            u.email     AS owner_email,
            u.raw_user_meta_data ->> 'full_name' AS full_name
        FROM public.brands b
        JOIN auth.users u ON u.id = b.user_id
        WHERE b.user_id IS NOT NULL
        ORDER BY b.user_id, b.created_at ASC
    LOOP
        -- Insert tenant only if this user doesn't already have one
        IF NOT EXISTS (
            SELECT 1 FROM public.tenants WHERE owner_id = rec.user_id
        ) THEN
            INSERT INTO public.tenants (
                name,
                billing_email,
                owner_id,
                plan_id,
                status,
                ai_tokens_used,
                brands_count,
                users_count,
                trial_ends_at,
                created_at,
                updated_at
            )
            SELECT
                COALESCE(rec.full_name, split_part(rec.owner_email, '@', 1), 'Account'),
                rec.owner_email,
                rec.user_id,
                'starter',
                'active',
                0,
                (SELECT count(*) FROM public.brands WHERE user_id = rec.user_id),
                (SELECT count(DISTINCT tm.user_id)
                 FROM public.team_members tm
                 JOIN public.brands bb ON bb.id = tm.brand_id
                 WHERE bb.user_id = rec.user_id),
                NULL,
                now(),
                now();

            RAISE NOTICE 'Created tenant for user % (%)', rec.owner_email, rec.user_id;
        ELSE
            RAISE NOTICE 'Tenant already exists for user %', rec.owner_email;
        END IF;
    END LOOP;
END;
$$;

-- ── 4. Link brands back to their tenant ──────────────────────────────────────

UPDATE public.brands b
SET tenant_id = t.id
FROM public.tenants t
WHERE b.user_id = t.owner_id
  AND b.tenant_id IS NULL;

-- ── 5. Refresh brands_count and users_count on all tenants ────────────────────

UPDATE public.tenants t
SET
    brands_count = (
        SELECT count(*) FROM public.brands WHERE user_id = t.owner_id
    ),
    users_count = (
        SELECT count(DISTINCT tm.user_id)
        FROM public.team_members tm
        JOIN public.brands b ON b.id = tm.brand_id
        WHERE b.user_id = t.owner_id
    ),
    updated_at = now()
WHERE owner_id IS NOT NULL;

-- ── 6. Verify ────────────────────────────────────────────────────────────────

SELECT
    t.id,
    t.name,
    t.billing_email,
    t.plan_id,
    t.status,
    t.brands_count,
    t.users_count
FROM public.tenants t
ORDER BY t.created_at DESC;

-- ═══════════════════════════════════════════════════════════════════
-- Done! The الحسابات tab should now show all brand owners as tenants.
-- ═══════════════════════════════════════════════════════════════════
