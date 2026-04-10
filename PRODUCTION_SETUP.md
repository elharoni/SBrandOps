# 🚀 دليل التشغيل الكامل — SBrandOps Production Setup

## الخطوة 1: تشغيل MASTER_FIX.sql في Supabase Dashboard

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك: **wxzcfdmjwggikmqeswvm**
3. اذهب إلى **SQL Editor** (من القائمة الجانبية)
4. اضغط **New Query**
5. انسخ محتوى ملف `MASTER_FIX.sql` كاملاً والصقه
6. اضغط **Run** — تأكد من ظهور: `Master Fix Script completed successfully! 🎉`

---

## الخطوة 2: Deploy الـ Edge Functions

### أولاً: الحصول على Access Token
1. افتح [Supabase Account Tokens](https://supabase.com/dashboard/account/tokens)
2. اضغط **Generate new token** → أعطِه اسماً مثل "SBrandOps Deploy"
3. انسخ التوكن

### ثانياً: تسجيل الدخول وDeployment
افتح PowerShell في مجلد المشروع وشغّل:

```powershell
# تسجيل الدخول
npx supabase login --token YOUR_ACCESS_TOKEN_HERE

# Deploy كل الـ Edge Functions
.\deploy.ps1 -ProjectRef wxzcfdmjwggikmqeswvm -ServiceRoleKey YOUR_SERVICE_ROLE_KEY
```

احصل على Service Role Key من: Dashboard → Project Settings → API → `service_role` (secret)

### بديل يدوي في حال فشل الـ Script:
```powershell
npx supabase link --project-ref wxzcfdmjwggikmqeswvm

# Deploy كل function بشكل منفرد:
npx supabase functions deploy publish-now
npx supabase functions deploy connect-accounts
npx supabase functions deploy auto-publisher
npx supabase functions deploy analytics-aggregator
npx supabase functions deploy provider-oauth-callback
npx supabase functions deploy provider-webhook
npx supabase functions deploy manage-social-account
npx supabase functions deploy paddle-checkout
npx supabase functions deploy paddle-webhook
npx supabase functions deploy paddle-billing-manage
npx supabase functions deploy paddle-webhook-auto-retry
npx supabase functions deploy paddle-webhook-retry

# Set secrets:
npx supabase secrets set SUPABASE_URL=https://wxzcfdmjwggikmqeswvm.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

---

## الخطوة 3: تفعيل الـ Extensions في Supabase

1. اذهب إلى Dashboard → **Database** → **Extensions**
2. فعّل: `pg_cron`, `pg_net`, `uuid-ossp`, `pgcrypto`

---

## الخطوة 4: إنشاء Storage Buckets

Dashboard → **Storage** → **New Bucket**:

| Bucket Name | Public | الاستخدام |
|-------------|--------|-----------|
| `brand-media` | ✅ | لوجوهات البراند والأصول |
| `post-media` | ✅ | صور وفيديوهات المنشورات |
| `avatars` | ✅ | صور المستخدمين |

---

## الخطوة 5: إعداد Cron Jobs للـ Auto Publisher

في Supabase SQL Editor:

```sql
-- إعداد متغيرات البيئة للـ cron
ALTER DATABASE postgres SET "app.supabase_url" = 'https://wxzcfdmjwggikmqeswvm.supabase.co';
ALTER DATABASE postgres SET "app.service_role_key" = 'YOUR_SERVICE_ROLE_KEY';
```

ثم شغّل migration: `supabase/migrations/015_edge_functions_cron.sql`

---

## الخطوة 6: إعداد X (Twitter) OAuth

للـ X OAuth تحتاج:
1. حساب على [X Developer Portal](https://developer.twitter.com)
2. إنشاء App → OAuth 2.0 → Callback URL: `https://wxzcfdmjwggikmqeswvm.supabase.co/functions/v1/provider-oauth-callback`
3. إضافة Client ID وClient Secret في Supabase Secrets:
   ```
   npx supabase secrets set X_CLIENT_ID=your_client_id
   npx supabase secrets set X_CLIENT_SECRET=your_client_secret
   ```

### ملاحظة مهمة:
- X API Basic tier: مجاني لكن محدود (500 tweets/شهر)
- X API Pro tier: $100/شهر لرفع الحد

---

## الخطوة 7: إعداد LinkedIn OAuth

1. سجّل على [LinkedIn Developer](https://developer.linkedin.com)
2. أنشئ App → OAuth 2.0 Settings → Redirect URL: نفس URL أعلاه
3. أضف Secrets:
   ```
   npx supabase secrets set LINKEDIN_CLIENT_ID=your_client_id
   npx supabase secrets set LINKEDIN_CLIENT_SECRET=your_client_secret
   ```

---

## الخطوة 8: إعداد Paddle للـ Billing

1. سجّل على [Paddle Dashboard](https://vendors.paddle.com)
2. احصل على API Key وإضافته:
   ```
   npx supabase secrets set PADDLE_API_KEY=your_api_key
   npx supabase secrets set PADDLE_WEBHOOK_SECRET=your_webhook_secret
   ```
3. في Paddle Dashboard → Notification Settings → أضف webhook URL:
   `https://wxzcfdmjwggikmqeswvm.supabase.co/functions/v1/paddle-webhook`

---

## ✅ قائمة التحقق النهائية

- [ ] MASTER_FIX.sql شُغِّل بنجاح
- [ ] جميع الـ Edge Functions مُشغَّلة (تأكد من Dashboard → Edge Functions)
- [ ] Storage buckets منشأة
- [ ] Extensions مُفعَّلة
- [ ] Cron Jobs تعمل (تحقق من: `SELECT * FROM cron.job ORDER BY jobid DESC`)
- [ ] Facebook OAuth يعمل (اختبر ربط صفحة حقيقية)
- [ ] النشر يعمل (جرّب نشر منشور اختبار)
- [ ] Analytics تظهر بياناً حقيقياً بعد 24 ساعة من النشر
