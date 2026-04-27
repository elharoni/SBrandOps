# SBrandOps — Master TODO List
> آخر مراجعة: 2026-04-27 | آخر تحديث: 2026-04-27 (Session 2: P2-01 AI Quick-Fill + P2-06 Duplicate + P3-04 Context Badge + P3-05 Inbox Context + P3-07 Mobile Switch + P4-03 Profile Cache)

---

## 🔴 P0 — حرج / مكسور / يمنع الإنتاج (4 مهام)

### ~~P0-01 · Mock Data في socialAccountService~~ ✅ منجز 2026-04-26
- Edge Function جديدة `get-platform-assets`: تفك تشفير التوكن من `oauth_tokens` وتستعلم Facebook Graph API للصفحات/Instagram
- `getPlatformAssets(platform, brandId)` يستدعي Edge Function بدلاً من البيانات المزيفة
- `ConnectAccountModal` كان محدثاً مسبقاً ليمرر `brandId`

### ~~P0-02 · DOCX/PPTX يطرح خطأ بلا توجيه~~ ✅ منجز 2026-04-26
- بطاقة إرشادية مع روابط Smallpdf / iLovePDF / PDF2Go + ملاحظة قبول TXT

### ~~P0-03 · OAuth Tokens — plaintext غير مشفّرة في قاعدة البيانات~~ ✅ منجز 2026-04-26
- Edge Function `encrypt-existing-tokens`: تشفير Batch للتوكنات القديمة في social_accounts + oauth_tokens + brand_connections بـ AES-256-GCM
- Migration `040_enforce_token_encryption.sql`: CHECK constraints تمنع plaintext جديد + جدول audit log + view `plaintext_tokens_audit`
- تشغيل: POST /encrypt-existing-tokens مع X-Admin-Key (dry_run=true للمراجعة أولاً)

### ~~P0-04 · Brand Intelligence Score — حساب جزئي وغير دقيق~~ ✅ منجز 2026-04-26
- يجلب الآن `getSocialAccounts` + `getBrandKnowledge` بالتوازي مع Profile
- Score breakdown جديد: هوية 45 pts + صوت/جمهور 20 pts + ربط اجتماعي 15 pts + قاعدة معرفة 20 pts = 100

---

## 🟠 P1 — ميزات أساسية مفقودة من المواصفات (6 مهام)

### ~~P1-01 · Brand Intelligence Tab في BrandHubPage~~ ✅ منجز 2026-04-26
- **الملف:** `components/pages/BrandHubPage.tsx` — إضافة تبويب `intelligence`
- **المطلوب:**
  - درجة اكتمال البراند (SVG دائرة) مقسّمة: هوية 30% / صوت 20% / جمهور 20% / معرفة 20% / اتصالات 10%
  - مستوى ثقة الذكاء الاصطناعي لكل وحدة: محتوى / ردود / إعلانات / تحليلات (شريط تقدم لكل)
  - مصادر البيانات النشطة: بيانات يدوية ✓ / صفحات مرتبطة ✓/✗ / CRM ✓/✗ / ملفات مرفوعة
  - Recommended Actions مرتبة: "أضف منتجاتك ← يُحسّن ردود المبيعات بـ 40%"
  - آخر نشاط تعلّم: "تعلّم 3 أسئلة جديدة أمس من Inbox"
- **يُبنى فوق:** `brandBrainService.ts` + `brandMemoryService.ts` + `getBrandKnowledge()`
- **الأثر:** نظام الذكاء الاصطناعي غير مرئي — المستخدم لا يعرف إذا كان يعمل أم لا

### ~~P1-02 · Onboarding Completion Checklist~~ ✅ منجز 2026-04-26
- `components/shared/OnboardingChecklist.tsx` جديد — 6 خطوات + progress bar + dismiss + localStorage
- استبدل الـ 4 خطوات القديمة في DashboardPage بالـ component الجديد

### ~~P1-03 · Token Expiry Warnings — تحذيرات انتهاء التوكن~~ ✅ منجز 2026-04-26
- IntegrationHealthPanel: عداد تنازلي (أحمر عند ≤3 أيام، برتقالي عند ≤7) مع animate-pulse
- Sidebar: نقطة حمراء animate-pulse على Integrations — `hasExpiringTokens` prop من App.tsx (يجلب integration_health عند تغيير البراند)
- Dashboard: بطاقة تحذير قابلة للإغلاق مع زر "جدّد الربط" ينقل لصفحة التكاملات

### ~~P1-04 · Scope Validation — عرض الصلاحيات الممنوحة والناقصة~~ ✅ منجز 2026-04-26
- `REQUIRED_SCOPES` per platform (Facebook/Instagram/TikTok/LinkedIn/X) per feature (publishing/inbox/analytics/ads)
- `getScopeStatus()` تقارن `scopes_granted` بالمطلوب وتُرجع مصفوفة {feature, granted, missing[]}
- بطاقة في `AssetCard`: ✓/✗ لكل ميزة + عدد الصلاحيات الناقصة + تعليمات إعادة الربط

### ~~P1-05 · AI Memory Review UI — واجهة مراجعة ذاكرة الذكاء الاصطناعي~~ ✅ منجز 2026-04-26
- **الملف:** `components/pages/BrandHubPage.tsx` — تبويب `ai-memory` (موجود كاسم لكن بدون محتوى فعلي)
- **المشكلة:** `brandMemoryService.ts` مكتمل backend لكن لا UI للمراجعة والتحكم
- **المطلوب:**
  - قائمة بكل عناصر التعلّم: النوع / المصدر / التاريخ / درجة الثقة
  - فلاتر: الكل / موافق عليه / معلّق / مرفوض / مؤرشف
  - أزرار لكل عنصر: ✓ وافق / ✎ عدّل / ✗ ارفض / 🗂 أرشف
  - بطاقة ملخص: "تعلّم 12 عنصراً هذا الأسبوع من 3 مصادر"
  - مرشح حسب المصدر: Inbox / Content Studio / ملف مرفوع / Manual
- **يُبنى فوق:** `brandMemoryService.getBrandMemoryContext()` + جدول `brand_memory`

### ~~P1-07 · WebsiteTab — توصيل GA4 الحقيقي~~ ✅ منجز (جلسة سابقة)
- يعرض sessions/engagedSessions/bounceRate/avgEngagementTime/keyEvents/revenue من `connectedSources.ga4`
- EmptyConnectState واضح عند عدم الربط

### ~~P1-08 · SEOTab — توصيل Search Console الحقيقي~~ ✅ منجز (جلسة سابقة)
- يعرض clicks/impressions/CTR/avgPosition/indexedPages + جدولا Top Queries & Top Pages
- `getSEOBreakdown()` من `analyticsService` + SyncStatusBar

### ~~P1-09 · AdsTab — توصيل Meta Ads + Google Ads~~ ✅ منجز (جلسة سابقة)
- يقرأ من `ad_campaign_facts` عبر `analyticsService` مع مفتاح `meta_ads`
- Provider filter + per-campaign metrics + ROAS/CPC/CPA

### ~~P1-10 · InboxPage — توصيل social_messages~~ ✅ منجز (جلسة سابقة)
- `getSocialMessagesAsConversations()` تقرأ من `social_messages` بـ priority_score ترتيب
- intent badges + sentiment + smart views (hot-leads/complaints/price-inquiry)
- Mark as read يحدّث `processed_at`

### P1-11 · OAuth Callback — اختبار وإصلاح كل منصة
- **الملف:** `components/pages/OAuthCallbackPage.tsx` + `supabase/functions/google-oauth/`
- **المشكلة:** OAuthCallbackPage بُني لكن لم يُختبر عملياً مع كل منصة
- **المطلوب التحقق منه:**
  - Facebook/Instagram: popup flow يُكمل ويحفظ token
  - Google (GA4 + GSC + Google Ads): redirect flow → callback → asset selector
  - TikTok: redirect flow مشابه لـ Google
  - LinkedIn/X: redirect flow
  - Shopify/WooCommerce/WordPress: API key flow (مختلف — بدون OAuth)
- **الأثر:** بدون هذا لا يعمل أي ربط فعلي

### ~~P1-06 · Page-Brand Match Confirmation Screen~~ ✅ منجز (جلسة سابقة)
- `PageBrandMatchModal` + `calcNameScore` + `calcCategoryScore` + `computeMatchScore` في AccountsPage.tsx
- `handleAssetsConfirmed` → match rows → `isMatchOpen` → `handleMatchConfirm` → `saveMatchScore`
- `saveMatchScore` في socialAuthService.ts تحفظ في `social_accounts`

---

## 🟡 P2 — ميزات تُحسّن جودة المنتج بشكل ملحوظ (6 مهام)

### ~~P2-01 · Brand Knowledge Quick-Fill بالذكاء الاصطناعي~~ ✅ منجز 2026-04-27
- زر "توليد AI" في 3 تبويبات: المنتجات / FAQ / سكريبتات (AI_SUPPORTED_TYPES)
- `AIQuickFillModal`: loading → عرض 6-8 مقترحات → approve/edit/reject/save
- `handleOpenAI` يجلب `getBrandHubProfile` + `callAIProxy(gemini-2.0-flash)` + parse JSON
- `handleSaveAISuggestions` يحفظ الموافق عليها عبر `addKnowledgeEntry`

### ~~P2-02 · Import Historical Data Flow — استيراد البيانات التاريخية~~ ✅ منجز 2026-04-27
- `components/pages/ImportDataModal.tsx` — 4 شاشات: Configure → Processing → Review → Done
- يُفتح تلقائياً بعد Page-Brand Match على FB/Instagram
- `callAIProxy(gemini-2.0-flash)` يستخرج: 5 FAQ + 3 شكاوى + 4 كلمات مفتاحية
- Review: approve/reject كل عنصر → حفظ في `brand_knowledge` بـ source: historical_import

### ~~P2-03 · Webhook Activation/Deactivation UI~~ ✅ منجز 2026-04-27
- Toggle button (ON/OFF) في AssetCard مع نافذة تأكيد عند الإيقاف
- `handleToggleWebhook` يستدعي `updateAssetMetadata(id, { webhookActive })` ويحدّث state
- تحذير: "إيقاف Webhook يوقف استقبال الرسائل في Inbox"

### ~~P2-04 · CRM Lead Creation من Inbox~~ ✅ منجز (جلسة سابقة)
- تبويب `crm` في InboxPage مع كشف النية (hot-lead/price-inquiry/order-intent)
- نموذج سريع: الاسم / الهاتف / البريد / الملاحظات
- `createCrmLeadFromConversation` في `inboxService.ts` تحفظ في `crm_leads`

### ~~P2-05 · Brand Voice Preview — معاينة صوت البراند مباشرة~~ ✅ منجز 2026-04-27
- زر "معاينة الصوت" في رأس تبويب Voice في BrandHubPage (IIFE pattern لـ local state)
- `generatePreview()` تستدعي `callAIProxy(gemini-2.0-flash)` بـ prompt يضم tone + keywords + guidelines
- 3 بطاقات قابلة للنسخ: رد على شكوى / منشور ترويجي / رسالة ترحيب + زر "توليد معاينة جديدة"

### ~~P2-06 · Multi-Brand Quick Duplicate~~ ✅ منجز (جلسة سابقة)
- `DuplicateBrandModal` + زر "استنساخ" على كل بطاقة (onDuplicate prop)
- `handleDuplicateConfirm` يستدعي `addBrand(newName, industry, undefined, country, websiteUrl)`
- لا ينسخ الحسابات أو قاعدة المعرفة — يبدأ من صفر

---

## 🟢 P3 — تحسينات UX وجودة تجربة المستخدم (8 مهام)

### ~~P3-01 · BrandHub Identity Tab — حقول الـ Wizard المفقودة~~ ✅ منجز 2026-04-27
- تبويب Identity أصبح نموذج تعديل كامل: الصناعة (select) / وصف البراند (textarea)
- نموذج العمل (select: b2c/b2b/ecommerce/...) + لغة التواصل (radio: ar/en/both)
- أهداف البراند (7 أزرار toggle: awareness/leads/sales/bookings/engagement/support/recruitment)
- الفئة العمرية (select) + ملخص الجمهور (textarea) + هاتف + إيميل
- كل تغيير يحدّث `profile` state مباشرة → "حفظ التغييرات" يحفظ عبر `updateBrandProfile()`

### ~~P3-02 · Knowledge Base — Duplicate Detection~~ ✅ منجز 2026-04-27
- `titleSimilarity()` في BrandKnowledgePage: word-overlap ratio على عناوين نفس النوع
- إذا تشابه > 60%: `window.confirm` يعرض اسم الإدخال المشابه + خيار الإضافة على أي حال
- يعمل على الإدخالات الجديدة فقط (لا يُطبَّق على التعديلات)

### ~~P3-03 · BrandBrainPage — Confidence Trend Chart~~ ✅ منجز 2026-04-27
- تبويب "مسار الثقة" جديد في BrandBrainPage مع SVG polyline chart (لا مكتبة خارجية)
- يجمع executions حسب اليوم ويحسب متوسط confidence كل يوم — آخر 30 يوم
- 3 بطاقات ملخص + chart مع area fill + reference line للمتوسط + جدول تفصيلي قابل للتمرير

### ~~P3-04 · Content Studio — Brand Context Indicator~~ ✅ منجز 2026-04-27
- شارة "Voice: [brandName] · Full" في AI toolbar أعلى المحرر
- قابلة للضغط لفتح Brand Hub عبر `onNavigate?.('brand-hub')`

### ~~P3-05 · Inbox — Brand Context Selector~~ ✅ منجز 2026-04-27
- مؤشر في أعلى تبويب AI في ActionPanel: "يرد بصوت [brandName] ← [Platform]"
- IIFE pattern لتجنب state إضافي، يعرض أيقونة المنصة + اسم البراند

### ~~P3-06 · Brand Data Export~~ ✅ منجز 2026-04-27
- زر "تصدير" في رأس BrandHubPage بجانب "حفظ التغييرات"
- يُنشئ JSON يشمل: الهوية + الصوت + الجمهور + consistencyScore
- اسم الملف: `[brandName]_brand_profile.json`

### ~~P3-07 · Mobile — Brand Quick Switch~~ ✅ منجز 2026-04-27
- زر "تبديل" في brand header يفتح dropdown بقائمة كل البراندات
- يظهر فقط إذا brands.length > 1 + BrandOption prop مُمرَّر من BrandRouter

### ~~P3-08 · Knowledge Base — Version History~~ ✅ منجز 2026-04-27
- Migration 044: جدول `brand_knowledge_history` + Trigger `trg_knowledge_version` يحفظ القيم القديمة عند تغيير العنوان/المحتوى
- `getKnowledgeHistory(entryId)` في brandKnowledgeService.ts
- زر "السجل" (ساعة) على كل EntryCard → modal مع قائمة الإصدارات + زر "استرجاع" لكل إصدار

---

## 🔵 P4 — بنية تحتية وأداء (6 مهام)

### ~~P4-01 · Server-Side Intelligence Score كـ DB Function~~ ✅ منجز 2026-04-27
- Migration 045: `compute_brand_intelligence_score(p_brand_id)` — 45 هوية + 20 صوت/جمهور + 15 اجتماعي + 20 معرفة = 100
- Trigger BEFORE INSERT/UPDATE على brand_profiles يضبط consistency_score مباشرة في NEW
- Triggers AFTER على brand_knowledge + social_accounts تُحدّث brand_profiles.consistency_score

### ~~P4-02 · Token Auto-Refresh — التحقق من اكتمال التنفيذ~~ ✅ منجز (مراجعة 2026-04-27)
- `supabase/functions/token-refresh/index.ts` مكتمل: FB/Instagram/Google/TikTok/LinkedIn-X
- `REFRESH_WINDOW_DAYS = 7` — يلتقط التوكنات التي ستنتهي خلال 7 أيام
- يحدّث `social_accounts.sync_status` + `brand_connections.status` + `integration_health_snapshots`
- تحذيرات الـ UI (P1-03) تعرض الإشعارات في المنصة

### ~~P4-03 · Brand Profile Caching~~ ✅ منجز 2026-04-27
- `profileCache: Map<string, {profile, ts}>` في brandHubService.ts بـ TTL = 5 دقائق
- `invalidateProfileCache(brandId)` تُستدعى تلقائياً في `updateBrandProfile`
- بدون تغييرات في Components أو Zustand — الـ cache شفاف

### ~~P4-04 · Missing Database Indexes~~ ✅ منجز (migration 042)
- idx_social_accounts_brand_platform + idx_social_accounts_brand_status
- idx_brand_knowledge_brand_type_active + idx_oauth_tokens_expiry_valid
- idx_analytics_* + idx_social_messages_* في `042_performance_indexes.sql`

### ~~P4-05 · Knowledge Content Length Validation~~ ✅ منجز (migration 043 + frontend)
- `CHECK (char_length(content) <= 3000) NOT VALID` في `043_knowledge_content_length.sql`
- EntryForm في BrandKnowledgePage لديها character counter + لا يُسمح بالحفظ عند التجاوز

### ~~P4-06 · Per-Brand AI Rate Limiting~~ ✅ منجز 2026-04-27
- `BRAND_DAILY_TOKEN_LIMIT` = 30,000 توكن/يوم per-brand (env: AI_BRAND_DAILY_TOKEN_LIMIT)
- `checkBrandDailySpendCap(brandId)` تستعلم `ai_usage_logs` WHERE brand_id + today
- فحص بعد user-level cap مباشرة — يُطبّق فقط عند وجود brand_id في الطلب

---

## 📊 ملخص تنفيذي

| الأولوية | المهام | الوقت التقديري | من يتأثر |
|-----------|--------|----------------|----------|
| 🔴 P0 — حرج     | 2  | 1-2 أيام  | كل المستخدمين |
| 🟠 P1 — أساسي   | 11 | 7-9 أيام  | Integration + Analytics + Inbox |
| 🟡 P2 — مهم     | 6  | 4-6 أيام  | المستخدمون النشطون يومياً |
| 🟢 P3 — UX      | 8  | 3-5 أيام  | جودة التجربة العامة |
| 🔵 P4 — بنية    | 6  | 2-4 أيام  | الأداء والأمان |
| **المجموع**     | **33** | **~3 أسابيع** | |

---

## ✅ منجز بالفعل

| المهمة | الملف |
|--------|-------|
| Brand Onboarding Wizard — 7 خطوات كاملة | `BrandOnboardingWizard.tsx` |
| Brand Intelligence Score في BrandsManagePage | `BrandsManagePage.tsx` |
| Extended Brand Profile — types + migration | `types.ts` + `053_brand_profile_extended.sql` |
| addBrand/updateBrand يقبلان country + website | `services/brandService.ts` |
| brandHubService يقرأ ويكتب extended_profile | `services/brandHubService.ts` |
| Brand Knowledge CRUD كامل مع بحث | `BrandKnowledgePage.tsx` |
| Brand Brain — Skills / Executions / Knowledge | `BrandBrainPage.tsx` |
| Brand Analysis + Competitor Widget | `BrandAnalysisPage.tsx` |
| Integration Health Panel كامل | `IntegrationHealthPanel.tsx` |
| AI Memory Service — backend كامل | `brandMemoryService.ts` |
| OAuth Token Encryption Schema | `migrations/021_encrypt_oauth_tokens.sql` |
| Asset Registry + Sync Status كامل | `migrations/048_asset_registry.sql` |
| Learning Loop Migration | `migrations/050_learning_loop.sql` |
| Smart Bot — 6 سيناريوهات + Wizard | `SmartBotPage.tsx` |
| Campaign Brain كامل | `CampaignBrainPage.tsx` |
| Analytics Hub — 8 tabs | `AnalyticsHubPage.tsx` |
| **Integration System Phase 1** | |
| Migration 037: sync_jobs, sync_logs, webhook_events, social_messages, ad_campaigns, ad_insights, products, integration_health_snapshots | `037_integration_system.sql` |
| Migration 038: analytics_snapshots.source/date columns + cron jobs | `038_integration_cron_jobs.sql` |
| Edge Function: token-refresh — Google + TikTok refresh grants | `functions/token-refresh/index.ts` |
| Edge Function: sync-engine — GA4 + GSC + Shopify + Social analytics | `functions/sync-engine/index.ts` |
| Edge Function: inbox-aggregator — FB/IG/YouTube messages + AI classify | `functions/inbox-aggregator/index.ts` |
| Edge Function: ads-sync — Meta Ads + Google Ads campaigns + insights | `functions/ads-sync/index.ts` |
| OAuthCallbackPage — يستقبل كل OAuth redirects + asset selector | `components/pages/OAuthCallbackPage.tsx` |
| PlatformCatalogSection — 14 منصة + status badges + category filter | `components/PlatformCatalogSection.tsx` |
| **DB Idempotency Fix (2026-04-26)** | |
| إصلاح bare CREATE POLICY في 9 migration files | `015, 016, 017, 019, 029, 030, 032, 033, 034` |
| إصلاح migration numbering conflict (035→037, 036→038) | renamed files |
