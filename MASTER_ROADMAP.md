# 🗺️ SBrandOps — Master Development Roadmap
### خارطة الطريق الشاملة لبناء تطبيق كامل ومتكامل يعمل بشكل واقعي

> **الإصدار:** v2.0 — محدّث بناءً على تحليل كامل للكود
> **الهدف النهائي:** SaaS متكامل قادر على الـ Production يخدم وكالات التسويق ومتعدد البراندات
> **المستوى الحالي:** ~35% مكتمل (واجهة + خدمات أساسية) — باقي 65% إما Stub أو Mock أو مفقود

---

## 📊 تشخيص الوضع الحالي

### ✅ مكتمل وحقيقي (Real + Supabase)
| الخدمة/الصفحة | الوصف | الجاهزية |
|---|---|---|
| `brandService` | إنشاء وجلب البراندات | ✅ 90% |
| `socialAccountService` | إدارة الحسابات الاجتماعية | ✅ 85% |
| `contentOpsService` | pipeline المحتوى | ✅ 80% |
| `postsService` | CRUD للمنشورات | ✅ 85% |
| `storageService` | رفع الملفات على Supabase | ✅ 90% |
| `activityLogService` | سجل الأنشطة | ✅ 90% |
| `postAnalyticsService` | تحليلات المنشورات | ✅ 80% |
| `marketingPlansService` | خطط التسويق | ✅ 75% |
| `geminiService` | خدمات الذكاء الاصطناعي | ✅ 85% |
| `ContentOpsPage` | صفحة إدارة المحتوى | ✅ 931 سطر |
| `DashboardPage` | لوحة التحكم | ✅ 304 سطر |

### ⚠️ Hardcoded لـ Brand IDs ثابتة (لن تعمل مع brands حقيقية)
| الخدمة | المشكلة | الأولوية |
|---|---|---|
| `analyticsService` | بيانات ثابتة لـ brand-1/2/3 فقط | 🔴 Critical |
| `adsService` | hardcoded campaigns لـ brand-1/2/3 | 🔴 Critical |
| `gbpService` | Google Business بيانات ثابتة | 🔴 Critical |
| `brandHubService` | profiles محددة بـ IDs وهمية | 🔴 Critical |
| `errorCenterService` | أخطاء mock ثابتة | 🟡 Medium |

### ❌ Stub كامل (Mock فقط — لا يعمل في Production)
| الخدمة | الحالة | الأولوية |
|---|---|---|
| `adminService` | setTimeout + hardcoded data بالكامل | 🔴 Critical |
| `systemService` | mock users/subscription/sessions | 🔴 Critical |
| `tenantService` | 23 سطر — stub كامل | 🔴 Critical |
| `workflowService` | 19 سطر — stub كامل | 🟡 Medium |
| `integrationsService` | 11 سطر — stub كامل | 🟡 Medium |
| `inboxService` | mock conversations ثابتة | 🟡 Medium |
| `ideaOpsService` | mock ideas ثابتة | 🟡 Medium |
| `adAccountService` | mock ad accounts | 🟠 High |
| `brandMemoryService` | stub + تعليق "mock service" | 🟢 Low |

### ❌ Pages Stub (واجهة بدون منطق حقيقي)
| الصفحة | الحجم | المشكلة |
|---|---|---|
| `PublisherPage` | 15 سطر! | ما فيهاش publisher حقيقي |
| `WorkflowPage` | 27 سطر | عرض فقط بدون CRUD |
| `IntegrationsPage` | 32 سطر | عرض قائمة بدون اتصال |
| `SEOOpsPage` | 51 سطر | محدودة جداً |
| `AdsOpsPage` | 63 سطر | stub مع بيانات وهمية |

---

## 🚨 PHASE 0: Emergency Bug Fixes
### المدة: يومان | الأولوية: BLOCKER

**المشكلة:** هذه bugs ستمنع التطبيق من العمل خالص حتى لو كل حاجة تانية شغالة.

---

### 0.1 — إصلاح Gemini API Key Bug
**الهدف:** تشغيل كل features الذكاء الاصطناعي
**المشكلة:** `geminiService.ts` بيستخدم `process.env.API_KEY` — ده Node.js syntax، مش Vite
**الحل:**
```typescript
// ❌ الخطأ الحالي في geminiService.ts
const apiKey = process.env.API_KEY;

// ✅ الصح لـ Vite
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
```
**ملفات متأثرة:** `services/geminiService.ts`، `.env`
**الوقت:** ساعة واحدة

---

### 0.2 — إصلاح Hardcoded Brand IDs في الـ Services
**الهدف:** جعل كل brand تعمل بشكل مستقل بدل brand-1/2/3 الوهمية
**المشكلة:** `analyticsService`, `adsService`, `gbpService`, `brandHubService` كلها تحتوي على:
```typescript
const allData: Record<string, Data> = {
    'brand-1': { ... }, // hardcoded!
    'brand-2': { ... }, // hardcoded!
}
```
**الحل:** ربط كل service بـ Supabase tables حقيقية وجلب البيانات بـ `brandId` الفعلي
**الوقت:** 6-8 ساعات

---

### 0.3 — إصلاح RLS Policies في Supabase
**الهدف:** أمان حقيقي — كل مستخدم يشوف بياناته بس
**المشكلة:** `supabase_schema.sql` الـ policy الحالية:
```sql
-- ❌ خطير في Production
create policy "Enable all access for authenticated users"
  on public.brands for all using (auth.role() = 'authenticated');
```
**الحل:**
```sql
-- ✅ كل user يشوف brands الخاصة بيه بس
create policy "Users see own brands"
  on public.brands for all using (auth.uid() = user_id);
```
**الوقت:** 4 ساعات

---

### 0.4 — إضافة Error Boundaries
**الهدف:** منع crash كامل للتطبيق عند أي خطأ
**الحل:** إضافة React Error Boundary على مستوى كل page
**الوقت:** 3 ساعات

**إجمالي Phase 0:** ~2 يوم عمل
**النتيجة:** تطبيق يعمل بدون bugs حرجة

---

## 🔐 PHASE 1: Authentication & User Management
### المدة: أسبوع واحد | الأولوية: CRITICAL — لا يوجد بعده شيء بدون Auth

**الهدف:** بناء نظام تسجيل دخول كامل، multi-tenant، مع صلاحيات
**لماذا الآن؟** كل الـ services المتبقية تعتمد على `user_id` من الـ auth

---

### 1.1 — Auth Pages
**الوصف:** صفحات Login / Register / Forgot Password
**الملفات الجديدة:**
- `components/auth/LoginPage.tsx`
- `components/auth/RegisterPage.tsx`
- `components/auth/ForgotPasswordPage.tsx`
- `services/authService.ts`

**المنهجية:**
```typescript
// authService.ts — استخدام Supabase Auth
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
    });
    if (error) throw error;
    return data;
}
```
**الوقت:** 8 ساعات

---

### 1.2 — Auth Context & Protected Routes
**الوصف:** منع الوصول لأي صفحة بدون تسجيل دخول
**الملفات:**
- `context/AuthContext.tsx` — session state عالمي
- `components/auth/ProtectedRoute.tsx` — HOC للحماية

**المنهجية:**
```typescript
// AuthContext.tsx
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
        });
    }, []);

    return <AuthContext.Provider value={{ user, session }}>{children}</AuthContext.Provider>;
};
```
**الوقت:** 4 ساعات

---

### 1.3 — User Profile & Settings
**الوصف:** صفحة إعدادات المستخدم — الاسم، الصورة، كلمة المرور
**الملفات:**
- `components/pages/UserSettingsPage.tsx`
- Migration لجدول `user_profiles`

**الوقت:** 6 ساعات

---

### 1.4 — تحديث RLS لتعمل مع auth.uid()
**الوصف:** تطبيق Row Level Security الحقيقية
**Migration جديد:**
```sql
-- 004_proper_rls.sql
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.brands;

CREATE POLICY "Users can only see their own brands"
    ON public.brands FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
```
**الوقت:** 3 ساعات

**إجمالي Phase 1:** ~أسبوع
**النتيجة:** تطبيق آمن بتسجيل دخول حقيقي

---

## 🏗️ PHASE 2: Architecture Refactor
### المدة: أسبوعان | الأولوية: HIGH — بدونه التطبيق مش scalable

**الهدف:** إعادة هيكلة الكود لتحمّل النمو والصيانة

---

### 2.1 — React Router v6
**الوصف:** استبدال navigation بالـ useState بـ React Router حقيقي
**لماذا؟** بدون routing: لا يوجد deep links، لا browser back، لا URL sharing

**التغييرات:**
```bash
npm install react-router-dom
```

```typescript
// main.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

<BrowserRouter>
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="publisher" element={<PublisherPage />} />
            <Route path="scheduled" element={<ScheduledPage />} />
            <Route path="content-ops" element={<ContentOpsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="ads" element={<AdsOpsPage />} />
            <Route path="seo" element={<SEOOpsPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="brand-hub" element={<BrandHubPage />} />
            <Route path="workflows" element={<WorkflowPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="system" element={<SystemPage />} />
        </Route>
        <Route path="/admin/*" element={<AdminRoutes />} />
    </Routes>
</BrowserRouter>
```
**الوقت:** 12 ساعة

---

### 2.2 — React Query للـ Data Fetching
**الوصف:** استبدال `useEffect + useState` بـ React Query لـ caching وـ refetching تلقائي
**لماذا؟** حالياً كل مرة بتفتح صفحة بيـfetch من الأول — بطيء ومكلف

```bash
npm install @tanstack/react-query
```

```typescript
// hooks/useBrands.ts
export function useBrands() {
    return useQuery({
        queryKey: ['brands'],
        queryFn: getBrands,
        staleTime: 5 * 60 * 1000, // 5 دقائق cache
    });
}

// hooks/useAnalytics.ts
export function useAnalytics(brandId: string, period: string) {
    return useQuery({
        queryKey: ['analytics', brandId, period],
        queryFn: () => getAnalyticsData(brandId, { period, platforms: [] }),
        enabled: !!brandId,
    });
}
```
**الوقت:** 16 ساعة

---

### 2.3 — تقسيم App.tsx (God Component)
**الوصف:** تفتيت الـ 415 سطر لـ custom hooks منفصلة
**الملفات الجديدة:**
- `hooks/useBrandData.ts` — brand state + fetching
- `hooks/useAdminData.ts` — admin state + fetching
- `hooks/useNotifications.ts` — notifications management
- `hooks/usePostManagement.ts` — posts CRUD

**النتيجة:** `App.tsx` يوصل لـ 80-100 سطر فقط
**الوقت:** 10 ساعات

---

### 2.4 — Zustand للـ Global State
**الوصف:** state management مركزي للبيانات المشتركة بين الصفحات

```bash
npm install zustand
```

```typescript
// stores/brandStore.ts
export const useBrandStore = create<BrandStore>((set) => ({
    brands: [],
    activeBrand: null,
    setActiveBrand: (brand) => set({ activeBrand: brand }),
    setBrands: (brands) => set({ brands }),
}));
```
**الوقت:** 8 ساعات

**إجمالي Phase 2:** ~أسبوعان
**النتيجة:** كود maintainable وـ scalable

---

## 🗄️ PHASE 3: Real Data Layer
### المدة: أسبوعان | الأولوية: HIGH

**الهدف:** ربط كل الـ stub services بـ Supabase الحقيقي وبناء الـ schema الكامل

---

### 3.1 — Analytics Service (Real Data)
**الوصف:** استبدال hardcoded analytics بـ real data من `post_analytics` table
**Migration جديد:**
```sql
-- 005_analytics_aggregation.sql
CREATE TABLE public.brand_analytics_cache (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade,
    period text not null, -- '7d', '30d', '90d'
    platform text,
    total_followers integer,
    total_impressions bigint,
    total_engagement bigint,
    posts_published integer,
    calculated_at timestamptz default now()
);
```

**المنهجية:** دالة تجميع تُشغّل كل 6 ساعات أو عند طلب جديد (on-demand calculation)
**الوقت:** 12 ساعة

---

### 3.2 — Workflows Service (Full CRUD)
**الوصف:** بناء workflow builder حقيقي بـ Supabase
**Migration:**
```sql
CREATE TABLE public.workflows (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade,
    name text not null,
    description text,
    trigger_type text not null, -- 'post_scheduled', 'post_published', 'manual'
    is_active boolean default true,
    steps jsonb not null default '[]',
    created_at timestamptz default now()
);
```
**الوقت:** 10 ساعات

---

### 3.3 — Inbox Service (Real Conversations)
**الوصف:** ربط الـ inbox بـ Supabase table حقيقية
**المنهجية:** الـ `inbox_conversations` table موجودة في الـ schema — المطلوب إكمال الـ service

```typescript
// inboxService.ts — real implementation
export async function getConversations(brandId: string): Promise<InboxConversation[]> {
    const { data, error } = await supabase
        .from('inbox_conversations')
        .select('*, inbox_messages(*)')
        .eq('brand_id', brandId)
        .order('last_message_timestamp', { ascending: false });

    if (error) throw error;
    return data.map(mapToInboxConversation);
}
```
**الوقت:** 8 ساعات

---

### 3.4 — System Service (Real Users + Permissions)
**الوصف:** إدارة المستخدمين والأدوار بـ Supabase
**Migration:**
```sql
CREATE TABLE public.team_members (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade,
    user_id uuid references auth.users(id),
    role text default 'viewer', -- 'owner', 'admin', 'editor', 'viewer'
    invited_email text,
    status text default 'pending', -- 'active', 'pending', 'suspended'
    invited_at timestamptz default now()
);

CREATE TABLE public.api_keys (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id) on delete cascade,
    name text not null,
    key_hash text not null, -- bcrypt hash
    last_used_at timestamptz,
    created_at timestamptz default now()
);
```
**الوقت:** 10 ساعات

---

### 3.5 — Admin Service (Real Supabase Tables)
**الوصف:** بناء admin layer حقيقية تقرأ من الـ DB فعلياً
**Migration:**
```sql
CREATE TABLE public.tenants (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    owner_id uuid references auth.users(id),
    plan_id text references public.subscription_plans(id),
    status text default 'active',
    created_at timestamptz default now()
);

CREATE TABLE public.subscription_plans (
    id text primary key, -- 'starter', 'pro', 'agency'
    name text not null,
    price_monthly numeric,
    price_yearly numeric,
    max_brands integer,
    max_users integer,
    ai_tokens_monthly bigint,
    features jsonb
);
```
**المنهجية:** Admin service يستخدم Supabase Admin API (service_role key) للوصول للـ auth.users
**الوقت:** 14 ساعة

---

### 3.6 — Brand Hub Service (Persisted)
**الوصف:** حفظ واسترجاع Brand profiles الحقيقية لكل brand
**المنهجية:** الـ `brand_profiles` table موجودة — المطلوب إكمال الـ service ليحفظ ويجلب صح

```typescript
export async function getBrandHubProfile(brandId: string, brandName: string): Promise<BrandHubProfile> {
    const { data, error } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('brand_id', brandId)
        .single();

    if (error || !data) return getEmptyBrandProfile(brandName);
    return mapToBrandHubProfile(data, brandName);
}
```
**الوقت:** 6 ساعات

**إجمالي Phase 3:** ~أسبوعان
**النتيجة:** كل البيانات حقيقية من Supabase

---

## 📱 PHASE 4: Social Media Publishing (Real APIs)
### المدة: أسبوعان | الأولوية: HIGH — Core Value Proposition

**الهدف:** نشر حقيقي على جميع المنصات

---

### 4.1 — Facebook & Instagram Publishing
**الوصف:** نشر posts وصور على Facebook Pages وInstagram Business
**المتطلبات:**
- Facebook App with `pages_manage_posts` permission
- Instagram Basic Display API أو Graph API

**المنهجية:**
```typescript
// socialPublishingService.ts — Facebook Real Publishing
export async function publishToFacebook(post: ScheduledPost, account: SocialAccount): Promise<string> {
    const response = await fetch(
        `https://graph.facebook.com/v18.0/${account.pageId}/feed`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: post.content,
                access_token: account.accessToken,
            })
        }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.id; // platform_post_id
}
```

**التوكنات:** يجب تخزينها encrypted في Supabase — حقل `access_token` في `social_accounts`
**الوقت:** 14 ساعة

---

### 4.2 — Twitter/X Publishing
**الوصف:** نشر Tweets بالنص والصور
**API:** Twitter API v2 مع OAuth 2.0 PKCE
**المنهجية:**
```typescript
// platformPublishingService.ts
export async function publishToX(post: ScheduledPost, account: SocialAccount): Promise<string> {
    const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: post.content })
    });
    const data = await response.json();
    return data.data.id;
}
```
**الوقت:** 8 ساعات

---

### 4.3 — LinkedIn Publishing
**الوصف:** نشر على LinkedIn Pages وProfiles
**API:** LinkedIn Marketing API v2
**الوقت:** 10 ساعات

---

### 4.4 — Auto Publisher (Background Jobs)
**الوصف:** نشر تلقائي للمنشورات المجدولة
**المشكلة الحالية:** `autoPublisherService.ts` موجود لكن يعمل كـ polling في browser — مش production-ready
**الحل:** Supabase Edge Functions أو pg_cron

```sql
-- Supabase pg_cron job يشتغل كل دقيقة
SELECT cron.schedule(
    'publish-scheduled-posts',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://your-project.supabase.co/functions/v1/auto-publisher',
        headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'
    );
    $$
);
```

**الملفات الجديدة:**
- `supabase/functions/auto-publisher/index.ts` — Edge Function

**الوقت:** 12 ساعة

---

### 4.5 — OAuth Flow للتوكنات
**الوصف:** ربط حسابات Facebook/Instagram/X/LinkedIn بـ OAuth 2.0 حقيقي
**المنهجية:**
1. User يضغط "Connect Facebook"
2. Redirect لـ Facebook OAuth
3. Callback يحفظ access_token في Supabase
4. Token refresh تلقائي قبل انتهاء الصلاحية

**الوقت:** 16 ساعة

**إجمالي Phase 4:** ~أسبوعان
**النتيجة:** نشر حقيقي على كل المنصات

---

## 📊 PHASE 5: Analytics Real Data
### المدة: أسبوع ونص | الأولوية: HIGH

**الهدف:** تحليلات حقيقية من المنصات

---

### 5.1 — Platform Analytics Fetching
**الوصف:** جلب بيانات الأداء من كل منصة بعد النشر
**المنهجية:**
```typescript
// postAnalyticsService.ts — Real Data Fetching
export async function fetchAndSaveFacebookAnalytics(postId: string, platformPostId: string, pageToken: string) {
    const response = await fetch(
        `https://graph.facebook.com/v18.0/${platformPostId}/insights?metric=post_impressions,post_engaged_users,post_clicks&access_token=${pageToken}`
    );
    const data = await response.json();

    await supabase.from('post_analytics').upsert({
        post_id: postId,
        platform: 'Facebook',
        impressions: data.data.find(d => d.name === 'post_impressions')?.values[0]?.value ?? 0,
        engagement: data.data.find(d => d.name === 'post_engaged_users')?.values[0]?.value ?? 0,
    });
}
```
**الوقت:** 14 ساعة

---

### 5.2 — Analytics Dashboard (Real Charts)
**الوصف:** استبدال mock charts بـ real data من الـ database
**المكونات:**
- Follower growth chart من `social_accounts` history
- Engagement rate من `post_analytics`
- Top posts من actual performance data

**الوقت:** 10 ساعات

---

### 5.3 — Scheduled Analytics Reports
**الوصف:** إرسال تقارير أداء أسبوعية/شهرية
**الحل:** Supabase Edge Function + cron job
**الوقت:** 8 ساعات

**إجمالي Phase 5:** ~أسبوع ونص

---

## 🔧 PHASE 6: Complete Incomplete Pages
### المدة: أسبوعان | الأولوية: HIGH

**الهدف:** إكمال الصفحات الـ stub وتطوير الصفحات الناقصة

---

### 6.1 — PublisherPage (15 سطر → 400+ سطر)
**المشكلة:** `PublisherPage.tsx` = 15 سطر فقط! مجرد wrapper فاضي
**الوصف:** بناء publisher كامل مع:
- Rich text editor مع emoji picker
- Platform preview لكل منصة
- Media upload + crop + resize
- Schedule date/time picker
- Character counter per platform (Twitter 280، LinkedIn 3000، إلخ)
- Platform-specific settings (Instagram first comment، LinkedIn targeting)

**الوقت:** 20 ساعة

---

### 6.2 — WorkflowPage (27 سطر → 300+ سطر)
**الوصف:** بناء workflow builder حقيقي
**الميزات:**
- Drag-and-drop step builder
- Trigger types: post scheduled، content approved، manual
- Step types: approval، notification، auto-publish، delay
- Enable/disable workflows
- Workflow history/logs

**الوقت:** 20 ساعة

---

### 6.3 — IntegrationsPage (32 سطر → 200+ سطر)
**الوصف:** صفحة integrations حقيقية مع connect/disconnect
**الميزات:**
- Slack: إرسال notifications لـ channel عند publish أو approval
- Google Drive: استيراد صور من Drive للـ publisher
- Zapier: webhook trigger عند events
- Google Analytics: ربط UTM tracking

**المنهجية:** كل integration عندها:
1. Status (Connected / Disconnected)
2. Configuration settings
3. Test connection button
4. Activity log

**الوقت:** 16 ساعة

---

### 6.4 — SEOOpsPage (51 سطر → 300+ سطر)
**الوصف:** تطوير صفحة SEO لتصبح أداة حقيقية
**الميزات:**
- Google Search Console integration
- Keyword tracking
- Technical SEO audit (يعمل الـ `seoAuditService.ts` موجود)
- GBP (Google Business Profile) management كامل
- Local SEO score

**الوقت:** 18 ساعة

---

### 6.5 — AdsOpsPage (63 سطر → 400+ سطر)
**الوصف:** صفحة إدارة الإعلانات الكاملة
**الميزات:**
- Meta Ads integration (Facebook/Instagram)
- Campaign creation wizard (يعمل في `CreateCampaignWizard.tsx`)
- Real-time performance metrics (ROAS، CPA، CTR)
- Budget management
- AI-powered recommendations
- Ad creative generator (Gemini integration)

**الوقت:** 20 ساعة

**إجمالي Phase 6:** ~أسبوعان

---

## 👑 PHASE 7: Admin Panel (Real)
### المدة: أسبوع | الأولوية: MEDIUM-HIGH (for SaaS)

**الهدف:** تحويل admin panel من mock data لـ production-ready SaaS admin

---

### 7.1 — Tenant Management (Real)
**الوصف:** إدارة حقيقية للـ tenants/customers
**الميزات:**
- قائمة tenants من Supabase
- تفاصيل كل tenant (brands، users، subscription)
- Suspend / Activate tenant
- Usage limits enforcement

**الوقت:** 10 ساعات

---

### 7.2 — Billing & Subscription System
**الوصف:** نظام اشتراكات حقيقي
**الخيارات:**
- **Option A:** Stripe Integration (موصى به)
- **Option B:** Manual billing management

**Migration:**
```sql
CREATE TABLE public.subscriptions (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid references public.tenants(id),
    plan_id text references public.subscription_plans(id),
    stripe_subscription_id text,
    status text default 'active', -- 'active', 'past_due', 'cancelled'
    current_period_start timestamptz,
    current_period_end timestamptz,
    created_at timestamptz default now()
);
```
**الوقت:** 16 ساعة

---

### 7.3 — AI Usage Monitoring (Real)
**الوصف:** تتبع استخدام الـ Gemini tokens فعلياً لكل tenant
**المنهجية:** في كل Gemini API call يتم تسجيل الـ tokens المستخدمة

```typescript
// geminiService.ts — token tracking
async function callGemini(prompt: string, brandId: string, feature: string) {
    const response = await ai.models.generateContent({...});

    // تسجيل الاستخدام في الـ DB
    await supabase.from('ai_usage_logs').insert({
        brand_id: brandId,
        feature,
        tokens_used: response.usageMetadata?.totalTokenCount ?? 0,
        latency_ms: Date.now() - startTime,
    });

    return response;
}
```
**الوقت:** 8 ساعات

---

### 7.4 — System Health (Real)
**الوصف:** monitoring حقيقي لصحة النظام
**الميزات:**
- Supabase connection status
- Failed jobs count
- API error rates
- Active sessions count

**الوقت:** 6 ساعات

**إجمالي Phase 7:** ~أسبوع

---

## 🤖 PHASE 8: AI Features Enhancement
### المدة: أسبوع | الأولوية: MEDIUM-HIGH

**الهدف:** تعميق وتطوير features الـ AI الحالية

---

### 8.1 — Brand Memory System (Real)
**الوصف:** AI يتعلم من كل تفاعل ويحسّن اقتراحاته للـ brand
**المشكلة:** `brandMemoryService.ts` = 13 سطر stub
**المنهجية:**
```sql
CREATE TABLE public.brand_memory (
    id uuid primary key default uuid_generate_v4(),
    brand_id uuid references public.brands(id),
    memory_type text, -- 'successful_post', 'failed_post', 'audience_preference', 'tone_correction'
    content text not null,
    embedding vector(1536), -- للـ semantic search
    metadata jsonb,
    created_at timestamptz default now()
);
```
**الوقت:** 12 ساعة

---

### 8.2 — AI Content Scoring
**الوصف:** Gemini يقيّم المحتوى قبل النشر ويعطي score 0-100
**المعايير:** Brand consistency، readability، engagement potential، SEO
**الوقت:** 8 ساعات

---

### 8.3 — Smart Scheduling (Real)
**الوصف:** تحليل best posting times بناءً على analytics الفعلية للـ brand
**المنهجية:** بدل recommendations عامة، تحليل متى حصلت أعلى engagement للـ brand تحديداً
**الوقت:** 6 ساعات

---

### 8.4 — AI Caption Variations A/B Testing
**الوصف:** نشر نسختين من المنشور وقياس أيهما أحسن
**الوقت:** 10 ساعات

**إجمالي Phase 8:** ~أسبوع

---

## 🧪 PHASE 9: Testing & Quality
### المدة: أسبوع | الأولوية: MEDIUM

**الهدف:** ضمان استقرار وجودة التطبيق

---

### 9.1 — Unit Tests للـ Services
```bash
npm install -D vitest @testing-library/react
```

**المنهجية:** test كل service function مع mock للـ Supabase client
**التغطية المطلوبة:** 60%+ للـ services الحرجة
**الوقت:** 16 ساعة

---

### 9.2 — Integration Tests للـ Critical Flows
**الـ flows المهمة:**
1. Login → Select Brand → Publish Post
2. Create Content → Approve → Send to Publisher
3. Connect Social Account → View Analytics

**الوقت:** 12 ساعة

---

### 9.3 — Performance Optimization
**الأدوات:** Lighthouse، React DevTools Profiler
**المشاكل المتوقعة:**
- Bundle size كبير (kمعظم الـ pages تُحمَّل مرة واحدة)
- الحل: Lazy loading لكل صفحة

```typescript
// App.tsx — Lazy loading
const ContentOpsPage = lazy(() => import('./pages/ContentOpsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
```
**الوقت:** 8 ساعات

---

### 9.4 — Error Monitoring
**الأداة:** Sentry.io (مجاني للـ small projects)
```bash
npm install @sentry/react
```
**الوقت:** 4 ساعات

**إجمالي Phase 9:** ~أسبوع

---

## 🚀 PHASE 10: Deployment & DevOps
### المدة: 3 أيام | الأولوية: MEDIUM

**الهدف:** نشر التطبيق على production

---

### 10.1 — Environment Setup
**الملفات المطلوبة:**
```env
# .env.production
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GEMINI_API_KEY=AIza...
VITE_FACEBOOK_APP_ID=123456789
VITE_APP_URL=https://sbrandops.com
```
**الوقت:** 2 ساعات

---

### 10.2 — Vercel / Netlify Deployment
**الأداة الموصى بها:** Vercel (مجاني للـ hobby projects)
```bash
npm i -g vercel
vercel deploy
```
**الوقت:** 2 ساعات

---

### 10.3 — Supabase Production Setup
**المهام:**
- Enable Email Auth في Supabase dashboard
- تفعيل Row Level Security على كل الجداول
- إعداد SMTP للـ email verification
- Database backups

**الوقت:** 4 ساعات

---

### 10.4 — CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci && npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```
**الوقت:** 3 ساعات

**إجمالي Phase 10:** 3 أيام

---

## 📅 الجدول الزمني الإجمالي

| Phase | الاسم | المدة | الأولوية | الحالة |
|-------|-------|-------|----------|--------|
| **0** | Emergency Bug Fixes | يومان | 🔴 BLOCKER | ❌ |
| **1** | Authentication | أسبوع | 🔴 Critical | ❌ |
| **2** | Architecture Refactor | أسبوعان | 🟠 High | ❌ |
| **3** | Real Data Layer | أسبوعان | 🟠 High | ❌ |
| **4** | Social Publishing APIs | أسبوعان | 🟠 High | ❌ |
| **5** | Analytics Real Data | أسبوع ونص | 🟡 Medium-High | ❌ |
| **6** | Complete Pages | أسبوعان | 🟡 Medium-High | ❌ |
| **7** | Admin Panel Real | أسبوع | 🟡 Medium | ❌ |
| **8** | AI Enhancement | أسبوع | 🟡 Medium | ❌ |
| **9** | Testing & Quality | أسبوع | 🟡 Medium | ❌ |
| **10** | Deployment | 3 أيام | 🟢 Low-Med | ❌ |

**الإجمالي:** ~14 أسبوع (3.5 أشهر) لمطور واحد full-time
**مع فريق 2 مطورين:** ~8 أسابيع (شهرين)

---

## 💰 ملخص الـ Dependencies والتكاليف

| الخدمة | الغرض | التكلفة |
|--------|--------|---------|
| Supabase Pro | DB + Auth + Storage | $25/شهر |
| Vercel Pro | Hosting | $20/شهر |
| Gemini API | AI | حسب الاستخدام (~$10-50/شهر) |
| Facebook/Meta API | Publishing | مجاني |
| Twitter API Basic | Publishing | $100/شهر |
| Sentry | Error monitoring | مجاني للـ small scale |
| Stripe | Billing | 2.9% per transaction |

**الإجمالي:** ~$155-200/شهر fixed costs + variable AI costs

---

## 🎯 نقاط القرار المهمة (Decision Points)

### 1. هل تبني Twitter/X Integration؟
التكلفة $100/شهر — قرر بناءً على إذا عملاؤك يستخدمون X فعلاً

### 2. Multi-tenant vs Single-tenant في البداية؟
توصية: ابدأ بـ single-tenant (SaaS لوكالة واحدة هي وكالتك) وضيف multi-tenancy لما يكون عندك عملاء يدفعون

### 3. TikTok Publishing؟
TikTok API للـ publishing محدود جداً وبيحتاج Partner approval — خليه priority낮 منخفض

### 4. Mobile App؟
الكود الحالي React Web فقط — لو مهم، Capacitor أو React Native هيكون Phase 11

---

## ✅ Immediate Next Steps (الأسبوع القادم)

```
Day 1: Phase 0.1 — إصلاح Gemini API Key (ساعة)
Day 1: Phase 0.2 — إصلاح hardcoded brand IDs في analyticsService (4 ساعات)
Day 1: Phase 0.3 — إصلاح RLS policies (3 ساعات)
Day 2: Phase 1.1 — بناء LoginPage + authService (8 ساعات)
Day 3: Phase 1.2 — AuthContext + Protected Routes (4 ساعات)
Day 4: Phase 1.3 — تحديث RLS بـ auth.uid() (3 ساعات)
Day 5: Phase 2.1 — إضافة React Router (12 ساعة — يتنهى يوم 6)
```

---

*📅 آخر تحديث: مارس 2026 — بناءً على تحليل كامل لـ SBrandOps v1.0541*
