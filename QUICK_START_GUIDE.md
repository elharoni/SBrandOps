# 🚀 دليل البدء السريع - SBrandOps

## مرحباً! 👋

هذا الدليل سيساعدك على البدء مع SBrandOps في أقل من 10 دقائق.

---

## الخطوة 1️⃣: تشغيل التطبيق

```bash
cd c:\Users\aboda\Downloads\sbrandops---v1.0541
npm run dev
```

افتح: **https://localhost:3000/**

---

## الخطوة 2️⃣: إعداد قاعدة البيانات

### إذا لم تكن قد قمت بإعداد Database بعد:

1. افتح [Supabase SQL Editor](https://supabase.com/dashboard/project/xosboyhviihchnoxtimj/sql/new)
2. انسخ محتوى ملف `setup_full.sql`
3. الصق في SQL Editor واضغط **Run**

**✅ تم!** الآن لديك:
- جدول brands
- جدول social_accounts
- جدول content_pieces
- 2 brands تجريبية (Confort-Tex & Eco Threads)

---

## الخطوة 3️⃣: إنشاء Brand جديد (خطوات سهلة!)

### الطريقة الجديدة - Onboarding Wizard 🎯

1. **اضغط "+ Add Brand"** في الأعلى
2. **سيظهر معالج إعداد Brand** مكون من 4 خطوات:

#### 📝 الخطوة 1: معلومات العلامة
- أدخل **اسم العلامة** (مثال: شركتي)
- أدخل **الصناعة** (اختياري)
- رابط الشعار (اختياري)
- اضغط **التالي**

#### 🎤 الخطوة 2: صوت العلامة
- أضف **قيم العلامة** (مثل: الجودة، الابتكار)
- أضف **نبرة الصوت** (مثل: ودود، احترافي)
- يمكنك **تخطي** هذه الخطوة

#### 🔗 الخطوة 3: ربط الحسابات
- اختر المنصة (Facebook, Instagram, etc.)
- سجل دخول وامنح الصلاحيات
- اختر الصفحات/الحسابات
- يتم الربط تلقائياً!

#### ✅ الخطوة 4: تم!
- شاهد ملخص الإعداد
- اضغط **ابدأ الآن!**

---

## الخطوة 4️⃣: ربط حسابات Social Media

### Setup Facebook/Instagram (الأكثر استخداماً):

#### A. إنشاء Facebook App

1. افتح: https://developers.facebook.com/apps
2. Create App > **Business** type
3. انسخ **App ID** و **App Secret**

#### B. أضف للـ `.env`

```env
VITE_FACEBOOK_APP_ID=your_app_id_here
VITE_FACEBOOK_APP_SECRET=your_app_secret_here
```

#### C. Configure App

1. **Settings > Basic:**
   - App Domains: `localhost`
   - Site URL: `https://localhost:3000/`

2. **Products > Facebook Login:**
   - Valid OAuth Redirect URIs: `https://localhost:3000/`

3. **Save!**

#### D. اربط الآن!

1. في Onboarding Wizard (الخطوة 3) أو من صفحة Accounts
2. اضغط **Connect** على Facebook/Instagram
3. سجل دخول
4. اختر الصفحات
5. **تم!** ✅

---

## الخطوة 5️⃣: ابدأ النشر!

### من Publisher Page:

1. اذهب لـ **Publisher** من الـ sidebar
2. اكتب المحتوى
3. أضف صور/فيديوهات
4. اختر المنصات
5. **انشر الآن** أو **جدول**

---

## 🎯 الميزات الأساسية

| الميزة | الوصف | الصفحة |
|--------|--------|--------|
| **Publisher** | إنشاء ونشر posts | Publisher |
| **Calendar** | عرض وجدولة المحتوى | Calendar |
| **Analytics** | تتبع الأداء والإحصائيات | Analytics |
| **Accounts** | إدارة حسابات Social Media | Accounts |
| **Brand Hub** | إدارة هوية العلامة | Brand Hub |
| **Inbox** | الرد على التعليقات | Inbox |

---

## 🆘 المشاكل الشائعة

### "Facebook SDK not loaded"
**الحل:**
- تأكد من `VITE_FACEBOOK_APP_ID` في `.env`
- اعمل Refresh (F5)

### "No pages found"
**الحل:**
- تأكد أن لديك Facebook Page (ليس personal profile)
- للـ Instagram: اربط Instagram Business Account بـ Facebook Page أولاً

### "Demo Brand" لا يزال ظاهراً
**الحل:**
1. تأكد من setup الـ database (الخطوة 2)
2. افتح Console (F12) وشوف الأخطاء
3. اعمل Refresh

---

## 📚 المزيد من الأدلة

- [DATABASE_SETUP.md](DATABASE_SETUP.md) - إعداد قاعدة البيانات
- [SETUP_SOCIAL_MEDIA.md](SETUP_SOCIAL_MEDIA.md) - ربط Social Media بالتفصيل
- [PLATFORM_INTEGRATION_GUIDE.md](PLATFORM_INTEGRATION_GUIDE.md) - دليل شامل لكل منصة

---

## ✨ نصائح سريعة

💡 **استخدم Onboarding Wizard** عند إنشاء brand جديد - أسهل وأسرع!

💡 **اربط Facebook أولاً** - سيعطيك وصول لـ Instagram أيضاً

💡 **جرب AI Features** - أضف `GEMINI_API_KEY` في `.env` لميزات الذكاء الاصطناعي

💡 **استكشف Dashboard** - شاهد الإحصائيات والتحليلات

---

## 🎉 جاهز!

الآن أنت جاهز لاستخدام SBrandOps بشكل كامل!

**التالي:**
- ✅ انشر أول post
- ✅ جدول محتوى
- ✅ تابع Analytics
- ✅ أضف brands أخرى

**استمتع! 🚀**
