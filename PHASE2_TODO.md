# SBrandOps — Phase 2 Feature Plan
> بدء التنفيذ: 2026-04-27 | المرحلة الثانية: 4 فيتشرز رئيسية

---

## ✅ المنجز من المرحلة الأولى
- جميع مهام P0–P4 (33 مهمة) منجزة — راجع TODO.md
- P1-11 يحتاج اختبار يدوي فقط (لا كود)

---

## 🚀 Phase 2 — الفيتشرز الجديدة

### F1 · Publishing Queue — قائمة انتظار النشر المتطورة
**الأولوية:** P0 | **الملف:** `components/pages/ScheduledPage.tsx`

**المطلوب:**
- [ ] Stats bar أعلى الصفحة: Scheduled / Published / Failed بأيقونات وأرقام لحظية
- [ ] Timeline view — المنشورات مجمّعة بالتاريخ (اليوم / غداً / هذا الأسبوع / لاحقاً)
- [ ] زر Retry (🔄) على المنشورات الفاشلة — يعيد Status إلى `Scheduled`
- [ ] Platform filter pills أعلى القائمة
- [ ] `onRetryPost` handler يستدعي supabase مباشرة

**البنية:**
```
ScheduledPage
  ├── StatsBar (scheduled/published/failed/draft counts)
  ├── PlatformFilterPills
  ├── ViewToggle (list | timeline)
  └── TimelineGroups (Today / Tomorrow / This Week / Later)
       └── PostCard (with Retry button if Failed)
```

---

### F2 · Content Calendar — Drag & Drop
**الأولوية:** P1 | **الملف:** `components/pages/CalendarPage.tsx`

**المطلوب:**
- [ ] `draggable` على event chips (posts only) في Month View
- [ ] `onDragOver` + `onDrop` على كل خلية يوم
- [ ] On drop: حساب التاريخ الجديد مع الحفاظ على نفس الوقت → `onUpdatePost(postId, { scheduledAt: newDate })`
- [ ] Highlight بصري على خلية الـ drop target
- [ ] نفس الـ DnD في Week View على time slots
- [ ] Visual feedback: chip شبه شفاف أثناء السحب

**State جديد:**
```ts
const [draggingId, setDraggingId] = useState<string | null>(null);
const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
```

---

### F3 · Competitor Intelligence — صفحة ذكاء المنافسين (جديدة)
**الأولوية:** P1 | **الملف:** `components/pages/CompetitorIntelligencePage.tsx` (جديد)

**المطلوب:**
- [ ] 3 تبويبات: **المراقبة** / **تحليل AI** / **الفجوات**
- [ ] تبويب المراقبة:
  - عرض قائمة watchlists من `competitive_watchlists` table
  - إضافة منافس جديد (اسم + قنوات + كلمات مفتاحية)
  - بطاقة كل منافس مع آخر تحليل
- [ ] تبويب تحليل AI:
  - زر "حلّل الآن" → يستدعي `callAIProxy(gemini-2.0-flash)`
  - يُدخل اسماء المنافسين + معلومات البراند → يُرجع SWOT analysis
  - عرض النتيجة في 4 بطاقات: نقاط قوة / ضعف / فرص / تهديدات
- [ ] تبويب الفجوات:
  - يقارن `brand_knowledge` مع تحليل المنافسين
  - يقترح محتوى لم يُعالَج بعد

**التكامل:**
```
competitiveIntelService: getCompetitiveWatchlists / createCompetitiveWatchlist
brandKnowledgeService: getBrandKnowledge (type: competitor)
callAIProxy: تحليل SWOT + اقتراح فجوات
```

**الإضافات المطلوبة:**
- `config/routes.ts`: `'competitor-intel': '/app/competitor-intel'`
- `Sidebar.tsx`: تحت قسم Brand Brain → `competitor-intel`
- `BrandRouter.tsx`: lazy import + case

---

### F4 · Billing Dashboard — لوحة استهلاك متطورة
**الأولوية:** P2 | **الملف:** `components/pages/UserBillingPage.tsx`

**المطلوب:**
- [ ] Recharts AreaChart للاستهلاك اليومي (30 يوم الماضية) من `ai_usage_logs`
- [ ] بطاقات إحصائية: هذا الشهر / الأسبوع الماضي / اليوم
- [ ] جدول per-feature breakdown: content_gen / inbox_reply / campaign / brand_brain / etc.
- [ ] Per-brand spending table (إذا brands > 1)
- [ ] زر "إدارة الاشتراك" يستدعي `billingManagementService`

**Query جديد:**
```sql
SELECT
  DATE_TRUNC('day', created_at) as day,
  feature,
  SUM(input_tokens + output_tokens) as tokens
FROM ai_usage_logs
WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1
```

---

## 📊 ملخص التنفيذ

| الفيتشر | الملفات المتأثرة | الوقت التقديري | الحالة |
|---------|-----------------|----------------|--------|
| F1 Publishing Queue | ScheduledPage.tsx | 2 ساعة | ⏳ |
| F2 Calendar DnD | CalendarPage.tsx | 1.5 ساعة | ⏳ |
| F3 Competitor Intel | CompetitorIntelligencePage.tsx + Routes + Sidebar + BrandRouter | 3 ساعات | ⏳ |
| F4 Billing Chart | UserBillingPage.tsx | 1 ساعة | ⏳ |

---

## 🗄️ Migrations جديدة
- لا مايجريشنز جديدة مطلوبة لـ F1/F2/F4
- F3: اختياري — يمكن تخزين نتائج AI في `brand_knowledge` (type: competitor) الموجود مسبقاً
