<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SBrandOps - نظام إدارة العلامات التجارية الشامل

> نظام متكامل لإدارة العلامات التجارية على وسائل التواصل الاجتماعي مع ذكاء اصطناعي متقدم

[![React](https://img.shields.io/badge/React-19.2.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-green.svg)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-orange.svg)](https://ai.google.dev/)

## ✨ المميزات

### 🚀 النشر على المنصات الاجتماعية
- ✅ **Facebook** - نشر منشورات وصور
- ✅ **Instagram** - نشر صور وفيديوهات مع first comment
- ✅ **Twitter/X** - نشر تغريدات مع ميديا
- ✅ **LinkedIn** - نشر محتوى احترافي
- ✅ **TikTok** - نشر فيديوهات

### 📊 التحليلات والإحصائيات
- 📈 تحليلات شاملة من جميع المنصات
- 🎯 تتبع الأداء في الوقت الفعلي
- 📉 تقارير مفصلة عن التفاعل
- 🏆 أفضل المنشورات أداءً

### 🤖 الذكاء الاصطناعي
- 💬 توليد محتوى بالذكاء الاصطناعي
- 🎨 اقتراحات للهاشتاجات
- ⏰ أفضل أوقات النشر
- 📝 تحليل صوت العلامة التجارية

### 📅 الجدولة والنشر التلقائي
- ⏱️ جدولة منشورات متعددة
- 🔄 نشر تلقائي في الوقت المحدد
- 📱 دعم جميع أنواع الميديا
- 🎯 استهداف منصات متعددة

### 💾 التخزين السحابي
- ☁️ رفع صور وفيديوهات
- 🔗 روابط عامة للملفات
- 📦 إدارة شاملة للميديا
- 🗑️ حذف وتنظيف الملفات

### 📝 سجل الأنشطة
- 📋 تسجيل جميع الأنشطة
- 🔍 بحث وفلترة متقدمة
- 📊 إحصائيات الأنشطة
- 🕐 تتبع زمني كامل

## 🚀 البدء السريع

### المتطلبات الأساسية

- Node.js 20+
- حساب Supabase (مشروع جاهز)
- Supabase CLI (`npm i -g supabase`)
- (اختياري) حسابات المنصات الاجتماعية للنشر

### التثبيت

```bash
# 1. استنساخ المشروع
git clone <repository-url>
cd sbrandops---v1.0541

# 2. تثبيت المكتبات
npm install

# 3. إعداد المتغيرات البيئية للواجهة الأمامية
cp .env.example .env
# أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY فقط

# 4. تشغيل التطبيق محلياً
npm run dev
```

### إعداد قاعدة البيانات

```bash
# ربط المشروع بـ Supabase
npx supabase link --project-ref <project-ref>

# تطبيق جميع الـ migrations دفعة واحدة
npx supabase db push
```

### إعداد الـ Edge Functions (متغيرات السيرفر)

في Supabase Dashboard → Settings → Edge Functions → Secrets، أضف:

| المتغير | الوصف |
|---------|-------|
| `GEMINI_API_KEY` | مفتاح Gemini AI (سري — لا يُكشف للعميل) |
| `OAUTH_ENCRYPTION_KEY` | 64-حرف hex لتشفير OAuth tokens |
| `WEBHOOK_SECRET` | سر مشترك للـ webhooks |
| `PADDLE_WEBHOOK_SECRET` | سر HMAC للـ Paddle |
| `AI_DAILY_TOKEN_LIMIT` | (اختياري) حد يومي للتوكنز، افتراضي 100000 |

```bash
# نشر جميع الـ Edge Functions
npm run supabase:functions:deploy
```

### إنشاء Storage Bucket

1. في Supabase Dashboard → Storage
2. أنشئ bucket جديد: `media`
3. فعّل Public Access

## 📚 التوثيق

- 📖 [**دليل البدء السريع**](./QUICK_START.md) - ابدأ في 5 دقائق
- 📘 [**دليل الباك اند الكامل**](./BACKEND_README.md) - توثيق شامل
- 📋 [**ملخص التحديثات**](./BACKEND_COMPLETION_SUMMARY.md) - ما تم إنجازه

## 🏗️ البنية المعمارية

```
sbrandops/
├── components/          # مكونات React
├── services/           # خدمات الباك اند
│   ├── supabaseClient.ts
│   ├── socialPublishingService.ts
│   ├── platformPublishingService.ts
│   ├── postsService.ts
│   ├── storageService.ts
│   ├── postAnalyticsService.ts
│   ├── activityLogService.ts
│   ├── autoPublisherService.ts
│   └── ...
├── config/             # إعدادات التطبيق
├── migrations/         # تحديثات قاعدة البيانات
├── types.ts           # تعريفات TypeScript
└── ...
```

## 🔧 الخدمات المتاحة

### Core Services
- `supabaseClient` - اتصال قاعدة البيانات
- `brandService` - إدارة العلامات التجارية
- `socialAuthService` - مصادقة OAuth

### Publishing Services
- `socialPublishingService` - النشر على Facebook/Instagram
- `platformPublishingService` - النشر على X/LinkedIn/TikTok
- `postsService` - إدارة CRUD للمنشورات
- `autoPublisherService` - النشر التلقائي

### Storage & Media
- `storageService` - رفع وإدارة الملفات

### Analytics
- `analyticsService` - تحليلات عامة
- `postAnalyticsService` - تحليلات المنشورات

### AI Services
- `geminiService` - خدمات Gemini AI
- `schedulingService` - أوقات النشر المثالية

### Utilities
- `activityLogService` - سجل الأنشطة
- `errorHandlingService` - معالجة الأخطاء
- `appConfig` - إدارة الإعدادات

## 🎯 أمثلة الاستخدام

### إنشاء منشور مجدول

```typescript
import { createScheduledPost } from './services/postsService';
import { SocialPlatform } from './types';

const post = await createScheduledPost({
    brandId: 'your-brand-id',
    content: 'مرحباً بكم! 🚀',
    platforms: [SocialPlatform.Facebook, SocialPlatform.Instagram],
    scheduledAt: new Date(Date.now() + 3600000) // بعد ساعة
});
```

### رفع صورة

```typescript
import { uploadFile } from './services/storageService';

const result = await uploadFile(file);
if (result.success) {
    console.log('File URL:', result.url);
}
```

### بدء النشر التلقائي

```typescript
import { startAutoPublisher } from './services/autoPublisherService';

const interval = startAutoPublisher(1); // كل دقيقة
```

## 🔐 الأمان

- ✅ Row Level Security (RLS) على جميع الجداول — كل مستخدم يرى بياناته فقط
- ✅ OAuth tokens مشفّرة بـ AES-256-GCM في قاعدة البيانات
- ✅ JWT verification على جميع الـ Edge Functions
- ✅ مفاتيح Gemini AI على السيرفر فقط — لا تُكشف للمتصفح
- ✅ HMAC signature verification على جميع الـ webhooks
- ✅ CORS مقيّد بـ domain محدد

## 🤝 المساهمة

نرحب بالمساهمات! يرجى:

1. Fork المشروع
2. إنشاء branch للميزة الجديدة
3. Commit التغييرات
4. Push إلى Branch
5. فتح Pull Request

## 📄 الترخيص

هذا المشروع مرخص تحت MIT License.

## 🙏 شكر خاص

- [Supabase](https://supabase.com) - قاعدة البيانات والتخزين
- [Google Gemini](https://ai.google.dev) - الذكاء الاصطناعي
- [React](https://reactjs.org) - واجهة المستخدم
- [Vite](https://vitejs.dev) - أداة البناء

## 📞 الدعم

إذا واجهت أي مشاكل:

1. راجع [دليل البدء السريع](./QUICK_START.md)
2. افحص [دليل الباك اند](./BACKEND_README.md)
3. تحقق من Console للأخطاء
4. راجع Supabase Logs

---

<div align="center">
صُنع بـ ❤️ للمسوقين ومديري العلامات التجارية
</div>
