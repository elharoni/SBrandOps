# Analytics Hub — Remaining To-Do List
> آخر تحديث: 2026-04-26
> ما تم: Frontend rebuild كامل (8 tabs، real trends، EmptyStates، types، service refactor)

---

## 🔴 Priority 1 — Backend / Data
> بدون هذه الخطوات تبقى أرقام التبويبات صفر حتى لو الحسابات مرتبطة

- [ ] **Edge Function: GA4 Sync**
  - تتصل بـ Google Analytics Data API
  - تسحب Sessions / Engaged Sessions / Bounced Sessions / Key Events / Revenue / Avg Engagement Time
  - تحفظ في جدول `analytics_page_facts` (brand_id, connection_id, analytics_property_id, fact_date)
  - تُشغَّل كـ cron كل 6 ساعات + manual trigger

- [ ] **Edge Function: Search Console Sync**
  - تتصل بـ Google Search Console API
  - تسحب Clicks / Impressions / CTR / Average Position / Page URL / Query
  - تحفظ في جدول `seo_page_facts` (brand_id, connection_id, fact_date, page_url, query)
  - تُشغَّل كـ cron يومياً + manual trigger

- [ ] **Edge Function: Meta Ads Sync**
  - تتصل بـ Meta Marketing API
  - تسحب Spend / Impressions / Reach / Clicks / CTR / CPC / CPM / Conversions / ROAS / CPA
  - تحفظ في جدول جديد `ad_campaign_facts` (brand_id, connection_id, campaign_id, ad_account_id, fact_date)
  - تُشغَّل كـ cron كل 6 ساعات + manual trigger

- [ ] **Migration: analytics_sync_jobs**
  - جدول لتسجيل حالة كل sync job
  - أعمدة: brand_id, provider, status (running/success/failed), started_at, finished_at, error_message, records_synced
  - يُستخدم لعرض Sync Status في الواجهة وإعادة المحاولة عند الفشل

---

## 🟠 Priority 2 — Ads Integration
> يفتح تبويب الإعلانات بالكامل

- [ ] **Meta Ads OAuth Flow**
  - Scopes المطلوبة: `ads_read`, `ads_management`, `business_management`
  - منفصل تماماً عن Facebook Page OAuth (لا تخلطهما)
  - يُخزَّن في `oauth_tokens` مشفراً بـ AES-256-GCM
  - يُعرض في صفحة التكاملات كـ account_type = `meta_ads`

- [ ] **Google Ads OAuth Flow**
  - Google Ads API (ليس Google Analytics)
  - Scopes: `https://www.googleapis.com/auth/adwords`
  - يُخزَّن في `oauth_tokens` مشفراً
  - يُعرض في صفحة التكاملات كـ account_type = `google_ads`

- [ ] **AdsTab: تفعيل البيانات الحقيقية**
  - الملف: `components/pages/analytics/AdsTab.tsx`
  - السطر: `const hasAdData = false` — يتحول لقراءة من `data.connectedSources?.metaAds` أو `data.connectedSources?.googleAds`
  - يُضاف `metaAds` و `googleAds` إلى `AnalyticsData.connectedSources` في `types.ts`
  - يُضاف fetch منهما في `analyticsService.ts` → `getConnectedSourceSummaries()`

---

## 🟡 Priority 3 — Tab Improvements
> يكمّل التجربة ويجعل كل تبويب قابلاً للعمل فعلياً

- [ ] **SEOTab: Top Queries & Top Pages**
  - حالياً يعرض فقط الإجماليات (Clicks, Impressions, CTR, Position)
  - يُضاف endpoint أو query منفصل يجيب top 10 queries وtop 10 pages من `seo_page_facts`
  - يُضاف في `analyticsService.ts` دالة `getSEOBreakdown(brandId, period)`
  - يُعرض في جدولين داخل `SEOTab.tsx`

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

- [ ] **DashboardPage: إصلاح مقياس Reach**
  - الملف: `components/pages/DashboardPage.tsx` السطر 921
  - حالياً: `value={formatter.format(analyticsData.overallStats.impressions)}` مع label "Reach"
  - الصحيح: `value={formatter.format(analyticsData.overallStats.reach || analyticsData.overallStats.impressions)}`

- [ ] **Sync Status Indicator**
  - عرض آخر وقت sync لكل مصدر في header التبويب
  - زر Retry واضح لو فشل الـ sync
  - يُقرأ من جدول `analytics_sync_jobs`

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
