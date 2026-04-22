# إعداد Supabase Edge Function Secrets

هذه الخطوات **مطلوبة** لتشغيل ربط Facebook وباقي المنصات.

## المشكلة الجذرية

الـ `connect-accounts` Edge Function تتحقق من وجود `OAUTH_ENCRYPTION_KEY` **أول شيء**.  
إذا غاب المفتاح → ترجع 503 وتمنع حفظ أي حساب مربوط.

---

## الخطوة 1 — Supabase CLI

```bash
# تثبيت CLI لو لم يكن مثبتاً
npm install -g supabase

# تسجيل الدخول
supabase login

# رابط المشروع (project ref = wxzcfdmjwggikmqeswvm)
supabase link --project-ref wxzcfdmjwggikmqeswvm
```

---

## الخطوة 2 — ضبط الـ Secrets

انسخ هذه الأوامر ونفّذها واحدًا تلو الآخر:

```bash
# 1. مفتاح تشفير التوكنات (AES-256-GCM) — جاهز للنسخ
supabase secrets set OAUTH_ENCRYPTION_KEY=d26c50986437ca037f890fc3bf38b2f4e74cfa030216bc81e9f89bfad6e0bbec --project-ref wxzcfdmjwggikmqeswvm

# 2. Facebook App (نفس قيمة VITE_FACEBOOK_APP_ID في .env)
supabase secrets set FACEBOOK_APP_ID=727110470078656 --project-ref wxzcfdmjwggikmqeswvm

# 3. Facebook App Secret — من Meta for Developers
#    رابط: https://developers.facebook.com/apps/727110470078656/settings/basic/
supabase secrets set FACEBOOK_APP_SECRET=<ضع_App_Secret_هنا> --project-ref wxzcfdmjwggikmqeswvm

# 4. رابط الـ frontend (للـ CORS) — بدون trailing slash
#    مثال إذا الموقع على Vercel: https://sbrandops.vercel.app
supabase secrets set FRONTEND_ORIGIN=<رابط_موقعك> --project-ref wxzcfdmjwggikmqeswvm
```

---

## الخطوة 3 — من Dashboard (بديل للـ CLI)

إذا فضّلت من الموقع:
1. افتح [supabase.com/dashboard](https://supabase.com/dashboard)
2. اختر المشروع `wxzcfdmjwggikmqeswvm`
3. من القائمة: **Edge Functions** → **Secrets** (في الشريط الجانبي)
4. أضف كل مفتاح بالاسم والقيمة

---

## الخطوة 4 — إعداد Facebook App في Meta for Developers

1. افتح [developers.facebook.com/apps/727110470078656](https://developers.facebook.com/apps/727110470078656)
2. **Settings → Basic**: تأكد أن `App Domains` يحتوي على دومين موقعك
3. **Facebook Login → Settings**:
   - `Valid OAuth Redirect URIs`: أضف `https://رابط_موقعك/`
   - `Deauthorize Callback URL`: اختياري
4. **App Mode**: غيّر من "Development" إلى "Live" حتى يتمكن أي مستخدم من الربط

---

## التحقق من الإعداد

بعد ضبط الـ secrets، اختبر بالنقر على "ربط فيسبوك" في صفحة التكاملات.  
إذا ظهر خطأ جديد في الإشعارات (بدل "خطأ في إعداد الخادم") — الـ OAUTH_ENCRYPTION_KEY شغّال.

---

## ملاحظات مهمة

- **لا تشارك** قيمة `OAUTH_ENCRYPTION_KEY` مع أحد — من يملكها يستطيع فك تشفير التوكنات
- `FACEBOOK_APP_SECRET` سري بنفس الدرجة
- `VITE_GEMINI_API_KEY` حُذف من `.env` لأن كل طلبات Gemini تمر عبر `ai-proxy` Edge Function الآن
- الـ `GEMINI_API_KEY` (بدون VITE_) يجب أن يُضاف في Supabase secrets أو في جدول `ai_provider_keys`
