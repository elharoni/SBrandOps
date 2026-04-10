-- Migration 009: Proper Row Level Security with auth.uid()
-- Run this AFTER setting up Supabase Auth
-- This replaces the development "allow all authenticated" policies

-- ================================================================
-- BRANDS: User sees only their own brands
-- ================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brands;

CREATE POLICY "Users can only see their own brands"
    ON public.brands FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own brands"
    ON public.brands FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own brands"
    ON public.brands FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own brands"
    ON public.brands FOR DELETE
    USING (user_id = auth.uid());

-- ================================================================
-- BRAND_PROFILES: User sees profiles for their brands only
-- ================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brand_profiles;
DROP POLICY IF EXISTS "Authenticated access brand profiles" ON public.brand_profiles;

CREATE POLICY "Brand profiles follow brand ownership"
    ON public.brand_profiles FOR ALL
    USING (
        brand_id IN (
            SELECT id FROM public.brands WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        brand_id IN (
            SELECT id FROM public.brands WHERE user_id = auth.uid()
        )
    );

-- ================================================================
-- SOCIAL_ACCOUNTS: Follow brand ownership
-- ================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.social_accounts;

CREATE POLICY "Social accounts follow brand ownership"
    ON public.social_accounts FOR ALL
    USING (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    )
    WITH CHECK (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    );

-- ================================================================
-- SCHEDULED_POSTS: Follow brand ownership
-- ================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.scheduled_posts;

CREATE POLICY "Posts follow brand ownership"
    ON public.scheduled_posts FOR ALL
    USING (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    )
    WITH CHECK (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    );

-- ================================================================
-- CONTENT_PIECES: Follow brand ownership
-- ================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.content_pieces;

CREATE POLICY "Content pieces follow brand ownership"
    ON public.content_pieces FOR ALL
    USING (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    )
    WITH CHECK (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    );

-- ================================================================
-- MARKETING_PLANS: Follow brand ownership
-- ================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.marketing_plans;

CREATE POLICY "Marketing plans follow brand ownership"
    ON public.marketing_plans FOR ALL
    USING (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    )
    WITH CHECK (
        brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
    );

-- ================================================================
-- New tables follow brand ownership too
-- ================================================================

-- AD CAMPAIGNS
DROP POLICY IF EXISTS "Authenticated users can manage ad campaigns" ON public.ad_campaigns;

CREATE POLICY "Ad campaigns follow brand ownership"
    ON public.ad_campaigns FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- GBP TABLES
DROP POLICY IF EXISTS "Authenticated access" ON public.gbp_info;
DROP POLICY IF EXISTS "Authenticated access" ON public.gbp_posts;
DROP POLICY IF EXISTS "Authenticated access" ON public.gbp_questions;
DROP POLICY IF EXISTS "Authenticated access" ON public.gbp_reviews;

CREATE POLICY "GBP info follows brand ownership" ON public.gbp_info FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "GBP posts follow brand ownership" ON public.gbp_posts FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "GBP questions follow brand ownership" ON public.gbp_questions FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "GBP reviews follow brand ownership" ON public.gbp_reviews FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- FOLLOWER HISTORY
DROP POLICY IF EXISTS "Authenticated users can manage follower history" ON public.follower_history;

CREATE POLICY "Follower history follows brand ownership" ON public.follower_history FOR ALL
    USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
    WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
