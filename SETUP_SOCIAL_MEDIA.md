# 🚀 Setup Social Media Connections - دليل سريع

## الخطوة 1️⃣: Setup Database (لو مش متعملة)

اتبع الخطوات في [DATABASE_SETUP.md](DATABASE_SETUP.md)

---

## الخطوة 2️⃣: Setup Facebook App (ضروري لـ Facebook & Instagram)

### A. إنشاء Facebook App

1. **افتح Facebook Developers:**
   ```
   https://developers.facebook.com/apps
   ```

2. **اضغط "Create App"**
   - نوع التطبيق: **Business**
   - اسم التطبيق: `SBrandOps` (أو أي اسم تاني)
   - البريد الإلكتروني: بريدك

3. **بعد الإنشاء، اذهب لـ Settings > Basic**
   - انسخ **App ID**
   - انسخ **App Secret**

### B. أضف الـ Credentials للـ `.env`

افتح ملف `.env` وأضف:

```env
VITE_FACEBOOK_APP_ID=123456789012345  # App ID اللي نسخته
VITE_FACEBOOK_APP_SECRET=abc123xyz789  # App Secret اللي نسخته
```

### C. Configure Facebook App

1. **App Domains:**
   - اذهب لـ Settings > Basic
   - أضف: `localhost`

2. **Site URL:**
   - أضف: `https://localhost:3000/`

3. **Enable Facebook Login:**
   - اذهب لـ Products > Facebook Login > Settings
   - **Valid OAuth Redirect URIs:**
     ```
     https://localhost:3000/
     ```
   - Save changes

### D. Enable Permissions

1. اذهب لـ **App Review > Permissions and Features**
2. اطلب الـ Permissions دي:
   - ✅ `pages_show_list`
   - ✅ `pages_read_engagement`
   - ✅ `pages_manage_posts`
   - ✅ `instagram_basic`
   - ✅ `instagram_content_publish`

**ملاحظة:** في Development Mode، ممكن تستخدم التطبيق بدون approval. بس للـ Production محتاج App Review.

### E. Make App Live (اختياري للتجربة)

في Development Mode، ممكن تربط حسابك الشخصي بس. لو عايز تربط حسابات تانية:

1. اذهب لـ **Roles > Test Users**
2. أضف المستخدمين كـ Testers

---

## الخطوة 3️⃣: Connect Your First Account

1. **شغّل الموقع:**
   ```bash
   npm run dev
   ```

2. **افتح:** https://localhost:3000/

3. **اذهب لـ Accounts Page** من الـ sidebar

4. **اضغط "Connect Account"** على Facebook أو Instagram

5. **اتبع OAuth Flow:**
   - سجل دخول Facebook
   - اختار الصفحات اللي عايز تربطها
   - Authorize

6. **Done! ✅** المفروض تشوف الحسابات متربطة

---

## 🐛 Troubleshooting

### مشكلة: "Facebook SDK not loaded"

**الحل:**
- تأكد إن `VITE_FACEBOOK_APP_ID` موجود في `.env`
- اعمل Refresh للصفحة (F5)
- افتح Console (F12) وشوف الـ errors

### مشكلة: "App Not Set Up"

**الحل:**
- تأكد إن ضفت `https://localhost:3000/` في Facebook App Settings
- تأكد إن ضفت `localhost` في App Domains

### مشكلة: "No Pages Found"

**الحل:**
- تأكد إن عندك Facebook Page (مش personal profile)
- للـ Instagram: ربط Instagram Business Account بالـ Facebook Page الأول

### مشكلة: "Permission Denied"

**الحل:**
- في OAuth dialog، تأكد إنك وافقت على كل الـ permissions
- جرب "Re-authorize" من الـ Accounts page

---

## ✨ الخطوات التالية

بعد ما تربط أول حساب:

1. ✅ **جرب Publisher:** اعمل post جديد
2. ✅ **جرب Scheduler:** اجدول post
3. ✅ **جرب Analytics:** شوف الـ stats

---

## 🎯 Platform Status

| Platform | Status | Setup Required |
|----------|--------|----------------|
| Facebook | ✅ **Ready** | Facebook App ID |
| Instagram | ✅ **Ready** | Facebook App ID + IG Business |
| Twitter | 🚧 Coming Soon | - |
| LinkedIn | 🚧 Coming Soon | - |
| TikTok | 🚧 Coming Soon | - |
| Pinterest | 🚧 Coming Soon | - |

---

## 📞 Need Help?

1. افتح Browser Console (F12) وشوف الـ error messages
2. تأكد من الـ credentials في `.env`
3. تأكد من Facebook App configuration

**Happy Connecting! 🎉**
