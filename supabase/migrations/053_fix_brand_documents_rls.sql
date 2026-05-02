-- Migration 053: Fix brand_documents RLS to allow team members and super admin
-- The single owner-only policy was blocking team members from inserting brand documents.

DROP POLICY IF EXISTS "brand_documents_owner" ON public.brand_documents;

CREATE POLICY "brand_documents_member_access"
  ON public.brand_documents
  FOR ALL
  USING  (brand_id = ANY(crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(crm_user_brand_ids()));

CREATE POLICY "super_admin_all_brand_documents"
  ON public.brand_documents
  FOR ALL
  USING  (is_super_admin())
  WITH CHECK (is_super_admin());
