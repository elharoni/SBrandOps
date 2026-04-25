# SBrandOps — Cowork Knowledge Base (v1.0541)

> ملف مرجعي شامل عن التطبيق — كود + تجاري + عميل — مستخرج من تحليل كامل للريبو (~55,680 سطر، 75 service، 36+11 صفحة، 51 migration، 21 Edge Function).
> تاريخ التجميع: 2026-04-25 | المالك: عبدالرحمن الحاروني (Founder/Operator) | للاستخدام كـ context يومي مع Cowork.

---

## 0) TL;DR — ايه هو SBrandOps؟

- **Category:** Multi-tenant, Multi-brand Brand Operating System (Brand-OS) للوكالات والـ in-house brand teams.
- **One-liner (AR):** نظام تشغيل البراند — يجمع المحتوى، السوشيال، الإعلانات، الـ SEO، CRM، والتحليلات في workspace واحد مدعوم بـ AI.
- **One-liner (EN):** A unified Brand Operating System: plan, publish, advertise, optimize, and report — across every brand from one workspace.
- **Stage:** v1.0541 — Internal Beta. **مش جاهز إنتاج لأي عميل دافع** قبل ما يخلص الـ 7-day hardening sprint (تفاصيل في القسم 13).
- **Scope vs Competitors:** سطح التطبيق يساوي Hootsuite + Buffer + SEMrush + HubSpot في app واحد — ميزة competitive ضخمة لكن debt تشغيلي عالي.
- **Differentiators:**
  1. عربي/إنجليزي كامل + RTL/LTR (الوحيد في فئته).
  2. AI native (Gemini 2.5 Flash/Pro) مدمج في كل module.
  3. Brand Brain — ذاكرة براند موحّدة تتغذى منها كل الـ AI prompts.
  4. سعر تنافسي (Starter $29 vs Hootsuite ~$99).

---

## 1) Identity & Positioning

| البُعد | القيمة |
|---|---|
| **Product Name** | SBrandOps |
| **Founder** | Abdelrahman Elharoni (عبدالرحمن الحاروني) |
| **Sister entities** | SMA Marketing (وكالة) + 5 براندات داخلية (يستخدمون التطبيق كـ dogfood). |
| **Brand voice (philosophy)** | "Operational Topography" — مدرسة بصرية ترسم المنظومات بدقة كارتوغراف بحري: شبكة، مقاييس، contour lines، مساحة سلبية، حبر navy داكن، لمسة دافئة واحدة. |
| **Visual stack** | Tailwind + design-tokens + theme-factory; dark/light + RTL/LTR. |
| **Languages** | Arabic (default) + English — 500+ keys per language across 21 sections. |

---

## 2) The Nine Operational Domains (مكونات المنتج)

التطبيق منظم حول **6 Pillars** + 3 Ops layers (إجمالي 9 domains):

### 2.1 Brand Brain Pillar — هوية وذاكرة البراند
- **Brand Hub** — identity, voice, audiences, values, do/don'ts → `BrandHubPage` (1,087 LOC).
- **Brand Knowledge** — knowledge base قابلة للبحث per brand → `BrandKnowledgePage`.
- **Platform Brain** — ذاكرة الـ AI بتتغذى من السلوك الفعلي.
- **Brand Brain Review** — موافقة على ما تعلّمه الـ AI قبل ما يستخدمه.
- **Brand Analysis** — تحليل آلي للهوية والـ consistency score.

### 2.2 Content Engine Pillar
- **Media Ops** (`MediaOpsPage` 966 LOC) — تخطيط creative briefs، ideas matrix، tracks (design/video/copy)، review levels.
- **Content Studio** (1,199 LOC) — توليد + تحرير محتوى بالـ AI.
- **Idea Bank** (`IdeaOpsPage`) — bank of brainstormed ideas + test plans.
- **Content Pipeline** (`ContentOpsPage` 1,520 LOC) — kanban: idea → draft → review → approved → published.
- **Marketing Plans** (`MarketingPlansPage` 997 LOC) — خطط شهرية/فصلية + مهام أسبوعية.
- **Design Ops** (`DesignOpsPage` 662 LOC) — workflows للتصميم + AI image (Imagen 4.0) + asset registry.
- **Video Studio** — short-form video scripts/briefs.
- **Asset Library** (793 LOC) — مكتبة الأصول per brand.

### 2.3 Social Ops Pillar
- **Publisher** (`Publisher.tsx` 1,032 LOC) — composer متعدد المنصات.
- **Scheduled** — قائمة المنشورات المجدولة + إعادة جدولة.
- **Calendar** (722 LOC) — تقويم تشغيلي.
- **Accounts** — إدارة الـ OAuth + connection health.
- **Social Search** — بحث اجتماعي + watchlist.
- **منصات مدعومة:** Facebook, Instagram, Twitter/X, LinkedIn, TikTok.
- **Engine:** `pg_cron` كل دقيقة → `auto-publisher` Edge Function → `publish-now` بـ retries (3 محاولات: 0/5/20 ثانية) + advisory locks (مضافة بعد بـ P1 fix).

### 2.4 Inbox & CRM Pillar
- **Inbox** (876 LOC) — DMs + comments موحّدة + sentiment pipeline + saved replies + auto-replies.
- **CRM** (1,265 LOC services + 4 صفحات: Dashboard / Customers / Pipeline / Tickets / Deals) — lifecycle, RFM scoring, retention cohorts, churn trends, cross-sell opportunities, automations triggers.
- **Tickets** — support layer.
- **E-commerce sync** — Shopify (590 LOC) + WooCommerce (514 LOC) للمنتجات والطلبات.

### 2.5 Ads Ops Pillar
- **AdsOpsPage** (551 LOC) — Google Ads + Meta Ads.
- **Campaigns** + **Recommendations** + **ROAS/CPA tracking** + **AI creative generator**.
- **Targeting suggestions** بـ AI.

### 2.6 SEO Ops Pillar
- **SEOOpsPageV2** (1,718 LOC) — keyword tracking, page audits, SERP, GSC integration, content briefs, cannibalization, decay, orphan pages, opportunities.
- **`seoIntelligenceService`** (2,303 LOC) — أكبر service في الـ codebase.

### 2.7 Analytics Hub
- **AnalyticsPage** (954 LOC) — GA4 + Search Console + post-level + brand-level.
- **AI insights** — موجز تنفيذي يقترح الخطوة التالية.

### 2.8 Integrations & Workflow Layer
- **IntegrationsPage** (1,662 LOC).
- **Integration OS** (Asset Registry 526 LOC).
- **Workflow** (563 LOC) — automations + flows.
- **Skill Engine** (`skillEngine.ts` 315 LOC) — يصنف الـ task ويوجّهه للنموذج المناسب (gemini-2.5-flash vs pro).

### 2.9 Admin Console
11 صفحة admin: Dashboard, Users, Tenants (1,430 LOC), Billing (1,354 LOC), AI Monitor, AI Provider Keys, Queues, System Health, Settings, Logs, Data Analytics.

---

## 3) Tech Stack — تفاصيل الكود

### 3.1 Frontend
- **React 19.2** + TypeScript 5.8 strict + Vite 6.
- **Routing:** React Router v7.13 (lazy + Suspense + Error Boundaries per route — مضافة بعد refactor).
- **State:** Zustand (brandStore, uiStore) + TanStack React Query 5.95 (server cache).
- **Styling:** Tailwind 3.4 + design-tokens + index.css (20,685 سطر CSS variables).
- **Charts:** Recharts 3.3.
- **Monitoring:** Sentry React 10.46.
- **i18n:** Custom — `LanguageContext` + `locales/ar.ts` + `locales/en.ts`.

### 3.2 Backend
- **Supabase (Postgres + Auth + Storage + Edge Functions Deno).**
- **AI:** Google Gemini (`@google/genai`) عبر Edge Function proxy فقط (ai-proxy) — مفيش key على الـ client بعد الـ hardening.
- **Billing:** Paddle (sandbox + live).
- **Cron:** `pg_cron` + `pg_net` extensions داخل Postgres.

### 3.3 Edge Functions (21)
| Function | الغرض |
|---|---|
| `ai-proxy` | كل استدعاءات Gemini — يطبق quota + spend cap. |
| `auto-publisher` | يلتقط `scheduled_posts` كل دقيقة. |
| `publish-now` | نشر فوري + idempotency keys. |
| `connect-accounts` / `manage-social-account` / `provider-oauth-callback` | OAuth flows لكل المنصات. |
| `provider-webhook` | inbound من المنصات (HMAC verified). |
| `paddle-checkout` / `paddle-webhook` (+retry/auto-retry) / `paddle-billing-manage` | Billing. |
| `analytics-aggregator` / `data-sync` | Service-role only — مزامنة دورية. |
| `today-summary` | ملخص يومي per tenant. |
| `monitor-health` | health probe (cron lag, webhook fail rate, publish fail rate). |
| `token-refresh` | تجديد OAuth tokens قبل انتهائها. |
| `google-oauth` | callback مخصص لـ GSC/GA4. |

### 3.4 Database (51 migrations)
**جداول رئيسية (~27 جدول):**
- **Multi-tenant core:** `tenants`, `subscription_plans`, `brands`, `brand_members`, `brand_profiles`, `payment_records`.
- **Social:** `social_accounts`, `oauth_tokens` (مشفّر AES-256-GCM)، `scheduled_posts`, `post_analytics`, `post_analytics_rollups`, `platform_publish_results`.
- **Content:** `content_pieces`, `marketing_plans`, `marketing_plan_details`, `media_projects`, `creative_briefs`, `idea_matrix`.
- **CRM:** `crm_customers`, `crm_orders`, `crm_deals`, `crm_tasks`, `crm_segments`, `crm_automations`, `crm_roles`.
- **SEO:** `seo_markets`, `seo_pages`, `seo_keywords`, `seo_keyword_clusters`, `seo_issues`, `content_briefs`, `seo_change_logs`.
- **Ads:** `ad_campaigns`, `ad_creatives`, `ad_accounts`.
- **Inbox:** `inbox_conversations`, `inbox_messages`, `saved_replies`, `inbox_sentiment_pipeline`.
- **Brain:** `brand_knowledge`, `brand_memory`, `skill_definitions`, `skill_executions`, `evaluation_signals`.
- **Ops:** `activity_logs`, `notifications`, `ai_usage_logs`, `idempotency_keys`, `link_shortener`, `link_clicks`.
- **Design:** `design_assets`, `design_workflows`, `design_jobs`, `asset_registry`, `media_projects`.
- **Cron:** `auto_publisher_cron`, `data_sync_cron`, `token_refresh_cron`.

**Security:** RLS مفعّل على كل الجداول، tenant/brand-scoped policies، OAuth tokens مشفّرة (pgcrypto + AES-256-GCM)، JWT verification على كل Edge Functions، CORS allowlist، HMAC على webhooks.

---

## 4) Commercial Model — الجانب التجاري

### 4.1 Pricing & Plans (USD, monthly | yearly)
| Plan | Price | Trial | Brands | Users | AI Tokens/mo | Audience | Badge |
|---|---|---|---|---|---|---|---|
| **Starter** | $29 / $290 | 14d | 1 | 2 | 1,000,000 | Solo operator / single brand | — |
| **Growth** | $99 / $990 | 14d | 5 | 10 | 5,000,000 | Multi-channel growth team | **Recommended** |
| **Agency** | $249 / $2,490 | 14d | 25 | 50 | 10,000,000 | Agencies + portfolio operators | — |
| **Enterprise** | Custom | — | ∞ | ∞ | 50,000,000+ | SSO / regulated / migration | **Custom** |

**يضاف لها:** سنوي = 10× الشهري (شهرين هدية فعلياً).

### 4.2 Plan Feature Matrix
- **Starter:** 1 brand workspace · Calendar + Publishing · Basic analytics · Starter AI credits · Core team access.
- **Growth:** كل Starter + Ads analytics + SEO writer + briefs + Inbox lite + workflow automations + advanced reporting.
- **Agency:** كل Growth + Multi-brand + Roles/permissions/approvals + webhook logs + higher ceilings.
- **Enterprise:** كل Agency + Custom onboarding + SSO + security review + custom integrations + commercial agreement.

### 4.3 Quotas & Enforcement
- **AI tokens** — server-side check في `ai-proxy` + headers `X-Tokens-Used-Today` / `X-Tokens-Limit-Today`.
- **AI daily cap** — افتراضي 100,000 token/day/user (env `AI_DAILY_TOKEN_LIMIT`).
- **Brand limit** — atomic check في `addBrand()` بناءً على `tenants.plan_id`.
- **Seat limit** — `inviteUser()` يعدّ active+pending مقابل `max_users`.
- **Trial** — `tenants.trial_ends_at` → `ai-proxy` يرجّع 403 لو منتهي/معلّق/ملغى.

### 4.4 Billing Stack
- **Paddle (Merchant of Record)** — checkout + invoices + tax handling.
- **Webhooks:** `paddle-webhook` + retry queue + auto-retry cron — HMAC verified، fail-closed لو الـ secret غايب.
- **Refund/Cancel:** عبر portal Paddle (SBrandOps يفتح link).
- **Records:** `payment_records` per tenant (status: paid/failed/refunded).
- **Plan changes:** in-app upgrade modal + portal external.

### 4.5 Commercial Loops & Gaps
| Loop | الحالة |
|---|---|
| Trial → Paid (state machine) | ✅ شغّال (يحجز ai-proxy، modal upgrade ظاهرة عند انتهاء/تجاوز quota). |
| Paid → Expand (upsells) | ⚠️ AI usage logs موجودة لكن الـ "you're at 80%" alert مضاف بـ headers — UI بيستخدمها. |
| At-risk → Retain (churn) | ❌ مفيش engagement scoring، ولا at-risk list في Admin Console. |
| Referral / Affiliate | ❌ فيه `ReferralWidget.tsx` (88 سطر) — placeholder، مش متفعّل. |
| MER/ROAS DB views | ✅ migration 024 (`v_tenant_summary`, `v_tenant_ai_usage_month`, `v_tenant_brand_counts`). |

### 4.6 Unit Economics Frame (للـ Founder operating)
- **CAC target:** غير محدد بعد — لازم تتحدد بعد أول 10 paying tenants.
- **LTV proxy:** متوسط ARPU × Gross Margin × 1/Churn — الـ instrumentation موجود (Paddle + analytics) لكن الـ dashboard في Admin Console ناقص.
- **Gross Margin drivers:** Gemini API spend (أكبر cost variable) + Supabase + Paddle fees.
- **Cost gate الذكي:** الـ AI cap اليومي يمنع تنزيف من user واحد لكن **مفيش tenant-level monthly $ cap هارد** — موصى به في AUDIT.

---

## 5) Customer-Facing UX — رحلة العميل

### 5.1 Public Marketing Site (`MarketingSite.tsx` 1,032 LOC)
صفحات: home, about, pricing, billing, contact, security, terms, privacy, dpa, refunds, cookies.

**Hero pillars:** Brand Hub · Content Ops · Social Ops · Ads Ops · SEO Ops · Analytics Hub.

**Case studies (mocked):** 3.4× سرعة التنفيذ · 42% تحسين قرار القنوات المدفوعة · 1 workspace.

**FAQ:** عربي؟ نعم. تعدد براند؟ نعم في الخطط الأعلى. Trial؟ نعم. إلغاء؟ نعم من Billing Center.

### 5.2 Onboarding Journey
1. Sign-up (email+password أو Google OAuth).
2. WelcomeModal + OnboardingTour.
3. BrandOnboardingWizard (605 LOC) — اسم، صناعة، voice، أصول.
4. ConnectAccountModal — أول OAuth.
5. أول Scheduled post.

### 5.3 Authenticated App Shell
- **Sidebar** بـ 9 sections: Command, Brand Brain, Content Engine, Publishing & Social, Inbox & Replies, Ads Intelligence, SEO & Website, Analytics & Growth, Operations.
- **MobileBottomNav** + MobileHomePage (291 LOC) — تجربة هاتف partial.
- **Header** فيه: تبديل لغة + theme + notifications panel + integration health.
- **CommandPalette** (lazy) — بحث سريع.

### 5.4 Recurring User Sessions
- **Dashboard** (1,009 LOC) — Operator metrics tiles, priority cards, alerts, suggestions, today summary.
- **Today Summary** — Edge Function مختصرة لكل tenant.
- **Notifications panel** + smart notifications service (459 LOC) — قواعد قابلة للتخصيص.

### 5.5 Persona-level use cases
| Persona | يستخدم إيه أساساً |
|---|---|
| **Solo Operator (Starter)** | Dashboard · Publisher · Calendar · Analytics light · Brand Hub. |
| **Growth team (Growth)** | Content Pipeline · Ads Ops · SEO briefs · Inbox · Marketing Plans. |
| **Agency (Agency)** | Multi-brand switcher · Approvals/roles · Webhook logs · CRM · Tickets · Reports. |
| **Enterprise** | كله + SSO + custom onboarding. |

---

## 6) Differentiators vs Competitors (للـ pitch)

| الميزة | SBrandOps | Hootsuite | Buffer | Sprout | Metricool |
|---|---|---|---|---|---|
| 5+ منصات نشر | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI native (Gemini) | ✅ deep | ⚠️ | ⚠️ | ⚠️ | ❌ |
| Arabic native + RTL | ✅ | ❌ | ❌ | ❌ | ❌ |
| SEO in same workspace | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| CRM + Inbox | ✅ | ⚠️ | ❌ | ✅ | ❌ |
| Ads Ops + ROAS | ✅ | ⚠️ | ❌ | ⚠️ | ✅ |
| Brand Brain memory | ✅ unique | ❌ | ❌ | ❌ | ❌ |
| Multi-brand by design | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |
| Price entry | $29 | $99 | $15 | $249 | $18 |

**الـ moats الحقيقية:**
1. السوق العربي (لا يوجد منافس native).
2. Integration depth (9 domains مش 1).
3. Brand Brain memory layer (لا يوجد عند المنافسين).

---

## 7) Risks / Production-Readiness Snapshot

من AUDIT_REPORT.md (Senior Full-Stack + SaaS Reviewer):

### 7.1 Scores (out of 10)
- Overall: **4.5** | Code Quality: 5 | Architecture: 4.5 | Database: 6 | UX/UI: 5 | Product Readiness: 5.5 | Security: 2 | Production Readiness: 3.5.

### 7.2 معظم الـ Critical اتقفل (راجع TODO.md)
- ✅ Gemini key rotated + moved to ai-proxy.
- ✅ `import.meta.env.DEV` admin escalation removed.
- ✅ JWT verification on all user-facing Edge Functions.
- ✅ OAuth tokens encrypted (AES-256-GCM).
- ✅ RLS policies fixed (migration 044).
- ✅ Paddle webhook fail-closed.
- ✅ CORS allowlist instead of `*`.
- ✅ Idempotency on `publish-now`.
- ✅ Auto-publisher race fixed (advisory lock).
- ✅ Server-side quota + AI spend cap.
- ✅ Gitleaks + npm audit + ESLint + monitor-health alerts.

### 7.3 لسه فاضل (P0/P1 المتبقي)
- ❌ Smoke tests (login, connect, schedule, publish, billing).
- ❌ E2E (Playwright).
- ❌ Partitioning لـ activity_logs / ai_usage_logs / post_analytics لما تكبر.
- ❌ WCAG 2.1 AA pass (icon-button labels تم، باقي contrast + focus traps).
- ❌ Mobile critical flows (publishing on mobile).
- ❌ At-risk tenant scoring في Admin.
- ❌ Engagement-based churn signals.

---

## 8) Operational Topology — كيف بتشتغل الحاجات سوا

```
[User] → React SPA → Supabase Auth (JWT) ─┬─> Postgres (RLS) ─┐
                                          │                    │
                                          ├─> Edge Functions ──┼─> Gemini (ai-proxy)
                                          │   (JWT + own check)│
                                          │                    ├─> Social APIs (FB/IG/X/LI/TT)
                                          │                    │
                                          └─> Storage (media)  └─> Paddle (billing)

[pg_cron] every minute ─> auto-publisher ─> publish-now ─> social APIs
[pg_cron] every 6h     ─> data-sync       ─> analytics_aggregator
[pg_cron] every 12h    ─> token-refresh   ─> oauth_tokens table
[pg_cron] hourly       ─> monitor-health  ─> Slack alerts
```

---

## 9) Files & LOC Heatmap (الأكبر = الأهم تشغيلياً)

| File | LOC | الدور |
|---|---|---|
| `services/geminiService.ts` | 2,467 | كل Gemini calls (proxied via ai-proxy). |
| `services/seoIntelligenceService.ts` | 2,303 | محرك SEO الكامل. |
| `components/pages/SEOOpsPageV2.tsx` | 1,718 | UI لـ SEO. |
| `components/pages/IntegrationsPage.tsx` | 1,662 | OAuth UI لكل المنصات. |
| `components/pages/ContentOpsPage.tsx` | 1,520 | Content pipeline. |
| `components/admin/pages/TenantsPage.tsx` | 1,430 | Admin tenants. |
| `components/admin/pages/BillingPage.tsx` | 1,354 | Admin billing. |
| `services/providerConnectionService.ts` | 1,275 | OAuth orchestration. |
| `services/crmService.ts` | 1,265 | CRM core. |
| `components/pages/ContentStudioPage.tsx` | 1,199 | Content studio. |
| `components/pages/BrandHubPage.tsx` | 1,087 | Brand identity UI. |
| `components/Publisher.tsx` | 1,032 | Composer multi-platform. |
| `components/marketing/MarketingSite.tsx` | 1,032 | الموقع العام. |
| `components/pages/DashboardPage.tsx` | 1,009 | Operator command center. |

**Total:** ~55,680 LOC | 75 services | 36 user pages + 11 admin pages.

---

## 10) Domain Model Highlights (للـ data discussions)

### 10.1 Multi-tenancy
```
tenant (1) ──< brand (N) ──< brand_member (N) ──> auth.users
                  │
                  ├──< social_account ──< oauth_token (encrypted)
                  ├──< scheduled_post ──< platform_publish_result
                  ├──< post_analytics → post_analytics_rollups
                  ├──< content_piece (status: idea→draft→review→approved→published)
                  ├──< marketing_plan ──< marketing_plan_detail
                  ├──< brand_knowledge / brand_memory (Brain)
                  ├──< crm_customer ──< crm_order ──< crm_order_item
                  ├──< crm_deal / crm_task / crm_automation
                  ├──< seo_market ──< seo_page / seo_keyword
                  ├──< ad_campaign ──< ad_creative
                  ├──< design_asset / design_workflow / design_job
                  ├──< media_project ──< creative_brief / idea_matrix
                  ├──< inbox_conversation ──< inbox_message
                  └──< activity_log / ai_usage_log
```

### 10.2 Key enums (types.ts — 213 exports total)
- **SocialPlatform**: Facebook | Instagram | Twitter | LinkedIn | TikTok.
- **PostStatus**: draft | scheduled | publishing | published | failed.
- **CampaignStatus**: active | paused | completed | draft.
- **CampaignGoal**: awareness | engagement | leads | sales | retention.
- **ContentStatus** | **CrmLifecycleStage** | **CrmOrderStatus** | **CrmTaskStatus** | **SeoArticleStatus** | **DesignJobStatus** | **MediaProjectStatus**.

---

## 11) Glossary (مختصرات اللي ممكن تيجي في المحادثة)

- **MER** — Marketing Efficiency Ratio = Revenue ÷ Total Ad Spend.
- **ROAS** — Return on Ad Spend.
- **CPA** — Cost per Acquisition.
- **CVR** — Conversion Rate.
- **GSC** — Google Search Console.
- **GA4** — Google Analytics 4.
- **GBP** — Google Business Profile.
- **RLS** — Row Level Security (Postgres).
- **HMAC** — Hash-based Message Authentication Code (webhook signing).
- **IDOR** — Insecure Direct Object Reference.
- **VPAT** — Voluntary Product Accessibility Template.
- **SOC2** — Audit framework (Type 1/2).

---

## 12) GTM Snapshot (للـ marketing/ops convos)

- **ICP أولي:** وكالات تسويق صغيرة-متوسطة في الخليج/مصر بـ 3-15 براند.
- **Wedge:** "نظام تشغيل البراند بالعربي مع AI داخلي" — لا يوجد بديل native.
- **Channel mix (متوقع):** SEO عربي (long-tail "إدارة سوشيال ميديا للوكالات") + LinkedIn outbound + قناة الـ founder + شراكات وكالات.
- **Sales motion:** Self-serve (Starter/Growth) + Inside sales (Agency/Enterprise).
- **Onboarding white-glove:** Agency + Enterprise (manual).

---

## 13) Founder's Critical Path (الأولويات اللي مفيش حلها)

1. **Smoke + E2E tests** قبل أول 5 paying tenants — Playwright على 10 critical flows.
2. **Engagement scoring + at-risk list** في Admin Console — قبل ما الـ churn يبقى مفاجأة.
3. **Tenant-level monthly $ cap** على AI spend — guardrail commercial حقيقي.
4. **Mobile publishing flow** — لأن الـ ICP بيستخدم موبايل أكتر من ديسكتوب في الخليج.
5. **Partitioning** على activity_logs/post_analytics قبل ما تتجاوز 1M row.

---

## 14) Working with Claude / Cowork — كيف تستخدم الملف ده

**أنا (Cowork) لما تسألني عن SBrandOps هلتزم بالآتي:**
- الأرقام والقرارات يفضّل تخرج من جدول 4 (Pricing) أو جدول 7 (Scores).
- لو سأل عن feature موجود/مش موجود، أرجع لجدول 2 ثم القسم 9.
- لو السؤال commercial (CAC, LTV, churn) أنبّه للـ gaps في 4.5 و13.
- لو السؤال security/production أرجع لـ 7.
- اللغة: عربي مصري للـ founder، إنجليزي لو طلب deck/external doc.
- التركيز دايماً على: ROI, funnels, conversion optimization, scalability.

---

*ملف مرجعي حي — يتحدّث بعد كل sprint كبير. آخر تحديث: 2026-04-25 — مبني على قراءة كاملة لـ AUDIT_REPORT.md / MASTER_ROADMAP.md / TODO.md / migrations/*.sql / services/*.ts / components/pages/*.tsx.*
