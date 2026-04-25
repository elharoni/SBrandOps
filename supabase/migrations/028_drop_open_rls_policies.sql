-- ============================================================
-- Migration 028: Drop open "Enable all access for authenticated users" policies
--
-- These policies were created in supabase_schema.sql and allow ANY
-- authenticated user to read/write ANY row — a critical data isolation
-- breach in a multi-tenant SaaS.  Migrations 009 and 044 dropped them
-- but were never applied via the Supabase CLI.  This migration closes
-- the gap permanently.
-- ============================================================

-- brands — must only be visible to their owner (user_id = auth.uid())
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brands;

-- brand_profiles — owned via brand.user_id
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brand_profiles;

-- social_accounts — owned via brand.user_id
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.social_accounts;

-- content_pieces — owned via brand.user_id
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.content_pieces;

-- scheduled_posts — owned via brand.user_id
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.scheduled_posts;

-- marketing_plans — owned via brand.user_id
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.marketing_plans;

-- ── Verify the correct restrictive policies exist ─────────────────────────────
-- brands_owner_only was created in migration 027 — confirm it exists
-- (this is a no-op if already present; will error if somehow missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'brands' AND policyname = 'brands_owner_only'
  ) THEN
    -- recreate as safety net
    EXECUTE $policy$
      CREATE POLICY "brands_owner_only"
          ON public.brands FOR ALL
          USING     (user_id = (SELECT auth.uid()))
          WITH CHECK (user_id = (SELECT auth.uid()))
    $policy$;
  END IF;
END $$;
