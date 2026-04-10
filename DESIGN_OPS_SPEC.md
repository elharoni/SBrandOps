# Design Ops — Full Implementation Spec
**SBrandOps | Feature Branch: `feature/design-ops`**
**تاريخ: أبريل 2026 | الحالة: جاهز للتنفيذ**

---

## 1. ملخص تنفيذي

إضافة قسم **Design Ops** كاملاً لـ SBrandOps يُمكّن الوكالة والبراندات من:
- إنشاء تصاميم بصرية عبر Workflows مُعرَّفة مسبقاً (مش prompt يدوي كل مرة)
- بناء مكتبة أصول بصرية per-brand
- توليد صور بالـ AI مع context تلقائي من Brand Hub
- إرسال التصاميم مباشرة للـ Publisher

---

## 2. الوضع الحالي (ما هو موجود في الكود)

| الملف | الوضع | ملاحظة |
|-------|-------|--------|
| `components/AIImageGeneratorModal.tsx` | موجود ✅ | Modal فقط — مش page |
| `services/geminiService.ts` → `generateImageFromPrompt()` | موجود ✅ | Imagen 4.0، يدعم 5 aspect ratios |
| `services/storageService.ts` → `uploadFile()` | موجود ✅ | Supabase Storage، bucket: `media` |
| `services/stockPhotosService.ts` | موجود ✅ | Unsplash + Pexels (API keys ناقصة في .env) |
| `services/integrationsService.ts` | موجود ✅ | Canva, Adobe Express, Figma معرّفين |
| `types.ts` → `MediaItem`, `BrandHubProfile` | موجود ✅ | Base للـ types الجديدة |
| `services/workflowService.ts` | موجود ✅ | نفس الـ pattern هنستخدمه |
| `hooks/useBrandData.ts` | موجود ✅ | نفس الـ pattern للـ hook الجديد |

**ما هو ناقص تماماً:**
- لا توجد صفحة `DesignOpsPage`
- لا يوجد `designAssetsService.ts`
- لا يوجد `designTemplatesService.ts`
- الـ Types الخاصة بالتصميم غير موجودة في `types.ts`
- لا يوجد nav item في Sidebar
- لا يوجد case في App.tsx router

---

## 3. Types الجديدة المطلوبة

**الملف المتأثر: `types.ts`**
أضف في نهاية الملف قبل سطر `// --- System ---`:

```typescript
// --- Design Ops ---

export type DesignAssetType = 'logo' | 'image' | 'template' | 'video' | 'icon' | 'font';

export type DesignAssetSource = 'upload' | 'ai-generated' | 'stock' | 'canva' | 'figma';

export interface DesignAsset {
    id: string;
    brandId: string;
    name: string;
    url: string;
    thumbnailUrl?: string;
    type: DesignAssetType;
    source: DesignAssetSource;
    tags: string[];
    width?: number;
    height?: number;
    fileSize?: number;       // bytes
    mimeType?: string;
    aspectRatio?: string;    // e.g. "1:1", "16:9"
    prompt?: string;         // إذا كانت AI-generated
    createdAt: string;
    updatedAt?: string;
}

export type DesignWorkflowStatus = 'draft' | 'active' | 'archived';

export type DesignWorkflowOutputFormat =
    | 'instagram-post'       // 1080×1080 — 1:1
    | 'instagram-story'      // 1080×1920 — 9:16
    | 'instagram-reel-cover' // 1080×1920 — 9:16
    | 'facebook-post'        // 1200×630  — 16:9 approx
    | 'twitter-post'         // 1600×900  — 16:9
    | 'linkedin-post'        // 1200×627  — ~16:9
    | 'linkedin-banner'      // 1584×396
    | 'tiktok-cover'         // 1080×1920 — 9:16
    | 'youtube-thumbnail'    // 1280×720  — 16:9
    | 'ad-banner-square'     // 1200×1200 — 1:1
    | 'ad-banner-landscape'  // 1200×628  — 16:9
    | 'custom';

export interface DesignWorkflowFormat {
    format: DesignWorkflowOutputFormat;
    width: number;
    height: number;
    label: string;
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
}

export interface DesignWorkflowStep {
    id: string;
    order: number;
    type:
        | 'input-topic'        // حقل نص: موضوع/فكرة
        | 'input-tone'         // اختيار: tone of voice
        | 'input-text-overlay' // نص يُضاف فوق الصورة
        | 'select-format'      // اختيار dimensions
        | 'apply-brand-colors' // inject brand colors من Brand Hub
        | 'apply-style'        // اختيار visual style
        | 'generate-image'     // توليد AI
        | 'select-variant'     // اختيار من 3 variants
        | 'review';            // مراجعة قبل الحفظ
    label: string;
    config?: Record<string, any>; // خيارات الـ step (e.g. tone options)
}

export interface DesignWorkflow {
    id: string;
    brandId: string;
    name: string;
    description: string;
    icon: string;             // FontAwesome class
    category:
        | 'social-post'
        | 'story'
        | 'ad-creative'
        | 'campaign-pack'
        | 'logo-usage'
        | 'custom';
    formats: DesignWorkflowFormat[];   // ممكن يولّد أكثر من format في مرة واحدة
    steps: DesignWorkflowStep[];
    promptTemplate: string;            // template مع placeholders: {topic}, {tone}, {brandColors}, {cta}
    useBrandColors: boolean;           // inject brand context تلقائياً
    useBrandVoice: boolean;
    status: DesignWorkflowStatus;
    variantsCount: 1 | 2 | 3;        // كم variant يولّد AI
    createdAt: string;
    updatedAt?: string;
    lastUsedAt?: string;
    usageCount: number;
}

export interface DesignJobStatus = 'pending' | 'generating' | 'done' | 'error';

export interface DesignJob {
    id: string;
    brandId: string;
    workflowId?: string;       // null لو free-prompt
    workflowName?: string;
    inputs: Record<string, any>;   // قيم الـ steps اللي دخلها المستخدم
    format: DesignWorkflowFormat;
    status: DesignJobStatus;
    prompt: string;            // الـ prompt الفعلي اللي اتبعت للـ AI
    assets: DesignAsset[];     // الناتج (واحدة أو أكثر حسب variantsCount)
    selectedAssetId?: string;  // الـ variant اللي اختاره المستخدم
    error?: string;
    createdAt: string;
}

export interface DesignOpsStats {
    totalAssets: number;
    aiGeneratedCount: number;
    uploadedCount: number;
    workflowsCount: number;
    jobsThisMonth: number;
    topFormats: { format: string; count: number }[];
}
```

---

## 4. الـ Format Dimensions Reference

```typescript
// الجدول ده بيتحول لـ helper في designTemplatesService.ts

export const DESIGN_FORMAT_MAP: Record<DesignWorkflowOutputFormat, DesignWorkflowFormat> = {
    'instagram-post':       { format: 'instagram-post',       width: 1080, height: 1080, label: 'Instagram Post',       aspectRatio: '1:1' },
    'instagram-story':      { format: 'instagram-story',      width: 1080, height: 1920, label: 'Instagram Story',      aspectRatio: '9:16' },
    'instagram-reel-cover': { format: 'instagram-reel-cover', width: 1080, height: 1920, label: 'Reel Cover',           aspectRatio: '9:16' },
    'facebook-post':        { format: 'facebook-post',        width: 1200, height: 630,  label: 'Facebook Post',       aspectRatio: '16:9' },
    'twitter-post':         { format: 'twitter-post',         width: 1600, height: 900,  label: 'X (Twitter) Post',    aspectRatio: '16:9' },
    'linkedin-post':        { format: 'linkedin-post',        width: 1200, height: 627,  label: 'LinkedIn Post',       aspectRatio: '16:9' },
    'linkedin-banner':      { format: 'linkedin-banner',      width: 1584, height: 396,  label: 'LinkedIn Banner',     aspectRatio: '4:3' },
    'tiktok-cover':         { format: 'tiktok-cover',         width: 1080, height: 1920, label: 'TikTok Cover',        aspectRatio: '9:16' },
    'youtube-thumbnail':    { format: 'youtube-thumbnail',    width: 1280, height: 720,  label: 'YouTube Thumbnail',   aspectRatio: '16:9' },
    'ad-banner-square':     { format: 'ad-banner-square',     width: 1200, height: 1200, label: 'Ad Square',           aspectRatio: '1:1' },
    'ad-banner-landscape':  { format: 'ad-banner-landscape',  width: 1200, height: 628,  label: 'Ad Landscape',        aspectRatio: '16:9' },
    'custom':               { format: 'custom',               width: 0,    height: 0,    label: 'Custom Size',         aspectRatio: '1:1' },
};
```

---

## 5. الـ Default Workflows (مُعرَّفة مسبقاً في الكود)

### Workflow 1: Social Post Creator
```
Name: منشور سوشيال ميديا
Category: social-post
Formats: [instagram-post, facebook-post, twitter-post]
Steps:
  1. input-topic     → "موضوع المنشور؟"
  2. input-tone      → options: [احترافي, ودود, عاجل, ملهم, تعليمي]
  3. apply-brand-colors → تلقائي من Brand Hub
  4. generate-image  → يولّد 3 variants
  5. select-variant  → المستخدم يختار
  6. review          → إرسال للـ Publisher أو الـ Asset Library
Prompt Template: "Create a professional social media visual for {brandName}. Topic: {topic}. Tone: {tone}. Brand colors: {brandColors}. Style: clean, modern, eye-catching."
variantsCount: 3
```

### Workflow 2: Story & Reel Cover
```
Name: ستوري وريل
Category: story
Formats: [instagram-story, instagram-reel-cover, tiktok-cover]
Steps:
  1. input-topic
  2. input-text-overlay → "النص الرئيسي على الصورة؟" (optional)
  3. apply-brand-colors
  4. generate-image → 3 variants
  5. select-variant
  6. review
Prompt Template: "Create a vertical social story/reel cover for {brandName}. Topic: {topic}. Text overlay idea: {textOverlay}. Brand colors: {brandColors}. Bold, mobile-first design."
variantsCount: 3
```

### Workflow 3: Ad Creative Pack
```
Name: حزمة إعلانية كاملة
Category: ad-creative
Formats: [ad-banner-square, ad-banner-landscape, instagram-story]
Steps:
  1. input-topic     → "المنتج أو العرض؟"
  2. input-tone      → options: [بيع مباشر, عرض حصري, إطلاق جديد, تذكير]
  3. input-text-overlay → "نص الـ CTA؟ (اشتري الآن، احجز، تعرف أكتر)"
  4. apply-brand-colors
  5. generate-image  → 3 variants
  6. select-variant
  7. review
Prompt Template: "Create a high-converting ad creative for {brandName}. Product/offer: {topic}. CTA: {textOverlay}. Tone: {tone}. Brand colors: {brandColors}. Urgency, clear value proposition."
variantsCount: 3
```

### Workflow 4: Campaign Visual Pack
```
Name: باقة تصاميم كمبانيا
Category: campaign-pack
Formats: [instagram-post, instagram-story, facebook-post, linkedin-post]
Steps:
  1. input-topic     → "اسم الكمبانيا أو الفكرة الرئيسية؟"
  2. input-tone
  3. apply-brand-colors
  4. generate-image  → يولّد صورة base واحدة ثم يحوّلها لكل format
  5. select-variant  → اختيار الـ base image
  6. review          → ناتج: 4 صور جاهزة
Prompt Template: "Create a cohesive campaign visual series for {brandName}. Campaign: {topic}. Tone: {tone}. Brand colors: {brandColors}. Consistent visual identity across all formats."
variantsCount: 1
```

### Workflow 5: Free Generate (Quick Prompt)
```
Name: توليد حر
Category: custom
Formats: [custom — المستخدم يحدد]
Steps:
  1. select-format   → يختار من القائمة أو يحدد dimensions مخصصة
  2. input-topic     → prompt مفتوح
  3. generate-image  → 3 variants
  4. select-variant
  5. review
Prompt Template: {topic}   ← المستخدم يكتب الـ prompt كاملاً
variantsCount: 3
```

---

## 6. Supabase Tables المطلوبة

### Table: `design_assets`
```sql
CREATE TABLE design_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    thumbnail_url   TEXT,
    type            TEXT NOT NULL CHECK (type IN ('logo','image','template','video','icon','font')),
    source          TEXT NOT NULL CHECK (source IN ('upload','ai-generated','stock','canva','figma')),
    tags            TEXT[] DEFAULT '{}',
    width           INTEGER,
    height          INTEGER,
    file_size       BIGINT,
    mime_type       TEXT,
    aspect_ratio    TEXT,
    prompt          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE design_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_access" ON design_assets
    USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
```

### Table: `design_workflows`
```sql
CREATE TABLE design_workflows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    icon            TEXT DEFAULT 'fa-magic',
    category        TEXT NOT NULL,
    formats         JSONB DEFAULT '[]',
    steps           JSONB DEFAULT '[]',
    prompt_template TEXT,
    use_brand_colors BOOLEAN DEFAULT true,
    use_brand_voice  BOOLEAN DEFAULT true,
    status          TEXT DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
    variants_count  INTEGER DEFAULT 3 CHECK (variants_count IN (1,2,3)),
    usage_count     INTEGER DEFAULT 0,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE design_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_access" ON design_workflows
    USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
```

### Table: `design_jobs`
```sql
CREATE TABLE design_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    workflow_id         UUID REFERENCES design_workflows(id) ON DELETE SET NULL,
    workflow_name       TEXT,
    inputs              JSONB DEFAULT '{}',
    format              JSONB NOT NULL,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','generating','done','error')),
    prompt              TEXT,
    assets              JSONB DEFAULT '[]',
    selected_asset_id   UUID,
    error               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE design_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_access" ON design_jobs
    USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
```

### Storage Bucket الجديد
```sql
-- في Supabase Storage: إنشاء bucket اسمه 'design-assets'
-- Public: true
-- Max file size: 20MB
-- Allowed MIME: image/*, video/*
```
*(يمكن استخدام `createBucket()` الموجودة في `storageService.ts`)*

---

## 7. الـ Services الجديدة

### 7.1 `services/designAssetsService.ts`
```
Pattern: نفس workflowService.ts تماماً

Functions:
  getDesignAssets(brandId, filters?)     → DesignAsset[]
  createDesignAsset(brandId, asset)      → DesignAsset
  updateDesignAsset(brandId, id, updates)→ DesignAsset
  deleteDesignAsset(brandId, id)         → void
  getDesignAssetsByType(brandId, type)   → DesignAsset[]
  searchDesignAssets(brandId, query)     → DesignAsset[]

Supabase bucket: 'design-assets' (مش 'media')
Folder structure: {brandId}/{type}/{timestamp}_{random}.{ext}
```

### 7.2 `services/designWorkflowsService.ts`
```
Functions:
  getDesignWorkflows(brandId)                → DesignWorkflow[]
  createDesignWorkflow(brandId, workflow)    → DesignWorkflow
  updateDesignWorkflow(brandId, id, updates) → DesignWorkflow
  deleteDesignWorkflow(brandId, id)          → void
  toggleWorkflowStatus(brandId, id, status)  → void
  seedDefaultWorkflows(brandId)              → void
    ← يُستدعى تلقائياً عند أول دخول للصفحة لو مافيش workflows
    ← يُنشئ الـ 5 workflows الافتراضية المُعرَّفة في §5
  incrementUsageCount(brandId, workflowId)   → void

Helper (client-side فقط):
  buildFinalPrompt(workflow, inputs, brandProfile) → string
    ← يأخذ prompt_template ويستبدل {topic}, {tone}, {brandColors}, {brandName}, {textOverlay}, {cta}
    ← يجلب brandColors من BrandHubProfile.styleGuidelines
```

### 7.3 `services/designJobsService.ts`
```
Functions:
  createDesignJob(brandId, job)          → DesignJob
  updateDesignJob(id, updates)           → DesignJob
  getDesignJobs(brandId, limit?)         → DesignJob[]
  selectJobVariant(jobId, assetId)       → void

Core AI Function (client-side):
  runDesignJob(job, brandProfile, addNotification) → DesignJob
    ← يبني الـ prompt من workflow + inputs + brand context
    ← يكرر الـ generateImageFromPrompt() حسب variantsCount (1-3 calls)
    ← كل صورة ناتجة: تُرفع على Supabase Storage → تتحول لـ DesignAsset
    ← يُحدّث الـ job status من 'generating' → 'done' أو 'error'
    ← يستخدم generateImageFromPrompt() الموجودة في geminiService.ts
```

---

## 8. الـ Hook الجديد

### `hooks/useDesignData.ts`
```
Pattern: نفس useBrandData.ts

State:
  designAssets:   DesignAsset[]
  designWorkflows: DesignWorkflow[]
  recentJobs:     DesignJob[]
  stats:          DesignOpsStats | null
  isLoading:      boolean

Functions:
  fetchDesignData(brandId)     → جلب كل البيانات
  refresh()

يُستدعى من App.tsx مثل useBrandData بالضبط.
```

---

## 9. التعديلات المطلوبة على الملفات الموجودة

### 9.1 `components/Sidebar.tsx`
```typescript
// في section 'publish' — بعد 'marketing-plans' مباشرةً:
{ id: 'design-ops', icon: 'fa-palette', label: ar ? 'استوديو التصميم' : 'Design Ops' },
```

### 9.2 `components/App.tsx`

**أ) في imports (مع باقي lazy imports):**
```typescript
const DesignOpsPage = React.lazy(() =>
    import('./components/pages/DesignOpsPage').then(m => ({ default: m.DesignOpsPage }))
);
```

**ب) في useBrandData destructuring — إضافة design data:**
```typescript
// Design data (hook جديد)
const {
    designAssets,
    designWorkflows,
    recentJobs,
    fetchDesignData,
} = useDesignData(addNotification);
```

**ج) في useEffect الخاص بـ activeBrand:**
```typescript
// أضف fetchDesignData بجانب fetchDataForBrand
useEffect(() => {
    if (activeBrand) {
        fetchDataForBrand(activeBrand);
        fetchDesignData(activeBrand.id);
    }
}, [activeBrand, fetchDataForBrand, fetchDesignData]);
```

**د) في renderBrandPage() → switch:**
```typescript
case 'design-ops':
    return (
        <DesignOpsPage
            brandId={activeBrand.id}
            brandProfile={resolvedBrandProfile}
            designAssets={designAssets}
            designWorkflows={designWorkflows}
            recentJobs={recentJobs}
            addNotification={addNotification}
            onSendToPublisher={(asset) => {
                // تحويل DesignAsset → MediaItem ثم إرساله للـ Publisher
                const mediaItem: MediaItem = {
                    id: asset.id,
                    type: 'image',
                    url: asset.url,
                    file: new File([], asset.name),
                };
                setPostToEdit({ id: '', content: '', platforms: [], media: [mediaItem], status: PostStatus.Draft, scheduledAt: null });
                setActiveBrandPage('social-ops/publisher');
                addNotification(NotificationType.Info, 'تم إرسال التصميم للـ Publisher');
            }}
            onRefresh={() => activeBrand && fetchDesignData(activeBrand.id)}
        />
    );
```

**هـ) في Skeleton switch:**
```typescript
case 'design-ops': return <div className="p-6"><SkeletonCardGrid count={6} cols={3} /></div>;
```

---

## 10. هيكل `DesignOpsPage.tsx`

**المسار:** `components/pages/DesignOpsPage.tsx`

### Props Interface:
```typescript
interface DesignOpsPageProps {
    brandId: string;
    brandProfile: BrandHubProfile;
    designAssets: DesignAsset[];
    designWorkflows: DesignWorkflow[];
    recentJobs: DesignJob[];
    addNotification: (type: NotificationType, msg: string) => void;
    onSendToPublisher: (asset: DesignAsset) => void;
    onRefresh: () => void;
}
```

### Tabs (4 tabs):
```
Tab 1: الـ Workflows  (fa-magic)      ← الـ default tab
Tab 2: مكتبة الأصول  (fa-images)
Tab 3: سجل الإنشاء   (fa-history)
Tab 4: الإعدادات     (fa-sliders)    ← إدارة الـ Workflows
```

### Tab 1 — Workflows:
```
- Grid of DesignWorkflow cards (مثل ContentOpsPage cards)
- كل كارد:
    اسم الـ Workflow | Icon | Category badge
    Description
    الـ Formats المدعومة (chips صغيرة)
    "آخر استخدام" و "عدد مرات الاستخدام"
    زر [تشغيل] → يفتح DesignWorkflowRunner modal/panel

- زر "Workflow جديد" في الـ header
```

### DesignWorkflowRunner (Component مستقل):
```
Modal أو Side Panel يمر على steps الـ workflow واحدة واحدة:

Step Navigation: Progress bar في الأعلى (Step 1 of 4)

كل step له UI مختلف:
  input-topic:      textarea
  input-tone:       button group اختيار
  input-text-overlay: text input
  select-format:    cards مع preview للـ dimensions
  apply-brand-colors: auto — يعرض preview للـ brand colors اللي هتتطبق
  generate-image:   زر "توليد" + spinner + عرض الـ variants
  select-variant:   grid من 3 صور → اختيار واحدة
  review:           summary + زر "حفظ في المكتبة" + زر "إرسال للـ Publisher"

State: {currentStep, inputs, generatedVariants, selectedVariant, isGenerating}
```

### Tab 2 — Asset Library:
```
- Filter bar: All | Logo | Image | Template | Video
- Search input
- Sort: تاريخ الإنشاء | النوع | المصدر
- Masonry grid (3 cols desktop, 2 tablet, 1 mobile)

كل Asset card:
  صورة preview (أو أيقونة للـ video)
  Hover overlay:
    [إرسال للـ Publisher] [تحميل] [حذف]
  Footer: اسم الـ Asset + Source badge (AI / Upload / Stock)

- زر "رفع أصول" → drag & drop أو file picker
- زر "بحث في Stock Photos" → يفتح StockPhotosPanel (باستخدام stockPhotosService الموجود)
```

### Tab 3 — Recent Jobs:
```
- List of DesignJob records
- كل job:
    Workflow name | Format | Date
    Status badge: pending / generating / done / error
    Preview الصور الناتجة (thumbnails صغيرة)
    زر "إعادة الاستخدام" → يفتح نفس الـ workflow بنفس الـ inputs
```

### Tab 4 — Settings (Workflow Management):
```
- CRUD على الـ Workflows
- زر "استعادة الـ Workflows الافتراضية"
- Toggle: تفعيل/تعطيل أي workflow
```

---

## 11. ترتيب التنفيذ (Priority Order)

### Phase 1 — Foundation (يوم 1-2)
| # | المهمة | الملف |
|---|--------|-------|
| 1 | إضافة Types الجديدة | `types.ts` |
| 2 | إنشاء `designAssetsService.ts` | services/ |
| 3 | إنشاء `designWorkflowsService.ts` | services/ |
| 4 | إنشاء Supabase Tables | Supabase Dashboard |
| 5 | إنشاء Storage bucket `design-assets` | Supabase Dashboard |

### Phase 2 — Core Page (يوم 2-3)
| # | المهمة | الملف |
|---|--------|-------|
| 6 | إنشاء `useDesignData.ts` hook | hooks/ |
| 7 | Sidebar nav item | `Sidebar.tsx` |
| 8 | App.tsx: import + hook + case | `App.tsx` |
| 9 | إنشاء `DesignOpsPage.tsx` (skeleton + tabs) | components/pages/ |

### Phase 3 — Workflow Runner (يوم 3-4)
| # | المهمة | الملف |
|---|--------|-------|
| 10 | إنشاء `designJobsService.ts` | services/ |
| 11 | إنشاء `DesignWorkflowRunner.tsx` | components/ |
| 12 | ربط `generateImageFromPrompt()` بالـ runner | geminiService existing |
| 13 | رفع الصور الناتجة على Storage | storageService existing |

### Phase 4 — Asset Library + Polish (يوم 4-5)
| # | المهمة | الملف |
|---|--------|-------|
| 14 | Asset Library tab (grid + filter + search) | DesignOpsPage |
| 15 | Upload flow (drag & drop → Storage) | DesignOpsPage |
| 16 | Stock Photos panel | DesignOpsPage |
| 17 | Send to Publisher flow | App.tsx handler |
| 18 | Recent Jobs tab | DesignOpsPage |
| 19 | Seed Default Workflows عند أول فتح | designWorkflowsService |

---

## 12. نقاط الربط مع باقي الـ App

| من | إلى | الـ Trigger |
|----|-----|------------|
| ContentOpsPage | DesignOpsPage | "إنشاء تصميم لهذا المحتوى" → يفتح workflow runner مع topic مملوء مسبقاً |
| PublisherPage  | DesignOpsPage | "استيراد من مكتبة التصاميم" → Asset Library picker |
| DesignOpsPage  | PublisherPage | "إرسال للـ Publisher" → `onSendToPublisher(asset)` في App.tsx |
| MarketingPlans | DesignOpsPage | "إنشاء باقة تصاميم الكمبانيا" → Campaign Pack workflow |

---

## 13. ملاحظات تقنية مهمة

### Brand Colors Injection
```typescript
// في buildFinalPrompt():
const brandColors = brandProfile.styleGuidelines
    .filter(g => g.toLowerCase().includes('color') || g.toLowerCase().includes('#'))
    .join(', ');
// fallback: "blue, white, modern"
```

### الـ Variants Generation
```typescript
// generateImageFromPrompt() بتُعيد صورة واحدة في كل call
// عشان 3 variants: بنعمل 3 calls بنفس الـ prompt
const [v1, v2, v3] = await Promise.all([
    generateImageFromPrompt(prompt, aspectRatio),
    generateImageFromPrompt(prompt, aspectRatio),
    generateImageFromPrompt(prompt, aspectRatio),
]);
// كل صورة: data URL → upload → DesignAsset
```

### الـ Data URL → Supabase Storage
```typescript
// نفس الـ pattern الموجود في AIImageGeneratorModal.tsx:
const res = await fetch(dataUrl);
const blob = await res.blob();
const file = new File([blob], `design-${Date.now()}.jpg`, { type: 'image/jpeg' });
const result = await uploadFile(file, 'design-assets', brandId);
```

### Per-Brand Isolation
- **كل DesignWorkflow مرتبطة بـ `brand_id`** — الوكالة تقدر تعمل workflows مختلفة لكل براند
- **Supabase RLS** بيضمن العزل التلقائي
- الـ Default Workflows بتُنشأ per-brand (مش global)

---

## 14. الـ .env Variables المطلوبة (موجودين بالفعل)

```bash
# موجودين بالفعل في المشروع
VITE_GEMINI_API_KEY=...          # لـ generateImageFromPrompt (Imagen 4.0)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# ناقصين ولازم يتضافوا
VITE_UNSPLASH_ACCESS_KEY=...    # stockPhotosService.ts سطر 30
VITE_PEXELS_API_KEY=...         # stockPhotosService.ts سطر 31
```

---

## 15. ملف التتبع — Checklist

### Phase 1: Foundation
- [ ] `types.ts` — إضافة DesignAsset, DesignWorkflow, DesignJob, DesignOpsStats
- [ ] `types.ts` — إضافة DESIGN_FORMAT_MAP constant
- [ ] `services/designAssetsService.ts` — CRUD كامل
- [ ] `services/designWorkflowsService.ts` — CRUD + seedDefaultWorkflows + buildFinalPrompt
- [ ] `services/designJobsService.ts` — create/update/get + runDesignJob
- [ ] Supabase: إنشاء table `design_assets`
- [ ] Supabase: إنشاء table `design_workflows`
- [ ] Supabase: إنشاء table `design_jobs`
- [ ] Supabase: إنشاء storage bucket `design-assets`

### Phase 2: Core Wiring
- [ ] `hooks/useDesignData.ts` — hook كامل
- [ ] `components/Sidebar.tsx` — إضافة 'design-ops' nav item
- [ ] `components/App.tsx` — import DesignOpsPage (lazy)
- [ ] `components/App.tsx` — useDesignData hook
- [ ] `components/App.tsx` — fetchDesignData في useEffect
- [ ] `components/App.tsx` — case 'design-ops' في switch
- [ ] `components/App.tsx` — onSendToPublisher handler
- [ ] `components/App.tsx` — skeleton case

### Phase 3: UI Components
- [ ] `components/pages/DesignOpsPage.tsx` — skeleton + 4 tabs
- [ ] `components/pages/DesignOpsPage.tsx` — Tab 1: Workflow cards grid
- [ ] `components/DesignWorkflowRunner.tsx` — step machine كاملة
- [ ] `components/DesignWorkflowRunner.tsx` — ربط generateImageFromPrompt
- [ ] `components/DesignWorkflowRunner.tsx` — رفع الـ variants على Storage
- [ ] `components/DesignWorkflowRunner.tsx` — variant selection UI
- [ ] `components/DesignWorkflowRunner.tsx` — review + save/send

### Phase 4: Asset Library & Polish
- [ ] `components/pages/DesignOpsPage.tsx` — Tab 2: Asset Library
- [ ] `components/pages/DesignOpsPage.tsx` — Upload drag & drop
- [ ] `components/pages/DesignOpsPage.tsx` — Stock Photos panel
- [ ] `components/pages/DesignOpsPage.tsx` — Tab 3: Recent Jobs
- [ ] `components/pages/DesignOpsPage.tsx` — Tab 4: Workflow Management (CRUD)
- [ ] Test: seed default workflows لـ brand جديدة
- [ ] Test: full workflow run من Step 1 → Publisher
- [ ] Test: upload asset → Asset Library
- [ ] Test: send design → Publisher → schedule

---

*آخر تحديث: أبريل 2026 | الحالة: جاهز للتنفيذ*
