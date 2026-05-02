-- Migration 052: Fix brand_profiles RLS to allow team members
-- The 4 duplicate owner-only policies were blocking team members from saving brand profiles.
-- Replace with a single policy using crm_user_brand_ids() which covers owners + active members.

DROP POLICY IF EXISTS "Users manage their brand profiles" ON public.brand_profiles;
DROP POLICY IF EXISTS "bp_all"                           ON public.brand_profiles;
DROP POLICY IF EXISTS "brand_profiles_all"               ON public.brand_profiles;
DROP POLICY IF EXISTS "brand_profiles_secure"            ON public.brand_profiles;

CREATE POLICY "brand_profiles_member_access"
  ON public.brand_profiles
  FOR ALL
  USING  (brand_id = ANY(crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(crm_user_brand_ids()));
