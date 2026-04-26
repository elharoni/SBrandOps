# Marketing Site — Remaining To-Do List
> آخر تحديث: 2026-04-26
> ما تم: إعادة بناء كاملة لـ MarketingSite.tsx — Hero + 12 section + HeroDashboardMock + bilingual + dark sections

---

## 🔴 Priority 1 — Bugs & Critical UX Fixes
> مشاكل تؤثر على التجربة الآن وتحتاج إصلاح فوري

- [ ] **RTL Arrow Direction Bug**
  - الملف: `components/marketing/MarketingSite.tsx`
  - كل أيقونات `fa-arrow-right` تشير يميناً في وضع العربية — عكس منطق RTL
  - الحل: `isArabic ? 'fa-arrow-left' : 'fa-arrow-right'` في كل موضع
  - المواضع: Hero CTA، Bottom CTA، FAQ link، About link — ~5 أماكن

- [ ] **Sticky Header**
  - الملف: `components/marketing/MarketingSite.tsx` — السطر `<header className=`
  - الـ header يختفي عند التمرير — المستخدم يفقد القائمة وزر CTA
  - الحل: إضافة `sticky top-0 z-50` + `backdrop-blur-xl bg-white/90 dark:bg-slate-950/90`

- [ ] **`dir` Attribute مفقود على الـ Root**
  - الملف: `components/marketing/MarketingSite.tsx`
  - الـ RTL/LTR يعتمد على CSS فقط بدون `dir` صريح على الـ wrapper الرئيسي
  - الحل: إضافة `dir={isArabic ? 'rtl' : 'ltr'}` على الـ `<div>` الخارجي للـ component

- [ ] **Before/After Table تنكسر على موبايل**
  - الملف: `components/marketing/MarketingSite.tsx`
  - الـ grid `grid-cols-[44px_1fr_1fr]` يعطي ثلاثة أعمدة بنصوص طويلة على شاشة 375px
  - الحل: على موبايل كل row تتحول لـ card عمودي (before فوق → after تحت)
  - استخدم `hidden sm:grid` على الـ grid و`flex flex-col sm:hidden` على الـ card version

- [ ] **HeroDashboardMock يظهر على موبايل**
  - الملف: `components/marketing/MarketingSite.tsx`
  - المكوّن كبير ومعقد بصرياً على شاشات صغيرة — يدفع المحتوى للأسفل
  - الحل: إضافة `hidden lg:block` على wrapper الـ `<HeroDashboardMock />`

---

## 🟠 Priority 2 — Conversion Optimization
> تؤثر مباشرة على معدل التسجيل والتحويل

- [ ] **"لا بطاقة ائتمانية مطلوبة" تحت كل CTA**
  - أقوى جملة تقليل احتكاك في SaaS
  - تُضاف `<p>` صغيرة تحت زر Primary CTA في Hero وBottom CTA وPricing section
  - النص: `لا بطاقة ائتمانية — ألغِ متى تشاء` / `No credit card required — cancel anytime`

- [ ] **مسار "مشاهدة العرض / See Demo" كـ Secondary CTA**
  - حالياً: Primary = "ابدأ التجربة"، Secondary = "احجز عرضاً"
  - المشكلة: الثانوي يأخذ لـ `/contact` (صفحة نموذج عام) وليس demo فعلي
  - الحل قصير المدى: تغيير `contactLabel` ليكون `تواصل معنا` / `Contact Us` بدلاً من "احجز عرضاً"
  - الحل طويل المدى: ربط بـ Calendly أو صفحة `/demo` مستقلة

- [ ] **Social Proof بأرقام في Hero**
  - حالياً لا يوجد أي رقم على الموقع
  - إضافة trust row تحت الـ CTAs في Hero: `+X براند` / `X,000+ منشور جُدوِل` / `X دولة`
  - يمكن استخدام أرقام تقريبية / aspirational لمرحلة الإطلاق

- [ ] **"Arabic-First" كـ Differentiator Headline**
  - أقوى ما يميز SBrandOps عن Hootsuite وBuffer وSprout وغيرهم
  - يستحق section أو highlight صريح: `مبني للسوق العربي — Arabic-First`
  - يُذكر: RTL، دعم المحتوى العربي، MENA region، تعدد البراندات

- [ ] **Trust Badges قرب CTAs أو في Footer**
  - `SSL Secured` / `GDPR Compliant` / `Data encrypted at rest`
  - تُضاف كـ row صغير أو في `SiteFooter` مباشرة
  - تقلل الاحتكاك عند اتخاذ قرار التسجيل

- [ ] **Waitlist / Newsletter Capture**
  - المستخدم غير المستعد للتسجيل ليس أمامه خيار إلا المغادرة
  - إضافة input بسيط `اترك بريدك — نُخبرك بالجديد` في Bottom CTA section أو Footer
  - يُحفظ في Supabase جدول `waitlist_emails` (email, created_at, source_page)

---

## 🟡 Priority 3 — Visual & Design Polish
> يرفع الجودة المرئية ويقوي الانطباع الأول

- [ ] **Scroll Animations (Fade-In on Scroll)**
  - `tailwind.config.js` يحتوي animation `fade-in` جاهزة لكنها غير مستخدمة
  - إضافة `IntersectionObserver` hook بسيط: `useInView` يضيف class `animate-fade-in` عند دخول كل section
  - يُطبَّق على: الـ section headers، الـ cards في modules grid، الـ workflow steps

- [ ] **Transition بين Hero (Dark) وProblem (Light)**
  - الانتقال من `#070B1F` إلى white مفاجئ بصرياً
  - الحل: `border-t border-slate-200/50 dark:border-slate-800` أو `gradient fade` خفيف

- [ ] **Workflow Steps: Visual Flow**
  - 6 خطوات مرقمة حالياً كـ cards عادية بدون ترابط بصري
  - إضافة connecting line أو سهم بين الخطوات يوضح التسلسل
  - على desktop: خط أفقي متصل — على موبايل: خط عمودي

- [ ] **Third Testimonial**
  - اثنتان فقط حالياً — تبدو قليلة وتملأ grid بشكل غير متوازن
  - إضافة شهادة ثالثة تمثل use case مختلف (مثل: مدير براند / brand manager)

- [ ] **Module Cards: Hover يكشف "استكشف →"**
  - حالياً الـ hover فقط يغير border color
  - إضافة link/arrow `اكتشف الميزة →` تظهر عند الـ hover
  - يزيد engagement ويوضح أن كل module صفحة/feature مستقلة

---

## 🔵 Priority 4 — SEO & Accessibility

- [ ] **Page Title يتغير per pageId**
  - حالياً نفس الـ `<title>` على كل الصفحات
  - الحل: `useEffect` يغير `document.title` بناءً على `pageId`
  - مثال: `SBrandOps — الأسعار` / `SBrandOps — من نحن`

- [ ] **OG Tags لكل صفحة (Open Graph)**
  - بدون OG tags، مشاركة الموقع على واتساب / تويتر / لينكدإن لا تظهر صورة أو عنوان
  - تُضاف `<meta property="og:title">`, `og:description`, `og:image` لكل pageId
  - يمكن تنفيذها عبر `useEffect` يحدث الـ meta tags أو react-helmet

- [ ] **`aria-expanded` على FAQ Accordion**
  - الملف: `components/marketing/MarketingSite.tsx` — قسم FAQ
  - الـ `<button>` في الـ accordion لا يعلم قارئات الشاشة بحالته
  - الحل: `aria-expanded={openFaq === i}` على كل button

- [ ] **Color Contrast على النصوص الخافتة**
  - `text-white/25` و`text-white/30` على خلفيات داكنة قد تفشل WCAG AA
  - مراجعة وتحديث النصوص الثانوية داخل الـ dark sections لـ `text-white/50` كحد أدنى

---

## ⚪ Priority 5 — Architecture & Future

- [ ] **FontAwesome: تحويل من CDN إلى Local**
  - CDN يمكن أن يكون بطيئاً أو محجوباً في بعض مناطق MENA
  - الحل: `npm install @fortawesome/fontawesome-free` وimport في `main.tsx`
  - يلغي الاعتماد على الشبكة لتحميل الأيقونات

- [ ] **تفكيك `renderHome` إلى Sub-Components**
  - حالياً ~400 سطر في دالة واحدة — صعبة الصيانة والتعديل المستقبلي
  - كل section تصبح component مستقلة:
    `HeroSection`, `ProblemSection`, `ModulesSection`, `AILayerSection`
    `WorkflowSection`, `BeforeAfterSection`, `UseCasesSection`
    `IntegrationsSection`, `SocialProofSection`, `PricingPreviewSection`
    `FAQSection`, `BottomCTASection`

- [ ] **Pricing Preview: إزالة التكرار**
  - منطق الـ pricing موجود في `renderHome` وفي `renderPricing` منفصلين
  - تحويل إلى `<PricingCards>` component مشترك يُستخدم في الاثنين

- [ ] **JSON-LD Structured Data**
  - إضافة `<script type="application/ld+json">` لـ SoftwareApplication schema
  - يحسن ظهور النتائج في Google Search بـ rich snippets

- [ ] **Features / Use Cases / Demo Pages**
  - الـ brief الأصلي ذكر صفحات مستقلة: `/features`, `/use-cases`, `/demo`
  - حالياً غير موجودة — كل المحتوى في الـ homepage
  - يُضاف `pageId` جديد لكل منها في `MarketingPageId` type والـ routing

---

## ملاحظات معمارية مهمة

- **Dark Sections**: تستخدم `style={{ margin: '1.5rem -1.5rem 0' }}` لكسر الـ max-w-7xl — لا تغير هذا النمط
- **bilingual pattern**: دائماً `isArabic ? arText : enText` — لا `i18n` library خارجية
- **SiteFooter**: يستقبل `isAuthenticated` prop — لا تتجاوزها
- **Dark sections**: Hero و Bottom CTA يستخدمان `#070B1F` inline — وليس Tailwind class — لضمان اللون الصحيح
- **Tailwind opacity**: `/8` و`/12` و`/6` تعمل مع JIT (Tailwind v3) — لا تستبدلها بـ arbitrary values
- **FontAwesome classes**: `fas` = solid، `fab` = brands — لا تخلط بينهما
