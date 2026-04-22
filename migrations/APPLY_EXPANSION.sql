-- ============================================================
-- SBrandOps — Database Expansion Master Script
-- طريقة التطبيق: افتح Supabase SQL Editor وشغّل هذا الملف
-- التاريخ: 2026-04-16
-- ============================================================
-- الترتيب المهم جداً:
-- 1. 038 أولاً (oauth_tokens — يعتمد عليه 040)
-- 2. 039 (ai_usage_logs — مستقل)
-- 3. 040 (platform_publish_results — يعتمد على 038)
-- 4. 041 (seo_tables — مستقل)
-- 5. 042 (enhance_existing — يعتمد على 010 workflows)
-- 6. 043 (analytics_cache — مستقل)
-- 7. 044 آخراً (fix_rls — يعيد كتابة policies)
-- ============================================================

-- ✅ STEP 1: oauth_tokens
\i migrations/038_oauth_tokens.sql

-- ✅ STEP 2: ai_usage_logs
\i migrations/039_ai_usage_logs.sql

-- ✅ STEP 3: platform_publish_results
\i migrations/040_platform_publish_results.sql

-- ✅ STEP 4: seo_tables
\i migrations/041_seo_tables.sql

-- ✅ STEP 5: enhance_existing_tables
\i migrations/042_enhance_existing_tables.sql

-- ✅ STEP 6: analytics_cache_and_snapshots
\i migrations/043_analytics_cache_and_snapshots.sql

-- ✅ STEP 7: fix_rls_policies (الأهم — الأمان)
\i migrations/044_fix_rls_policies.sql

-- انتهى — طباعة رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE '✅ Database expansion complete — 7 migrations applied successfully';
    RAISE NOTICE '  New tables: oauth_tokens, ai_usage_logs, platform_publish_results';
    RAISE NOTICE '  New tables: seo_pages, seo_keywords, seo_keyword_history';
    RAISE NOTICE '  New tables: brand_analytics_cache, follower_snapshots, workflow_runs';
    RAISE NOTICE '  Enhanced:   brand_profiles, ad_campaigns, workflows, brand_integrations';
    RAISE NOTICE '  Security:   11 RLS policies fixed — no more open access';
END $$;
