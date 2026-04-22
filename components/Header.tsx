import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { usePlanLimits } from '../hooks/usePlanLimits';

interface HeaderProps {
    unreadCount: number;
    onToggleNotifications: () => void;
    brands: Brand[];
    activeBrand: Brand | null;
    onSwitchBrand: (brandId: string) => void;
    onAddBrand: () => void;
    onManageBrands: () => void;
    onSwitchToAdmin: () => void;
    onToggleMobileSidebar?: () => void;
    onSignOut?: () => void;
    userName?: string;
    userEmail?: string;
    activePageId: string;
}

const getPageMeta = (pageId: string, ar: boolean) => {
    const meta: Record<string, { eyebrow: string; title: string; description: string }> = {
        dashboard: {
            eyebrow: ar ? 'مركز القيادة' : 'Control Center',
            title: ar ? 'لوحة التشغيل' : 'Operations Dashboard',
            description: ar ? 'ملخص الأداء، النشر، والمهام في مساحة واحدة.' : 'Performance, publishing, and team activity in one workspace.',
        },
        'social-ops/publisher': {
            eyebrow: ar ? 'النشر' : 'Publishing',
            title: ar ? 'منشئ المحتوى' : 'Publisher',
            description: ar ? 'أنشئ، راجع، وانشر المحتوى بصيغة جاهزة لكل منصة.' : 'Draft, review, and publish content with platform-ready output.',
        },
        'social-ops/scheduled': {
            eyebrow: ar ? 'الجدولة' : 'Scheduling',
            title: ar ? 'المحتوى المجدول' : 'Scheduled Posts',
            description: ar ? 'تابع ما سيُنشر ومتى وعلى أي منصة.' : 'Track what goes live next and where.',
        },
        'social-ops/accounts': {
            eyebrow: ar ? 'القنوات' : 'Channels',
            title: ar ? 'الحسابات المتصلة' : 'Connected Accounts',
            description: ar ? 'إدارة الربط والحالة التشغيلية لكل قناة.' : 'Manage connection health and ownership across channels.',
        },
        'social-ops/social-search': {
            eyebrow: ar ? 'الاكتشاف' : 'Discovery',
            title: ar ? 'البحث الاجتماعي' : 'Social Search',
            description: ar ? 'التقط الإشارات والفرص الجديدة عبر القنوات.' : 'Track mentions, signals, and new opportunities across channels.',
        },
        calendar: {
            eyebrow: ar ? 'التقويم' : 'Calendar',
            title: ar ? 'تقويم المحتوى' : 'Content Calendar',
            description: ar ? 'رؤية أسبوعية وشهرية لسير الإنتاج والنشر.' : 'Weekly and monthly view of your production pipeline.',
        },
        'content-ops': {
            eyebrow: ar ? 'الإنتاج' : 'Content Ops',
            title: ar ? 'خط إنتاج المحتوى' : 'Content Pipeline',
            description: ar ? 'حرّك الأفكار من المسودة إلى الاعتماد ثم النشر.' : 'Move ideas from draft to approval and publishing.',
        },
        analytics: {
            eyebrow: ar ? 'التحليلات' : 'Analytics',
            title: ar ? 'قراءة الأداء' : 'Performance Analytics',
            description: ar ? 'افهم ما يعمل وما يحتاج إجراءً سريعًا.' : 'See what is working and what needs action.',
        },
        'ads-ops': {
            eyebrow: ar ? 'النمو المدفوع' : 'Paid Growth',
            title: ar ? 'تشغيل الإعلانات' : 'Ads Ops',
            description: ar ? 'صحة الحملات، الكفاءة، والتنبيهات الحرجة.' : 'Campaign health, efficiency, and paid alerts.',
        },
        'seo-ops': {
            eyebrow: ar ? 'الاكتشاف' : 'Discovery',
            title: ar ? 'تشغيل SEO' : 'SEO Ops',
            description: ar ? 'الكلمات، المحتوى، والتحسينات الجاهزة للنشر.' : 'Keywords, content, and publish-ready SEO improvements.',
        },
        inbox: {
            eyebrow: ar ? 'التفاعل' : 'Engagement',
            title: ar ? 'صندوق الوارد' : 'Inbox',
            description: ar ? 'تابع الرسائل والتعليقات دون تشتيت.' : 'Keep message handling focused and fast.',
        },
        'brand-hub': {
            eyebrow: ar ? 'الهوية' : 'Identity',
            title: ar ? 'مركز البراند' : 'Brand Hub',
            description: ar ? 'مصدر الحقيقة للهوية، النبرة، والأصول.' : 'The single source of truth for voice, assets, and positioning.',
        },
        workflow: {
            eyebrow: ar ? 'العمليات' : 'Operations',
            title: ar ? 'سير العمل' : 'Workflow',
            description: ar ? 'تابع المهام، الاعتمادات، والتنفيذ المتكرر.' : 'Track tasks, approvals, and operational workflows.',
        },
        integrations: {
            eyebrow: ar ? 'الربط' : 'Integrations',
            title: ar ? 'التكاملات' : 'Integrations',
            description: ar ? 'إدارة الربط مع القنوات والأنظمة الخارجية.' : 'Manage the systems and channels connected to your workspace.',
        },
        system: {
            eyebrow: ar ? 'الإدارة' : 'Administration',
            title: ar ? 'النظام والإعدادات' : 'System & Settings',
            description: ar ? 'المستخدمون، الفوترة، الأمان، ومفاتيح API.' : 'Users, billing, security, and API keys.',
        },
    };

    return meta[pageId] ?? {
        eyebrow: ar ? 'مساحة العمل' : 'Workspace',
        title: ar ? 'تشغيل البراند' : 'Brand Workspace',
        description: ar ? 'مساحة موحدة للفريق والمحتوى والنمو.' : 'Unified workspace for brand operations and growth.',
    };
};

export const Header: React.FC<HeaderProps> = React.memo(({
    unreadCount,
    onToggleNotifications,
    brands,
    activeBrand,
    onSwitchBrand,
    onAddBrand,
    onManageBrands,
    onSwitchToAdmin,
    onToggleMobileSidebar,
    onSignOut,
    userName,
    userEmail,
    activePageId,
}) => {
    const { language } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const ar = language === 'ar';
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pageMeta = useMemo(() => getPageMeta(activePageId, ar), [activePageId, ar]);
    const { planName, planId, limits, brandUsagePercent } = usePlanLimits();
    const brandPct = brandUsagePercent(brands.length);
    const isNearLimit = brandPct !== null && brandPct >= 80;

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleBrandSelect = (brandId: string) => {
        onSwitchBrand(brandId);
        setIsDropdownOpen(false);
    };

    return (
        <header className="sticky top-0 z-30 bg-light-bg/80 backdrop-blur-[24px] saturate-150 shadow-[var(--shadow-ambient)] dark:bg-dark-bg/80">
            <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        onClick={onToggleMobileSidebar}
                        className="flex h-[44px] w-[44px] items-center justify-center rounded-xl text-light-text-secondary transition-colors hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text lg:hidden"
                        aria-label={ar ? 'فتح القائمة الجانبية' : 'Open sidebar'}
                    >
                        <i className="fas fa-bars text-sm" />
                    </button>

                    <div className="relative min-w-0" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen((open) => !open)}
                            className="surface-panel-soft flex min-w-[140px] sm:min-w-[182px] items-center gap-2 sm:gap-3 rounded-2xl px-2.5 sm:px-3 py-2 text-start transition-all hover:shadow-primary-glow max-w-[200px] sm:max-w-none"
                            aria-label={ar ? 'تبديل البراند' : 'Switch brand'}
                        >
                            {activeBrand ? (
                                <>
                                    <img src={activeBrand.logoUrl} alt={activeBrand.name} className="h-10 w-10 rounded-xl object-cover shadow-sm" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-light-text-secondary dark:text-dark-text-secondary">
                                            {ar ? 'البراند الحالي' : 'Active Brand'}
                                        </p>
                                        <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{activeBrand.name}</p>
                                    </div>
                                </>
                            ) : (
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">{ar ? 'اختر براند' : 'Select Brand'}</p>
                                </div>
                            )}
                            <i className={`fas fa-chevron-down text-[11px] text-light-text-secondary transition-transform dark:text-dark-text-secondary ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <div className={`absolute top-full z-50 mt-2 w-72 sm:w-80 overflow-hidden rounded-2xl border border-light-border dark:border-dark-border bg-white dark:bg-[#151b2a] shadow-[var(--shadow-directional)] ${ar ? 'right-0' : 'left-0'} max-w-[calc(100vw-2rem)] ${isDropdownOpen ? 'visible opacity-100 translate-y-0' : 'invisible opacity-0 -translate-y-1'} transition-all duration-150`}>
                            <div className="border-b border-light-border/80 px-4 py-3 dark:border-dark-border/80">
                                <p className="section-kicker">{ar ? 'التبديل بين البراندات' : 'Switch brands'}</p>
                            </div>

                            <div className="max-h-72 space-y-1 overflow-y-auto p-2">
                                {brands.map((brand) => {
                                    const isActive = activeBrand?.id === brand.id;
                                    return (
                                        <button
                                            key={brand.id}
                                            onClick={() => handleBrandSelect(brand.id)}
                                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start transition-all ${
                                                isActive
                                                    ? 'bg-brand-primary/10 text-brand-primary'
                                                    : 'text-light-text-secondary hover:bg-light-bg hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-dark-text'
                                            }`}
                                        >
                                            <img src={brand.logoUrl} alt={brand.name} className="h-9 w-9 rounded-xl object-cover" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold">{brand.name}</p>
                                            </div>
                                            {isActive && <i className="fas fa-check text-xs" />}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="border-t border-light-border/80 p-2 space-y-1 dark:border-dark-border/80">
                                <button
                                    onClick={() => {
                                        onAddBrand();
                                        setIsDropdownOpen(false);
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-primary/30 px-3 py-3 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white"
                                >
                                    <i className="fas fa-plus text-xs" />
                                    <span>{ar ? 'إضافة براند جديد' : 'Add new brand'}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        onManageBrands();
                                        setIsDropdownOpen(false);
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-light-text-secondary transition-colors hover:bg-light-bg hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-dark-text"
                                >
                                    <i className="fas fa-sliders text-xs" />
                                    <span>{ar ? 'إدارة البراندات' : 'Manage brands'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
                    <div className="surface-panel-soft min-w-0 max-w-2xl rounded-2xl px-4 py-2.5">
                        <p className="section-kicker">{pageMeta.eyebrow}</p>
                        <div className="mt-1 flex min-w-0 items-center gap-3">
                            <h2 className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{pageMeta.title}</h2>
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                            <p className="truncate text-xs text-light-text-secondary dark:text-dark-text-secondary">{pageMeta.description}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Plan pill — always visible, pulses amber when near brand limit */}
                    <Link
                        to="/app/billing"
                        className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                            isNearLimit
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse'
                                : 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20'
                        }`}
                        title={limits.maxBrands !== null ? `${brands.length} / ${limits.maxBrands} ${ar ? 'براند' : 'brands'}` : ''}
                    >
                        <i className="fas fa-bolt text-[9px]" />
                        {planName}
                        {isNearLimit && <i className="fas fa-exclamation text-[9px]" />}
                    </Link>

                    <button
                        onClick={toggleTheme}
                        className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-light-text-secondary transition-colors hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text"
                        title={theme === 'dark' ? (ar ? 'الوضع الفاتح' : 'Light mode') : (ar ? 'الوضع الداكن' : 'Dark mode')}
                        aria-label={theme === 'dark' ? (ar ? 'تفعيل الوضع الفاتح' : 'Switch to light mode') : (ar ? 'تفعيل الوضع الداكن' : 'Switch to dark mode')}
                    >
                        <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-sm`} />
                    </button>

                    <div className="hidden sm:block"><LanguageSwitcher /></div>

                    <button
                        onClick={onSwitchToAdmin}
                        className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-light-text-secondary transition-colors hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text"
                        title={ar ? 'لوحة الإدارة' : 'Admin panel'}
                        aria-label={ar ? 'فتح لوحة الإدارة' : 'Open admin panel'}
                    >
                        <i className="fas fa-cog text-sm" />
                    </button>

                    <button
                        onClick={onToggleNotifications}
                        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-light-text-secondary transition-colors hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text"
                        title={ar ? 'الإشعارات' : 'Notifications'}
                        aria-label={ar ? 'فتح الإشعارات' : 'Open notifications'}
                    >
                        <i className="far fa-bell text-sm" />
                        {unreadCount > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-bold text-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    <div className="hidden h-8 w-px bg-light-border dark:bg-dark-border md:block" />

                    <div className="surface-panel-soft flex items-center gap-2 rounded-2xl px-2 py-1.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary text-sm font-bold text-white">
                            {userName ? userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="hidden min-w-0 md:block">
                            <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{userName || (ar ? 'المستخدم' : 'User')}</p>
                            <p className="truncate text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{userEmail || ''}</p>
                        </div>
                        {onSignOut && (
                            <button
                                onClick={onSignOut}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-light-text-secondary transition-colors hover:bg-light-bg hover:text-red-500 dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-red-300"
                                title={ar ? 'تسجيل الخروج' : 'Sign out'}
                                aria-label={ar ? 'تسجيل الخروج' : 'Sign out'}
                            >
                                <i className="fas fa-sign-out-alt text-xs" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
});
