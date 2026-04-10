-- ============================================================
-- SBrandOps — Production RLS & Access Hardening
-- Team-scoped access via crm_user_brand_ids(); service-only secrets
-- Run in Supabase SQL Editor (prod)
-- ============================================================

-- Pre-req: FUNCTION public.crm_user_brand_ids() exists (see schema_v2.sql)

-- -- Brands --------------------------------------------------
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brands;
DROP POLICY IF EXISTS "Enable all access for anon" ON public.brands;
DROP POLICY IF EXISTS "Users manage own brands" ON public.brands;
DROP POLICY IF EXISTS "brands_select_owner_or_member" ON public.brands;
DROP POLICY IF EXISTS "brands_mutate_owner_only" ON public.brands;

CREATE POLICY "brands_select_owner_or_member"
  ON public.brands FOR SELECT
  USING (id = ANY(public.crm_user_brand_ids()) OR user_id = auth.uid());

CREATE POLICY "brands_mutate_owner_only"
  ON public.brands FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -- Generic brand_id-scoped tables helper (repeat per table) --
-- USING (brand_id = ANY(public.crm_user_brand_ids()))
-- WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()))

-- brand_profiles
DROP POLICY IF EXISTS "Users manage own brand profiles" ON public.brand_profiles;
DROP POLICY IF EXISTS "bp_all" ON public.brand_profiles;
CREATE POLICY "bp_all"
  ON public.brand_profiles FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- social_accounts (base table: no client SELECT policy)
DROP POLICY IF EXISTS "Users manage own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "sa_write_only_members" ON public.social_accounts;
DROP POLICY IF EXISTS "sa_update_only_members" ON public.social_accounts;
DROP POLICY IF EXISTS "sa_delete_only_members" ON public.social_accounts;

CREATE POLICY "sa_write_only_members"
  ON public.social_accounts FOR INSERT
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

CREATE POLICY "sa_update_only_members"
  ON public.social_accounts FOR UPDATE
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

CREATE POLICY "sa_delete_only_members"
  ON public.social_accounts FOR DELETE
  USING (brand_id = ANY(public.crm_user_brand_ids()));

-- content_pieces
DROP POLICY IF EXISTS "Users manage own content pieces" ON public.content_pieces;
DROP POLICY IF EXISTS "cp_all" ON public.content_pieces;
CREATE POLICY "cp_all"
  ON public.content_pieces FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- scheduled_posts
DROP POLICY IF EXISTS "Users manage own scheduled posts" ON public.scheduled_posts;
DROP POLICY IF EXISTS "sp_all" ON public.scheduled_posts;
CREATE POLICY "sp_all"
  ON public.scheduled_posts FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- marketing_plans
DROP POLICY IF EXISTS "Users manage own marketing plans" ON public.marketing_plans;
DROP POLICY IF EXISTS "mp_all" ON public.marketing_plans;
CREATE POLICY "mp_all"
  ON public.marketing_plans FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- ad_campaigns
DROP POLICY IF EXISTS "Users manage own ad campaigns" ON public.ad_campaigns;
DROP POLICY IF EXISTS "ac_all" ON public.ad_campaigns;
CREATE POLICY "ac_all"
  ON public.ad_campaigns FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- inbox_conversations
DROP POLICY IF EXISTS "Users manage own conversations" ON public.inbox_conversations;
DROP POLICY IF EXISTS "ic_all" ON public.inbox_conversations;
CREATE POLICY "ic_all"
  ON public.inbox_conversations FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- inbox_messages (scoped via conversation -> brand)
DROP POLICY IF EXISTS "Users manage own messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "im_all" ON public.inbox_messages;
CREATE POLICY "im_all"
  ON public.inbox_messages FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.inbox_conversations ic
    WHERE ic.id = inbox_messages.conversation_id
      AND ic.brand_id = ANY(public.crm_user_brand_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.inbox_conversations ic
    WHERE ic.id = inbox_messages.conversation_id
      AND ic.brand_id = ANY(public.crm_user_brand_ids())
  ));

-- team_members
DROP POLICY IF EXISTS "Users manage own team members" ON public.team_members;
DROP POLICY IF EXISTS "tm_all" ON public.team_members;
CREATE POLICY "tm_all"
  ON public.team_members FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- api_keys
DROP POLICY IF EXISTS "Users manage own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "ak_all" ON public.api_keys;
CREATE POLICY "ak_all"
  ON public.api_keys FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- post_analytics (via scheduled_posts -> brand)
DROP POLICY IF EXISTS "Users view own post analytics" ON public.post_analytics;
DROP POLICY IF EXISTS "pa_all" ON public.post_analytics;
CREATE POLICY "pa_all"
  ON public.post_analytics FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.scheduled_posts sp
    WHERE sp.id = post_analytics.post_id
      AND sp.brand_id = ANY(public.crm_user_brand_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.scheduled_posts sp
    WHERE sp.id = post_analytics.post_id
      AND sp.brand_id = ANY(public.crm_user_brand_ids())
  ));

-- follower_history
DROP POLICY IF EXISTS "fh_all" ON public.follower_history;
DROP POLICY IF EXISTS "Follower history follows brand ownership" ON public.follower_history;
CREATE POLICY "fh_all"
  ON public.follower_history FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- analytics_snapshots
DROP POLICY IF EXISTS "as_all" ON public.analytics_snapshots;
DROP POLICY IF EXISTS "Analytics snapshots follow brand ownership" ON public.analytics_snapshots;
CREATE POLICY "as_all"
  ON public.analytics_snapshots FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- activity_logs
DROP POLICY IF EXISTS "Users view own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "al_all" ON public.activity_logs;
CREATE POLICY "al_all"
  ON public.activity_logs FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- brainstormed_ideas
DROP POLICY IF EXISTS "Users manage own ideas" ON public.brainstormed_ideas;
DROP POLICY IF EXISTS "bi_all" ON public.brainstormed_ideas;
CREATE POLICY "bi_all"
  ON public.brainstormed_ideas FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- workflows
DROP POLICY IF EXISTS "Users manage own workflows" ON public.workflows;
DROP POLICY IF EXISTS "wf_all" ON public.workflows;
CREATE POLICY "wf_all"
  ON public.workflows FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- operational_errors
DROP POLICY IF EXISTS "oe_all" ON public.operational_errors;
CREATE POLICY "oe_all"
  ON public.operational_errors FOR ALL
  USING (brand_id = ANY(public.crm_user_brand_ids()))
  WITH CHECK (brand_id = ANY(public.crm_user_brand_ids()));

-- -- Lock down base table privileges for social_accounts ---------------------
REVOKE ALL ON TABLE public.social_accounts FROM anon, authenticated;
-- service_role keeps full access via key

-- -- Safe RPC for listing accounts without secrets --------------------------
DROP FUNCTION IF EXISTS public.get_social_accounts_public(uuid);
CREATE OR REPLACE FUNCTION public.get_social_accounts_public(p_brand_id uuid)
RETURNS TABLE (
  id uuid,
  brand_id uuid,
  platform text,
  username text,
  avatar_url text,
  followers_count integer,
  status text,
  token_expires_at timestamptz
) AS $$
  SELECT id, brand_id, platform, username, avatar_url, followers_count, status, token_expires_at
  FROM public.social_accounts
  WHERE brand_id = p_brand_id
    AND brand_id = ANY(public.crm_user_brand_ids());
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_social_accounts_public(uuid) TO authenticated;

-- ============================================================
-- Team-scoped RLS applied; secrets gated via RPC/function
-- ============================================================
