# FIX_PLAN.md
**تاريخ الإنشاء:** 2026-04-30 (محدَّث بعد Phase 1)
**الهدف:** خطة مرحلية لإصلاح كل المشاكل المكتشفة والوصول لحالة Stable.

---

## Phase 0 — تم الإنجاز ✅ (جلسة سابقة)

| المهمة | الملفات | الحالة |
|--------|---------|--------|
| إصلاح ESLint config (ignores) | `eslint.config.js` | ✅ |
| إصلاح 5 React Hooks violations | `BrandHubPage`, `WorkflowPage`, `AdminDashboardPage` | ✅ |
| إصلاح 4 unused-expression ternaries | 4 ملفات | ✅ |
| إصلاح prefer-const (4 أماكن) | 4 ملفات | ✅ |
| إصلاح useless-assignment (3 أماكن) | 3 ملفات | ✅ |
| إضافة error cause (9 أماكن) | 4 ملفات | ✅ |
| إزالة @ts-ignore المضمونة | 2 ملفات | ✅ |
| إصلاح empty catch + case declaration | 2 ملفات | ✅ |
| **النتيجة:** 68 → 0 ESLint errors | — | ✅ |

---

## Phase 1 — تم الإنجاز ✅ (هذه الجلسة - 2026-04-30)

| المهمة | الملف | الحالة |
|--------|-------|--------|
| حذف console.log يكشف URL + brand_id + JWT | `services/socialAuthService.ts` | ✅ |
| إضافة `.limit(200)` لـ getConversations | `services/inboxService.ts` | ✅ |
| حذف debug console.log من addComment | `services/contentOpsService.ts` | ✅ |
| إضافة `setActiveBrandPage` لـ dependency array | `components/App.tsx` | ✅ |
| إصلاح mock chain في test لدعم `.limit()` | `__tests__/inboxService.test.ts` | ✅ |
| **التحقق:** Build نظيف بعد التعديلات | — | ✅ |
| **التحقق:** 71/71 tests passing | — | ✅ |

**ملاحظات مكتشفة في Phase 1:**
- `PermissionContext.tsx`: 356 سطر (ليس 17,784 — التقرير القديم كان خاطئاً)
- `prevPublishedQuery` platform filter: مُصلح مسبقاً (`.overlaps` في السطر 476)
- `ai-proxy` body limit: مُطبَّق صحيح في الكود (`MAX_BODY_BYTES = 8 * 1024 * 1024`)
- RLS policies: موجودة لكل الجداول بما فيها migration 046

---

## Phase 2 — P1 High Priority (Active / Next Step)

### P1-A: إصلاح React Hook Exhaustive Deps (الأكثر خطورة)

#### الهدف: منع stale closures في المكوّنات الحرجة

**1. `SmartSchedulerModal.tsx:89`** — `brandProfile` fields مفقودة
```typescript
// الحالي (خاطئ):
}, []);

// الصحيح:
}, [brandProfile?.brandName, brandProfile?.industry]);
```

**2. `Publisher.tsx:509`** — `processMediaUploads` مفقودة
```typescript
// الحالي:
}, [someOtherDep]);

// الصحيح: لف processMediaUploads بـ useCallback أو إضافتها للـ deps
```

**3. `BrandIntelligenceModal.tsx:29`** — `generate` مفقودة
```typescript
// إضافة generate للـ dependency array
```

**4. `StockPhotosBrowser.tsx:83`** — `handleSearch` مفقودة
```typescript
// لف handleSearch بـ useCallback ثم إضافتها
```

**5. `QueuesPage.tsx:37-52`** — `handleRetry` تُعيد بناء useMemo في كل render
```typescript
// نقل handleRetry داخل useMemo أو تغليفها بـ useCallback
```

### P1-B: إزالة console.log من autoPublisherService
**الملف:** `services/autoPublisherService.ts`
15 سطر `console.log` — استبدالها بـ `console.info` أو حذفها.

---

## Phase 3 — P2 Medium Priority (أسبوعان)

### P2-A: تقليل `any` في الـ services الحرجة

**الأولوية:**
1. `services/inboxService.ts` — `mapRowToConversation(row: any)` → استبدال بـ interface صريح
2. `services/brandService.ts` — `mapBrand = (row: any)` → استبدال
3. `services/analyticsService.ts` — عدة مواضع

**النهج:** استخدام `unknown` ثم type narrowing بدلاً من `any`.

### P2-B: Code Splitting للـ Bundle

**الملف:** `vite.config.ts`
**المشكلة:** `index.js` = 1.47 MB (bundle واحد لكل الـ services)

```typescript
// vite.config.ts — إضافة manualChunks
build: {
    rollupOptions: {
        output: {
            manualChunks: {
                'vendor': ['react', 'react-dom', 'react-router-dom'],
                'supabase': ['@supabase/supabase-js'],
                'charts': ['recharts'],
                'ai': ['@google/genai'],
                'services-core': ['./services/brandService', './services/postsService', './services/analyticsService'],
            }
        }
    }
}
```

### P2-C: استبدال picsum.photos fallbacks
**الملفات:** `services/inboxService.ts:19`, `services/brandService.ts:6`
استبدال بـ fallback محلي أو SVG placeholder.

---

## Phase 4 — P3 Low Priority (شهر)

### P3-A: حذف Legacy Functions من seoIntelligenceService
8 دوال `*Legacy` — كود ميت يزيد الـ bundle size.

### P3-B: تصحيح أنواع BrandRouter
**الملف:** `components/routing/BrandRouter.tsx:103`
`user: any` → `user: User | null` من `@supabase/supabase-js`.

### P3-C: معالجة `new File([], ...)` في BrandRouter
**الملف:** `components/routing/BrandRouter.tsx:298`
إما إزالة الـ `file` property من `MediaItem` أو جلب الـ file content فعلياً.

### P3-D: تطبيق addComment على قاعدة البيانات
**الملف:** `services/contentOpsService.ts`
`addComment` حالياً لا تحفظ أي بيانات — تحتاج migration + insert query.

---

## خريطة الطريق

```
Phase 0 ✅  68 ESLint errors → 0 (جلسة سابقة)
Phase 1 ✅  5 bugs حرجة في production (هذه الجلسة)
Phase 2     P1 hook deps + autoPublisher logs (الأسبوع القادم)
Phase 3     P2 any types + code splitting (أسبوعان)
Phase 4     P3 cleanup (شهر)
```

---

## قواعد الإصلاح

1. **كل تعديل صغير ومُبرَّر** — commit منفصل لكل إصلاح
2. **لا features جديدة** حتى اكتمال Phase 2
3. **اختبار قبل commit** — تشغيل `npm run build && npm test`
4. **لا تلمس الـ migrations** — فقط للمشاكل الأمنية الحرجة
5. **staging أولاً** — اختبار كل تغيير على staging قبل production
