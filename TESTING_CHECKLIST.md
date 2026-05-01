# TESTING_CHECKLIST.md
**تاريخ الإنشاء:** 2026-04-30 (محدَّث بعد Phase 1)
**الهدف:** اختبار يدوي وآلي شامل للتحقق من استقرار التطبيق.

---

## 0. الاختبارات الآلية (تشغيل قبل كل commit)

```bash
# Build — يجب أن يكمل بدون errors
npm run build

# TypeScript — يجب أن لا يُنتج أي مخرجات (= 0 errors)
npx tsc --noEmit

# Tests — يجب أن تنجح كل الـ 71 tests
npm test
```

**المتوقع:**
- [ ] Build: `✓ built in X.Xs` بدون أخطاء
- [ ] TypeScript: لا مخرجات
- [ ] Tests: `Tests 71 passed (71)`

---

## 1. Auth & Session

### 1.1 تسجيل الدخول
- [ ] email/password صحيح → ينقل للـ dashboard
- [ ] بيانات خاطئة → رسالة خطأ عربية/إنجليزية واضحة
- [ ] تسجيل خروج → ينقل للـ Login، يُمسح الـ session وبيانات الـ brands
- [ ] إعادة تحميل الصفحة بعد login → يبقى مُسجَّلاً (session persisted)
- [ ] Google OAuth → redirects بشكل صحيح

### 1.2 Route Guards
- [ ] `/admin` بدون admin role → AccessDenied أو redirect
- [ ] `/admin` كـ SUPER_ADMIN → يعمل
- [ ] صفحة brand بدون login → ينقل للـ Login
- [ ] صفحة محجوبة بـ plan → يظهر Paywall

### 1.3 Permission Guards
- [ ] `viewer` لا يرى أزرار الإنشاء
- [ ] `editor` يستطيع إنشاء content لكن لا يرى Settings
- [ ] `admin` يرى كل الصلاحيات

---

## 2. Brand Flow

### 2.1 إنشاء براند
- [ ] الضغط على "إضافة براند" → يفتح modal
- [ ] ملء البيانات والحفظ → يظهر البراند في القائمة
- [ ] تجاوز الحد المسموح → رسالة quota error واضحة

### 2.2 BrandHubPage — Voice Tab
**كان فيه Hooks violation حرجة — تأكد من عدم التراجع**
- [ ] فتح Voice Tab → يُحمَّل بدون crash
- [ ] Generate Preview → يعمل ويحفظ الحالة
- [ ] Copy value → copiedKey يتغير مؤقتاً
- [ ] التبديل بين الـ tabs مرات متعددة → لا crash

### 2.3 BrandHubPage — Audience Tab
**كان فيه Hooks violation حرجة**
- [ ] فتح Audience Tab → يُحمَّل بدون crash
- [ ] إضافة persona → يُضاف للقائمة
- [ ] حذف persona → يُحذف
- [ ] التبديل لـ Voice ثم العودة → state سليم

### 2.4 Brand Import — PDF
- [ ] رفع PDF < 1 MB → يعمل
- [ ] رفع PDF 3-5 MB → يعمل
- [ ] رفع PDF > 5 MB → رسالة خطأ عن الحجم
- [ ] رفع ملف غير PDF → رسالة خطأ نوع الملف

---

## 3. Publisher & Content

### 3.1 Publisher
- [ ] إنشاء منشور جديد → يُحفظ كـ Draft
- [ ] جدولة منشور → `scheduled_at` يُحفظ
- [ ] تعديل منشور موجود → التغييرات تُطبَّق
- [ ] حذف منشور → يُحذف من القائمة

### 3.1.1 Publisher Hooks & State (Phase 2 Verification)
- [ ] Uploading media → Verify `processMediaUploads` runs with correct state without infinite loops.
- [ ] Using SmartSchedulerModal → Confirm `brandProfile` fields are not stale when submitting.
- [ ] BrandIntelligenceModal → Ensure `generate` function executes with the latest context.
- [ ] StockPhotosBrowser → Ensure `handleSearch` executes without UI freezing.

### 3.2 Scheduled Posts
- [ ] عرض قائمة المنشورات المجدولة
- [ ] اختيار post → selected state يتغير (FIX-010)
- [ ] تعديل post من القائمة → يفتح في Publisher

### 3.3 Content Ops
- [ ] إنشاء content piece جديد
- [ ] تحديث status
- [ ] إرسال لـ Publisher

---

## 4. Analytics Hub

### 4.1 Overview Tab
- [ ] يُحمَّل بدون errors في console
- [ ] الـ metrics تظهر (حتى لو 0)
- [ ] تغيير date range → تتحدث البيانات

### 4.2 Platform Filter
- [ ] اختيار منصة واحدة → الـ charts تتغير
- [ ] إلغاء الـ filter → تعود كل المنصات
- [ ] الـ comparison arrows (↑↓) تعمل بشكل صحيح

### 4.3 Social/SEO/Ads/Website Tabs
- [ ] كل tab يُحمَّل بدون crash
- [ ] لا `undefined is not a function` في console

---

## 5. Inbox

### 5.1 تحميل المحادثات
- [ ] فتح Inbox → يُحمَّل المحادثات (حتى 200)
- [ ] لا timeout أو blank screen على الـ brands الكبيرة
- [ ] المحادثات مُرتَّبة بآخر رسالة (الأحدث أولاً)

### 5.2 التفاعل
- [ ] فتح محادثة → عرض الرسائل
- [ ] الرد على محادثة → يُضاف للـ inbox_messages
- [ ] Mark as read → `is_read = true`
- [ ] تعيين لـ assignee → يُحفظ

---

## 6. Integrations & OAuth

### 6.1 Connect Account Flow
- [ ] الضغط على "Connect" لمنصة → يبدأ OAuth
- [ ] **تحقق في DevTools Console:** لا `console.log` يظهر بعد Fix-030
- [ ] OAuth callback → يعود للتطبيق مع نجاح أو رسالة خطأ واضحة

### 6.2 Integration Health Center
- [ ] اختيار/إلغاء اختيار item → toggle يعمل (FIX-007)
- [ ] التبديل مرات متعددة → لا stuck state

---

## 7. Admin Dashboard

### 7.1 AdminDashboardPage
**كان useMemo يُستدعى بعد early return**
- [ ] تسجيل دخول كـ SUPER_ADMIN
- [ ] أول تحميل (بيانات تُحمَّل): skeleton يظهر بدون crash
- [ ] بعد تحميل البيانات: chart يظهر
- [ ] إعادة تحميل → نفس السلوك

### 7.2 Admin Users
- [ ] عرض قائمة المستخدمين
- [ ] تغيير صلاحية → يُحفظ
- [ ] Suspend user → status يتغير

---

## 8. Workflow / SmartBot

### 8.1 WorkflowPage
**كان فيه Hooks violations حرجة**
- [ ] فتح WorkflowPage → يُحمَّل بدون crash
- [ ] Notifications Tab → يُحمَّل
- [ ] Dependencies Tab → يُحمَّل
- [ ] التبديل بين الـ tabs مرات → لا crash

---

## 9. Campaign Wizard

### 9.1 CreateCampaignWizard (FIX-029)
**كان case 4 يُنتج lexical declaration error**
- [ ] فتح Campaign Wizard
- [ ] الوصول لـ Step 4 (Review) → يُحمَّل بدون crash
- [ ] عرض ملخص الـ campaign
- [ ] الإرسال أو الإلغاء

---

## 10. Security Checks

### 10.1 Console Cleanliness
**افتح DevTools Console وتأكد من غياب:**
- [ ] أي `[connect-accounts] calling...` — يجب أن يكون محذوفاً (FIX-030)
- [ ] أي `[connect-accounts] response status:` — يجب أن يكون محذوفاً (FIX-030)
- [ ] أي `Adding comment...` — يجب أن يكون محذوفاً (FIX-032)
- [ ] أي JWT tokens أو API keys في الـ console

### 10.2 Database RLS (اختبار SQL في Supabase Dashboard)
```sql
-- تحقق من RLS على كل الجداول الرئيسية
SELECT tablename, rowsecurity,
    CASE WHEN rowsecurity THEN '✅ مُفعَّل' ELSE '❌ مُعطَّل' END
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
- [ ] `brands`: RLS مُفعَّل
- [ ] `inbox_conversations`: RLS مُفعَّل
- [ ] `inbox_messages`: RLS مُفعَّل
- [ ] `scheduled_posts`: RLS مُفعَّل
- [ ] `oauth_tokens`: RLS مُفعَّل
- [ ] جداول migration 046 (inbox_reply_logs, etc.): RLS مُفعَّل

### 10.3 Cross-Brand Isolation
- [ ] تسجيل دخول بحساب A → لا يرى بيانات حساب B
- [ ] محاولة طلب بيانات brand غير مملوك → 0 نتائج (RLS)

---

## 11. Performance

### 11.1 Bundle Size
```bash
npm run build
# راجع: dist/assets/index-*.js
```
- [ ] الـ chunk الرئيسي < 2 MB (حالياً 1.47 MB — مقبول)
- [ ] لا حزم > 500 KB بدون مبرر

### 11.2 تحميل الصفحات
- [ ] Login → Dashboard < 3 ثوانٍ على اتصال عادي
- [ ] لا blank screens أثناء التحميل (skeletons تظهر)

---

## ترتيب الأولويات

```
1. Automated (دائماً أولاً — < 1 دقيقة):
   npm run build && npx tsc --noEmit && npm test

2. Critical Paths (بعد كل نشر — 15 دقيقة):
   Auth → BrandHub (Voice/Audience) → Admin Dashboard → Inbox → Connect Account

3. Feature Tests (قبل release — 45 دقيقة):
   Publisher → Analytics → Campaign Wizard → Integrations → PDF Import

4. Security Tests (قبل production — 30 دقيقة):
   Console cleanliness → RLS checks → Cross-brand isolation
```
