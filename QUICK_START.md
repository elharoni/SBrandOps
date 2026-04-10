# 🚀 دليل البدء السريع - SBrandOps Backend

## ⚡ البدء في 5 دقائق

### الخطوة 1️⃣: تثبيت المكتبات

```bash
npm install
```

### الخطوة 2️⃣: إعداد المتغيرات البيئية

```bash
# انسخ ملف المثال
cp .env.example .env
```

ثم افتح `.env` وأضف القيم التالية:

```bash
# ✅ مطلوب - Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# ✅ مطلوب - Gemini AI (للحصول على مفتاح: https://ai.google.dev)
VITE_GEMINI_API_KEY=your-gemini-api-key

# ⚠️ اختياري - Facebook (للحصول على App ID: https://developers.facebook.com)
VITE_FACEBOOK_APP_ID=your-facebook-app-id
```

### الخطوة 3️⃣: إعداد قاعدة البيانات

1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اذهب إلى **SQL Editor**
3. انسخ محتوى `setup_full.sql` والصقه
4. اضغط **Run**
5. انسخ محتوى `migrations/001_enhanced_schema.sql` والصقه
6. اضغط **Run**

### الخطوة 4️⃣: إنشاء Storage Bucket

1. في Supabase Dashboard، اذهب إلى **Storage**
2. اضغط **New bucket**
3. الاسم: `media`
4. فعّل **Public bucket**
5. اضغط **Create bucket**

### الخطوة 5️⃣: تشغيل التطبيق

```bash
npm run dev
```

🎉 **تم! التطبيق يعمل الآن على http://localhost:3000**

---

## 🧪 اختبار سريع

### اختبار 1: رفع ملف

```typescript
import { uploadFile } from './services/storageService';

// في أي component
const handleUpload = async (file: File) => {
    const result = await uploadFile(file);
    if (result.success) {
        console.log('✅ File uploaded:', result.url);
    } else {
        console.error('❌ Upload failed:', result.error);
    }
};
```

### اختبار 2: إنشاء منشور

```typescript
import { createScheduledPost } from './services/postsService';
import { SocialPlatform } from './types';

const createPost = async () => {
    const post = await createScheduledPost({
        brandId: 'your-brand-id',
        content: 'مرحباً بكم في SBrandOps! 🚀',
        platforms: [SocialPlatform.Facebook],
        scheduledAt: new Date(Date.now() + 3600000) // بعد ساعة
    });
    
    if (post) {
        console.log('✅ Post created:', post.id);
    }
};
```

### اختبار 3: بدء النشر التلقائي

```typescript
import { startAutoPublisher } from './services/autoPublisherService';

// في ملف التطبيق الرئيسي (index.tsx أو App.tsx)
useEffect(() => {
    // بدء الخدمة (تفحص كل دقيقة)
    const interval = startAutoPublisher(1);
    
    // تنظيف عند إلغاء التحميل
    return () => {
        clearInterval(interval);
    };
}, []);
```

---

## 🔧 إعدادات Facebook (اختياري)

لتفعيل النشر على Facebook و Instagram:

### 1. إنشاء Facebook App

1. اذهب إلى [Facebook Developers](https://developers.facebook.com)
2. اضغط **My Apps** > **Create App**
3. اختر **Business** > **Continue**
4. املأ التفاصيل واضغط **Create App**

### 2. إضافة Facebook Login

1. في Dashboard، اضغط **Add Product**
2. اختر **Facebook Login** > **Set Up**
3. اختر **Web**
4. أضف URL: `http://localhost:3000`

### 3. إعداد OAuth Redirect

1. اذهب إلى **Facebook Login** > **Settings**
2. في **Valid OAuth Redirect URIs**، أضف:
   ```
   http://localhost:3000
   https://localhost:3000
   ```
3. احفظ التغييرات

### 4. الحصول على App ID

1. اذهب إلى **Settings** > **Basic**
2. انسخ **App ID**
3. ضعه في `.env`:
   ```bash
   VITE_FACEBOOK_APP_ID=your-app-id-here
   ```

### 5. إضافة Facebook SDK

SDK موجود بالفعل في `index.html`! ✅

---

## 📱 اختبار النشر على Facebook

```typescript
import { publishPost } from './services/socialPublishingService';
import { SocialPlatform, PostStatus } from './types';

const testPublish = async () => {
    const post = {
        id: 'test-post-id',
        content: 'مرحباً من SBrandOps! 🎉',
        platforms: [SocialPlatform.Facebook],
        media: [],
        status: PostStatus.Draft,
        scheduledAt: null
    };
    
    const results = await publishPost('brand-id', post);
    
    results.forEach(result => {
        if (result.success) {
            console.log(`✅ Published to ${result.platform}:`, result.postId);
        } else {
            console.error(`❌ Failed on ${result.platform}:`, result.error);
        }
    });
};
```

---

## 🎯 الميزات الجاهزة للاستخدام

### ✅ النشر على المنصات
- Facebook ✅
- Instagram ✅
- Twitter/X ✅
- LinkedIn ✅
- TikTok ✅

### ✅ إدارة المحتوى
- إنشاء منشورات ✅
- جدولة منشورات ✅
- النشر التلقائي ✅
- رفع صور وفيديوهات ✅

### ✅ التحليلات
- تحليلات Facebook ✅
- تحليلات Instagram ✅
- ملخص الأداء ✅
- أفضل المنشورات ✅

### ✅ سجل الأنشطة
- تسجيل جميع الأنشطة ✅
- الاستعلام عن السجلات ✅
- إحصائيات الأنشطة ✅

---

## 🐛 حل المشاكل

### المشكلة: "Missing Supabase environment variables"

**الحل:**
```bash
# تأكد من وجود .env في المجلد الرئيسي
# وأنه يحتوي على:
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### المشكلة: "Facebook SDK not loaded"

**الحل:**
1. تأكد من وجود `VITE_FACEBOOK_APP_ID` في `.env`
2. أعد تشغيل التطبيق: `npm run dev`
3. افتح Console وتأكد من عدم وجود أخطاء في تحميل SDK

### المشكلة: "Failed to upload file"

**الحل:**
1. تأكد من إنشاء bucket `media` في Supabase Storage
2. تأكد من تفعيل Public Access على الـ bucket
3. تحقق من صلاحيات RLS

### المشكلة: "Auto publisher not working"

**الحل:**
1. تأكد من استدعاء `startAutoPublisher()` في التطبيق
2. تحقق من وجود منشورات بحالة `Scheduled`
3. تأكد أن `scheduled_at` في الماضي أو الحاضر

---

## 📚 موارد إضافية

- 📖 [دليل الباك اند الكامل](./BACKEND_README.md)
- 📋 [ملخص التحديثات](./BACKEND_COMPLETION_SUMMARY.md)
- 🌐 [Supabase Docs](https://supabase.com/docs)
- 🤖 [Gemini API Docs](https://ai.google.dev/docs)
- 📱 [Facebook Graph API](https://developers.facebook.com/docs/graph-api)

---

## 💡 نصائح

### للتطوير
- استخدم `console.log` لتتبع العمليات
- افحص Supabase Logs للأخطاء
- استخدم React DevTools

### للإنتاج
- فعّل RLS بشكل صحيح
- شفّر Access Tokens
- استخدم HTTPS
- راقب الأخطاء (Sentry)

---

## 🎉 مبروك!

أنت الآن جاهز لاستخدام SBrandOps! 🚀

إذا واجهت أي مشاكل، راجع:
1. [دليل الباك اند](./BACKEND_README.md)
2. Console للأخطاء
3. Supabase Logs

**استمتع بالتطوير! 💪**
