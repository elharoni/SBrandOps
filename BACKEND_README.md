# SBrandOps Backend Documentation

## 📚 نظرة عامة

هذا المستند يشرح البنية الكاملة للباك اند الخاص بتطبيق SBrandOps، وهو نظام إدارة شامل للعلامات التجارية على وسائل التواصل الاجتماعي.

## 🏗️ البنية المعمارية

### قاعدة البيانات (Supabase)

التطبيق يستخدم Supabase كقاعدة بيانات PostgreSQL مع المميزات التالية:

#### الجداول الرئيسية:

1. **brands** - معلومات العلامات التجارية
2. **brand_profiles** - إعدادات وصوت العلامة التجارية
3. **social_accounts** - حسابات وسائل التواصل المتصلة
4. **scheduled_posts** - المنشورات المجدولة
5. **post_analytics** - تحليلات أداء المنشورات
6. **activity_logs** - سجل جميع الأنشطة
7. **inbox_conversations** - المحادثات والتعليقات
8. **inbox_messages** - الرسائل
9. **ad_campaigns** - حملات الإعلانات
10. **marketing_plans** - خطط التسويق
11. **content_pieces** - قطع المحتوى

### الخدمات (Services)

#### 1. خدمات المصادقة والحسابات

- **`supabaseClient.ts`** - عميل Supabase الأساسي
- **`socialAuthService.ts`** - مصادقة OAuth للمنصات الاجتماعية
- **`socialAccountService.ts`** - إدارة الحسابات الاجتماعية

#### 2. خدمات النشر

- **`socialPublishingService.ts`** - النشر على Facebook و Instagram
- **`platformPublishingService.ts`** - النشر على X, LinkedIn, TikTok
- **`postsService.ts`** - إدارة CRUD للمنشورات المجدولة
- **`autoPublisherService.ts`** - النشر التلقائي للمنشورات المجدولة

#### 3. خدمات التخزين والملفات

- **`storageService.ts`** - رفع وإدارة الصور والفيديوهات

#### 4. خدمات التحليلات

- **`analyticsService.ts`** - تحليلات الأداء (Mock Data)
- **`postAnalyticsService.ts`** - تحليلات المنشورات الحقيقية من APIs

#### 5. خدمات الذكاء الاصطناعي

- **`geminiService.ts`** - خدمات Gemini AI
- **`schedulingService.ts`** - اقتراح أوقات النشر المثالية

#### 6. خدمات أخرى

- **`brandService.ts`** - إدارة العلامات التجارية
- **`activityLogService.ts`** - تسجيل الأنشطة
- **`adsService.ts`** - إدارة الإعلانات
- **`inboxService.ts`** - إدارة الرسائل والمحادثات
- **`contentOpsService.ts`** - إدارة المحتوى
- **`marketingPlansService.ts`** - إدارة خطط التسويق

## 🔐 المتغيرات البيئية

قم بإنشاء ملف `.env` في المجلد الرئيسي وأضف المتغيرات التالية:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key

# Social Media OAuth
VITE_FACEBOOK_APP_ID=your_facebook_app_id
VITE_FACEBOOK_APP_SECRET=your_facebook_app_secret

VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id
VITE_INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret

VITE_TWITTER_API_KEY=your_twitter_api_key
VITE_TWITTER_API_SECRET=your_twitter_api_secret
VITE_TWITTER_BEARER_TOKEN=your_twitter_bearer_token

VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id
VITE_LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

VITE_TIKTOK_CLIENT_KEY=your_tiktok_client_key
VITE_TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

# Application Configuration
VITE_APP_URL=http://localhost:3000
VITE_API_URL=http://localhost:3001
```

## 🚀 الإعداد والتشغيل

### 1. تثبيت المكتبات

```bash
npm install
```

### 2. إعداد قاعدة البيانات

قم بتشغيل ملفات SQL التالية في Supabase SQL Editor:

```bash
# الإعداد الأساسي
setup_full.sql

# التحديثات والجداول الإضافية
migrations/001_enhanced_schema.sql
```

### 3. إنشاء Storage Buckets

في Supabase Dashboard، قم بإنشاء bucket باسم `media` مع السماح بالوصول العام.

### 4. تشغيل التطبيق

```bash
npm run dev
```

## 📡 APIs المدعومة

### Facebook Graph API

- **النشر**: `POST /{page-id}/feed` أو `/{page-id}/photos`
- **التحليلات**: `GET /{post-id}/insights`
- **الصفحات**: `GET /me/accounts`

### Instagram Graph API

- **النشر**: 
  1. `POST /{ig-user-id}/media` (إنشاء container)
  2. `POST /{ig-user-id}/media_publish` (نشر)
- **التحليلات**: `GET /{media-id}/insights`

### Twitter API v2

- **النشر**: `POST /2/tweets`
- **رفع الميديا**: `POST /1.1/media/upload.json`

### LinkedIn API

- **النشر**: `POST /v2/ugcPosts`
- **رفع الميديا**: `POST /v2/assets?action=registerUpload`

### TikTok API

- **النشر**: `POST /share/video/upload/`

## 🔄 النشر التلقائي

التطبيق يدعم النشر التلقائي للمنشورات المجدولة بطريقتين:

### 1. Polling (الطريقة الحالية)

```typescript
import { startAutoPublisher } from './services/autoPublisherService';

// بدء الخدمة (تفحص كل دقيقة)
const interval = startAutoPublisher(1);

// إيقاف الخدمة
stopAutoPublisher(interval);
```

### 2. Webhooks (مستقبلاً)

يمكن استخدام Supabase Webhooks أو Edge Functions لتشغيل النشر عند حلول الوقت المحدد.

## 📊 التحليلات

### جلب التحليلات من Facebook/Instagram

```typescript
import { fetchFacebookPostAnalytics, fetchInstagramPostAnalytics } from './services/postAnalyticsService';

// Facebook
const fbAnalytics = await fetchFacebookPostAnalytics(postId, accessToken);

// Instagram
const igAnalytics = await fetchInstagramPostAnalytics(mediaId, accessToken);
```

### حفظ التحليلات

```typescript
import { savePostAnalytics } from './services/postAnalyticsService';

await savePostAnalytics({
    postId: 'post-uuid',
    platform: SocialPlatform.Facebook,
    platformPostId: 'fb-post-id',
    impressions: 1000,
    reach: 800,
    engagement: 150,
    likes: 100,
    comments: 30,
    shares: 20,
    clicks: 50,
    saves: 10,
    fetchedAt: new Date()
});
```

## 🗂️ إدارة الملفات

### رفع صورة أو فيديو

```typescript
import { uploadFile } from './services/storageService';

const result = await uploadFile(file, 'media', 'posts');

if (result.success) {
    console.log('File URL:', result.url);
}
```

### رفع عدة ملفات

```typescript
import { uploadMultipleFiles } from './services/storageService';

const results = await uploadMultipleFiles(files, 'media', 'posts');
```

## 📝 سجل الأنشطة

### تسجيل نشاط

```typescript
import { createActivityLog, ActivityAction, EntityType } from './services/activityLogService';

await createActivityLog({
    brandId: 'brand-uuid',
    userId: 'user-uuid',
    action: ActivityAction.POST_PUBLISHED,
    entityType: EntityType.POST,
    entityId: 'post-uuid',
    metadata: { platform: 'Facebook', success: true }
});
```

### الحصول على السجلات

```typescript
import { getActivityLogs } from './services/activityLogService';

const logs = await getActivityLogs('brand-uuid', 50, 0);
```

## 🔒 الأمان

### Row Level Security (RLS)

جميع الجداول محمية بـ RLS. حالياً، السياسات تسمح بالوصول الكامل للمستخدمين المصادق عليهم (Development Mode).

في الإنتاج، يجب تحديث السياسات لتقييد الوصول:

```sql
-- مثال: السماح للمستخدمين برؤية براندات خاصة بهم فقط
CREATE POLICY "Users can view own brands" 
ON public.brands 
FOR SELECT 
USING (user_id = auth.uid());
```

### تشفير Access Tokens

⚠️ **مهم**: في الإنتاج، يجب تشفير `access_token` و `refresh_token` قبل حفظها في قاعدة البيانات.

## 🧪 الاختبار

### اختبار النشر على Facebook

```typescript
import { publishPost } from './services/socialPublishingService';

const post = {
    id: 'test-post',
    content: 'Test post',
    platforms: [SocialPlatform.Facebook],
    media: [],
    status: PostStatus.Draft,
    scheduledAt: null
};

const results = await publishPost('brand-id', post);
console.log(results);
```

## 📚 الموارد

- [Supabase Documentation](https://supabase.com/docs)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [Twitter API v2](https://developer.twitter.com/en/docs/twitter-api)
- [LinkedIn API](https://docs.microsoft.com/en-us/linkedin/)
- [TikTok API](https://developers.tiktok.com/)
- [Gemini API](https://ai.google.dev/docs)

## 🐛 المشاكل الشائعة

### 1. Facebook SDK لا يعمل

تأكد من:
- إضافة `VITE_FACEBOOK_APP_ID` في `.env`
- تحميل Facebook SDK في `index.html`
- تشغيل التطبيق على HTTPS (localhost يعمل على HTTP)

### 2. رفع الملفات يفشل

تأكد من:
- إنشاء bucket `media` في Supabase Storage
- تفعيل Public Access على الـ bucket
- صلاحيات RLS على Storage

### 3. النشر التلقائي لا يعمل

تأكد من:
- تشغيل `startAutoPublisher()` في التطبيق
- وجود منشورات مجدولة بحالة `Scheduled`
- `scheduled_at` في الماضي أو الحاضر

## 🤝 المساهمة

لإضافة ميزات جديدة:

1. أنشئ خدمة جديدة في `services/`
2. أضف الـ types المطلوبة في `types.ts`
3. حدّث schema قاعدة البيانات إذا لزم الأمر
4. أضف documentation في هذا الملف

## 📄 الترخيص

هذا المشروع مرخص تحت MIT License.
