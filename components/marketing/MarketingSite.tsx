import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { publicPageToPath } from '../../config/routes';
import { BillingCycle, DEFAULT_PUBLIC_PRICING_PLAN_IDS, PRICING_PLANS, getBillingAmount } from '../../config/pricingPlans';
import { openBillingCheckout } from '../../services/billingCheckoutService';

type MarketingPageId = 'home' | 'about' | 'pricing' | 'billing' | 'contact' | 'security' | 'terms' | 'privacy' | 'dpa' | 'refunds' | 'cookies';

interface MarketingSiteProps {
    pageId: MarketingPageId;
    isAuthenticated: boolean;
}

const PILLARS = [
    { title: 'Brand Hub', ar: 'الهوية، النبرة، والأصول في مرجع واحد.', en: 'Identity, voice, and assets in one source of truth.' },
    { title: 'Content Ops', ar: 'دورة المحتوى من الفكرة حتى الموافقة والنشر.', en: 'The content workflow from idea to approval and publishing.' },
    { title: 'Social Ops', ar: 'إدارة الحسابات والجدولة والنشر متعدد القنوات.', en: 'Connected accounts, scheduling, and multi-channel publishing.' },
    { title: 'Ads Ops', ar: 'قراءة أداء الإعلانات وربطها بالإجراءات.', en: 'Paid performance tied to actions, not just dashboards.' },
    { title: 'SEO Ops', ar: 'محتوى SEO، briefs، ومتابعة أثر المقالات.', en: 'SEO briefs, content production, and article performance tracking.' },
    { title: 'Analytics Hub', ar: 'لوحة تنفيذية تشرح الأداء وتقترح الخطوة التالية.', en: 'An executive layer that explains performance and suggests the next move.' },
];

const FAQ_ITEMS = [
    {
        arQ: 'هل النظام يدعم العربية؟',
        arA: 'نعم. الواجهة والتشغيل يدعمان العربية والإنجليزية مع RTL وLTR.',
        enQ: 'Does the product support Arabic?',
        enA: 'Yes. The app supports Arabic and English with RTL and LTR layouts.',
    },
    {
        arQ: 'هل أستطيع إدارة أكثر من براند؟',
        arA: 'نعم. الخطط الأعلى تدعم تعدد البراندات، الأدوار، والموافقات.',
        enQ: 'Can I manage multiple brands?',
        enA: 'Yes. Higher plans support multiple brands, roles, and approvals.',
    },
    {
        arQ: 'هل توجد تجربة مجانية؟',
        arA: 'نعم. الخطط الأساسية تتضمن فترة تجريبية قبل تفعيل الاشتراك الكامل.',
        enQ: 'Is there a free trial?',
        enA: 'Yes. Core plans include a trial before the paid subscription starts.',
    },
    {
        arQ: 'هل أستطيع إلغاء الاشتراك؟',
        arA: 'نعم. يمكنك إدارة الإلغاء والإيقاف والفواتير من داخل Billing Center.',
        enQ: 'Can I cancel the subscription?',
        enA: 'Yes. Billing Center lets you cancel, pause, and manage invoices.',
    },
];

const CASE_STUDIES = [
    {
        metric: '3.4x',
        arTitle: 'رفع سرعة التنفيذ من التخطيط إلى النشر',
        enTitle: 'Reduced time from planning to publishing',
        arBody: 'فريق محتوى صغير وحّد التقويم والموافقات والنشر داخل تدفق واحد بدل المتابعة عبر أدوات منفصلة.',
        enBody: 'A lean content team unified planning, approvals, and publishing in one operating flow instead of scattered tools.',
    },
    {
        metric: '42%',
        arTitle: 'تحسين وضوح القرار في القنوات المدفوعة',
        enTitle: 'Clearer paid-media decision making',
        arBody: 'ربط مؤشرات الإعلانات مع التوصيات وسجل التنفيذ سهّل معرفة متى يتم التوسيع أو الإيقاف أو تعديل الرسائل.',
        enBody: 'Connecting ad metrics with recommendations and execution logs made it easier to know when to scale, pause, or change messaging.',
    },
    {
        metric: '1 workspace',
        arTitle: 'إدارة البراند والمحتوى والدعم من مكان واحد',
        enTitle: 'Brand, content, and support in one workspace',
        arBody: 'بدل القفز بين البريد والجداول وأدوات النشر، أصبح الفريق يعمل من لوحة تشغيل واحدة مرتبطة بالبراند.',
        enBody: 'Instead of juggling email, sheets, and publishing tools, the team now operates from one brand-centered workspace.',
    },
];

const TESTIMONIALS = [
    {
        name: 'Nour',
        roleAr: 'مديرة نمو — متجر إلكتروني',
        roleEn: 'Growth lead — ecommerce brand',
        quoteAr: 'أهم فرق فعلي رأيناه هو أن المحتوى والإعلانات والتحليلات أصبحت مترابطة داخل نفس القرار اليومي.',
        quoteEn: 'The biggest improvement was having content, ads, and analytics tied into the same daily operating decision.',
    },
    {
        name: 'Kareem',
        roleAr: 'مؤسس وكالة',
        roleEn: 'Agency founder',
        quoteAr: 'بدل متابعة العملاء عبر أدوات متفرقة، أصبح لدينا مركز تشغيل واحد يوضح ما يجب تنفيذه الآن.',
        quoteEn: 'Instead of tracking clients across disconnected tools, we now have one operating center that shows what needs action now.',
    },
];

const SUPPORT_PATHS = [
    {
        icon: 'fa-headset',
        arTitle: 'دعم المنتج',
        enTitle: 'Product support',
        arBody: 'للمشاكل التشغيلية، الإعداد، وربط الحسابات.',
        enBody: 'For setup, operational issues, and account connection support.',
        value: 'support@sbrandops.com',
        href: 'mailto:support@sbrandops.com',
    },
    {
        icon: 'fa-credit-card',
        arTitle: 'دعم الفوترة',
        enTitle: 'Billing support',
        arBody: 'للفواتير، الاشتراكات، والإلغاء أو الإيقاف.',
        enBody: 'For invoices, subscriptions, cancellation, or pause requests.',
        value: 'billing@sbrandops.com',
        href: 'mailto:billing@sbrandops.com',
    },
    {
        icon: 'fa-book-open',
        arTitle: 'مركز المساعدة',
        enTitle: 'Help center',
        arBody: 'إرشادات سريعة لبدء الاستخدام والفرق والعملاء.',
        enBody: 'Quick onboarding guidance for teams, brands, and clients.',
        value: 'contact / support flow',
        href: '/contact#support',
    },
];

const LEGAL_COPY: Record<Exclude<MarketingPageId, 'home' | 'about' | 'pricing' | 'billing' | 'contact' | 'security'>, { arTitle: string; enTitle: string; arBody: string[]; enBody: string[] }> = {
    terms: {
        arTitle: 'شروط الاستخدام',
        enTitle: 'Terms of Service',
        arBody: [
            'باستخدام SBrandOps فأنت توافق على استخدام المنصة ضمن حدود الخطة وسياسات الاستخدام المقبول.',
            'مالك الحساب مسؤول عن إدارة الأعضاء والصلاحيات داخل مساحة العمل الخاصة به.',
            'قد يتم تعليق الحساب عند إساءة الاستخدام أو فشل السداد المستمر وفق سياسة الفوترة.',
        ],
        enBody: [
            'By using SBrandOps, you agree to operate within your plan limits and acceptable use rules.',
            'The account owner is responsible for members and permissions inside the workspace.',
            'Accounts may be suspended for abuse or repeated payment failure under the billing policy.',
        ],
    },
    privacy: {
        arTitle: 'سياسة الخصوصية',
        enTitle: 'Privacy Policy',
        arBody: [
            'نجمع الحد الأدنى من البيانات اللازمة لتشغيل الحسابات، التحليلات، الفوترة، والدعم.',
            'تُستخدم البيانات لتشغيل المنتج، تحسين الأداء، وإدارة الاشتراكات.',
            'يمكن طلب حذف الحساب أو البيانات وفق سياسات الحذف والاحتفاظ المعتمدة.',
        ],
        enBody: [
            'We collect the minimum data required for accounts, analytics, billing, and support.',
            'Data is used to operate the product, improve reliability, and manage subscriptions.',
            'Account and data deletion requests are handled under the applicable retention policy.',
        ],
    },
    dpa: {
        arTitle: 'اتفاقية معالجة البيانات',
        enTitle: 'Data Processing Addendum',
        arBody: [
            'تعمل SBrandOps كمعالج بيانات بالنسبة للمعلومات التي يحمّلها العميل داخل المنصة أو يربطها عبر التكاملات.',
            'تغطي الاتفاقية موضوع المعالجة، فئات البيانات، تعليمات العميل، وضوابط الأمن والاحتفاظ والحذف.',
            'طلبات التوقيع أو مراجعة الملحق يمكن إرسالها إلى legal@sbrandops.com مع اسم الشركة والجهة المتعاقدة.',
        ],
        enBody: [
            'SBrandOps acts as a data processor for the customer data uploaded into the product or synced through integrations.',
            'The addendum covers processing scope, data categories, customer instructions, and security, retention, and deletion controls.',
            'Signature or review requests can be sent to legal@sbrandops.com with the contracting entity details.',
        ],
    },
    refunds: {
        arTitle: 'سياسة الاسترجاع',
        enTitle: 'Refund Policy',
        arBody: [
            'الاشتراكات تُدار حسب دورة الفوترة المختارة، مع إلغاء أو إيقاف بنهاية الفترة الحالية.',
            'طلبات الاسترجاع تُراجع حسب حالة الفوترة وسجل الاستخدام أو الخدمات المنفذة.',
            'يمكن إدارة الخطة والإلغاء والإيقاف من داخل التطبيق أو عبر Customer Portal.',
        ],
        enBody: [
            'Subscriptions follow the selected billing cycle, with cancel or pause applied at period end.',
            'Refund requests are reviewed based on billing status and delivered usage.',
            'Plan changes, cancellation, and pause are available in-app or via the customer portal.',
        ],
    },
    cookies: {
        arTitle: 'سياسة ملفات الارتباط',
        enTitle: 'Cookie Policy',
        arBody: [
            'نستخدم ملفات أساسية لتسجيل الجلسات، التفضيلات، والأمان.',
            'قد نستخدم ملفات إضافية لقياس الأداء وتحسين تجربة الاستخدام.',
            'يمكن تحديث تفضيلات الخصوصية والكوكيز من الإعدادات عند توفرها.',
        ],
        enBody: [
            'We use essential cookies for sessions, preferences, and security.',
            'Additional cookies may be used for performance measurement and UX improvements.',
            'Privacy and cookie preferences can be updated in settings when available.',
        ],
    },
};

const formatMoney = (amount: number | null, currency = 'USD') => {
    if (amount === null) {
        return 'Custom';
    }

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
};

const MarketingHeroMock: React.FC = () => (
    <div className="relative overflow-hidden rounded-[2rem] border border-light-border bg-slate-950 p-4 shadow-2xl shadow-slate-900/20 dark:border-slate-800">
        <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="h-8 w-28 rounded-xl bg-white/10" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
                <div className="rounded-[1.5rem] bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <div className="h-3 w-24 rounded-full bg-white/15" />
                            <div className="mt-2 h-8 w-36 rounded-xl bg-white/10" />
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-brand-primary/40" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map(item => (
                            <div key={item} className="rounded-2xl bg-white/5 p-3">
                                <div className="h-3 w-16 rounded-full bg-white/10" />
                                <div className="mt-3 h-7 w-14 rounded-xl bg-white/15" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-[1.5rem] bg-white/5 p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="h-3 w-28 rounded-full bg-white/15" />
                        <div className="h-3 w-20 rounded-full bg-white/10" />
                    </div>
                    <div className="flex h-48 items-end gap-3">
                        {[48, 32, 64, 38, 58, 26, 44].map((height, index) => (
                            <div key={index} className="flex-1 rounded-t-2xl bg-brand-primary/35" style={{ height }} />
                        ))}
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="rounded-[1.5rem] bg-white/5 p-4">
                    <div className="mb-3 h-3 w-32 rounded-full bg-white/15" />
                    {[1, 2, 3].map(item => (
                        <div key={item} className="mb-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3 last:mb-0">
                            <div className="h-10 w-10 rounded-2xl bg-brand-secondary/35" />
                            <div className="flex-1">
                                <div className="h-3 w-3/4 rounded-full bg-white/10" />
                                <div className="mt-2 h-3 w-1/2 rounded-full bg-white/5" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="rounded-[1.5rem] bg-gradient-to-br from-brand-primary/25 to-brand-secondary/20 p-4">
                    <div className="h-3 w-24 rounded-full bg-white/15" />
                    <div className="mt-4 space-y-3">
                        <div className="h-10 rounded-2xl bg-white/10" />
                        <div className="h-10 rounded-2xl bg-white/10" />
                        <div className="h-10 rounded-2xl bg-white/10" />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const RouteLink: React.FC<{ href: string; className?: string; children: React.ReactNode; onClick?: () => void }> = ({ href, className, children, onClick }) => (
    href.includes('#')
        ? <a href={href} className={className} onClick={onClick}>{children}</a>
        : <Link to={href} className={className} onClick={onClick}>{children}</Link>
);

const MarketingSite: React.FC<MarketingSiteProps> = ({ pageId, isAuthenticated }) => {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const isArabic = language === 'ar';
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
    const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const publicPlans = useMemo(
        () => PRICING_PLANS.filter(plan => DEFAULT_PUBLIC_PRICING_PLAN_IDS.includes(plan.id)),
        []
    );

    const primaryLabel = isAuthenticated ? (isArabic ? 'افتح التطبيق' : 'Open App') : (isArabic ? 'ابدأ التجربة المجانية' : 'Start Free Trial');
    const appLabel = isAuthenticated ? (isArabic ? 'اذهب إلى مساحة العمل' : 'Go to Workspace') : primaryLabel;
    const contactLabel = isArabic ? 'احجز عرضًا مباشرًا' : 'Book Demo';
    const navItems = [
        { id: 'home' as const, label: isArabic ? 'الرئيسية' : 'Home', href: publicPageToPath('home') },
        { id: 'about' as const, label: isArabic ? 'من نحن' : 'About', href: publicPageToPath('about') },
        { id: 'pricing' as const, label: isArabic ? 'الأسعار' : 'Pricing', href: publicPageToPath('pricing') },
        { id: 'contact' as const, label: isArabic ? 'تواصل معنا' : 'Contact', href: publicPageToPath('contact') },
    ];
    const footerGroups = [
        {
            title: isArabic ? 'المنتج' : 'Product',
            links: [
                { label: 'Brand Hub', href: `${publicPageToPath('home')}#product` },
                { label: isArabic ? 'الأسعار' : 'Pricing', href: publicPageToPath('pricing') },
                { label: 'Workflow', href: `${publicPageToPath('home')}#workflow` },
            ],
        },
        {
            title: isArabic ? 'الشركة' : 'Company',
            links: [
                { label: isArabic ? 'من نحن' : 'About', href: publicPageToPath('about') },
                { label: isArabic ? 'تواصل معنا' : 'Contact', href: publicPageToPath('contact') },
            ],
        },
        {
            title: isArabic ? 'الموارد' : 'Resources',
            links: [
                { label: isArabic ? 'مركز المساعدة' : 'Help Center', href: `${publicPageToPath('contact')}#support` },
                { label: isArabic ? 'الأسئلة الشائعة' : 'FAQ', href: `${publicPageToPath('home')}#faq` },
                { label: isArabic ? 'الأمان' : 'Security', href: publicPageToPath('security') },
                { label: isArabic ? 'الفوترة' : 'Billing', href: publicPageToPath('billing') },
                { label: isArabic ? 'المبيعات' : 'Sales', href: publicPageToPath('contact') },
            ],
        },
        {
            title: isArabic ? 'القانونية' : 'Legal',
            links: [
                { label: isArabic ? 'الشروط' : 'Terms', href: publicPageToPath('terms') },
                { label: isArabic ? 'الخصوصية' : 'Privacy', href: publicPageToPath('privacy') },
                { label: isArabic ? 'اتفاقية معالجة البيانات' : 'DPA', href: publicPageToPath('dpa') },
                { label: isArabic ? 'الاسترجاع' : 'Refunds', href: publicPageToPath('refunds') },
                { label: isArabic ? 'الكوكيز' : 'Cookies', href: publicPageToPath('cookies') },
            ],
        },
    ];

    const primaryCtaAction = () => navigate(isAuthenticated ? '/app' : '/register');

    const handlePlanCheckout = async (planId: string) => {
        if (planId === 'enterprise') {
            navigate('/contact');
            return;
        }

        if (!isAuthenticated) {
            navigate('/register');
            return;
        }

        setCheckoutError(null);
        setPendingPlanId(planId);
        try {
            const result = await openBillingCheckout({ planId, billingCycle });
            if (result.mode !== 'checkout') {
                setCheckoutError(result.message);
            }
        } catch (error) {
            setCheckoutError(error instanceof Error ? error.message : (isArabic ? 'تعذر بدء الدفع.' : 'Failed to start checkout.'));
        } finally {
            setPendingPlanId(null);
        }
    };
    const renderHome = () => (
        <>
            <section className="grid gap-10 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-24">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-primary">Brand Operating System</p>
                    <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[1.05] tracking-tight text-slate-950 dark:text-white md:text-6xl">
                        {isArabic ? 'شغّل البراند من نظام واحد' : 'Run Your Brand From One Operating System'}
                    </h1>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                        {isArabic
                            ? 'خطط للمحتوى، انشر عبر القنوات، راقب الأداء، وأدر الفريق من مساحة تشغيل واحدة بدل أدوات متفرقة.'
                            : 'Plan content, publish across channels, monitor performance, and operate your team from one workspace instead of scattered tools.'}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <button onClick={primaryCtaAction} className="rounded-2xl bg-brand-primary px-6 py-3.5 text-sm font-semibold text-white shadow-primary-glow transition-transform hover:-translate-y-0.5">
                            {primaryLabel}
                        </button>
                        <Link to={publicPageToPath('contact')} className="rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800">
                            {contactLabel}
                        </Link>
                    </div>
                    <div className="mt-10">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{isArabic ? 'تكاملات أساسية' : 'Core integrations'}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            <span>Meta</span>
                            <span>Instagram</span>
                            <span>TikTok</span>
                            <span>LinkedIn</span>
                            <span>Shopify</span>
                            <span>WooCommerce</span>
                            <span>WordPress</span>
                        </div>
                    </div>
                </div>
                <MarketingHeroMock />
            </section>

            <section className="grid gap-6 border-y border-slate-200 py-14 dark:border-slate-800 lg:grid-cols-2">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'المشكلة' : 'The problem'}</p>
                    <h2 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">
                        {isArabic ? 'المشكلة ليست نقص الأدوات، بل تشتت التشغيل' : 'The problem is not missing tools. It is fragmented execution.'}
                    </h2>
                </div>
                <div className="grid gap-3">
                    {[
                        isArabic ? 'المحتوى في أداة، والإعلانات في أداة، والتحليلات في مكان ثالث.' : 'Content is in one tool, ads in another, and analytics somewhere else.',
                        isArabic ? 'الوقت يضيع بين المنصات بدل التنفيذ الفعلي.' : 'Teams lose execution time jumping between disconnected platforms.',
                        isArabic ? 'لا توجد ذاكرة موحدة لصوت البراند والرسائل الأساسية.' : 'There is no shared memory for brand voice and core messaging.',
                        isArabic ? 'من الصعب ربط الأداء بالإيراد والمهام اليومية.' : 'It is difficult to connect performance with revenue and daily action.',
                    ].map(item => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            {item}
                        </div>
                    ))}
                </div>
            </section>

            <section id="product" className="py-16">
                <div className="mb-10 max-w-2xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'النظام' : 'The system'}</p>
                    <h2 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">
                        {isArabic ? 'كل وظائف النمو تحت نموذج تشغيل واحد' : 'All growth operations under one operating model.'}
                    </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {PILLARS.map(pillar => (
                        <div key={pillar.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{pillar.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{isArabic ? pillar.ar : pillar.en}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-8 rounded-[2rem] bg-slate-950 px-6 py-12 text-white md:px-10 lg:grid-cols-[0.95fr_1.05fr]">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-secondary">{isArabic ? 'طبقة الذكاء الاصطناعي' : 'AI Layer'}</p>
                    <h2 className="mt-4 text-3xl font-bold">
                        {isArabic ? 'الذكاء الاصطناعي هنا للتخطيط والتنفيذ والتحسين' : 'AI is here to plan, execute, and improve.'}
                    </h2>
                    <p className="mt-5 text-sm leading-7 text-slate-300">
                        {isArabic
                            ? 'الذكاء الاصطناعي داخل SBrandOps لا يكتب فقط. هو يقرأ السياق، يقترح الإجراء، ويفسر الأداء مع الحفاظ على صوت البراند.'
                            : 'Inside SBrandOps, AI does more than generate copy. It reads context, suggests actions, and explains performance while preserving brand voice.'}
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {(isArabic
                        ? ['تخطيط الاستراتيجية', 'توليد المحتوى', 'تحسين الحملات', 'اقتراح الردود', 'تحسين SEO', 'توصيات الأداء']
                        : ['Strategy planning', 'Content generation', 'Campaign optimization', 'Reply assistance', 'SEO recommendations', 'Performance insights']
                    ).map(item => (
                        <div key={item} className="rounded-2xl bg-white/5 px-4 py-4 text-sm text-slate-200">{item}</div>
                    ))}
                </div>
            </section>

            <section id="workflow" className="py-16">
                <div className="mb-8 max-w-2xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'طريقة العمل' : 'Workflow'}</p>
                    <h2 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">
                        {isArabic ? 'رحلة واضحة من إضافة البراند حتى التحسين المستمر' : 'A clear path from setup to continuous optimization.'}
                    </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                    {[
                        isArabic ? 'أضف البراند' : 'Add Brand',
                        isArabic ? 'اربط القنوات' : 'Connect Channels',
                        isArabic ? 'خطط للمحتوى' : 'Plan Content',
                        isArabic ? 'انشر' : 'Publish',
                        isArabic ? 'حلل الأداء' : 'Analyze',
                        isArabic ? 'حسّن التنفيذ' : 'Optimize',
                    ].map((step, index) => (
                        <div key={step} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {isArabic ? `الخطوة ${index + 1}` : `Step ${index + 1}`}
                            </p>
                            <h3 className="mt-3 text-base font-semibold text-slate-950 dark:text-white">{step}</h3>
                        </div>
                    ))}
                </div>
            </section>

            <section className="py-16">
                <div className="mb-8 max-w-2xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'أثر تشغيلي واضح' : 'Operational proof'}</p>
                    <h2 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">
                        {isArabic ? 'قيمة واضحة في الوقت والقرار والتنفيذ' : 'Clear value in speed, decision quality, and execution.'}
                    </h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    {CASE_STUDIES.map((item) => (
                        <div key={item.enTitle} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">{item.metric}</p>
                            <h3 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">{isArabic ? item.arTitle : item.enTitle}</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{isArabic ? item.arBody : item.enBody}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    {TESTIMONIALS.map((item) => (
                        <div key={item.name} className="rounded-[1.75rem] bg-slate-950 px-6 py-6 text-white">
                            <p className="text-sm leading-7 text-slate-200">{isArabic ? item.quoteAr : item.quoteEn}</p>
                            <div className="mt-5 border-t border-white/10 pt-4">
                                <p className="font-semibold">{item.name}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{isArabic ? item.roleAr : item.roleEn}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="py-16">
                <div className="mb-8 flex items-end justify-between gap-4">
                    <div className="max-w-2xl">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الأسعار' : 'Pricing'}</p>
                        <h2 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">
                            {isArabic ? 'خطط واضحة يمكن بيعها وتشغيلها من أول نسخة' : 'Straightforward plans you can sell and operate from v1.'}
                        </h2>
                    </div>
                    <Link to={publicPageToPath('pricing')} className="text-sm font-semibold text-brand-primary">
                        {isArabic ? 'عرض كل الخطط' : 'See Full Pricing'}
                    </Link>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    {publicPlans.map(plan => {
                        const price = getBillingAmount(plan, billingCycle);
                        return (
                            <div key={plan.id} className={`rounded-[1.75rem] border p-6 ${plan.highlighted ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-950 dark:text-white">{plan.name}</h3>
                                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>
                                    </div>
                                    {plan.badge && <span className="rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span>}
                                </div>
                                <p className="mt-6 text-4xl font-black text-slate-950 dark:text-white">
                                    {formatMoney(price, plan.currency)}
                                    {price !== null && <span className="text-sm font-medium text-slate-400">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>}
                                </p>
                                <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                    {plan.features.map(feature => (
                                        <li key={feature} className="flex items-start gap-2">
                                            <i className="fas fa-check mt-1 text-xs text-brand-primary" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section id="faq" className="grid gap-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الأسئلة الشائعة' : 'FAQ'}</p>
                    <h2 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">
                        {isArabic ? 'الأسئلة الأساسية قبل الاشتراك' : 'The core questions before purchase.'}
                    </h2>
                </div>
                <div className="space-y-3">
                    {FAQ_ITEMS.map(item => (
                        <div key={item.enQ} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-base font-semibold text-slate-950 dark:text-white">{isArabic ? item.arQ : item.enQ}</h3>
                            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{isArabic ? item.arA : item.enA}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section id="support" className="rounded-[2rem] border border-slate-200 bg-white px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-8 max-w-2xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الدعم' : 'Support'}</p>
                    <h2 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">
                        {isArabic ? 'اختر مسار الدعم المناسب بسرعة' : 'Pick the right support path quickly.'}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        {isArabic ? 'قبل البيع، أثناء الإعداد، أو بعد بدء الاشتراك، كل مسار واضح حتى لا تضيع بين الرسائل العامة.' : 'Before purchase, during onboarding, or after subscription starts, each route is explicit so support does not get lost in generic contact.'}
                    </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    {SUPPORT_PATHS.map((item) => (
                        <a key={item.enTitle} href={item.href} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-brand-primary hover:bg-brand-primary/5 dark:border-slate-800 dark:bg-slate-950">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                                <i className={`fas ${item.icon}`} />
                            </div>
                            <h3 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">{isArabic ? item.arTitle : item.enTitle}</h3>
                            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{isArabic ? item.arBody : item.enBody}</p>
                            <p className="mt-4 text-sm font-semibold text-brand-primary">{item.value}</p>
                        </a>
                    ))}
                </div>
            </section>
        </>
    );

    const renderAbout = () => {
        const sections = [
            {
                title: isArabic ? 'قصتنا' : 'Our story',
                body: isArabic
                    ? 'بُني SBrandOps لأن فرق التسويق كانت تعمل عبر أدوات كثيرة، والبيانات كانت مشتتة، والتنفيذ أبطأ من المطلوب.'
                    : 'SBrandOps was built because marketing teams were operating across too many tools, with fragmented data and slow execution.',
            },
            {
                title: isArabic ? 'مهمتنا' : 'Our mission',
                body: isArabic
                    ? 'توحيد تشغيل نمو البراند داخل نظام ذكي واحد يدعم التخطيط والتنفيذ والتحسين.'
                    : 'To unify brand growth operations inside one intelligent system for planning, execution, and optimization.',
            },
            {
                title: isArabic ? 'ما نؤمن به' : 'What we believe',
                body: isArabic
                    ? 'النظام قبل الفوضى، والبيانات قبل القرارات، والذكاء الاصطناعي يجب أن يخدم التنفيذ.'
                    : 'Systems before chaos, data before decisions, and AI that serves execution.',
            },
            {
                title: isArabic ? 'ما يميزنا' : 'What makes us different',
                body: isArabic
                    ? 'Arabic-first مع دعم إنجليزي، تشغيل متعدد البراندات، وربط فعلي بين التسويق والعمليات والنمو.'
                    : 'Arabic-first with English support, multi-brand operations, and a tighter link between marketing, operations, and growth.',
            },
        ];

        return (
            <section className="py-16">
                <div className="max-w-3xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'من نحن' : 'About SBrandOps'}</p>
                    <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">
                        {isArabic ? 'نحن نبني نظام تشغيل عملي للبراند' : 'We are building a real operating system for brands.'}
                    </h1>
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
    const renderPricing = () => (
        <section className="py-16">
            <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الأسعار' : 'Pricing'}</p>
                <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">
                    {isArabic ? 'اختر الخطة المناسبة لمرحلة نموك' : 'Choose the plan that matches your growth stage'}
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                    {isArabic
                        ? 'ابدأ بخطة مناسبة الآن، ثم وسّع الفريق والبراندات والفوترة والإدارة مع نمو التشغيل.'
                        : 'Start with the right operating baseline now, then expand brands, team, billing, and governance as you grow.'}
                </p>
            </div>

            <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
                    <button
                        key={cycle}
                        onClick={() => setBillingCycle(cycle)}
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${billingCycle === cycle ? 'bg-brand-primary text-white' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
                    >
                        {cycle === 'monthly' ? (isArabic ? 'شهري' : 'Monthly') : (isArabic ? 'سنوي' : 'Yearly')}
                    </button>
                ))}
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
                {publicPlans.map(plan => {
                    const price = getBillingAmount(plan, billingCycle);
                    const annualSaving = billingCycle === 'yearly' && plan.monthlyPrice !== null && plan.yearlyPrice !== null
                        ? (plan.monthlyPrice * 12) - plan.yearlyPrice
                        : 0;

                    return (
                        <div key={plan.id} className={`rounded-[2rem] border p-7 ${plan.highlighted ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-slate-950 dark:text-white">{plan.name}</h2>
                                {plan.badge && <span className="rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span>}
                            </div>
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
                            <p className="mt-8 text-5xl font-black text-slate-950 dark:text-white">
                                {formatMoney(price, plan.currency)}
                                {price !== null && <span className="text-base font-medium text-slate-400">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>}
                            </p>
                            {annualSaving > 0 && (
                                <p className="mt-3 text-sm font-medium text-brand-primary">
                                    {isArabic ? `وفّر ${formatMoney(annualSaving, plan.currency)} سنويًا` : `Save ${formatMoney(annualSaving, plan.currency)} annually`}
                                </p>
                            )}
                            <ul className="mt-8 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                {plan.features.map(feature => (
                                    <li key={feature} className="flex items-start gap-2">
                                        <i className="fas fa-check mt-1 text-xs text-brand-primary" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => handlePlanCheckout(plan.id)}
                                disabled={pendingPlanId === plan.id}
                                className={`mt-8 w-full rounded-2xl px-5 py-3 text-sm font-semibold ${plan.highlighted ? 'bg-brand-primary text-white' : 'border border-slate-300 bg-transparent text-slate-950 dark:border-slate-700 dark:text-white'}`}
                            >
                                {pendingPlanId === plan.id
                                    ? (isArabic ? 'جارٍ تجهيز الدفع...' : 'Preparing checkout...')
                                    : plan.id === 'starter'
                                        ? (isArabic ? 'ابدأ بـ Starter' : plan.ctaLabel)
                                        : plan.id === 'growth'
                                            ? (isArabic ? 'ابدأ بـ Growth' : plan.ctaLabel)
                                            : (isArabic ? 'ابدأ بـ Agency' : plan.ctaLabel)}
                            </button>
                        </div>
                    );
                })}
            </div>
            {checkoutError && (
                <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    {checkoutError}
                </div>
            )}
        </section>
    );

    const renderBilling = () => (
        <section className="py-16">
            <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الفوترة' : 'Billing'}</p>
                <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">
                    {isArabic ? 'فهم أوضح للاشتراك والفواتير من أول يوم' : 'Clear subscription and invoice operations from day one'}
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                    {isArabic
                        ? 'كل خطة لها دورة فوترة واضحة، وفواتير قابلة للتتبع، وإدارة للإلغاء أو الترقية أو الإيقاف من نفس مساحة العمل.'
                        : 'Every plan has a clear billing cycle, traceable invoices, and in-app cancellation, upgrade, and pause controls.'}
                </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
                {[
                    {
                        title: isArabic ? 'الدفع والاشتراك' : 'Checkout and subscriptions',
                        body: isArabic
                            ? 'تبدأ الخطة عبر Checkout آمن، ثم تُدار حالات الترقية والتخفيض والإيقاف من داخل تجربة الفوترة نفسها.'
                            : 'Plans start in secure checkout, then upgrades, downgrades, and pauses are managed inside the same billing flow.',
                    },
                    {
                        title: isArabic ? 'الفواتير والامتثال المالي' : 'Invoices and finance ops',
                        body: isArabic
                            ? 'يمكن للفرق المالية مراجعة الفواتير، تواريخ التحصيل، ودورات السداد بدون الرجوع إلى دعم يدوي لكل حركة.'
                            : 'Finance teams can review invoices, collection dates, and billing cycles without needing manual support for every change.',
                    },
                    {
                        title: isArabic ? 'دعم الفوترة' : 'Billing support',
                        body: isArabic
                            ? 'الأسئلة المتعلقة بالمدفوعات أو الاسترجاع أو تحديث جهة التعاقد تذهب إلى billing@sbrandops.com.'
                            : 'Questions about payments, refunds, or billing entity changes are routed through billing@sbrandops.com.',
                    },
                ].map((item) => (
                    <div key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-xl font-bold text-slate-950 dark:text-white">{item.title}</h2>
                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.body}</p>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
                <Link to={publicPageToPath('pricing')} className="rounded-2xl bg-brand-primary px-6 py-3.5 text-sm font-semibold text-white">
                    {isArabic ? 'قارن الخطط' : 'Compare plans'}
                </Link>
                <a href="mailto:billing@sbrandops.com" className="rounded-2xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-white">
                    {isArabic ? 'تواصل مع دعم الفوترة' : 'Contact billing support'}
                </a>
            </div>
        </section>
    );

    const renderSecurity = () => (
        <section className="py-16">
            <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'الأمان' : 'Security'}</p>
                <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">
                    {isArabic ? 'طبقة تشغيل آمنة للفرق والبراندات والبيانات المتصلة' : 'A secure operating layer for teams, brands, and connected data'}
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                    {isArabic
                        ? 'نعامل الأمان كمسار تشغيل أساسي: صلاحيات، سجلات، حماية جلسات، وربط مزودين خارجيين ضمن حدود واضحة.'
                        : 'We treat security as a core operating track: permissions, auditability, session protection, and tightly-scoped external integrations.'}
                </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-2">
                {[
                    {
                        title: isArabic ? 'التحكم في الوصول' : 'Access control',
                        body: isArabic
                            ? 'تُدار العضويات والصلاحيات داخل مساحة العمل، مع فصل واضح بين الإدارة، التشغيل، والموافقة.'
                            : 'Workspace membership and permissions are managed with a clear split between admin, operator, and approver responsibilities.',
                    },
                    {
                        title: isArabic ? 'سلامة البيانات والربط' : 'Data and integration safety',
                        body: isArabic
                            ? 'رموز الوصول والتكاملات تُحفظ لإعادة الاستخدام التشغيلي، مع تتبع حالة الاتصال ومؤشرات الخطأ والمزامنة.'
                            : 'Access tokens and connected systems are stored for operational reuse with connection health, sync state, and error visibility.',
                    },
                    {
                        title: isArabic ? 'الاستجابة والمراجعة' : 'Review and response',
                        body: isArabic
                            ? 'يستطيع الفريق مراجعة صفحات الأمن والخصوصية وDPA، ورفع الأسئلة الحساسة مباشرة إلى security@sbrandops.com.'
                            : 'Teams can review security, privacy, and DPA information and route sensitive questions directly to security@sbrandops.com.',
                    },
                    {
                        title: isArabic ? 'الأثر التشغيلي' : 'Operational assurance',
                        body: isArabic
                            ? 'الفكرة ليست صفحة سياسات فقط، بل مسار تشغيل يقلل الفوضى عند إدارة الحسابات، الأصول، والتحليلات المتصلة.'
                            : 'This is not only a policy page. It is an operating track that reduces ambiguity when teams manage connected accounts, assets, and analytics.',
                    },
                ].map((item) => (
                    <div key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-xl font-bold text-slate-950 dark:text-white">{item.title}</h2>
                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.body}</p>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
                <Link to={publicPageToPath('privacy')} className="rounded-2xl bg-brand-primary px-6 py-3.5 text-sm font-semibold text-white">
                    {isArabic ? 'راجع الخصوصية' : 'Review privacy'}
                </Link>
                <Link to={publicPageToPath('dpa')} className="rounded-2xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-white">
                    {isArabic ? 'راجع DPA' : 'Review DPA'}
                </Link>
            </div>
        </section>
    );

    const renderContact = () => (
        <section id="support" className="grid gap-8 py-16 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'التواصل' : 'Contact'}</p>
                <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 dark:text-white">
                    {isArabic ? 'هل تريد تشغيل أكثر من براند أو فريق كامل؟' : 'Need to operate multiple brands or a full team?'}
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                    {isArabic
                        ? 'تواصل معنا لنعرض لك أفضل إعداد لـ SBrandOps حسب عدد البراندات والقنوات والأدوار داخل الفريق.'
                        : 'Talk to us to define the right SBrandOps setup for your brands, channels, and team structure.'}
                </p>
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
                    <a href="mailto:demo@sbrandops.com" className="rounded-2xl bg-brand-primary px-6 py-3.5 text-sm font-semibold text-white">
                        {isArabic ? 'تواصل مع المبيعات' : 'Contact Sales'}
                    </a>
                    <button onClick={primaryCtaAction} className="rounded-2xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-white">
                        {isArabic ? 'ابدأ التجربة' : 'Start Free Trial'}
                    </button>
                </div>
                <div className="mt-8 grid gap-3">
                    {SUPPORT_PATHS.map((item) => (
                        <a key={item.enTitle} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-brand-primary hover:bg-brand-primary/5 dark:border-slate-800 dark:bg-slate-950">
                            <p className="text-sm font-semibold text-slate-950 dark:text-white">{isArabic ? item.arTitle : item.enTitle}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isArabic ? item.arBody : item.enBody}</p>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );

    const renderLegal = () => {
        const legalPage = LEGAL_COPY[pageId as keyof typeof LEGAL_COPY];
        const body = isArabic ? legalPage.arBody : legalPage.enBody;

        return (
            <section className="py-16">
                <div className="max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{isArabic ? 'القانونية' : 'Legal'}</p>
                    <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                        {isArabic ? legalPage.arTitle : legalPage.enTitle}
                    </h1>
                    <div className="mt-6 space-y-4">
                        {body.map(paragraph => (
                            <p key={paragraph} className="text-sm leading-8 text-slate-600 dark:text-slate-300">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                </div>
            </section>
        );
    };

    const renderPage = () => {
        switch (pageId) {
            case 'about':
                return renderAbout();
            case 'pricing':
                return renderPricing();
            case 'billing':
                return renderBilling();
            case 'contact':
                return renderContact();
            case 'security':
                return renderSecurity();
            case 'terms':
            case 'privacy':
            case 'dpa':
            case 'refunds':
            case 'cookies':
                return renderLegal();
            case 'home':
            default:
                return renderHome();
        }
    };
    return (
        <div className="min-h-screen bg-[#f6f8fb] text-slate-950 dark:bg-slate-950 dark:text-white" dir={isArabic ? 'rtl' : 'ltr'}>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-brand-primary/10 blur-3xl" />
                <div className="absolute bottom-[-10rem] right-[-6rem] h-80 w-80 rounded-full bg-brand-secondary/10 blur-3xl" />
            </div>

            <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                    <Link to="/" className="text-lg font-black tracking-tight text-slate-950 dark:text-white">SBrandOps</Link>

                    <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
                        {navItems.map(item => (
                            <RouteLink key={item.id} href={item.href} className={`transition-colors hover:text-brand-primary ${item.id === pageId ? 'text-brand-primary' : ''}`}>
                                {item.label}
                            </RouteLink>
                        ))}
                    </nav>

                    <div className="hidden items-center gap-3 md:flex">
                        <Link to={isAuthenticated ? '/app' : '/login'} className="text-sm font-semibold text-slate-700 transition-colors hover:text-brand-primary dark:text-slate-200">
                            {isAuthenticated ? (isArabic ? 'افتح التطبيق' : 'Open App') : (isArabic ? 'تسجيل الدخول' : 'Login')}
                        </Link>
                        <button onClick={primaryCtaAction} className="rounded-2xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-primary-glow">
                            {appLabel}
                        </button>
                    </div>

                    <button
                        onClick={() => setMobileMenuOpen(open => !open)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200 md:hidden"
                        aria-label={isArabic ? 'فتح قائمة الموقع' : 'Open site menu'}
                    >
                        <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`} />
                    </button>
                </div>

                {mobileMenuOpen && (
                    <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-800 md:hidden">
                        <div className="flex flex-col gap-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                            {navItems.map(item => (
                                <RouteLink key={item.id} href={item.href} className={`py-1 ${item.id === pageId ? 'text-brand-primary' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                                    {item.label}
                                </RouteLink>
                            ))}
                            <Link to={isAuthenticated ? '/app' : '/login'} onClick={() => setMobileMenuOpen(false)}>
                                {isAuthenticated ? (isArabic ? 'افتح التطبيق' : 'Open App') : (isArabic ? 'تسجيل الدخول' : 'Login')}
                            </Link>
                            <button onClick={() => { setMobileMenuOpen(false); primaryCtaAction(); }} className="rounded-2xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white">
                                {primaryLabel}
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className="relative mx-auto max-w-7xl px-6">{renderPage()}</main>

            <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.1fr_1fr_1fr_1fr]">
                    <div>
                        <h3 className="text-lg font-black text-slate-950 dark:text-white">SBrandOps</h3>
                        <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {isArabic ? 'نظام التشغيل الذي تحتاجه البراندات الحديثة.' : 'The operating system for modern brands.'}
                        </p>
                    </div>
                    {footerGroups.map(group => (
                        <div key={group.title}>
                            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{group.title}</h4>
                            <div className="mt-4 space-y-3">
                                {group.links.map(link => (
                                    <RouteLink key={link.label} href={link.href} className="block text-sm text-slate-600 transition-colors hover:text-brand-primary dark:text-slate-300">
                                        {link.label}
                                    </RouteLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-200 dark:border-slate-800">
                    <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 text-sm text-slate-500 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
                        <span>© 2026 SBrandOps</span>
                        <div className="flex flex-wrap gap-4">
                            <a href="mailto:support@sbrandops.com">support@sbrandops.com</a>
                            <Link to={publicPageToPath('contact')}>{isArabic ? 'المبيعات' : 'Sales'}</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MarketingSite;
