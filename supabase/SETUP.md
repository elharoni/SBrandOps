# SBrandOps — Production Deployment Guide
# دليل النشر على بيئة الإنتاج

> آخر تحديث: 2026-04-27 | يشمل جميع الـ migrations حتى 046 + جميع Edge Functions

---

## المتطلبات الأولية

- Node.js 18+
- Supabase CLI: `npm install -g supabase`
- Vercel CLI: `npm install -g vercel`
- حساب على: Supabase · Vercel · Meta Developers · Google Cloud

---

## Phase 1 — إعداد Supabase Production

### 1.1 إنشاء مشروع جديد

1. اذهب إلى [supabase.com/dashboard](https://supabase.com/dashboard)
2. **New Project** ← أدخل الاسم والباسورد ← اختر Region قريبة من جمهورك
3. احفظ:
   - **Project Ref** (مثل: `abcxyz123`)
   - **Project URL** (مثل: `https://abcxyz123.supabase.co`)
   - **anon public key**
   - **service_role key** ← سري جداً، لـ Edge Functions فقط

### 1.2 تفعيل الإضافات المطلوبة

في Dashboard → Database → Extensions، فعّل:

| الإضافة | الغرض |
|---------|-------|
| `pg_cron` | جدولة المهام التلقائية |
| `pg_net` | طلبات HTTP من داخل DB |
| `pgcrypto` | تشفير التوكنات |
| `uuid-ossp` | توليد UUIDs |

### 1.3 ربط الـ CLI

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 1.4 تشغيل الـ Migrations

```bash
supabase db push
```

سيُشغّل تلقائياً بالترتيب:

```
015_edge_functions_cron.sql
016_crm_module.sql
017_crm_inbox_roles_analytics.sql
018_marketing_plans_ai.sql
019_seo_ops.sql
020_perf_indexes.sql
021_encrypt_oauth_tokens.sql
022_jsonb_constraints.sql
023_tenant_counter_functions.sql
024_tenant_usage_views.sql
025_oauth_tokens_and_platform_user_id.sql
026_fix_oauth_tokens_nullable.sql
027_fix_security_advisor.sql
028_drop_open_rls_policies.sql
029_create_media_storage_bucket.sql
030_campaign_brain.sql
031_brand_documents.sql
032_captions_media_assets.sql
033_support_chat.sql
034_smart_bot.sql
035_analytics_fact_tables.sql
037_integration_system.sql
038_integration_cron_jobs.sql
039_inbox_tables_and_sync.sql
040_enforce_token_encryption.sql
041_social_account_match.sql
042_performance_indexes.sql
043_knowledge_content_length.sql
044_knowledge_version_history.sql
045_brand_intelligence_score_function.sql
046_inbox_commercial.sql
```

### 1.5 إعداد pg_cron (بعد تشغيل المigrations)

في Supabase SQL Editor:

```sql
ALTER DATABASE postgres
  SET "app.supabase_url" = 'https://YOUR_PROJECT_REF.supabase.co';

ALTER DATABASE postgres
  SET "app.service_role_key" = 'YOUR_SERVICE_ROLE_KEY';
```

### 1.6 التحقق من RLS

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

يجب أن تكون جميع القيم `true`.

---

## Phase 2 — نشر Edge Functions

### 2.1 ضبط الـ Secrets أولاً

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set GEMINI_API_KEY=your_gemini_api_key
supabase secrets set FACEBOOK_APP_SECRET=your_facebook_app_secret
supabase secrets set INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret
supabase secrets set GOOGLE_CLIENT_SECRET=your_google_client_secret
supabase secrets set TWITTER_API_SECRET=your_twitter_api_secret
supabase secrets set TWITTER_BEARER_TOKEN=your_twitter_bearer_token
supabase secrets set LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
supabase secrets set TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
supabase secrets set PADDLE_API_KEY=your_paddle_api_key
supabase secrets set PADDLE_WEBHOOK_SECRET=your_paddle_webhook_secret
supabase secrets set ADMIN_SECRET_KEY=your_strong_random_key_for_admin_ops
supabase secrets set AI_BRAND_DAILY_TOKEN_LIMIT=30000
```

### 2.2 نشر جميع الـ Functions

```bash
supabase functions deploy ai-proxy
supabase functions deploy token-refresh
supabase functions deploy sync-engine
supabase functions deploy inbox-aggregator
supabase functions deploy ads-sync
supabase functions deploy get-platform-assets
supabase functions deploy google-oauth
supabase functions deploy provider-oauth-callback
supabase functions deploy meta-ads-oauth
supabase functions deploy encrypt-existing-tokens
supabase functions deploy auto-publisher
supabase functions deploy publish-now
supabase functions deploy publish-content
supabase functions deploy send-reply
supabase functions deploy connect-accounts
supabase functions deploy manage-social-account
supabase functions deploy data-sync
supabase functions deploy analytics-aggregator
supabase functions deploy analytics-learning
supabase functions deploy monitor-health
supabase functions deploy today-summary
supabase functions deploy sync-inbox
supabase functions deploy provider-webhook
supabase functions deploy paddle-checkout
supabase functions deploy paddle-webhook
supabase functions deploy paddle-billing-manage
supabase functions deploy paddle-webhook-auto-retry
supabase functions deploy paddle-webhook-retry
```

أو دفعة واحدة (بدون `--no-verify-jwt` على functions تحتاج auth):

```bash
# للـ functions التي تستقبل webhooks خارجية (بدون JWT)
supabase functions deploy provider-webhook --no-verify-jwt
supabase functions deploy paddle-webhook --no-verify-jwt
supabase functions deploy paddle-webhook-auto-retry --no-verify-jwt
```

### 2.3 تشفير التوكنات الموجودة (إن وُجدت)

```bash
# أولاً: dry run للمراجعة
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/encrypt-existing-tokens \
  -H "x-admin-key: YOUR_ADMIN_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'

# إذا النتيجة مقبولة: تشفير فعلي
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/encrypt-existing-tokens \
  -H "x-admin-key: YOUR_ADMIN_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'
```

---

## Phase 3 — إعداد Authentication

### 3.1 إعداد URLs

في Dashboard → Authentication → URL Configuration:

| الحقل | القيمة |
|-------|--------|
| Site URL | `https://sbrandops.com` |
| Redirect URLs | `https://sbrandops.com/*` |

### 3.2 تفعيل OAuth Providers

**Facebook / Instagram:**
- Dashboard → Auth → Providers → Facebook
- أدخل App ID + App Secret من [Meta Developer Console](https://developers.facebook.com)
- Callback URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

**Google:**
- Dashboard → Auth → Providers → Google
- أدخل Client ID + Secret من [Google Cloud Console](https://console.cloud.google.com)
- أضف Authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

---

## Phase 4 — Storage Buckets

في Dashboard → Storage → New Bucket:

| Bucket | عام؟ | الوصف |
|--------|------|-------|
| `brand-media` | ✅ | شعارات وأصول البراند |
| `post-media` | ✅ | صور وفيديوهات المنشورات |
| `avatars` | ✅ | صور المستخدمين |
| `reports` | ❌ | تقارير التحليلات (خاصة) |

---

## Phase 5 — نشر الـ Frontend على Vercel

### 5.1 ملف `.env.production`

أنشئ ملف `.env.production` (لا تضفه لـ git):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_FACEBOOK_APP_ID=your_facebook_app_id
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id
VITE_TWITTER_API_KEY=your_twitter_consumer_key
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id
VITE_TIKTOK_CLIENT_KEY=your_tiktok_client_key
VITE_PADDLE_ENV=production
VITE_PADDLE_STARTER_MONTHLY_PRICE_ID=pri_xxx
VITE_PADDLE_STARTER_YEARLY_PRICE_ID=pri_xxx
VITE_PADDLE_GROWTH_MONTHLY_PRICE_ID=pri_xxx
VITE_PADDLE_GROWTH_YEARLY_PRICE_ID=pri_xxx
VITE_PADDLE_AGENCY_MONTHLY_PRICE_ID=pri_xxx
VITE_PADDLE_AGENCY_YEARLY_PRICE_ID=pri_xxx
VITE_APP_URL=https://sbrandops.com
VITE_API_URL=https://YOUR_PROJECT_REF.supabase.co
```

### 5.2 Build واختبار محلي

```bash
npm run build
npx serve dist  # اختبار الـ build محلياً
```

### 5.3 النشر على Vercel

```bash
vercel --prod
```

أو عبر GitHub:
1. Push الكود لـ GitHub
2. [vercel.com/new](https://vercel.com/new) → Import Repository
3. أضف جميع `VITE_*` في Environment Variables
4. Deploy

### 5.4 ربط الدومين

في Vercel → Project → Settings → Domains:
- أضف `sbrandops.com`
- اتبع تعليمات DNS (CNAME أو A record)

---

## Phase 6 — اختبار ما بعد النشر

```
[ ] تسجيل الدخول / إنشاء حساب يعمل
[ ] إنشاء براند يحفظ في DB
[ ] OAuthCallbackPage يستقبل Facebook redirect
[ ] Token expiry warnings تظهر
[ ] AI proxy (Gemini) يستجيب
[ ] Inbox يجلب الرسائل
[ ] Analytics sync يعمل (بعد 6 ساعات)
[ ] Sentry يستقبل أخطاء تجريبية
```

---

## Meta App Setup (لـ P1-11)

1. [developers.facebook.com](https://developers.facebook.com) → إنشاء App
2. Products: **Facebook Login** + **Instagram Basic Display** + **Instagram Graph API**
3. في Facebook Login → Settings:
   - Valid OAuth Redirect URIs: `https://sbrandops.com/oauth/callback`
4. في App Settings → Basic:
   - App Domains: `sbrandops.com`
5. انسخ **App ID** → `.env.production` كـ `VITE_FACEBOOK_APP_ID`
6. انسخ **App Secret** → Supabase secrets كـ `FACEBOOK_APP_SECRET`
7. عند الاختبار: أضف بريدك في App Roles → Testers

> **ملاحظة:** الـ app يظل في وضع Development حتى تُكمل App Review من Meta (مطلوب للإنتاج الكامل)
