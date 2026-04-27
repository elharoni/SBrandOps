# Analytics Hub — Remaining To-Do List
> آخر تحديث: 2026-04-26
> ما تم: Frontend rebuild كامل (8 tabs، real trends، EmptyStates، types، service refactor)
> ما تم (2026-04-26 — جلسة 1): Migration 035 (analytics_page_facts + seo_page_facts + ad_campaign_facts + analytics_sync_jobs) + data-sync يدعم GA4 كامل + Search Console + DashboardPage Reach fix
> ما تم (2026-04-26 — جلسة 2): meta-ads-oauth Edge Function + IntegrationsPage wiring كامل (picker + OAuth popup) + integrationsModel meta_ads + analyticsService يقرأ من ad_campaign_facts بمفتاح meta_ads الصحيح + AdsTab PROVIDER_DISPLAY fix
> ما تم (2026-04-26 — جلسة 3): SEOTab Top Queries + Top Pages جدولان حقيقيان + SyncStatusBar مكوّن مشترك في analyticsHelpers + getSEOBreakdown + getLastSyncJobs في analyticsService + SEOBreakdown + SyncJobStatus types + SyncStatusBar مضاف لـ SEOTab + WebsiteTab + AdsTab

---

## 🔴 Priority 1 — Backend / Data
> بدون هذه الخطوات تبقى أرقام التبويبات صفر حتى لو الحسابات مرتبطة

- [x] **Edge Function: GA4 Sync** ✅ `data-sync/index.ts`
  - Sessions / Engaged Sessions / Bounced Sessions / Key Events / Transactions / Revenue / Avg Engagement Time
  - يحفظ في `analytics_page_facts` — conflict key: `brand_id, connection_id, fact_date, landing_page`
  - يُشغَّل كـ cron كل 6 ساعات (migration 035) + manual trigger بـ service role key

- [x] **Edge Function: Search Console Sync** ✅ `data-sync/index.ts`
  - Clicks / Impressions / CTR / Position — dimensions: date + page + query
  - يحفظ في `seo_page_facts` — pagination بـ 1000 صف لكل request
  - يُشغَّل مع GA4 في نفس الـ cron

- [x] **Edge Function: Meta Ads Sync** ✅ `data-sync/index.ts` — `syncMetaAds()`
  - يقرأ connections بـ provider = `meta_ads` من `brand_connections`
  - يستدعي Marketing API v23.0 `/insights` بـ level=campaign, time_increment=1
  - يحفظ في `ad_campaign_facts` — conflict key: `brand_id, provider, fact_date, campaign_id`

- [x] **Migration: analytics_sync_jobs** ✅ `035_analytics_fact_tables.sql`
  - يُسجَّل تلقائياً من `data-sync` بعد كل sync (success أو failed)

---

## 🟠 Priority 2 — Ads Integration
> يفتح تبويب الإعلانات بالكامل

- [x] **Meta Ads OAuth Flow** ✅
  - Scopes: `ads_read, ads_management, business_management`
  - Edge Function: `supabase/functions/meta-ads-oauth/index.ts` — `/init` + `/callback`
  - يُخزَّن في `brand_connections` (provider=`meta_ads`) مشفراً بـ AES-256-GCM
  - IntegrationsPage: OAuth popup → account picker (multi-account) → `connectProvider`
  - `providerConnectionService`: `initiateMetaAdsOAuth` + `persistMetaAdsConnection`
  - `brandConnectionService`: `meta_ads` مضاف لـ Provider type + CONNECTABLE_BRAND_PROVIDERS

- [ ] **Google Ads OAuth Flow**
  - Google Ads API (ليس Google Analytics)
  - Scopes: `https://www.googleapis.com/auth/adwords`
  - يُخزَّن في `oauth_tokens` مشفراً
  - يُعرض في صفحة التكاملات كـ account_type = `google_ads`

- [x] **AdsTab: تفعيل البيانات الحقيقية** ✅
  - `analyticsService.ts`: يقرأ من `ad_campaign_facts` (بدل `ad_insights` الوهمي)
  - provider key مصحح: `meta_ads` بدل `meta` الخاطئ
  - `tiktok_ads` محذوف (لم يكن Provider صحيح)
  - `AdsTab.tsx` PROVIDER_DISPLAY: مفتاح `meta_ads` مصحح
  - `connectedSources.ads` يتعبأ تلقائياً لما يوجد بيانات في `ad_campaign_facts`

---

## 🟡 Priority 3 — Tab Improvements
> يكمّل التجربة ويجعل كل تبويب قابلاً للعمل فعلياً

- [x] **SEOTab: Top Queries & Top Pages** ✅
  - `analyticsService.ts`: `getSEOBreakdown(brandId, period)` — تجمّع clicks + impressions + avgPosition من `seo_page_facts`، top 10 queries + top 10 pages
  - `types.ts`: `SEOBreakdown`, `SEOQueryRow`, `SEOPageRow`
  - `SEOTab.tsx`: جدولان — كلمات مفتاحية وصفحات مع rank + clicks + impressions + CTR + position — skeleton أثناء التحميل

- [ ] **WebsiteTab: Traffic Sources Breakdown**
  - يحتاج GA4 يرسل source/medium في `analytics_page_facts` أو جدول منفصل
  - يُعرض Organic / Paid / Social / Direct / Email / Referral
  - حقل جديد في migration: `source_medium JSONB` أو جدول `analytics_traffic_sources`

- [ ] **ContentTab: تقسيم نوع المحتوى**
  - Reels vs Posts vs Carousel vs Stories vs Videos
  - يحتاج حقل `content_type` في جدول `post_analytics` (migration جديد)
  - يُعرض كـ MetricBarList في `ContentTab.tsx`

- [ ] **SocialTab: Video Metrics**
  - Watch Time / Video Views / Completion Rate
  - متاح من Instagram Insights API وTikTok API وYouTube Analytics
  - يُضاف في `analytics_snapshots` كـ metric_name = `video_views`, `watch_time_sec`

---

## 🔵 Priority 4 — UX Improvements

- [ ] **Date Range: Custom Picker**
  - إضافة خيارات: Today / Yesterday / This Month / Last Month / Custom Range
  - حالياً فقط: 7d / 30d / 90d
  - يُعدَّل `PERIOD_OPTIONS` في `AnalyticsPage.tsx` وتُعدَّل `getPeriodDate()` في `analyticsService.ts`

- [x] **DashboardPage: إصلاح مقياس Reach** ✅
  - `components/pages/DashboardPage.tsx` line 921 — يعرض الآن `reach` مع fallback لـ `impressions`

- [x] **Sync Status Indicator** ✅
  - `analyticsService.ts`: `getLastSyncJobs(brandId)` — آخر job لكل provider من `analytics_sync_jobs`
  - `types.ts`: `SyncJobStatus`
  - `analyticsHelpers.tsx`: `SyncStatusBar` مكوّن مشترك — provider label + status dot + وقت + عدد سجلات + زر مزامنة
  - مضاف في SEOTab (search_console) + WebsiteTab (ga4) + AdsTab (meta_ads, google_ads)

---

## ⚪ Priority 5 — Future / Phase 2

- [ ] TikTok Ads API integration
- [ ] LinkedIn Ads API integration
- [ ] Google Search Console: Index Coverage data (indexed vs not indexed)
- [ ] Anomaly Detection — تنبيه تلقائي لو الـ impressions انخفضت بأكثر من 30% فجأة
- [ ] Scheduled Reports — إرسال تقرير أسبوعي بالبريد الإلكتروني
- [ ] Keyword Tracking — تتبع ترتيب كلمات مفتاحية محددة بمرور الوقت
- [ ] Competitor Benchmarking — مقارنة الأداء بمتوسط الصناعة

---

## ملاحظات معمارية مهمة

- **GA4 ≠ Google Ads** — مصدران منفصلان، OAuth منفصل، بيانات منفصلة، تبويبات منفصلة
- **Meta Ads ≠ Facebook Page** — Meta Ads = paid, Facebook Page = organic
- **Tokens** — لا تُعرض أبداً في الـ frontend، تُقرأ فقط من Edge Functions بعد فك التشفير
- **Empty States** — كل تبويب بدون بيانات يعرض empty state واضح مع رابط للتكاملات
- **Trend Arrows** — تُحسب دائماً من `previousPeriodStats` — لا أرقام hardcoded أبداً
