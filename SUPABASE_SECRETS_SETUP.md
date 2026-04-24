# إعداد Supabase Edge Function Secrets
# دليل إصلاح ربط Facebook / Meta

---

## المشكلة الجذرية — لماذا يفشل ربط Facebook؟

هناك 5 أسباب محتملة بالترتيب:

| # | السبب | الأثر | الحل |
|---|-------|-------|------|
| 1 | `OAUTH_ENCRYPTION_KEY` غائب من Supabase Secrets | Edge Function ترفع 503 فوراً ولا يُحفظ أي شيء | أضفه في Secrets |
| 2 | Facebook App في Development mode | فقط Admins/Testers يقدرون يدخلون | غيّر لـ Live mode |
| 3 | `FACEBOOK_APP_SECRET` غائب | التوكنات تنتهي بعد ساعتين | أضفه في Secrets |
| 4 | `FACEBOOK_APP_ID` غائب في Secrets | نفس مشكلة P3 | أضفه في Secrets |
| 5 | `FRONTEND_ORIGIN` غائب | CORS يعمل permissive (مقبول للتطوير) | أضفه للإنتاج |

---

## الخطوة 1 — ضبط Supabase Secrets (مطلوب قبل أي شيء)

### الطريقة A: عبر Supabase Dashboard (أسهل)

1. افتح [supabase.com/dashboard](https://supabase.com/dashboard)
2. اختر المشروع: `wxzcfdmjwggikmqeswvm`
3. من القائمة الجانبية: **Edge Functions** → **Secrets**
4. أضف هذه المفاتيح:

| اسم المفتاح | القيمة | ملاحظة |
|-------------|--------|--------|
| `OAUTH_ENCRYPTION_KEY` | `d26c50986437ca037f890fc3bf38b2f4e74cfa030216bc81e9f89bfad6e0bbec` | مفتاح التشفير — لا تشاركه |
| `FACEBOOK_APP_ID` | `727110470078656` | نفس قيمة VITE_FACEBOOK_APP_ID |
| `FACEBOOK_APP_SECRET` | `<من Meta Developer Console>` | انظر الخطوة 3 |
| `FRONTEND_ORIGIN` | `<رابط موقعك بدون trailing slash>` | مثال: `https://sbrandops.vercel.app` |

### الطريقة B: عبر Supabase CLI

```bash
# تثبيت CLI
npm install -g supabase

# تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref wxzcfdmjwggikmqeswvm

# ضبط الـ Secrets
supabase secrets set OAUTH_ENCRYPTION_KEY=d26c50986437ca037f890fc3bf38b2f4e74cfa030216bc81e9f89bfad6e0bbec --project-ref wxzcfdmjwggikmqeswvm

supabase secrets set FACEBOOK_APP_ID=727110470078656 --project-ref wxzcfdmjwggikmqeswvm

# استبدل <APP_SECRET> بالقيمة الفعلية من Meta
supabase secrets set FACEBOOK_APP_SECRET=<APP_SECRET> --project-ref wxzcfdmjwggikmqeswvm

# استبدل <FRONTEND_URL> برابط موقعك
supabase secrets set FRONTEND_ORIGIN=<FRONTEND_URL> --project-ref wxzcfdmjwggikmqeswvm
```

---

## الخطوة 2 — إعداد Facebook App في Meta Developer Console

1. افتح: https://developers.facebook.com/apps/727110470078656/settings/basic/

2. **App Settings → Basic:**
   - **App Domains**: أضف دومين موقعك (مثال: `sbrandops.vercel.app`)
   - **Privacy Policy URL**: مطلوب للتحويل لـ Live mode
   - **Terms of Service URL**: مطلوب للتحويل لـ Live mode

3. **Facebook Login → Settings:**
   - **Valid OAuth Redirect URIs**: أضف رابط موقعك (مثال: `https://sbrandops.vercel.app/`)
   - **Client OAuth Login**: ✅ مفعّل
   - **Web OAuth Login**: ✅ مفعّل
   - **Enforce HTTPS**: ✅ مفعّل (للإنتاج)

4. **App Mode → Live:**
   - غيّر من **Development** إلى **Live**
   - ⚠️ يتطلب Privacy Policy URL و Terms URL
   - في Development mode: فقط المضافون كـ Admins/Developers/Testers يقدرون يدخلون

5. **Products → Facebook Login:**
   - تأكد أنه مضاف للتطبيق

---

## الخطوة 3 — الحصول على FACEBOOK_APP_SECRET

1. افتح: https://developers.facebook.com/apps/727110470078656/settings/basic/
2. انقر على **Show** بجانب **App Secret**
3. ادخل كلمة مرورك
4. انسخ الـ Secret وأضفه في Supabase Secrets (لا تضعه في .env أو في الكود)

---

## الخطوة 4 — التحقق من الإعداد

بعد ضبط الـ Secrets، راقب Supabase Edge Function Logs:

1. افتح [supabase.com/dashboard](https://supabase.com/dashboard)
2. Edge Functions → `connect-accounts` → Logs
3. ابحث عن `config-check` في اللوقات
4. يجب أن ترى:
```json
{
  "event": "config-check",
  "OAUTH_ENCRYPTION_KEY_set": true,
  "FACEBOOK_APP_ID_set": true,
  "FACEBOOK_APP_SECRET_set": true
}
```

---

## الصلاحيات (Permissions/Scopes) المطلوبة

### Basic Connection (لا تحتاج App Review):
- `pages_show_list` — قائمة الصفحات
- `pages_read_engagement` — بيانات الصفحة الأساسية
- `pages_manage_posts` — نشر منشورات
- `pages_read_user_content` — قراءة تعليقات ومنشورات المستخدمين

### Advanced Features (تحتاج App Review من Meta):
- `read_insights` — تحليلات الصفحة
- `ads_read` — بيانات الإعلانات
- `ads_management` — إدارة الإعلانات

> **ملاحظة**: الـ Scopes المحتاجة App Review لا تعمل في Live mode بدون موافقة Meta.
> في Development mode تعمل فقط مع App Admins/Testers.

---

## مسار Facebook OAuth الصحيح (بعد الإصلاح)

```
المستخدم ينقر "ربط Facebook"
        ↓
IntegrationsPage.tsx → handleConnectPlatform(Facebook)
        ↓
socialAuthService.ts → initiateSocialLogin()
   → يحمّل Facebook JS SDK (v23.0)
   → يفتح نافذة FB.login() مع scopes
        ↓
المستخدم يوافق على الصلاحيات
        ↓
socialAuthService.ts → fetchAvailableAssets()
   → FB.api('/me/accounts') — يجلب الصفحات
        ↓
AssetSelectionModal — المستخدم يختار الصفحات
        ↓
socialAuthService.ts → connectSelectedAssets()
   → يجدد JWT من Supabase
   → يستدعي connect-accounts Edge Function
        ↓
connect-accounts Edge Function:
   1. يتحقق من OAUTH_ENCRYPTION_KEY ✅
   2. يتحقق من JWT المستخدم ✅
   3. يتحقق من ملكية البراند ✅
   4. يبادل التوكن القصير بطويل (60 يوم) ✅
   5. يجلب Page Token دائم server-side ✅
   6. يحفظ في social_accounts (مشفّر) ✅
   7. يحفظ في oauth_tokens (مشفّر) ✅
        ↓
IntegrationsPage → يعرض الحسابات المرتبطة ✅
```

---

## أسئلة شائعة

**Q: التطبيق في Development mode ولا أقدر أحوّله لـ Live — ماذا أفعل؟**
A: أضف نفسك وكل من يحتاج يختبر كـ **Tester** في Meta App Console → Roles → Roles.

**Q: ظهر الخطأ "User cancelled login" لكن المستخدم لم يلغِ شيئاً**
A: غالباً التطبيق في Development mode والمستخدم ليس مضاف كـ Tester.

**Q: ظهر خطأ "Server misconfiguration: OAUTH_ENCRYPTION_KEY is not set"**
A: لم يُضبط `OAUTH_ENCRYPTION_KEY` في Supabase Edge Function Secrets — طبّق الخطوة 1.

**Q: التوكن ينتهي بعد ساعتين والحساب ينفصل**
A: لم يُضبط `FACEBOOK_APP_SECRET` في Supabase Secrets — التبادل للتوكن الطويل يفشل.

**Q: الـ redirect لا يعمل على localhost**
A: Facebook SDK لا يستخدم redirect — يعتمد على JS popup. لكن تأكد أن `localhost` مضاف في
   App Domains في Meta Console لبيئة التطوير.

---

## ملاحظات أمنية

- ❌ لا تضع `FACEBOOK_APP_SECRET` في `.env` أو في الكود
- ❌ لا تشارك `OAUTH_ENCRYPTION_KEY` مع أحد
- ✅ كلا المفتاحين يجب أن يكونا فقط في Supabase Edge Function Secrets
- ✅ `VITE_FACEBOOK_APP_ID` آمن في `.env` لأنه public identifier
