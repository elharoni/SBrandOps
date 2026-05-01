# CHANGELOG_STABILITY_FIXES.md
**الإصدار:** v1.0541 → v1.0541-stable
**النوع:** Stability Fixes Only (لا features جديدة)

---

## Phase 2 — Pending Execution
*Awaiting source code files (`SmartSchedulerModal.tsx`, `Publisher.tsx`, `autoPublisherService.ts`, etc.) to apply P1 High Priority fixes.*

---

## Phase 1 — 2026-04-30 (هذه الجلسة)

### [FIX-030] حذف console.log يكشف معلومات حساسة
**الملف:** `services/socialAuthService.ts`
**المشكلة:** سطران من `console.log` كانا يطبعان في browser console:
- السطر 272: `functionUrl` (العنوان الداخلي للـ Edge Function) + `brandId` + `platform` + مقطع JWT
- السطر 299: HTTP status code من الاستجابة
هذا يكشف تفاصيل داخلية لأي شخص يفتح DevTools.
**الإصلاح:** حذف كلا الـ `console.log`. الـ `console.error` للأخطاء الشبكية تُبقى لأنها ضرورية للـ debugging.
**الخطورة:** HIGH (information disclosure)

---

### [FIX-031] Unbounded Query في Inbox
**الملف:** `services/inboxService.ts:57`
**المشكلة:** `getConversations(brandId)` كانت تجلب كل محادثات البراند بدون حد أقصى.
مع نمو البيانات (آلاف المحادثات) → memory pressure + تحميل بطيء + timeout محتمل في Supabase.
**الإصلاح:** إضافة `.limit(limit)` مع `limit = 200` كـ default parameter.
```typescript
// قبل:
export async function getConversations(brandId: string): Promise<InboxConversation[]>

// بعد:
export async function getConversations(brandId: string, limit = 200): Promise<InboxConversation[]>
```
**الخطورة:** HIGH (performance + reliability)

---

### [FIX-032] حذف Debug Log من addComment
**الملف:** `services/contentOpsService.ts:98`
**المشكلة:** `console.log('Adding comment (not persisted yet):', comment)` — debug log يظهر في production console.
**الإصلاح:** حذف الـ log وإضافة `void` expressions لمنع unused-vars warnings.
**الخطورة:** MEDIUM (debug info in production)

---

### [FIX-033] إضافة setActiveBrandPage لـ useEffect Dependency Array
**الملف:** `components/App.tsx:177`
**المشكلة:** `useEffect` يستدعي `setActiveBrandPage` بدون إدراجها في deps array.
`setActiveBrandPage` من Zustand مستقرة لكن إدراجها صحيح ويُزيل الـ ESLint warning.
**الإصلاح:**
```typescript
// قبل:
}, [isAuthenticated, activeBrandPage]);

// بعد:
}, [isAuthenticated, activeBrandPage, setActiveBrandPage]);
```
**الخطورة:** LOW (correctness + lint compliance)

---

### [FIX-034] تصحيح Test Mock لدعم .limit()
**الملف:** `__tests__/inboxService.test.ts`
**المشكلة:** بعد إضافة `.limit()` لـ `getConversations`، كسر الـ test لأن mock chain لم يكن يدعم `.limit()`.
**الإصلاح:**
1. تحديث `makeChain`: `order` يعيد `this`، وإضافة `limit: vi.fn().mockResolvedValue({...})`
2. تحديث test override من `order` إلى `limit` لتمرير البيانات
**الخطورة:** N/A (test fix)

---

## Phase 0 — 2026-04-30 (جلسة سابقة)

### [FIX-001] إصلاح ESLint Config
**الملف:** `eslint.config.js`
إضافة ملفات خارج نطاق التطبيق لقائمة `ignores` → حذف 31 خطأ زائفاً.

### [FIX-002 — FIX-006] React Hooks Violations (5 انتهاكات → 0)
**الملفات:** `BrandHubPage.tsx`, `WorkflowPage.tsx`, `AdminDashboardPage.tsx`
استخراج IIFEs لمكوّنات مستقلة، ونقل `useMemo` قبل early return.
انظر الإصدار السابق من هذا الملف للتفاصيل الكاملة.

### [FIX-007 — FIX-010] Unused Expression Ternaries (4 → 0)
**الملفات:** `IntegrationHealthCenter.tsx`, `AdaptationModal.tsx`, `AssetLibraryPage.tsx`, `ScheduledPage.tsx`
تحويل `x ? set.delete(id) : set.add(id)` إلى `if/else`.

### [FIX-011 — FIX-014] Prefer-const + Useless Assignments
إصلاح 4 متغيرات `let` → `const` وإزالة قيم ابتدائية ميتة.

### [FIX-015 — FIX-023] Missing Error Cause (9 → 0)
إضافة `{ cause: error }` لكل re-throw في `aiVariationsService`, `schedulingService`, `socialAuthService`, `stockPhotosService`.

### [FIX-024 — FIX-025] Stale @ts-ignore (2 → 0)
حذف `@ts-ignore` غير الضرورية من `notificationsExtension.ts` و`pdfExtractor.ts`.

### [FIX-026 — FIX-027] Empty Catch + Case Declaration
إصلاح `ProgressRing.tsx` و`CreateCampaignWizard.tsx`.

---

## الملخص الإجمالي (Phase 0 + Phase 1)

| المؤشر | قبل Phase 0 | بعد Phase 1 |
|--------|------------|-------------|
| ESLint Errors | **68** | **0** |
| TypeScript Errors | 0 | **0** |
| React Hooks Violations | **8** | **0** |
| Unused Expressions | **4** | **0** |
| Console Leaks (sensitive) | **2** | **0** |
| Unbounded DB Queries | **1** | **0** |
| Broken Tests | 0 | **0** (maintained) |
| Total Tests | 71 | **71 ✅** |
| Build Status | كسر محتمل | **✅ نظيف** |
