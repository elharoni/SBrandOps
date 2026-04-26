import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { publicPageToPath } from '../../config/routes';
import SiteFooter from './SiteFooter';
import { SBrandOpsLogo } from '../SBrandOpsLogo';
import { BillingCycle, DEFAULT_PUBLIC_PRICING_PLAN_IDS, PRICING_PLANS, getBillingAmount } from '../../config/pricingPlans';
import { openBillingCheckout } from '../../services/billingCheckoutService';

type MarketingPageId = 'home' | 'about' | 'pricing' | 'billing' | 'contact' | 'security' | 'terms' | 'privacy' | 'dpa' | 'refunds' | 'cookies';
interface MarketingSiteProps { pageId: MarketingPageId; isAuthenticated: boolean; }

// ─── DATA ────────────────────────────────────────────────────────────────────

const MODULES = [
    { icon: 'fa-fingerprint',            color: 'bg-cyan-500/15 text-cyan-400',    title: 'Brand Hub',          arDesc: 'هوية البراند، الصوت، الجمهور، وأصول الماركة في مرجع ذكي واحد.', enDesc: 'Brand identity, voice, audiences, and assets in one AI-powered reference.' },
    { icon: 'fa-brain',                  color: 'bg-indigo-500/15 text-indigo-400', title: 'Campaign Brain',     arDesc: 'من الهدف إلى الاستراتيجية إلى تقويم المحتوى في تدفق واحد مدعوم بالذكاء.', enDesc: 'From goal to strategy to content calendar in one AI-driven flow.' },
    { icon: 'fa-pen-nib',                color: 'bg-blue-500/15 text-blue-400',    title: 'Content Studio',     arDesc: 'توليد المحتوى بالذكاء الاصطناعي مع Kanban للسير من الفكرة إلى النشر.', enDesc: 'AI-powered content creation with Kanban pipeline from idea to publish.' },
    { icon: 'fa-share-nodes',            color: 'bg-violet-500/15 text-violet-400', title: 'Social Publishing', arDesc: 'جدولة ونشر متعدد القنوات عبر Instagram وTikTok وMeta وLinkedIn.', enDesc: 'Multi-channel scheduling and publishing across Instagram, TikTok, Meta, and LinkedIn.' },
    { icon: 'fa-rectangle-ad',           color: 'bg-orange-500/15 text-orange-400', title: 'Ads Ops',           arDesc: 'مراقبة أداء الإعلانات وتوصيات التوسع ونسخ الإعلانات المولودة بالذكاء.', enDesc: 'Ad performance monitoring, scaling recommendations, and AI-generated ad copy.' },
    { icon: 'fa-magnifying-glass-chart', color: 'bg-emerald-500/15 text-emerald-400', title: 'SEO Ops',         arDesc: 'توليد briefs لـ SEO وتتبع أداء المقالات وأدوات المحتوى الموجه للبحث.', enDesc: 'Generate SEO briefs, track article performance, and optimize search content.' },
    { icon: 'fa-inbox',                  color: 'bg-cyan-500/15 text-cyan-400',    title: 'Inbox Ops',          arDesc: 'بريد وارد موحد لكل القنوات مع تحليل المشاعر وتوجيه ذكي للردود.', enDesc: 'Unified inbox across all channels with sentiment analysis and smart routing.' },
    { icon: 'fa-robot',                  color: 'bg-purple-500/15 text-purple-400', title: 'Smart Bot',         arDesc: 'بوت مبيعات ذكي بـ 6 سيناريوهات جاهزة يرد بصوت البراند على العملاء.', enDesc: 'Intelligent sales bot with 6 ready scenarios responding in your brand voice.' },
    { icon: 'fa-chart-mixed',            color: 'bg-blue-500/15 text-blue-400',    title: 'Analytics Hub',      arDesc: 'تحليلات موحدة لكل القنوات مع رؤى AI وتقارير ROAS وتقسيم الأداء.', enDesc: 'Unified cross-channel analytics with AI insights, ROAS reports, and performance attribution.' },
    { icon: 'fa-circle-nodes',           color: 'bg-slate-400/15 text-slate-400',  title: 'Integrations OS',    arDesc: 'ربط ذكي بالمنصات مع تسجيل نوع الأصل ووظيفته وحالة المزامنة.', enDesc: 'Smart platform connections with asset type, purpose, and sync status registry.' },
];

const AI_CAPABILITIES = [
    { icon: 'fa-compass-drafting',     ar: 'تخطيط الاستراتيجية', en: 'Strategy Planning',     dAr: 'من الهدف التسويقي إلى خطة قابلة للتنفيذ.', dEn: 'From marketing goal to executable plan.' },
    { icon: 'fa-wand-magic-sparkles',  ar: 'توليد المحتوى',      en: 'Content Generation',    dAr: '14 مهارة محتوى بصوت البراند تلقائيًا.', dEn: '14 content skills powered by brand voice.' },
    { icon: 'fa-bullseye-arrow',       ar: 'تحسين الحملات',      en: 'Campaign Optimization', dAr: 'توصيات مبنية على أداء الحملات.', dEn: 'Recommendations built on campaign performance.' },
    { icon: 'fa-comment-dots',         ar: 'ردود المحادثة',      en: 'Conversation Replies',  dAr: 'ردود البوت الذكي محكومة بسيناريوهات المبيعات.', dEn: 'Smart bot replies governed by sales scenarios.' },
    { icon: 'fa-magnifying-glass-plus', ar: 'توصيات SEO',        en: 'SEO Recommendations',   dAr: 'محتوى محسّن للبحث من أول مسودة.', dEn: 'Search-optimized content from the first draft.' },
    { icon: 'fa-chart-line',           ar: 'رؤى الأداء',         en: 'Performance Insights',  dAr: 'البيانات تُفسَّر تلقائيًا في توصيات تنفيذية.', dEn: 'Data auto-interpreted into actionable decisions.' },
];

const WORKFLOW_STEPS = [
    { num: '01', icon: 'fa-fingerprint',         ar: 'أضف البراند',        en: 'Add Brand',            aSub: 'صف البراند أو ارفع مستند ويولد الذكاء الاصطناعي هويته.', eSub: 'Describe your brand or upload a doc — AI builds its identity.' },
    { num: '02', icon: 'fa-circle-nodes',        ar: 'اربط القنوات',        en: 'Connect Channels',     aSub: 'اربط Meta وInstagram وTikTok وLinkedIn من مكان واحد.', eSub: 'Connect Meta, Instagram, TikTok, and LinkedIn from one place.' },
    { num: '03', icon: 'fa-brain',               ar: 'خطط بعقل البراند',   en: 'Plan with Brand Brain', aSub: 'الذكاء يبني الاستراتيجية والتقويم بناءً على هدفك.', eSub: 'AI builds strategy and content calendar from your goal.' },
    { num: '04', icon: 'fa-wand-magic-sparkles', ar: 'ولّد المحتوى',       en: 'Generate Content',     aSub: 'نسخة، إعلانات، ريلز، بريف SEO — بصوت البراند دائمًا.', eSub: 'Captions, ads, reels, SEO briefs — always in brand voice.' },
    { num: '05', icon: 'fa-paper-plane',         ar: 'انشر وجدوِل',         en: 'Publish & Schedule',   aSub: 'نشر فوري أو مجدول لكل القنوات من لوحة تحكم واحدة.', eSub: 'Instant or scheduled publishing across all channels from one board.' },
    { num: '06', icon: 'fa-chart-mixed',         ar: 'حلل وحسّن',           en: 'Analyze & Optimize',   aSub: 'رؤى AI تحوّل البيانات إلى قرارات تشغيلية واضحة.', eSub: 'AI insights turn data into clear operational decisions.' },
];

const BEFORE_AFTER = [
    { icon: 'fa-pen',                    bAr: 'أفكار المحتوى في Google Docs',         bEn: 'Content ideas scattered in Google Docs',       aAr: 'Brand Hub + Content Studio', aEn: 'Brand Hub + Content Studio' },
    { icon: 'fa-calendar',               bAr: 'جدولة عبر Hootsuite / Buffer',          bEn: 'Scheduling through Hootsuite / Buffer',         aAr: 'Social Publisher متعدد القنوات', aEn: 'Multi-channel Social Publisher' },
    { icon: 'fa-rectangle-ad',           bAr: 'إدارة إعلانات في Meta Ads Manager',     bEn: 'Ads managed in Meta Ads Manager separately',   aAr: 'Ads Ops مدمج مع التحليلات', aEn: 'Ads Ops integrated with analytics' },
    { icon: 'fa-chart-bar',              bAr: 'تحليلات كل منصة بشكل منفصل',            bEn: 'Platform analytics in separate dashboards',     aAr: 'Analytics Hub موحد + رؤى AI', aEn: 'Unified Analytics Hub with AI insights' },
    { icon: 'fa-fingerprint',            bAr: 'دليل البراند محفوظ في PDF',             bEn: 'Brand guidelines locked in PDFs',               aAr: 'Brand Brain: ذاكرة AI حية للبراند', aEn: 'Brand Brain: live AI brand memory' },
    { icon: 'fa-inbox',                  bAr: 'الرد على عملاء يدويًا في كل منصة',      bEn: 'Manual customer replies per platform',          aAr: 'Inbox موحد + Smart Bot بسيناريوهات', aEn: 'Unified Inbox + Smart Bot with scenarios' },
    { icon: 'fa-brain',                  bAr: 'Briefs الحملات في جداول Excel',          bEn: 'Campaign briefs tracked in Excel sheets',       aAr: 'Campaign Brain: من الهدف للجدول الكامل', aEn: 'Campaign Brain: from goal to full content calendar' },
    { icon: 'fa-magnifying-glass-chart', bAr: 'أدوات SEO منفصلة عن تدفق المحتوى',     bEn: 'SEO tools disconnected from content flow',      aAr: 'SEO Ops: Brief → إنتاج → تتبع', aEn: 'SEO Ops: Brief → Production → Tracking' },
];

const USE_CASES = [
    { icon: 'fa-building',  color: 'bg-indigo-500/15 text-indigo-400',  ar: 'الوكالات التسويقية',    en: 'Marketing Agencies',  pAr: 'إدارة عشرات العملاء عبر أدوات متفرقة يبطئ التسليم ويضعف الاتساق.', pEn: 'Managing multiple clients across scattered tools slows delivery and weakens brand consistency.', sAr: 'مساحة عمل منفصلة لكل براند مع أدوار وموافقات وتقارير للعملاء.', sEn: 'Separate workspace per brand with roles, approvals, and client reporting from one panel.' },
    { icon: 'fa-store',     color: 'bg-orange-500/15 text-orange-400',  ar: 'التجارة الإلكترونية',   en: 'E-commerce Brands',   pAr: 'الإعلانات والمحتوى والتحليلات منفصلة ولا يمكن ربطها بقرار تشغيلي.', pEn: 'Ads, content, and analytics are disconnected and impossible to link into one decision.', sAr: 'Ads Ops + Analytics Hub + Content Pipeline في نظام مترابط بالإيرادات.', sEn: 'Ads Ops + Analytics Hub + Content Pipeline in one revenue-linked system.' },
    { icon: 'fa-user-tie',  color: 'bg-cyan-500/15 text-cyan-400',      ar: 'مدراء البراند',          en: 'Brand Managers',      pAr: 'ضمان اتساق صوت البراند عبر الفرق والمنصات مهمة شبه مستحيلة.', pEn: 'Keeping brand voice consistent across teams and platforms is nearly impossible.', sAr: 'Brand Hub + Brand Brain يبنيان ذاكرة حية تُستخدم في كل طلب AI.', sEn: 'Brand Hub + Brand Brain build a live brand memory used in every AI request.' },
    { icon: 'fa-rocket',    color: 'bg-emerald-500/15 text-emerald-400', ar: 'الشركات الناشئة',       en: 'Growing Startups',    pAr: 'التسويق فوضوي والفريق الصغير لا يتحمل إدارة أدوات متعددة بموارد محدودة.', pEn: 'Marketing is chaotic and small teams cannot manage multiple tools with limited resources.', sAr: 'نظام تشغيل واحد يركّز الفريق على التنفيذ لا على الإدارة.', sEn: 'One operating system that focuses the team on execution, not administration.' },
];

const INTEGRATIONS = [
    { name: 'Meta', fab: 'fa-meta', color: 'text-blue-400' },
    { name: 'Instagram', fab: 'fa-instagram', color: 'text-pink-400' },
    { name: 'TikTok', fab: 'fa-tiktok', color: 'text-slate-200' },
    { name: 'LinkedIn', fab: 'fa-linkedin', color: 'text-sky-400' },
    { name: 'X', fab: 'fa-x-twitter', color: 'text-slate-300' },
    { name: 'YouTube', fab: 'fa-youtube', color: 'text-red-400' },
    { name: 'Facebook', fab: 'fa-facebook', color: 'text-blue-400' },
    { name: 'Pinterest', fab: 'fa-pinterest', color: 'text-red-400' },
    { name: 'Google', fab: 'fa-google', color: 'text-amber-400' },
    { name: 'Shopify', fab: 'fa-shopify', color: 'text-emerald-400' },
    { name: 'WordPress', fab: 'fa-wordpress', color: 'text-sky-300' },
];

const FAQ_ITEMS = [
    { arQ: 'هل النظام يدعم العربية؟', arA: 'نعم. الواجهة والتشغيل يدعمان العربية والإنجليزية مع RTL وLTR بشكل كامل. SBrandOps مبني Arabic-first.', enQ: 'Does SBrandOps support Arabic?', enA: 'Yes. The full interface and AI outputs support Arabic and English with RTL and LTR layouts. SBrandOps is built Arabic-first.' },
    { arQ: 'هل أستطيع إدارة أكثر من براند؟', arA: 'نعم. الخطط الأعلى تدعم تعدد البراندات مع فصل كامل للبيانات والأدوار والصلاحيات لكل براند.', enQ: 'Can I manage multiple brands?', enA: 'Yes. Higher plans support multiple brands with full data separation, roles, and permissions per brand.' },
    { arQ: 'هل توجد تجربة مجانية؟', arA: 'نعم. تشمل الخطط الأساسية فترة تجريبية قبل تفعيل الاشتراك الكامل.', enQ: 'Is there a free trial?', enA: 'Yes. Core plans include a trial period before the full subscription activates.' },
    { arQ: 'كيف يستخدم الذكاء الاصطناعي بيانات البراند؟', arA: 'كل طلب AI يمر عبر Brand Brain الذي يحمل صوت البراند وقيمه وجمهوره لضمان مخرجات تعكس هوية البراند دائمًا.', enQ: 'How does AI use brand data?', enA: 'Every AI request passes through Brand Brain — carrying brand voice, values, and audiences — ensuring outputs always reflect your brand identity.' },
    { arQ: 'هل يمكن إلغاء الاشتراك؟', arA: 'نعم. يمكن إدارة الإلغاء والإيقاف والفواتير من داخل التطبيق أو عبر Customer Portal في أي وقت.', enQ: 'Can I cancel the subscription?', enA: 'Yes. Cancel, pause, and billing management are all available in-app or via the customer portal at any time.' },
];

const CASE_STUDIES = [
    { metric: '3.4x', arTitle: 'أسرع من التخطيط إلى النشر', enTitle: 'Faster from planning to publishing', arBody: 'فريق محتوى صغير وحّد التقويم والموافقات والنشر في تدفق تشغيلي واحد.', enBody: 'A lean content team unified planning, approvals, and publishing in one operating flow.' },
    { metric: '42%', arTitle: 'وضوح أعمق في قرارات الإعلانات', enTitle: 'Clearer paid-media decisions', arBody: 'ربط مؤشرات الإعلانات بسجل التنفيذ سهّل معرفة متى تتوسع أو توقف.', enBody: 'Connecting ad metrics with execution logs clarified when to scale or pause campaigns.' },
    { metric: '1 workspace', arTitle: 'البراند والمحتوى والدعم من مكان واحد', enTitle: 'Brand, content, and support unified', arBody: 'بدل القفز بين الأدوات، الفريق يعمل من لوحة تشغيل واحدة مرتبطة بالبراند.', enBody: 'Instead of switching tools, the team operates from one brand-centered workspace.' },
];

const TESTIMONIALS = [
    { name: 'Nour A.', roleAr: 'مديرة نمو — متجر إلكتروني', roleEn: 'Growth Lead — E-commerce Brand', quoteAr: 'أهم فرق فعلي هو أن المحتوى والإعلانات والتحليلات أصبحت مترابطة داخل نفس القرار اليومي.', quoteEn: 'The biggest improvement was having content, ads, and analytics tied into the same daily operating decision.', initials: 'NA', gFrom: 'from-cyan-500', gTo: 'to-blue-600' },
    { name: 'Kareem S.', roleAr: 'مؤسس وكالة تسويق', roleEn: 'Agency Founder', quoteAr: 'بدل متابعة العملاء عبر أدوات متفرقة، أصبح لدينا مركز تشغيل واحد يوضح ما يجب تنفيذه الآن.', quoteEn: 'Instead of tracking clients across disconnected tools, we have one operating center that shows what needs action now.', initials: 'KS', gFrom: 'from-indigo-500', gTo: 'to-purple-600' },
];

const SUPPORT_PATHS = [
    { icon: 'fa-headset', arTitle: 'دعم المنتج', enTitle: 'Product support', arBody: 'للمشاكل التشغيلية، الإعداد، وربط الحسابات.', enBody: 'For setup, operational issues, and account connection support.', value: 'support@sbrandops.com', href: 'mailto:support@sbrandops.com' },
    { icon: 'fa-credit-card', arTitle: 'دعم الفوترة', enTitle: 'Billing support', arBody: 'للفواتير، الاشتراكات، والإلغاء أو الإيقاف.', enBody: 'For invoices, subscriptions, cancellation, or pause requests.', value: 'billing@sbrandops.com', href: 'mailto:billing@sbrandops.com' },
    { icon: 'fa-book-open', arTitle: 'مركز المساعدة', enTitle: 'Help center', arBody: 'إرشادات سريعة لبدء الاستخدام والفرق والعملاء.', enBody: 'Quick onboarding guidance for teams, brands, and clients.', value: 'Help Guides', href: '/contact#support' },
];

type LegalBlock = { heading?: string; text: string };
type LegalPageDef = { arTitle: string; enTitle: string; effective: string; arBlocks: LegalBlock[]; enBlocks: LegalBlock[] };

const LEGAL_COPY: Record<Exclude<MarketingPageId, 'home' | 'about' | 'pricing' | 'billing' | 'contact' | 'security'>, LegalPageDef> = {
    terms: {
        arTitle: 'شروط الاستخدام', enTitle: 'Terms of Service', effective: 'April 26, 2026',
        enBlocks: [
            { text: 'These Terms of Service ("Terms") govern your access to and use of SBrandOps, an AI-powered brand operating system provided by SMA Marketing ("we", "us"). By creating an account or using any part of the service, you agree to be bound by these Terms.' },
            { heading: '1. The Service', text: 'SBrandOps provides tools for content planning, social publishing, ad analytics, inbox management, workflow automation, and team collaboration. Features available to you depend on your subscription plan. We reserve the right to modify or discontinue features at any time with reasonable notice.' },
            { heading: '2. Account Registration', text: 'You must provide accurate, complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and all activity within your workspace. You must be at least 18 years old or have legal authority to enter into contracts in your jurisdiction.' },
            { heading: '3. Account Owner Responsibilities', text: 'The account owner is responsible for managing team members, assigning roles, and controlling access permissions. If team members violate these Terms, the account owner bears responsibility. Notify us of any unauthorized access at security@sbrandops.com.' },
            { heading: '4. Acceptable Use', text: 'You agree not to use SBrandOps to publish spam, misleading content, or material that violates applicable laws. You may not reverse-engineer, scrape, or attempt to extract the source code or data models of the platform. Violation of acceptable use may result in immediate account suspension.' },
            { heading: '5. Connected Integrations', text: 'When you connect third-party platforms (Meta, TikTok, LinkedIn, Google, etc.), you authorize SBrandOps to interact with those platforms on your behalf within the permissions you grant. You remain responsible for complying with each platform\'s own terms. We are not liable for third-party account suspensions or API changes that affect functionality.' },
            { heading: '6. Subscriptions and Payment', text: 'Paid plans are billed monthly or annually as selected at checkout. All fees are due at the start of each billing period. Failure to pay may result in service downgrade or suspension. Prices may change with 30 days written notice. Applicable taxes will be added to invoices where required by law.' },
            { heading: '7. Intellectual Property', text: 'SBrandOps, its software, designs, and algorithms are the intellectual property of SMA Marketing. Your subscription grants a limited, non-exclusive, non-transferable license to use the service during your subscription period. You retain full ownership of the content you create, upload, or connect through the platform.' },
            { heading: '8. Data and Privacy', text: 'Your use is also governed by our Privacy Policy and Data Processing Addendum (DPA) where applicable. We process your data solely to operate the service. We do not sell your data to third parties.' },
            { heading: '9. Termination', text: 'You may cancel your subscription at any time from the Billing Center. Cancellation takes effect at the end of the current billing period. We may suspend accounts that violate these Terms. Upon termination your data is retained per our retention schedule before deletion.' },
            { heading: '10. Limitation of Liability', text: 'To the maximum extent permitted by law, SMA Marketing is not liable for any indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid us in the three months preceding the claim. The service is provided "as is" without warranty of uninterrupted availability.' },
            { heading: '11. Governing Law', text: 'These Terms are governed by the laws of the Kingdom of Saudi Arabia. Disputes shall be subject to the exclusive jurisdiction of competent courts in Riyadh, Saudi Arabia.' },
            { heading: '12. Changes', text: 'We may update these Terms with 14 days\' notice to registered users via email or in-app notification before material changes take effect.' },
            { heading: 'Contact', text: 'For questions about these Terms: legal@sbrandops.com — SMA Marketing, Riyadh, Kingdom of Saudi Arabia.' },
        ],
        arBlocks: [
            { text: 'تحكم شروط الاستخدام هذه وصولك إلى منصة SBrandOps واستخدامك لها، وهي نظام تشغيل البراند المقدم من SMA Marketing. بإنشاء حساب أو استخدام أي جزء من الخدمة، توافق على الالتزام بهذه الشروط.' },
            { heading: '١. الخدمة', text: 'توفر SBrandOps أدوات تخطيط المحتوى، النشر الاجتماعي، تحليلات الإعلانات، إدارة صندوق الوارد، أتمتة سير العمل، والتعاون المؤسسي. الميزات المتاحة تعتمد على خطة اشتراكك. نحتفظ بحق تعديل أو تحديث الميزات مع إشعار معقول.' },
            { heading: '٢. تسجيل الحساب', text: 'يجب تقديم معلومات دقيقة وكاملة عند إنشاء الحساب. أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول وجميع الأنشطة داخل مساحة عملك. يجب أن تكون قد بلغت 18 عاماً أو تمتلك الصلاحية القانونية لإبرام عقود في نطاق اختصاصك.' },
            { heading: '٣. مسؤوليات مالك الحساب', text: 'مالك الحساب مسؤول عن إدارة أعضاء الفريق وتعيين الأدوار والتحكم في صلاحيات الوصول. يتحمل مسؤولية مخالفات أعضاء الفريق لهذه الشروط. يجب إخطارنا فوراً بأي وصول غير مصرح به على security@sbrandops.com.' },
            { heading: '٤. الاستخدام المقبول', text: 'توافق على عدم استخدام المنصة لنشر محتوى مضلل أو منتهك للقوانين. لا يجوز إجراء هندسة عكسية أو كشط البيانات أو استخراج الكود المصدري. الانتهاك الجسيم قد يؤدي إلى تعليق الحساب فوراً.' },
            { heading: '٥. التكاملات الخارجية', text: 'عند ربط منصات خارجية، تفوّض SBrandOps بالتفاعل معها نيابةً عنك ضمن الصلاحيات التي تمنحها. تبقى مسؤولاً عن الامتثال لشروط كل منصة. لسنا مسؤولين عن تعليقات الحسابات أو تغييرات API.' },
            { heading: '٦. الاشتراكات والدفع', text: 'تُفوتر الخطط المدفوعة شهرياً أو سنوياً حسب اختيارك. تستحق الرسوم في بداية كل دورة فوترة. قد يؤدي الفشل في السداد إلى تعليق الخدمة. قد تتغير الأسعار مع إشعار مسبق 30 يوماً.' },
            { heading: '٧. الملكية الفكرية', text: 'SBrandOps وجميع البرامج والتصاميم ملكية فكرية لـ SMA Marketing. يمنحك اشتراكك رخصة محدودة وغير حصرية لاستخدام الخدمة. تحتفظ بالملكية الكاملة للمحتوى الذي تنشئه أو تحمّله عبر المنصة.' },
            { heading: '٨. البيانات والخصوصية', text: 'استخدامك للمنصة يخضع أيضاً لسياسة الخصوصية واتفاقية معالجة البيانات (DPA) حيثما ينطبق. نعالج بياناتك فقط لتشغيل الخدمة. لا نبيع بياناتك لأطراف ثالثة.' },
            { heading: '٩. الإنهاء', text: 'يمكنك إلغاء اشتراكك في أي وقت من مركز الفوترة. يسري الإلغاء في نهاية دورة الفوترة الحالية. يحق لنا تعليق الحسابات المنتهكة لهذه الشروط. عند الإنهاء تُحفظ بياناتك وفق جدول الاحتفاظ المعتمد قبل الحذف.' },
            { heading: '١٠. تحديد المسؤولية', text: 'بالقدر الأقصى المسموح به قانوناً، لن تكون SMA Marketing مسؤولة عن أي أضرار غير مباشرة أو تبعية. لن تتجاوز مسؤوليتنا الإجمالية المبلغ الذي دفعته في الثلاثة أشهر السابقة للمطالبة.' },
            { heading: '١١. القانون الحاكم', text: 'تخضع هذه الشروط لقوانين المملكة العربية السعودية. تخضع أي نزاعات للاختصاص القضائي الحصري للمحاكم المختصة في الرياض.' },
            { heading: '١٢. التعديلات', text: 'قد نحدّث هذه الشروط مع إخطار المستخدمين المسجلين قبل 14 يوماً من سريان التغييرات الجوهرية عبر البريد الإلكتروني أو داخل التطبيق.' },
            { heading: 'التواصل', text: 'للاستفسار عن هذه الشروط: legal@sbrandops.com — SMA Marketing، الرياض، المملكة العربية السعودية.' },
        ],
    },
    privacy: {
        arTitle: 'سياسة الخصوصية', enTitle: 'Privacy Policy', effective: 'April 26, 2026',
        enBlocks: [
            { text: 'This Privacy Policy explains how SMA Marketing collects, uses, stores, and protects personal data when you use SBrandOps. We are committed to responsible data handling in compliance with applicable data protection laws, including GDPR where applicable.' },
            { heading: '1. Data We Collect', text: 'We collect data you provide directly: your name, email address, company name, and payment information. We collect usage data automatically: pages visited, features used, session duration, and device/browser information. When you connect third-party platforms via OAuth, we receive and store access tokens and analytics data returned by those platforms on your behalf.' },
            { heading: '2. How We Use Your Data', text: 'We use your data to: create and manage your account; provide and improve the SBrandOps service; process payments and send billing communications; send product updates, security alerts, and support messages; and analyze aggregate usage patterns to improve reliability. We do not use your data for advertising to third parties.' },
            { heading: '3. Legal Basis for Processing', text: 'For users in the EEA/UK, we process your data based on: Contract performance (operating your account); Legitimate interests (product improvement and security); Legal obligation (tax and compliance records); and Consent (optional analytics and marketing communications, which you may withdraw at any time).' },
            { heading: '4. Data Sharing', text: 'We share your data with: Supabase (database and authentication); Stripe (payment processing); AI inference providers (for AI features, using minimal data); and connected social/ad platforms only to the extent you authorize via OAuth. We do not sell or rent your personal data to any third party.' },
            { heading: '5. Data Storage and Security', text: 'Your data is stored on secure cloud infrastructure. OAuth tokens and sensitive credentials are encrypted at rest. We apply role-based access controls and maintain audit logs for sensitive operations. Despite these measures, no system is completely secure — use strong passwords and keep credentials private.' },
            { heading: '6. International Transfers', text: 'Our infrastructure may be hosted in regions outside your home country. Where we transfer data outside the EEA, we use Standard Contractual Clauses (SCCs) or other approved transfer mechanisms.' },
            { heading: '7. Your Rights', text: 'You may have the right to: access your personal data; request correction of inaccurate data; request deletion of your account and data; object to or restrict certain processing; request a portable copy of your data; and withdraw consent at any time. To exercise these rights, email privacy@sbrandops.com.' },
            { heading: '8. Data Retention', text: 'We retain account data for the duration of your subscription plus 90 days after cancellation for reactivation purposes. After that, personal data is deleted or anonymized. Billing records are retained for 7 years per financial regulations.' },
            { heading: '9. Children\'s Privacy', text: 'SBrandOps is not directed at users under 18. We do not knowingly collect data from minors. If you believe a minor has submitted data, contact privacy@sbrandops.com and we will delete it promptly.' },
            { heading: '10. Changes', text: 'We may update this Privacy Policy periodically. Material changes will be communicated via email or in-app notification at least 14 days before taking effect.' },
            { heading: 'Contact', text: 'For privacy questions or data subject rights requests: privacy@sbrandops.com. Please include your name, email, and a description of your request.' },
        ],
        arBlocks: [
            { text: 'توضح سياسة الخصوصية هذه كيف تجمع SMA Marketing بياناتك الشخصية وتستخدمها وتخزنها وتحميها عند استخدام SBrandOps. نلتزم بالتعامل مع بياناتك بمسؤولية وفق قوانين حماية البيانات المعمول بها، بما يشمل اللائحة الأوروبية GDPR حيثما تنطبق.' },
            { heading: '١. البيانات التي نجمعها', text: 'نجمع البيانات التي تقدمها مباشرة: اسمك، بريدك الإلكتروني، اسم شركتك، ومعلومات الدفع. نجمع بيانات الاستخدام تلقائياً: الصفحات المزارة، الميزات المستخدمة، مدة الجلسة، ومعلومات الجهاز والمتصفح. عند ربط منصات خارجية عبر OAuth، نتلقى ونخزن رموز الوصول وبيانات التحليلات نيابةً عنك.' },
            { heading: '٢. كيف نستخدم بياناتك', text: 'نستخدم بياناتك لـ: إنشاء حسابك وإدارته؛ تقديم الخدمة وتحسينها؛ معالجة المدفوعات؛ إرسال تحديثات المنتج وتنبيهات الأمان؛ وتحليل أنماط الاستخدام المجمّعة. لا نستخدم بياناتك للإعلان لدى أطراف ثالثة.' },
            { heading: '٣. الأساس القانوني للمعالجة', text: 'للمستخدمين في المنطقة الاقتصادية الأوروبية/المملكة المتحدة، نعالج بياناتك استناداً إلى: تنفيذ العقد؛ المصالح المشروعة (تحسين المنتج والأمان)؛ الالتزام القانوني (سجلات الضرائب)؛ والموافقة (التحليلات الاختيارية ومراسلات التسويق).' },
            { heading: '٤. مشاركة البيانات', text: 'نشارك بياناتك مع: Supabase (قاعدة البيانات والمصادقة)؛ Stripe (معالجة الدفع)؛ مزودي الذكاء الاصطناعي (باستخدام بيانات محدودة)؛ والمنصات الخارجية فقط بالقدر الذي تفوّضه. لا نبيع بياناتك الشخصية.' },
            { heading: '٥. تخزين البيانات وأمانها', text: 'تُخزّن بياناتك على بنية تحتية سحابية آمنة. تُشفّر رموز OAuth والبيانات الحساسة في حالة السكون. نطبّق ضوابط وصول قائمة على الأدوار ونحتفظ بسجلات تدقيق للعمليات الحساسة.' },
            { heading: '٦. النقل الدولي للبيانات', text: 'قد تُستضاف بنيتنا في مناطق خارج بلدك. عند نقل البيانات خارج المنطقة الاقتصادية الأوروبية، نستخدم بنود العقود النموذجية أو آليات النقل الأخرى المعتمدة.' },
            { heading: '٧. حقوقك', text: 'يحق لك: الوصول إلى بياناتك؛ طلب تصحيحها؛ طلب حذف حسابك وبياناتك؛ الاعتراض على معالجة معينة أو تقييدها؛ طلب نسخة قابلة للنقل؛ وسحب الموافقة في أي وقت. لممارسة هذه الحقوق: privacy@sbrandops.com.' },
            { heading: '٨. الاحتفاظ بالبيانات', text: 'نحتفظ ببيانات الحساب طوال الاشتراك بالإضافة إلى 90 يوماً بعد الإلغاء. بعدها تُحذف البيانات أو يُزال التعريف عنها. تُحفظ سجلات الفوترة 7 سنوات وفق متطلبات الامتثال المالي.' },
            { heading: '٩. خصوصية الأطفال', text: 'لا تستهدف SBrandOps القاصرين دون 18 عاماً. إذا اعتقدت أن قاصراً قدم بياناته، راسلنا على privacy@sbrandops.com وسنحذفها فوراً.' },
            { heading: '١٠. التعديلات', text: 'قد نحدّث هذه السياسة دورياً. سنخطرك بالتغييرات الجوهرية قبل 14 يوماً من سريانها عبر البريد الإلكتروني أو داخل التطبيق.' },
            { heading: 'التواصل', text: 'للاستفسارات وطلبات حقوق البيانات: privacy@sbrandops.com مع ذكر اسمك وبريدك ووصف طلبك.' },
        ],
    },
    dpa: {
        arTitle: 'اتفاقية معالجة البيانات', enTitle: 'Data Processing Addendum (DPA)', effective: 'April 26, 2026',
        enBlocks: [
            { text: 'This Data Processing Addendum ("DPA") forms part of the agreement between you ("Customer") and SMA Marketing ("Processor") for the use of SBrandOps. It applies where SBrandOps processes personal data on behalf of the Customer and is designed to satisfy GDPR Article 28 and equivalent regulations.' },
            { heading: '1. Definitions', text: '"Personal Data", "Data Subject", "Processing", "Controller", and "Processor" have the meanings given in GDPR (EU) 2016/679. "Customer Data" means any personal data submitted to the platform by or on behalf of the Customer through account use, integrations, or content uploads.' },
            { heading: '2. Roles', text: 'The Customer acts as the Data Controller. SMA Marketing acts as the Data Processor, processing Customer Data only on behalf of the Customer and in accordance with documented instructions as set out in this DPA and the applicable Terms of Service.' },
            { heading: '3. Processing Scope and Purpose', text: 'SBrandOps processes Customer Data solely to provide the contracted service: storing brand assets, managing content workflows, syncing social analytics, facilitating inbox management, and supporting AI-powered features. We do not process Customer Data for our own commercial purposes or for advertising to third parties.' },
            { heading: '4. Categories of Personal Data', text: 'Depending on the Customer\'s use, processed data may include: account user names and email addresses; social media audience analytics (aggregated); customer contact data entered into Inbox features; content drafts and brand assets uploaded by the team; and OAuth tokens for connected integrations.' },
            { heading: '5. Duration', text: 'Processing continues for the duration of the active subscription. Upon termination, Customer Data is retained for 90 days to allow reactivation or export, then deleted or anonymized per our data retention schedule.' },
            { heading: '6. Security Measures', text: 'We implement appropriate technical and organizational measures including: encryption of data in transit (TLS 1.2+) and at rest; encrypted storage of OAuth tokens; role-based access controls; audit logging of sensitive operations; and regular security reviews. Details are available at sbrandops.com/security.' },
            { heading: '7. Sub-processors', text: 'We use the following sub-processor categories: cloud database and infrastructure (Supabase/AWS); payment processing (Stripe); AI inference services (Google Gemini and/or other providers); and email delivery services. We will notify Customers of sub-processor changes with at least 14 days\' notice.' },
            { heading: '8. Data Subject Rights', text: 'Upon receiving a verifiable data subject rights request, we will within 5 business days either fulfill the request as Processor or notify the Customer so the Customer (Controller) can fulfill it directly.' },
            { heading: '9. Data Transfers', text: 'Where Customer Data is transferred outside the EEA/UK, such transfers are covered by EU Standard Contractual Clauses (SCCs) or other approved mechanisms. Country-specific documentation may be requested at legal@sbrandops.com.' },
            { heading: '10. Breach Notification', text: 'In the event of a confirmed personal data breach affecting Customer Data, we will notify the Customer without undue delay and within 72 hours of becoming aware, providing information required under GDPR Article 33(3).' },
            { heading: '11. Audit Rights', text: 'The Customer may request an annual written summary of our security controls. We will support audits by mandated third-party auditors subject to reasonable notice, scope agreement, and confidentiality terms.' },
            { heading: '12. Executing This DPA', text: 'Enterprise customers requiring a countersigned DPA: email legal@sbrandops.com with your company name, contracting entity, jurisdiction, and billing contact. We respond within 5 business days.' },
        ],
        arBlocks: [
            { text: 'تُشكّل اتفاقية معالجة البيانات هذه جزءاً من العقد بينك ("العميل") وبين SMA Marketing ("المعالج") لاستخدام SBrandOps. تنطبق حيثما تعالج المنصة بيانات شخصية نيابةً عن العميل، وتستوفي متطلبات المادة 28 من اللائحة GDPR.' },
            { heading: '١. التعريفات', text: 'تحمل المصطلحات المعاني المحددة في اللائحة GDPR. "بيانات العميل" تعني أي بيانات شخصية يرسلها العميل إلى المنصة عبر استخدام الحساب أو التكاملات أو تحميلات المحتوى.' },
            { heading: '٢. الأدوار', text: 'يعمل العميل بصفة متحكم في البيانات. تعمل SMA Marketing بصفة معالج، تعالج بيانات العميل فقط نيابةً عنه ووفق تعليماته الموثقة كما هو محدد في هذه الاتفاقية وشروط الاستخدام.' },
            { heading: '٣. نطاق المعالجة والغرض', text: 'تعالج SBrandOps بيانات العميل فقط لتقديم الخدمة المتعاقد عليها: تخزين أصول البراند، إدارة سير عمل المحتوى، مزامنة التحليلات، وتشغيل ميزات الذكاء الاصطناعي. لا نعالج بيانات العميل لأغراضنا التجارية.' },
            { heading: '٤. فئات البيانات الشخصية', text: 'قد تشمل البيانات المعالجة: أسماء مستخدمي الحساب وبريدهم الإلكتروني؛ تحليلات جماهير وسائل التواصل (مجمّعة)؛ بيانات الاتصال في ميزات Inbox؛ مسودات المحتوى وأصول البراند؛ ورموز OAuth.' },
            { heading: '٥. مدة المعالجة', text: 'تستمر المعالجة طوال الاشتراك النشط. عند الإنهاء، تُحفظ بيانات العميل 90 يوماً للسماح بإعادة التفعيل أو التصدير، ثم تُحذف أو يُزال التعريف عنها.' },
            { heading: '٦. التدابير الأمنية', text: 'نطبّق تدابير تقنية وتنظيمية تشمل: تشفير البيانات أثناء النقل وفي حالة السكون؛ تشفير رموز OAuth؛ التحكم في الوصول القائم على الأدوار؛ وسجلات التدقيق. التفاصيل متاحة على sbrandops.com/security.' },
            { heading: '٧. المعالجون الفرعيون', text: 'نستخدم: البنية التحتية السحابية (Supabase/AWS)؛ معالجة الدفع (Stripe)؛ خدمات الذكاء الاصطناعي (Google Gemini وغيره)؛ وخدمات تسليم البريد. سنخطر العملاء بالتغييرات قبل 14 يوماً.' },
            { heading: '٨. حقوق أصحاب البيانات', text: 'عند استلام طلب موثّق، سنُخطر العميل خلال 5 أيام عمل لتمكينه من الوفاء بالطلب أو سننجزه مباشرة بما في وسعنا بصفتنا معالجاً.' },
            { heading: '٩. نقل البيانات', text: 'حيثما تُنقل بيانات العميل خارج المنطقة الاقتصادية الأوروبية، تغطيها بنود العقود النموذجية أو آليات النقل المعتمدة. وثائق النقل الخاصة بالبلد متاحة عبر legal@sbrandops.com.' },
            { heading: '١٠. إخطار الاختراق', text: 'عند حدوث اختراق مؤكد، سنخطر العميل خلال 72 ساعة مع تقديم المعلومات المطلوبة بموجب المادة 33(3) من GDPR.' },
            { heading: '١١. تنفيذ الاتفاقية', text: 'للعملاء المؤسسيين الذين يحتاجون إلى اتفاقية DPA موقّعة، أرسل طلبك إلى legal@sbrandops.com مع اسم شركتك والجهة المتعاقدة. سنرد خلال 5 أيام عمل.' },
        ],
    },
    refunds: {
        arTitle: 'سياسة الاسترجاع', enTitle: 'Refund Policy', effective: 'April 26, 2026',
        enBlocks: [
            { text: 'This Refund Policy explains how SBrandOps handles cancellations, plan changes, and refund requests. Our goal is fairness and transparency. For billing issues not covered here, contact billing@sbrandops.com.' },
            { heading: '1. Subscription Structure', text: 'All paid plans are prepaid subscriptions billed monthly or annually as selected at checkout. Fees are charged at the start of each billing period and cover access to the platform for the full duration of that period.' },
            { heading: '2. Free Trial', text: 'Where a free trial is offered, no charge is applied until the trial ends. Cancelling before the trial ends incurs no charge. Trial eligibility is one per organization; abuse of trial offers may result in account restrictions.' },
            { heading: '3. Cancellation', text: 'You may cancel at any time from Settings → Billing inside the app or via the Customer Portal. Cancellation takes effect at the end of the current billing period. You retain full access until that date. We do not issue partial-period refunds for mid-cycle cancellations.' },
            { heading: '4. Refund Eligibility', text: 'Refunds are considered in these situations: (a) Billing errors — incorrect charges due to a platform error are refunded in full; (b) Duplicate charges — duplicate charges for the same period are refunded immediately; (c) Annual plans — customers on annual plans who cancel within 7 days of initial purchase may request a pro-rated refund for unused months, minus any promotional discount received.' },
            { heading: '5. Non-Refundable', text: 'We do not issue refunds for: change of mind after the 7-day window on annual plans; completed monthly subscription periods; accounts suspended for Terms of Service violations; one-time setup fees once delivered; or non-use of the platform during an active subscription.' },
            { heading: '6. Plan Downgrades', text: 'Downgrading to a lower plan applies from the next billing period. We do not issue credits or refunds for the price difference in the current period unless a billing error is involved.' },
            { heading: '7. How to Request', text: 'Email billing@sbrandops.com with subject "Refund Request" including: your registered email, workspace name, the billing date and amount, and a brief explanation. We review and respond within 5 business days. Approved refunds are issued to the original payment method within 7–10 business days.' },
            { heading: '8. Currency and Taxes', text: 'Refunds are issued in the original transaction currency. We are not responsible for conversion fees by your financial institution. Where taxes were included, refunds will include the proportional tax amount.' },
            { heading: 'Contact', text: 'Billing questions and refund requests: billing@sbrandops.com. For urgent issues, include "URGENT" in the subject line.' },
        ],
        arBlocks: [
            { text: 'توضح سياسة الاسترجاع هذه كيف تتعامل SBrandOps مع الإلغاءات وتغييرات الخطط وطلبات الاسترجاع. هدفنا الشفافية والعدالة. للتواصل بشأن مشكلة غير مشمولة هنا: billing@sbrandops.com.' },
            { heading: '١. هيكل الاشتراك', text: 'جميع الخطط المدفوعة اشتراكات مسبقة الدفع تُفوتر شهرياً أو سنوياً. تُحصّل الرسوم في بداية كل دورة فوترة وتغطي الوصول الكامل للمنصة طوال تلك الفترة.' },
            { heading: '٢. التجربة المجانية', text: 'لا يُطبّق أي رسوم حتى انتهاء فترة التجربة. إلغاء الاشتراك قبل انتهائها لا يُولّد أي رسوم. التجربة لمرة واحدة لكل مؤسسة.' },
            { heading: '٣. الإلغاء', text: 'يمكنك الإلغاء في أي وقت من الإعدادات ← الفوترة داخل التطبيق أو عبر بوابة العملاء. يسري الإلغاء في نهاية دورة الفوترة الحالية مع الحفاظ على الوصول الكامل حتى ذلك التاريخ. لا نُطبّق استردادات جزئية للإلغاء في منتصف الدورة.' },
            { heading: '٤. أهلية الاسترجاع', text: 'يُنظر في الطلبات في الحالات التالية: (أ) أخطاء الفوترة — نُصدر استرداداً كاملاً للمبلغ الخاطئ؛ (ب) الرسوم المكررة — نُرجعها فوراً؛ (ج) الخطط السنوية — يمكن طلب استرداد نسبي عند الإلغاء خلال 7 أيام من الشراء الأولي مطروحاً منه الخصومات الترويجية.' },
            { heading: '٥. الحالات غير القابلة للاسترجاع', text: 'لا نُصدر استردادات في حالات: تغيير الرأي بعد نافذة الـ7 أيام للخطط السنوية؛ فترات الاشتراك الشهري المكتملة؛ الحسابات الموقوفة بسبب انتهاك الشروط؛ رسوم الإعداد بعد التسليم؛ أو عدم استخدام المنصة خلال الاشتراك النشط.' },
            { heading: '٦. التخفيض إلى خطة أدنى', text: 'يسري سعر الخطة الأدنى من دورة الفوترة التالية. لا نُصدر رصيداً للفرق في الدورة الحالية ما لم يكن هناك خطأ في الفوترة.' },
            { heading: '٧. كيفية تقديم طلب الاسترجاع', text: 'راسل billing@sbrandops.com بعنوان "طلب استرجاع" مع ذكر: بريدك المسجّل، اسم مساحة العمل، تاريخ ومبلغ الفوترة، وشرح مختصر. سنرد خلال 5 أيام عمل. تُصدر الاستردادات لوسيلة الدفع الأصلية خلال 7-10 أيام عمل.' },
            { heading: 'التواصل', text: 'للاستفسارات: billing@sbrandops.com. للحالات العاجلة، اذكر "عاجل" في عنوان الرسالة.' },
        ],
    },
    cookies: {
        arTitle: 'سياسة ملفات الارتباط', enTitle: 'Cookie Policy', effective: 'April 26, 2026',
        enBlocks: [
            { text: 'This Cookie Policy explains what cookies and similar technologies SBrandOps uses, why we use them, and how you can control them. By using SBrandOps, you consent to cookies as described here, subject to your preferences.' },
            { heading: '1. What Are Cookies', text: 'Cookies are small text files stored on your device by your browser when you visit a website or web application. They allow the application to remember session information, preferences, and activity. Similar technologies include local storage and session storage.' },
            { heading: '2. Categories', text: 'We use three categories: Essential Cookies (always active, required for core functionality), Functional Cookies (improve experience, can be disabled), and Analytics Cookies (optional, require consent in jurisdictions that mandate it).' },
            { heading: '3. Essential Cookies', text: 'These are strictly necessary for SBrandOps to function and cannot be switched off. They include: authentication session tokens; CSRF protection tokens; language and locale preferences; and billing session continuity for secure checkout. These do not require your consent as they are technically required.' },
            { heading: '4. Functional Cookies', text: 'These improve your experience without being strictly necessary: workspace layout and sidebar preferences; dark/light mode selection; notification settings; and last-visited page within the app. You can disable these in browser settings, though some interface features may behave inconsistently.' },
            { heading: '5. Analytics Cookies', text: 'We may use analytics tools to understand aggregate platform usage and improve the product. These collect anonymized or pseudonymized data about page visits and feature usage. Where required by law (e.g., EEA), analytics cookies are only set after explicit consent via our consent banner.' },
            { heading: '6. Third-Party Cookies', text: 'Some features involve third-party services that may set their own cookies: Stripe (payment checkout); embedded support widgets (where active). We do not control third-party cookies — review their respective privacy and cookie policies.' },
            { heading: '7. Cookie Duration', text: 'Essential session cookies expire on browser close or after an inactivity period (7 days for "remember me" sessions). Preference cookies persist up to 12 months. Analytics cookies persist 12–24 months depending on the tool.' },
            { heading: '8. Managing Preferences', text: 'Manage cookies through: your browser settings (block, delete, or receive notifications about cookies); in-app privacy settings where available; or email privacy@sbrandops.com to disable analytics tracking for your account. Blocking essential cookies will prevent use of the service.' },
            { heading: '9. Changes', text: 'We may update this Cookie Policy to reflect technology or legal changes. Updates will be posted here with a revised effective date.' },
            { heading: 'Contact', text: 'For cookie or data rights questions: privacy@sbrandops.com.' },
        ],
        arBlocks: [
            { text: 'توضح سياسة ملفات الارتباط هذه ما تستخدمه SBrandOps من ملفات الارتباط وتقنيات التتبع، ولماذا نستخدمها، وكيف يمكنك التحكم فيها.' },
            { heading: '١. ما هي ملفات الارتباط', text: 'ملفات الارتباط ملفات نصية صغيرة يخزنها متصفحك على جهازك. تتيح للتطبيق تذكّر معلومات جلستك وتفضيلاتك ونشاطك. تشمل التقنيات المماثلة التخزين المحلي وتخزين الجلسة.' },
            { heading: '٢. الفئات', text: 'نستخدم ثلاث فئات: ملفات الارتباط الأساسية (نشطة دائماً، مطلوبة للعمل الأساسي)، والوظيفية (تُحسّن التجربة وقابلة للتعطيل)، والتحليلية (اختيارية، تتطلب موافقة حيثما يقتضي القانون).' },
            { heading: '٣. ملفات الارتباط الأساسية', text: 'ضرورية لعمل SBrandOps ولا يمكن إيقافها. تشمل: رموز جلسة المصادقة؛ رموز حماية CSRF؛ تفضيلات اللغة؛ وجلسة الدفع الآمنة. لا تتطلب موافقتك لأنها ضرورية تقنياً.' },
            { heading: '٤. ملفات الارتباط الوظيفية', text: 'تُحسّن تجربتك دون أن تكون ضرورية تقنياً: تفضيلات تخطيط مساحة العمل والشريط الجانبي؛ تحديد الوضع الليلي/النهاري؛ إعدادات الإشعارات. يمكن تعطيلها من إعدادات المتصفح.' },
            { heading: '٥. ملفات الارتباط التحليلية', text: 'قد نستخدم أدوات تحليل لفهم الاستخدام المجمّع وتحسين المنتج. تجمع بيانات مجهولة الهوية. في المناطق التي يشترط فيها القانون الموافقة، لا تُنشأ إلا بعد حصولنا على موافقتك الصريحة.' },
            { heading: '٦. ملفات الارتباط الخارجية', text: 'بعض الميزات تتضمن خدمات طرف ثالث: Stripe (عملية الدفع)؛ وأدوات الدعم المضمّنة. لا نتحكم في ملفات الارتباط الخارجية — راجع سياساتها الخاصة.' },
            { heading: '٧. مدة ملفات الارتباط', text: 'تنتهي ملفات الجلسة الأساسية عند إغلاق المتصفح أو بعد فترة خمول (7 أيام لجلسات "تذكرني"). تستمر ملفات التفضيلات حتى 12 شهراً. تستمر التحليلية 12-24 شهراً.' },
            { heading: '٨. إدارة تفضيلاتك', text: 'يمكنك إدارة ملفات الارتباط عبر إعدادات المتصفح أو إعدادات الخصوصية داخل التطبيق أو بمراسلة privacy@sbrandops.com. حظر الملفات الأساسية سيمنع استخدام الخدمة.' },
            { heading: '٩. التعديلات', text: 'قد نحدّث هذه السياسة لتعكس تغييرات في التقنيات أو القانون. ستُنشر التحديثات هنا مع تاريخ سريان منقّح.' },
            { heading: 'التواصل', text: 'لملفات الارتباط وحقوق البيانات: privacy@sbrandops.com.' },
        ],
    },
};

const formatMoney = (amount: number | null, currency = 'USD') => {
    if (amount === null) return 'Custom';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
};

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

const HeroDashboardMock: React.FC = () => {
    const bars = [35, 52, 41, 68, 45, 82, 60, 88, 72, 57, 78, 92];
    return (
        <div className="relative select-none">
            <div className="absolute -inset-8 rounded-[3rem] bg-blue-600/10 blur-[60px]" />
            <div className="absolute -inset-12 rounded-[4rem] bg-cyan-500/6 blur-[80px]" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1329] shadow-[0_40px_80px_rgba(0,0,0,0.7)]">
                {/* Browser bar */}
                <div className="flex items-center gap-2 border-b border-white/5 bg-black/20 px-4 py-3">
                    <div className="flex gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
                    </div>
                    <div className="mx-auto flex h-6 w-48 items-center justify-center gap-1.5 rounded-full bg-white/5 px-3">
                        <i className="fas fa-lock text-[8px] text-white/20" />
                        <span className="text-[10px] text-white/20">app.sbrandops.com</span>
                    </div>
                </div>
                {/* App shell */}
                <div className="flex h-[380px]">
                    {/* Sidebar */}
                    <div className="flex w-12 flex-col items-center gap-2 border-r border-white/5 bg-black/10 px-2 py-4">
                        {[
                            { icon: 'fa-gauge-high', cls: 'bg-cyan-500/20 text-cyan-400' },
                            { icon: 'fa-brain', cls: 'text-white/20' },
                            { icon: 'fa-pen-nib', cls: 'text-white/20' },
                            { icon: 'fa-share-nodes', cls: 'text-white/20' },
                            { icon: 'fa-inbox', cls: 'text-white/20' },
                            { icon: 'fa-rectangle-ad', cls: 'text-white/20' },
                            { icon: 'fa-chart-mixed', cls: 'text-white/20' },
                            { icon: 'fa-circle-nodes', cls: 'text-white/20' },
                        ].map((item, i) => (
                            <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-xl text-[11px] ${item.cls}`}>
                                <i className={`fas ${item.icon}`} />
                            </div>
                        ))}
                    </div>
                    {/* Main content */}
                    <div className="flex-1 overflow-hidden p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">CONTROL CENTER</p>
                                <p className="mt-0.5 text-[13px] font-bold text-white/70">Today's Operations</p>
                            </div>
                            <div className="flex gap-2">
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-60" />
                                <div className="h-6 w-20 rounded-lg bg-blue-500/20" />
                            </div>
                        </div>
                        {/* KPI cards */}
                        <div className="mb-3 grid grid-cols-4 gap-1.5">
                            {[
                                { icon: 'fa-calendar-check', val: '12', lbl: 'Scheduled', cls: 'bg-blue-500/20 text-blue-400' },
                                { icon: 'fa-message', val: '7', lbl: 'Inbox', cls: 'bg-cyan-500/20 text-cyan-400' },
                                { icon: 'fa-bullhorn', val: '3', lbl: 'Campaigns', cls: 'bg-indigo-500/20 text-indigo-400' },
                                { icon: 'fa-circle-check', val: '28', lbl: 'Published', cls: 'bg-emerald-500/20 text-emerald-400' },
                            ].map((kpi, i) => (
                                <div key={i} className="rounded-xl bg-white/5 p-2.5">
                                    <div className={`mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg text-[10px] ${kpi.cls}`}>
                                        <i className={`fas ${kpi.icon}`} />
                                    </div>
                                    <p className="text-[15px] font-bold text-white/80">{kpi.val}</p>
                                    <p className="text-[9px] text-white/25">{kpi.lbl}</p>
                                </div>
                            ))}
                        </div>
                        {/* Chart + priority list */}
                        <div className="grid grid-cols-[1fr_0.75fr] gap-2">
                            <div className="rounded-xl bg-white/5 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="h-2 w-20 rounded-full bg-white/20" />
                                    <div className="h-1.5 w-10 rounded-full bg-white/10" />
                                </div>
                                <div className="flex h-[95px] items-end gap-1">
                                    {bars.map((h, i) => (
                                        <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i >= 10 ? 'linear-gradient(to top, #2563EB, #06B6D4)' : 'rgba(255,255,255,0.07)' }} />
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/5 p-3">
                                <div className="mb-3 h-2 w-16 rounded-full bg-white/20" />
                                {[85, 65, 90].map((w, i) => (
                                    <div key={i} className="mb-2.5 last:mb-0 flex items-center gap-2">
                                        <div className={`h-5 w-5 flex-shrink-0 rounded-lg ${['bg-blue-500/25', 'bg-cyan-500/25', 'bg-indigo-500/25'][i]}`} />
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="h-1.5 rounded-full bg-white/15" style={{ width: `${w}%` }} />
                                            <div className="h-1 rounded-full bg-white/10" style={{ width: `${w - 20}%` }} />
                                        </div>
                                    </div>
                                ))}
                                <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-indigo-500/15 px-2 py-1.5">
                                    <span className="text-[8px] font-bold text-indigo-400">AI</span>
                                    <div className="h-1.5 flex-1 rounded-full bg-white/10" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RouteLink: React.FC<{ href: string; className?: string; children: React.ReactNode; onClick?: () => void }> = ({ href, className, children, onClick }) => (
    href.includes('#')
        ? <a href={href} className={className} onClick={onClick}>{children}</a>
        : <Link to={href} className={className} onClick={onClick}>{children}</Link>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

const MarketingSite: React.FC<MarketingSiteProps> = ({ pageId, isAuthenticated }) => {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const isArabic = language === 'ar';
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
    const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const publicPlans = useMemo(() => PRICING_PLANS.filter(plan => DEFAULT_PUBLIC_PRICING_PLAN_IDS.includes(plan.id)), []);
    const primaryLabel = isAuthenticated ? (isArabic ? 'افتح التطبيق' : 'Open App') : (isArabic ? 'ابدأ التجربة المجانية' : 'Start Free Trial');
    const appLabel = isAuthenticated ? (isArabic ? 'اذهب إلى مساحة العمل' : 'Go to Workspace') : primaryLabel;
    const contactLabel = isArabic ? 'احجز عرضًا مباشرًا' : 'Book Demo';
    const primaryCtaAction = () => navigate(isAuthenticated ? '/app' : '/register');

    const navItems = [
        { id: 'home' as const, label: isArabic ? 'الرئيسية' : 'Home', href: publicPageToPath('home') },
        { id: 'about' as const, label: isArabic ? 'من نحن' : 'About', href: publicPageToPath('about') },
        { id: 'pricing' as const, label: isArabic ? 'الأسعار' : 'Pricing', href: publicPageToPath('pricing') },
        { id: 'contact' as const, label: isArabic ? 'تواصل معنا' : 'Contact', href: publicPageToPath('contact') },
    ];

    const handlePlanCheckout = async (planId: string) => {
        if (planId === 'enterprise') { navigate('/contact'); return; }
        if (!isAuthenticated) { navigate('/register'); return; }
        setCheckoutError(null);
        setPendingPlanId(planId);
        try {
            const result = await openBillingCheckout({ planId, billingCycle });
            if (result.mode !== 'checkout') setCheckoutError(result.message);
        } catch (error) {
            setCheckoutError(error instanceof Error ? error.message : (isArabic ? 'تعذر بدء الدفع.' : 'Failed to start checkout.'));
        } finally {
            setPendingPlanId(null);
        }
    };

    // ── HOME ──────────────────────────────────────────────────────────────────
    const renderHome = () => (
        <>
            {/* HERO */}
            <section className="relative overflow-hidden rounded-[2rem] bg-[#070B1F] px-8 py-20 lg:py-28" style={{ margin: '1.5rem -1.5rem 0' }}>
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-[-15%] top-[-5%] h-[500px] w-[500px] rounded-full bg-blue-600/12 blur-[100px]" />
                    <div className="absolute right-[-5%] top-[15%] h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[90px]" />
                    <div className="absolute bottom-[-10%] left-[30%] h-[350px] w-[350px] rounded-full bg-cyan-500/6 blur-[80px]" />
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                </div>
                <div className="relative mx-auto max-w-7xl">
                    <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-4 py-1.5">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-400">
                                    {isArabic ? 'نظام التشغيل للبراند' : 'AI-Powered Brand Operating System'}
                                </span>
                            </div>
                            <h1 className="mt-6 max-w-xl text-5xl font-black leading-[1.05] tracking-tight text-white md:text-6xl lg:text-[62px]">
                                {isArabic ? (
                                    <>شغّل البراند<br /><span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">من نظام واحد</span></>
                                ) : (
                                    <>One System.<br /><span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">Smarter Growth.</span></>
                                )}
                            </h1>
                            <p className="mt-6 max-w-lg text-lg leading-8 text-white/55">
                                {isArabic
                                    ? 'خطط للمحتوى، انشر عبر القنوات، راقب الأداء، وأدر الفريق من مساحة تشغيل واحدة مدعومة بالذكاء الاصطناعي.'
                                    : 'Plan content, publish across channels, monitor performance, and operate your team from one AI-powered workspace — instead of scattered tools.'}
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <button onClick={primaryCtaAction} className="group inline-flex items-center gap-2 rounded-[14px] bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all hover:-translate-y-0.5 hover:bg-blue-500">
                                    {primaryLabel}
                                    <i className="fas fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" />
                                </button>
                                <Link to={publicPageToPath('contact')} className="inline-flex items-center gap-2 rounded-[14px] border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10">
                                    <i className="fas fa-calendar-check text-xs text-cyan-400" />
                                    {contactLabel}
                                </Link>
                            </div>
                            <div className="mt-10">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">{isArabic ? 'تكاملات أساسية' : 'Core integrations'}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                                    {['Meta', 'Instagram', 'TikTok', 'LinkedIn', 'Google', 'Shopify'].map(name => (
                                        <span key={name} className="text-xs font-semibold text-white/30">{name}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <HeroDashboardMock />
                    </div>
                </div>
            </section>

            {/* PROBLEM */}
            <section className="py-20">
                <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'المشكلة' : 'The Problem'}</p>
                        <h2 className="mt-4 text-3xl font-bold leading-snug text-slate-950 dark:text-white md:text-4xl">
                            {isArabic ? 'المشكلة ليست نقص الأدوات. بل تشتت التشغيل.' : 'The problem is not missing tools. It is fragmented execution.'}
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">
                            {isArabic ? 'الفرق تعمل بأدوات كثيرة لكنها مشتتة — ويضيع الوقت في الانتقال لا في التنفيذ.' : 'Teams operate across too many tools — time is lost in switching, not executing.'}
                        </p>
                    </div>
                    <div className="space-y-2.5">
                        {[
                            { icon: 'fa-puzzle-piece', ar: 'المحتوى في أداة، والإعلانات في أخرى، والتحليلات في مكان ثالث.', en: 'Content is in one tool, ads in another, and analytics somewhere else.' },
                            { icon: 'fa-arrows-spin', ar: 'الوقت يضيع في الانتقال بين المنصات بدل التنفيذ الفعلي.', en: 'Execution time is lost jumping between disconnected platforms.' },
                            { icon: 'fa-memory', ar: 'لا توجد ذاكرة موحدة لصوت البراند والرسائل الأساسية عبر الفريق.', en: 'No shared memory for brand voice and core messaging across the team.' },
                            { icon: 'fa-link-slash', ar: 'من الصعب ربط الأداء التسويقي بالإيرادات والقرارات اليومية.', en: 'Connecting marketing performance to revenue and daily decisions is nearly impossible.' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-4 rounded-[20px] border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-sm text-red-500">
                                    <i className={`fas ${item.icon}`} />
                                </div>
                                <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{isArabic ? item.ar : item.en}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* MODULES GRID */}
            <section id="product" className="py-20">
                <div className="mb-12">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'النظام' : 'The System'}</p>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
                        <h2 className="max-w-2xl text-3xl font-bold leading-snug text-slate-950 dark:text-white md:text-4xl">
                            {isArabic ? 'كل وظائف النمو تحت نموذج تشغيل واحد' : 'All growth operations under one operating model.'}
                        </h2>
                        <p className="max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
                            {isArabic ? '10 وحدات متكاملة — كل واحدة تحل مشكلة حقيقية، وكلها مترابطة في سياق البراند الواحد.' : '10 integrated modules — each solving a real problem, all connected within one brand context.'}
                        </p>
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {MODULES.map(mod => (
                        <div key={mod.title} className="group rounded-[20px] border border-slate-200 bg-white p-6 transition-all hover:border-blue-500/30 hover:shadow-[0_16px_50px_rgba(6,182,212,0.10)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30">
                            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-base ${mod.color}`}>
                                <i className={`fas ${mod.icon}`} />
                            </div>
                            <h3 className="mt-4 text-base font-bold text-slate-950 dark:text-white">{mod.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{isArabic ? mod.arDesc : mod.enDesc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* AI LAYER */}
            <section className="relative overflow-hidden rounded-[2rem] bg-[#070B1F] px-8 py-20" style={{ margin: '0 -1.5rem' }}>
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute right-[10%] top-[10%] h-64 w-64 rounded-full bg-indigo-600/10 blur-[80px]" />
                    <div className="absolute left-[5%] bottom-[10%] h-56 w-56 rounded-full bg-cyan-500/8 blur-[70px]" />
                </div>
                <div className="relative mx-auto max-w-7xl grid gap-14 lg:grid-cols-2 lg:items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-4 py-1.5">
                            <i className="fas fa-microchip text-xs text-indigo-400" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400">{isArabic ? 'طبقة الذكاء الاصطناعي' : 'AI Layer'}</span>
                        </div>
                        <h2 className="mt-5 text-3xl font-bold leading-snug text-white md:text-4xl">
                            {isArabic
                                ? 'الذكاء الاصطناعي هنا للتخطيط والتنفيذ والتحسين — لا للكتابة فقط.'
                                : 'AI that plans, executes, and improves — not just a writing tool.'}
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-white/50">
                            {isArabic
                                ? 'كل طلب AI يمر عبر Brand Brain الذي يحمل صوت البراند وقيمه وجمهوره — ليضمن مخرجات تعكس هوية البراند دائمًا عبر 14 مهارة تسويقية متخصصة.'
                                : 'Every AI request flows through Brand Brain — carrying brand voice, values, and audiences — guaranteeing outputs that always reflect your brand identity across 14 specialized marketing skills.'}
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {AI_CAPABILITIES.map(cap => (
                            <div key={cap.en} className="rounded-[20px] border border-white/[0.08] bg-white/5 p-4 backdrop-blur-sm">
                                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-sm text-indigo-400">
                                    <i className={`fas ${cap.icon}`} />
                                </div>
                                <h3 className="text-sm font-bold text-white">{isArabic ? cap.ar : cap.en}</h3>
                                <p className="mt-1 text-xs leading-5 text-white/40">{isArabic ? cap.dAr : cap.dEn}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section id="workflow" className="py-20">
                <div className="mb-12">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'طريقة العمل' : 'How It Works'}</p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-snug text-slate-950 dark:text-white md:text-4xl">
                        {isArabic ? 'من إضافة البراند إلى التحسين المستمر في 6 خطوات' : 'From brand setup to continuous optimization in 6 steps.'}
                    </h2>
                </div>
                <div className="space-y-3">
                    {WORKFLOW_STEPS.map((step, i) => (
                        <div key={i} className="grid gap-4 rounded-[20px] border border-slate-200 bg-white p-5 transition-all hover:border-blue-500/30 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[64px_1fr_2fr] lg:items-center lg:gap-6">
                            <div className="flex items-center gap-3 lg:block lg:text-center">
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.35)]">
                                    <i className={`fas ${step.icon} text-sm`} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 lg:mt-1 lg:block">{step.num}</span>
                            </div>
                            <h3 className="text-base font-bold text-slate-950 dark:text-white">{isArabic ? step.ar : step.en}</h3>
                            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{isArabic ? step.aSub : step.eSub}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* BEFORE / AFTER */}
            <section className="py-20">
                <div className="mb-12">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'قبل وبعد' : 'Before vs After'}</p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-snug text-slate-950 dark:text-white md:text-4xl">
                        {isArabic ? 'من فوضى الأدوات إلى نظام تشغيل واحد' : 'From scattered tools to one operating system.'}
                    </h2>
                </div>
                <div className="overflow-hidden rounded-[20px] border border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-[44px_1fr_1fr] bg-slate-50 dark:bg-[#0c1321]">
                        <div />
                        <div className="border-x border-slate-200 px-5 py-3 dark:border-slate-800">
                            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-400" /><span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{isArabic ? 'الوضع الحالي' : 'Before'}</span></div>
                        </div>
                        <div className="px-5 py-3">
                            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-400" /><span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">SBrandOps</span></div>
                        </div>
                    </div>
                    {BEFORE_AFTER.map((row, i) => (
                        <div key={i} className={`grid grid-cols-[44px_1fr_1fr] border-t border-slate-200 dark:border-slate-800 ${i % 2 === 0 ? 'bg-white dark:bg-slate-900/50' : 'bg-slate-50/60 dark:bg-slate-900/30'}`}>
                            <div className="flex items-center justify-center py-4">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 dark:bg-slate-800"><i className={`fas ${row.icon}`} /></div>
                            </div>
                            <div className="flex items-center border-x border-slate-200 px-5 py-4 dark:border-slate-800">
                                <p className="text-sm text-slate-500">{isArabic ? row.bAr : row.bEn}</p>
                            </div>
                            <div className="flex items-center px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <i className="fas fa-check-circle text-xs text-cyan-500" />
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{isArabic ? row.aAr : row.aEn}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* USE CASES */}
            <section className="py-20">
                <div className="mb-12">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'حالات الاستخدام' : 'Use Cases'}</p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-snug text-slate-950 dark:text-white md:text-4xl">
                        {isArabic ? 'مبني للفرق التي تحتاج تنفيذًا حقيقيًا' : 'Built for teams that need real execution.'}
                    </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {USE_CASES.map(uc => (
                        <div key={uc.en} className="rounded-[20px] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-base ${uc.color}`}>
                                <i className={`fas ${uc.icon}`} />
                            </div>
                            <h3 className="mt-4 text-base font-bold text-slate-950 dark:text-white">{isArabic ? uc.ar : uc.en}</h3>
                            <p className="mt-2 text-sm leading-6 text-red-500/80 dark:text-red-400/70">{isArabic ? uc.pAr : uc.pEn}</p>
                            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{isArabic ? uc.sAr : uc.sEn}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* INTEGRATIONS */}
            <section className="rounded-[20px] border border-slate-200 bg-white px-8 py-14 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-8 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'التكاملات' : 'Integrations'}</p>
                    <h2 className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">{isArabic ? 'اربط الأدوات التي تستخدمها بالفعل' : 'Connect the tools you already use.'}</h2>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    {INTEGRATIONS.map(int => (
                        <div key={int.name} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
                            <i className={`fab ${int.fab} text-sm ${int.color}`} />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{int.name}</span>
                        </div>
                    ))}
                    <div className="rounded-full border border-dashed border-slate-300 px-4 py-2 dark:border-slate-700">
                        <span className="text-sm text-slate-400">{isArabic ? '+ المزيد قريبًا' : '+ More coming'}</span>
                    </div>
                </div>
            </section>

            {/* SOCIAL PROOF */}
            <section className="py-20">
                <div className="mb-12">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'أثر تشغيلي واضح' : 'Operational Proof'}</p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-snug text-slate-950 dark:text-white md:text-4xl">
                        {isArabic ? 'قيمة واضحة في السرعة والقرار والتنفيذ' : 'Clear value in speed, decision quality, and execution.'}
                    </h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    {CASE_STUDIES.map(item => (
                        <div key={item.enTitle} className="rounded-[20px] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-4xl font-black text-blue-600 dark:text-blue-400">{item.metric}</p>
                            <h3 className="mt-3 text-base font-bold text-slate-950 dark:text-white">{isArabic ? item.arTitle : item.enTitle}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{isArabic ? item.arBody : item.enBody}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {TESTIMONIALS.map((item, i) => (
                        <div key={i} className="rounded-[20px] bg-[#070B1F] p-6">
                            <p className="text-sm leading-7 text-white/65">&ldquo;{isArabic ? item.quoteAr : item.quoteEn}&rdquo;</p>
                            <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
                                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.gFrom} ${item.gTo} text-xs font-bold text-white`}>
                                    {item.initials}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{item.name}</p>
                                    <p className="text-[11px] uppercase tracking-[0.15em] text-white/30">{isArabic ? item.roleAr : item.roleEn}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* PRICING PREVIEW */}
            <section className="py-20">
                <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'الأسعار' : 'Pricing'}</p>
                        <h2 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">{isArabic ? 'خطط واضحة تناسب كل مرحلة نمو' : 'Straightforward plans for every growth stage.'}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                            {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
                                <button key={cycle} onClick={() => setBillingCycle(cycle)} className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${billingCycle === cycle ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-950 dark:hover:text-white'}`}>
                                    {cycle === 'monthly' ? (isArabic ? 'شهري' : 'Monthly') : (isArabic ? 'سنوي' : 'Yearly')}
                                </button>
                            ))}
                        </div>
                        <Link to={publicPageToPath('pricing')} className="text-sm font-semibold text-blue-600 dark:text-blue-400">{isArabic ? 'عرض كل الخطط ←' : 'See full pricing →'}</Link>
                    </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    {publicPlans.map(plan => {
                        const price = getBillingAmount(plan, billingCycle);
                        return (
                            <div key={plan.id} className={`rounded-[20px] border p-6 ${plan.highlighted ? 'border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-950 dark:text-white">{plan.name}</h3>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>
                                    </div>
                                    {plan.badge && <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span>}
                                </div>
                                <p className="mt-6 text-4xl font-black text-slate-950 dark:text-white">
                                    {formatMoney(price, plan.currency)}
                                    {price !== null && <span className="text-sm font-medium text-slate-400">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>}
                                </p>
                                <ul className="mt-5 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                                    {plan.features.map(feature => (
                                        <li key={feature} className="flex items-start gap-2">
                                            <i className="fas fa-check mt-0.5 text-xs text-cyan-500" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button onClick={() => handlePlanCheckout(plan.id)} disabled={pendingPlanId === plan.id} className={`mt-6 w-full rounded-[14px] px-5 py-3 text-sm font-semibold transition-all ${plan.highlighted ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.35)] hover:-translate-y-0.5' : 'border border-slate-300 bg-transparent text-slate-950 hover:border-blue-500 dark:border-slate-700 dark:text-white'}`}>
                                    {pendingPlanId === plan.id ? (isArabic ? 'جارٍ تجهيز الدفع...' : 'Preparing checkout...') : plan.ctaLabel}
                                </button>
                            </div>
                        );
                    })}
                </div>
                {checkoutError && <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{checkoutError}</div>}
            </section>

            {/* FAQ */}
            <section id="faq" className="py-20">
                <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">{isArabic ? 'الأسئلة الشائعة' : 'FAQ'}</p>
                        <h2 className="mt-4 text-3xl font-bold leading-snug text-slate-950 dark:text-white">{isArabic ? 'الأسئلة الأساسية قبل الاشتراك' : 'Core questions before you sign up.'}</h2>
                        <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">{isArabic ? 'لم تجد إجابة؟ تواصل معنا مباشرة.' : "Didn't find your answer? Talk to us directly."}</p>
                        <Link to={publicPageToPath('contact')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {isArabic ? 'تواصل معنا' : 'Contact us'} <i className="fas fa-arrow-right text-xs" />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {FAQ_ITEMS.map((item, i) => (
                            <div key={i} className="overflow-hidden rounded-[20px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between px-5 py-4" style={{ textAlign: isArabic ? 'right' : 'left' }}>
                                    <span className="text-sm font-semibold text-slate-950 dark:text-white">{isArabic ? item.arQ : item.enQ}</span>
                                    <i className={`fas fa-chevron-down ms-3 flex-shrink-0 text-xs text-slate-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                                </button>
                                {openFaq === i && (
                                    <div className="border-t border-slate-200 px-5 pb-4 pt-3 dark:border-slate-800">
                                        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{isArabic ? item.arA : item.enA}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* BOTTOM CTA */}
            <section className="relative overflow-hidden rounded-[2rem] bg-[#070B1F] px-8 py-20 text-center" style={{ margin: '0 -1.5rem 1.5rem' }}>
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-[20%] top-[10%] h-64 w-64 rounded-full bg-blue-600/12 blur-[90px]" />
                    <div className="absolute right-[15%] bottom-[10%] h-56 w-56 rounded-full bg-indigo-600/10 blur-[80px]" />
                </div>
                <div className="relative mx-auto max-w-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-400">{isArabic ? 'ابدأ الآن' : 'Get Started'}</p>
                    <h2 className="mt-4 text-4xl font-black leading-tight text-white md:text-5xl">
                        {isArabic ? (
                            <>جاهز لتشغيل البراند<br /><span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">من نظام واحد؟</span></>
                        ) : (
                            <>Ready to run your brand<br /><span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">from one system?</span></>
                        )}
                    </h2>
                    <p className="mt-5 text-sm leading-7 text-white/50">
                        {isArabic ? 'انضم إلى البراندات التي حوّلت فوضى التسويق إلى نظام تشغيل ذكي وقابل للتوسع.' : 'Join brands that have turned marketing chaos into one intelligent, scalable operating system.'}
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <button onClick={primaryCtaAction} className="inline-flex items-center gap-2 rounded-[14px] bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all hover:-translate-y-0.5 hover:bg-blue-500">
                            {primaryLabel} <i className="fas fa-arrow-right text-xs" />
                        </button>
                        <Link to={publicPageToPath('contact')} className="inline-flex items-center gap-2 rounded-[14px] border border-white/15 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:border-white/30 hover:bg-white/5">
                            {contactLabel}
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );

    // ── ABOUT ─────────────────────────────────────────────────────────────────
    const renderAbout = () => {
        const sections = [
            { title: isArabic ? 'قصتنا' : 'Our story', body: isArabic ? 'بُني SBrandOps لأن فرق التسويق كانت تعمل عبر أدوات كثيرة، والبيانات كانت مشتتة، والتنفيذ أبطأ من المطلوب.' : 'SBrandOps was built because marketing teams were operating across too many tools, with fragmented data and slow execution.' },
            { title: isArabic ? 'مهمتنا' : 'Our mission', body: isArabic ? 'توحيد تشغيل نمو البراند داخل نظام ذكي واحد يدعم التخطيط والتنفيذ والتحسين.' : 'To unify brand growth operations inside one intelligent system for planning, execution, and optimization.' },
            { title: isArabic ? 'ما نؤمن به' : 'What we believe', body: isArabic ? 'النظام قبل الفوضى، والبيانات قبل القرارات، والذكاء الاصطناعي يجب أن يخدم التنفيذ.' : 'Systems before chaos, data before decisions, and AI that serves execution.' },
            { title: isArabic ? 'ما يميزنا' : 'What makes us different', body: isArabic ? 'Arabic-first مع دعم إنجليزي، تشغيل متعدد البراندات، وربط فعلي بين التسويق والعمليات والنمو.' : 'Arabic-first with English support, multi-brand operations, and a tighter link between marketing, operations, and growth.' },
        ];
        return (
            <section className="py-16">
                <div className="max-w-3xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'من نحن' : 'About SBrandOps'}</p>
                    <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">{isArabic ? 'نحن نبني نظام تشغيل عملي للبراند' : 'We are building a real operating system for brands.'}</h1>
                </div>
                <div className="mt-12 grid gap-6 lg:grid-cols-2">
                    {sections.map(section => (
                        <div key={section.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="text-xl font-bold text-slate-950 dark:text-white">{section.title}</h2>
                            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{section.body}</p>
                        </div>
                    ))}
                </div>
            </section>
        );
    };

    // ── PRICING ───────────────────────────────────────────────────────────────
    const renderPricing = () => (
        <section className="py-16">
            <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الأسعار' : 'Pricing'}</p>
                <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">{isArabic ? 'اختر الخطة المناسبة لمرحلة نموك' : 'Choose the plan that matches your growth stage'}</h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{isArabic ? 'ابدأ بخطة مناسبة الآن، ثم وسّع الفريق والبراندات والفوترة والإدارة مع نمو التشغيل.' : 'Start with the right operating baseline now, then expand brands, team, billing, and governance as you grow.'}</p>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
                    <button key={cycle} onClick={() => setBillingCycle(cycle)} className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${billingCycle === cycle ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}>
                        {cycle === 'monthly' ? (isArabic ? 'شهري' : 'Monthly') : (isArabic ? 'سنوي' : 'Yearly')}
                    </button>
                ))}
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
                {publicPlans.map(plan => {
                    const price = getBillingAmount(plan, billingCycle);
                    const annualSaving = billingCycle === 'yearly' && plan.monthlyPrice !== null && plan.yearlyPrice !== null ? (plan.monthlyPrice * 12) - plan.yearlyPrice : 0;
                    return (
                        <div key={plan.id} className={`rounded-[2rem] border p-7 ${plan.highlighted ? 'border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-slate-950 dark:text-white">{plan.name}</h2>
                                {plan.badge && <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span>}
                            </div>
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
                            <p className="mt-8 text-5xl font-black text-slate-950 dark:text-white">
                                {formatMoney(price, plan.currency)}
                                {price !== null && <span className="text-base font-medium text-slate-400">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>}
                            </p>
                            {annualSaving > 0 && <p className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400">{isArabic ? `وفّر ${formatMoney(annualSaving, plan.currency)} سنويًا` : `Save ${formatMoney(annualSaving, plan.currency)} annually`}</p>}
                            <ul className="mt-8 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                {plan.features.map(feature => (
                                    <li key={feature} className="flex items-start gap-2">
                                        <i className="fas fa-check mt-1 text-xs text-cyan-500" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => handlePlanCheckout(plan.id)} disabled={pendingPlanId === plan.id} className={`mt-8 w-full rounded-2xl px-5 py-3 text-sm font-semibold ${plan.highlighted ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-transparent text-slate-950 dark:border-slate-700 dark:text-white'}`}>
                                {pendingPlanId === plan.id ? (isArabic ? 'جارٍ تجهيز الدفع...' : 'Preparing checkout...') : plan.id === 'starter' ? (isArabic ? 'ابدأ بـ Starter' : plan.ctaLabel) : plan.id === 'growth' ? (isArabic ? 'ابدأ بـ Growth' : plan.ctaLabel) : (isArabic ? 'ابدأ بـ Agency' : plan.ctaLabel)}
                            </button>
                        </div>
                    );
                })}
            </div>
            {checkoutError && <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{checkoutError}</div>}
        </section>
    );

    // ── BILLING ───────────────────────────────────────────────────────────────
    const renderBilling = () => (
        <section className="py-16">
            <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الفوترة' : 'Billing'}</p>
                <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">{isArabic ? 'فهم أوضح للاشتراك والفواتير من أول يوم' : 'Clear subscription and invoice operations from day one'}</h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{isArabic ? 'كل خطة لها دورة فوترة واضحة، وفواتير قابلة للتتبع، وإدارة للإلغاء أو الترقية أو الإيقاف من نفس مساحة العمل.' : 'Every plan has a clear billing cycle, traceable invoices, and in-app cancellation, upgrade, and pause controls.'}</p>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
                {[
                    { title: isArabic ? 'الدفع والاشتراك' : 'Checkout and subscriptions', body: isArabic ? 'تبدأ الخطة عبر Checkout آمن، ثم تُدار حالات الترقية والتخفيض والإيقاف من داخل تجربة الفوترة نفسها.' : 'Plans start in secure checkout, then upgrades, downgrades, and pauses are managed inside the same billing flow.' },
                    { title: isArabic ? 'الفواتير والامتثال المالي' : 'Invoices and finance ops', body: isArabic ? 'يمكن للفرق المالية مراجعة الفواتير، تواريخ التحصيل، ودورات السداد بدون الرجوع إلى دعم يدوي لكل حركة.' : 'Finance teams can review invoices, collection dates, and billing cycles without needing manual support for every change.' },
                    { title: isArabic ? 'دعم الفوترة' : 'Billing support', body: isArabic ? 'الأسئلة المتعلقة بالمدفوعات أو الاسترجاع أو تحديث جهة التعاقد تذهب إلى billing@sbrandops.com.' : 'Questions about payments, refunds, or billing entity changes are routed through billing@sbrandops.com.' },
                ].map(item => (
                    <div key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-xl font-bold text-slate-950 dark:text-white">{item.title}</h2>
                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.body}</p>
                    </div>
                ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
                <Link to={publicPageToPath('pricing')} className="rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white">{isArabic ? 'قارن الخطط' : 'Compare plans'}</Link>
                <a href="mailto:billing@sbrandops.com" className="rounded-2xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-white">{isArabic ? 'تواصل مع دعم الفوترة' : 'Contact billing support'}</a>
            </div>
        </section>
    );

    // ── SECURITY ──────────────────────────────────────────────────────────────
    const renderSecurity = () => (
        <section className="py-16">
            <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الأمان' : 'Security'}</p>
                <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">{isArabic ? 'طبقة تشغيل آمنة للفرق والبراندات والبيانات المتصلة' : 'A secure operating layer for teams, brands, and connected data'}</h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{isArabic ? 'نعامل الأمان كمسار تشغيل أساسي: صلاحيات، سجلات، حماية جلسات، وربط مزودين خارجيين ضمن حدود واضحة.' : 'We treat security as a core operating track: permissions, auditability, session protection, and tightly-scoped external integrations.'}</p>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-2">
                {[
                    { title: isArabic ? 'التحكم في الوصول' : 'Access control', body: isArabic ? 'تُدار العضويات والصلاحيات داخل مساحة العمل، مع فصل واضح بين الإدارة، التشغيل، والموافقة.' : 'Workspace membership and permissions are managed with a clear split between admin, operator, and approver responsibilities.' },
                    { title: isArabic ? 'سلامة البيانات والربط' : 'Data and integration safety', body: isArabic ? 'رموز الوصول والتكاملات تُحفظ لإعادة الاستخدام التشغيلي، مع تتبع حالة الاتصال ومؤشرات الخطأ والمزامنة.' : 'Access tokens and connected systems are stored for operational reuse with connection health, sync state, and error visibility.' },
                    { title: isArabic ? 'الاستجابة والمراجعة' : 'Review and response', body: isArabic ? 'يستطيع الفريق مراجعة صفحات الأمن والخصوصية وDPA، ورفع الأسئلة الحساسة مباشرة إلى security@sbrandops.com.' : 'Teams can review security, privacy, and DPA information and route sensitive questions directly to security@sbrandops.com.' },
                    { title: isArabic ? 'الأثر التشغيلي' : 'Operational assurance', body: isArabic ? 'الفكرة ليست صفحة سياسات فقط، بل مسار تشغيل يقلل الفوضى عند إدارة الحسابات، الأصول، والتحليلات المتصلة.' : 'This is not only a policy page. It is an operating track that reduces ambiguity when teams manage connected accounts, assets, and analytics.' },
                ].map(item => (
                    <div key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-xl font-bold text-slate-950 dark:text-white">{item.title}</h2>
                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.body}</p>
                    </div>
                ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
                <Link to={publicPageToPath('privacy')} className="rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white">{isArabic ? 'راجع الخصوصية' : 'Review privacy'}</Link>
                <Link to={publicPageToPath('dpa')} className="rounded-2xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-white">{isArabic ? 'راجع DPA' : 'Review DPA'}</Link>
            </div>
        </section>
    );

    // ── CONTACT ───────────────────────────────────────────────────────────────
    const renderContact = () => (
        <section id="support" className="grid gap-8 py-16 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'التواصل' : 'Contact'}</p>
                <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">{isArabic ? 'هل تريد تشغيل أكثر من براند أو فريق كامل؟' : 'Need to operate multiple brands or a full team?'}</h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{isArabic ? 'تواصل معنا لنعرض لك أفضل إعداد لـ SBrandOps حسب عدد البراندات والقنوات والأدوار داخل الفريق.' : 'Talk to us to define the right SBrandOps setup for your brands, channels, and team structure.'}</p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
                <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{isArabic ? 'المبيعات' : 'Sales'}</p>
                        <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">demo@sbrandops.com</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{isArabic ? 'الدعم' : 'Support'}</p>
                        <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">support@sbrandops.com</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{isArabic ? 'وقت الرد' : 'Response time'}</p>
                        <p className="mt-2 leading-7">{isArabic ? 'خلال يوم عمل واحد عادةً.' : 'Usually within one business day.'}</p>
                    </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                    <a href="mailto:demo@sbrandops.com" className="rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white">{isArabic ? 'تواصل مع المبيعات' : 'Contact Sales'}</a>
                    <button onClick={primaryCtaAction} className="rounded-2xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-white">{isArabic ? 'ابدأ التجربة' : 'Start Free Trial'}</button>
                </div>
                <div className="mt-8 grid gap-3">
                    {SUPPORT_PATHS.map(item => (
                        <a key={item.enTitle} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-blue-500/40 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-950">
                            <p className="text-sm font-semibold text-slate-950 dark:text-white">{isArabic ? item.arTitle : item.enTitle}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isArabic ? item.arBody : item.enBody}</p>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );

    // ── LEGAL ─────────────────────────────────────────────────────────────────
    const renderLegal = () => {
        const legalPage = LEGAL_COPY[pageId as keyof typeof LEGAL_COPY];
        const blocks = isArabic ? legalPage.arBlocks : legalPage.enBlocks;
        const legalLinks: Array<{ label: string; page: MarketingPageId }> = [
            { label: isArabic ? 'الشروط' : 'Terms', page: 'terms' },
            { label: isArabic ? 'الخصوصية' : 'Privacy', page: 'privacy' },
            { label: 'DPA', page: 'dpa' },
            { label: isArabic ? 'الاسترجاع' : 'Refunds', page: 'refunds' },
            { label: isArabic ? 'الكوكيز' : 'Cookies', page: 'cookies' },
        ];
        return (
            <section className="py-16">
                <div className="max-w-4xl">
                    {/* Header */}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'القانونية' : 'Legal'}</p>
                    <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                        {isArabic ? legalPage.arTitle : legalPage.enTitle}
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        {isArabic ? `تاريخ السريان: ${legalPage.effective}` : `Effective date: ${legalPage.effective}`}
                    </p>

                    {/* Legal page nav */}
                    <div className="mt-6 flex flex-wrap gap-2">
                        {legalLinks.map(l => (
                            <Link
                                key={l.page}
                                to={publicPageToPath(l.page)}
                                className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors ${pageId === l.page ? 'bg-brand-primary text-white' : 'border border-slate-200 text-slate-600 hover:border-brand-primary hover:text-brand-primary dark:border-slate-700 dark:text-slate-300'}`}
                            >
                                {l.label}
                            </Link>
                        ))}
                    </div>

                    {/* Content card */}
                    <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
                        <div className="space-y-6">
                            {blocks.map((block, i) => (
                                <div key={i}>
                                    {block.heading && (
                                        <h2 className="mb-2 text-base font-bold text-slate-950 dark:text-white">{block.heading}</h2>
                                    )}
                                    <p className="text-sm leading-8 text-slate-600 dark:text-slate-300">{block.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA row */}
                    <div className="mt-6 flex flex-wrap gap-3">
                        <a href="mailto:legal@sbrandops.com" className="rounded-2xl bg-brand-primary px-6 py-3 text-sm font-semibold text-white">
                            {isArabic ? 'تواصل مع الفريق القانوني' : 'Contact Legal Team'}
                        </a>
                        <Link to={publicPageToPath('security')} className="rounded-2xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-white">
                            {isArabic ? 'صفحة الأمان' : 'Security'}
                        </Link>
                    </div>
                </div>
            </section>
        );
    };

    const renderPage = () => {
        switch (pageId) {
            case 'about': return renderAbout();
            case 'pricing': return renderPricing();
            case 'billing': return renderBilling();
            case 'contact': return renderContact();
            case 'security': return renderSecurity();
            case 'terms':
            case 'privacy':
            case 'dpa':
            case 'refunds':
            case 'cookies': return renderLegal();
            case 'home':
            default: return renderHome();
        }
    };

    // ── SHELL ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#f6f8fb] text-slate-950 dark:bg-slate-950 dark:text-white" dir={isArabic ? 'rtl' : 'ltr'}>
            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/90">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                    <Link to="/" className="flex items-center gap-2">
                        <SBrandOpsLogo variant="gradient" layout="mark" size="sm" alt="SBrandOps" />
                        <span className="text-base font-black tracking-tight text-slate-950 dark:text-white">SBrandOps</span>
                    </Link>
                    <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
                        {navItems.map(item => (
                            <RouteLink key={item.id} href={item.href} className={`transition-colors hover:text-blue-600 dark:hover:text-blue-400 ${item.id === pageId ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                {item.label}
                            </RouteLink>
                        ))}
                    </nav>
                    <div className="hidden items-center gap-3 md:flex">
                        <Link to={isAuthenticated ? '/app' : '/login'} className="text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">
                            {isAuthenticated ? (isArabic ? 'افتح التطبيق' : 'Open App') : (isArabic ? 'تسجيل الدخول' : 'Login')}
                        </Link>
                        <button onClick={primaryCtaAction} className="rounded-[14px] bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:-translate-y-0.5 hover:bg-blue-500">
                            {appLabel}
                        </button>
                    </div>
                    <button onClick={() => setMobileMenuOpen(o => !o)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200 md:hidden" aria-label={isArabic ? 'فتح القائمة' : 'Open menu'}>
                        <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-sm`} />
                    </button>
                </div>
                {mobileMenuOpen && (
                    <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950 md:hidden">
                        <div className="flex flex-col gap-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                            {navItems.map(item => (
                                <RouteLink key={item.id} href={item.href} className={`py-1 ${item.id === pageId ? 'text-blue-600 dark:text-blue-400' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                                    {item.label}
                                </RouteLink>
                            ))}
                            <Link to={isAuthenticated ? '/app' : '/login'} onClick={() => setMobileMenuOpen(false)} className="py-1">
                                {isAuthenticated ? (isArabic ? 'افتح التطبيق' : 'Open App') : (isArabic ? 'تسجيل الدخول' : 'Login')}
                            </Link>
                            <button onClick={() => { setMobileMenuOpen(false); primaryCtaAction(); }} className="rounded-[14px] bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
                                {primaryLabel}
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className="relative mx-auto max-w-7xl px-6">{renderPage()}</main>

            <SiteFooter isAuthenticated={isAuthenticated} />
        </div>
    );
};

export default MarketingSite;
