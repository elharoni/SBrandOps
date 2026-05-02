-- Migration 054: Fix brand_knowledge and brand_memory RLS for team members + super admin

-- ── brand_knowledge ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own brand knowledge" ON public.brand_knowledge;

CREATE POLICY "brand_knowledge_member_access"
  ON public.brand_knowledge
  FOR ALL
  USING  (brand_id = ANY(crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

-- (super admin policy already exists on this table)

-- ── brand_memory ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "brand_memory_all" ON public.brand_memory;

CREATE POLICY "brand_memory_member_access"
  ON public.brand_memory
  FOR ALL
  USING  (brand_id = ANY(crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE POLICY "super_admin_all_brand_memory"
  ON public.brand_memory
  FOR ALL
  USING  (is_super_admin())
  WITH CHECK (is_super_admin());
