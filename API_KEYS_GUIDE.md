# 🔑 دليل الحصول على API Keys

## كيفية الحصول على مفاتيح API للصور المجانية

---

## 1️⃣ Unsplash API Key

### الخطوات:

#### 1. إنشاء حساب
1. اذهب إلى: https://unsplash.com/join
2. سجّل حساب جديد (مجاني)
3. أو سجّل الدخول إذا كان لديك حساب

#### 2. إنشاء تطبيق
1. اذهب إلى: https://unsplash.com/oauth/applications
2. اضغط **"New Application"**
3. اقرأ وافق على الشروط
4. املأ النموذج:
   - **Application name:** SBrandOps
   - **Description:** Social media management platform
   - اترك باقي الحقول فارغة (اختيارية)
5. اضغط **"Create application"**

#### 3. الحصول على Access Key
1. بعد إنشاء التطبيق، ستجد:
   - **Access Key** ← هذا ما تحتاجه!
   - **Secret Key** ← لا تحتاجه الآن
2. انسخ **Access Key**

#### 4. إضافته في .env
```bash
VITE_UNSPLASH_ACCESS_KEY=paste_your_access_key_here
```

### مثال:
```bash
# مثال (ليس حقيقي)
VITE_UNSPLASH_ACCESS_KEY=abc123xyz789_example_key_not_real
```

### ⚠️ ملاحظات مهمة:
- ✅ **مجاني تماماً** - 50 طلب في الساعة
- ✅ **لا يحتاج بطاقة ائتمان**
- ✅ **كافي للتطوير والاستخدام الشخصي**
- ⚠️ للإنتاج: قد تحتاج رفع الحد (مجاني أيضاً)

---

## 2️⃣ Pexels API Key

### الخطوات:

#### 1. إنشاء حساب
1. اذهب إلى: https://www.pexels.com/
2. اضغط **"Join"** في الأعلى
3. سجّل حساب جديد (مجاني)

#### 2. الذهاب لصفحة API
1. اذهب إلى: https://www.pexels.com/api/
2. اضغط **"Get Started"** أو **"Your API Key"**
3. أو مباشرة: https://www.pexels.com/api/new/

#### 3. الحصول على API Key
1. ستجد **API Key** مباشرة في الصفحة
2. انسخ المفتاح

#### 4. إضافته في .env
```bash
VITE_PEXELS_API_KEY=paste_your_api_key_here
```

### مثال:
```bash
# مثال (ليس حقيقي)
VITE_PEXELS_API_KEY=563492ad6f91700001000001abc123xyz789example
```

### ⚠️ ملاحظات مهمة:
- ✅ **مجاني تماماً** - 200 طلب في الساعة
- ✅ **لا يحتاج بطاقة ائتمان**
- ✅ **سخي جداً للاستخدام**
- ✅ **لا حد للصور**

---

## 📝 الخطوات الكاملة (ملخص سريع)

### Unsplash:
1. https://unsplash.com/join ← سجّل
2. https://unsplash.com/oauth/applications ← أنشئ تطبيق
3. انسخ **Access Key**
4. ضعه في `.env`

### Pexels:
1. https://www.pexels.com/ ← سجّل
2. https://www.pexels.com/api/ ← اذهب للـ API
3. انسخ **API Key**
4. ضعه في `.env`

---

## 🔧 تحديث ملف .env

بعد الحصول على المفاتيح، افتح ملف `.env` وأضف:

```bash
# Supabase (موجود بالفعل)
VITE_SUPABASE_URL=your_existing_url
VITE_SUPABASE_ANON_KEY=your_existing_key

# Gemini AI (موجود بالفعل)
VITE_GEMINI_API_KEY=your_existing_key

# Facebook (موجود بالفعل)
VITE_FACEBOOK_APP_ID=your_existing_id

# ✨ جديد - Stock Photos
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_key_here
VITE_PEXELS_API_KEY=your_pexels_key_here
```

---

## ✅ التحقق من نجاح الإعداد

### 1. أعد تشغيل التطبيق:
```bash
# أوقف التطبيق (Ctrl+C)
# ثم شغّله مرة أخرى
npm run dev
```

### 2. اختبر في Console:
```javascript
// افتح Console في المتصفح (F12)
import { searchUnsplash } from './services/stockPhotosService';

const photos = await searchUnsplash({ query: 'nature', perPage: 5 });
console.log(photos);
```

إذا رأيت نتائج، يعني المفاتيح تعمل! ✅

---

## ❌ حل المشاكل

### المشكلة: "401 Unauthorized"
**السبب:** المفتاح غير صحيح

**الحل:**
1. تأكد من نسخ المفتاح بالكامل
2. تأكد من عدم وجود مسافات زائدة
3. تأكد من إعادة تشغيل التطبيق

### المشكلة: "403 Forbidden"
**السبب:** تجاوزت الحد المسموح

**الحل:**
- انتظر ساعة (يتم تجديد الحد كل ساعة)
- أو أنشئ تطبيق جديد

### المشكلة: "لا يعمل"
**الحل:**
1. تأكد من اسم المتغير صحيح:
   - `VITE_UNSPLASH_ACCESS_KEY` ✅
   - `UNSPLASH_ACCESS_KEY` ❌ (ناقص VITE_)
2. تأكد من إعادة تشغيل التطبيق
3. تحقق من Console للأخطاء

---

## 🎯 بدائل (إذا لم تنجح)

### يمكنك استخدام:
1. **Pixabay API** - https://pixabay.com/api/docs/
2. **Flickr API** - https://www.flickr.com/services/api/
3. **Freepik API** - https://www.freepik.com/api

لكن Unsplash و Pexels هما الأفضل والأسهل! 👍

---

## 📊 مقارنة سريعة

| الميزة | Unsplash | Pexels |
|--------|----------|--------|
| مجاني | ✅ | ✅ |
| عدد الصور | 3M+ | 3M+ |
| الحد (مجاني) | 50/ساعة | 200/ساعة |
| الجودة | ممتازة | ممتازة |
| سهولة الإعداد | سهل | أسهل |
| بطاقة ائتمان | لا | لا |

**النصيحة:** استخدم الاثنين معاً للحصول على أكبر تنوع! 🎨

---

## 🆘 هل تحتاج مساعدة؟

إذا واجهت أي مشكلة:
1. تأكد من اتباع الخطوات بالترتيب
2. تحقق من رسائل الخطأ في Console
3. جرّب إنشاء تطبيق جديد
4. تأكد من إعادة تشغيل التطبيق

---

**حظاً موفقاً! 🚀**

بعد الحصول على المفاتيح، ستتمكن من الوصول لملايين الصور المجانية عالية الجودة! 📸
