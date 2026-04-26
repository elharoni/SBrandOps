import React, { useMemo, useState, useEffect } from 'react';
import { NavItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ProgressRing, CompletionStep } from './shared/ProgressRing';
import { SBrandOpsLogo, LogoVariant } from './SBrandOpsLogo';

interface NavSection {
    id: string;
    label: string;
    items: NavItem[];
}

const getNavSections = (t: any, ar: boolean): NavSection[] => [
    {
        id: 'command',
        label: ar ? 'مركز القيادة' : 'Command Center',
        items: [
            { id: 'dashboard', icon: 'fa-house-chimney', label: ar ? 'مركز التحكم' : 'Control Center' },
            { id: 'calendar',  icon: 'fa-calendar-alt',  label: ar ? 'التقويم'      : 'Calendar'       },
        ],
    },
    {
        id: 'brand-system',
        label: ar ? 'نظام البراند' : 'Brand System',
        items: [
            { id: 'brand-hub', icon: 'fa-fingerprint', label: ar ? 'هوية البراند' : 'Brand Hub' },
            {
                id: 'brand-brain',
                icon: 'fa-microchip',
                label: ar ? 'عقل البراند' : 'Brand Brain',
                children: [
                    { id: 'brand-knowledge',    icon: 'fa-book-open',             label: ar ? 'قاعدة المعرفة'      : 'Knowledge Base' },
                    { id: 'brand-brain-review', icon: 'fa-circle-check',          label: ar ? 'مراجعة عقل البراند' : 'Brain Review'   },
                    { id: 'brand-analysis',     icon: 'fa-magnifying-glass-plus', label: ar ? 'تحليل البراند'      : 'Brand Analysis' },
                ],
            },
        ],
    },
    {
        id: 'planning-section',
        label: ar ? 'التخطيط والإنتاج' : 'Planning & Production',
        items: [
            { id: 'campaign-brain', icon: 'fa-bullseye', label: ar ? 'الحملات الذكية' : 'Campaign Brain' },
            {
                id: 'content-hub',
                icon: 'fa-pen-nib',
                label: ar ? 'استوديو المحتوى' : 'Content Studio',
                children: [
                    { id: 'content-studio',  icon: 'fa-wand-magic-sparkles', label: ar ? 'استوديو المحتوى' : 'Content Studio'  },
                    { id: 'idea-ops',        icon: 'fa-lightbulb',           label: ar ? 'بنك الأفكار'     : 'Idea Bank'       },
                    { id: 'content-ops',     icon: 'fa-layer-group',         label: ar ? 'لوحة المحتوى'   : 'Content Pipeline'},
                    { id: 'marketing-plans', icon: 'fa-clipboard-list',      label: ar ? 'خطط التسويق'    : 'Marketing Plans' },
                ],
            },
            {
                id: 'media-hub',
                icon: 'fa-palette',
                label: ar ? 'الميديا والتصميم' : 'Media & Design',
                children: [
                    { id: 'media-ops',  icon: 'fa-clapperboard', label: ar ? 'إنتاج الميديا'   : 'Media Production' },
                    { id: 'design-ops', icon: 'fa-pen-ruler',    label: ar ? 'التصميمات'       : 'Design Ops'       },
                    { id: 'ai-video',   icon: 'fa-film',         label: ar ? 'استوديو الفيديو' : 'Video Studio'     },
                ],
            },
            { id: 'asset-library', icon: 'fa-photo-film', label: ar ? 'مكتبة الأصول' : 'Asset Library' },
        ],
    },
    {
        id: 'social-section',
        label: ar ? 'النشر والسوشيال' : 'Publishing & Social',
        items: [
            {
                id: 'social-ops',
                icon: 'fa-share-nodes',
                label: ar ? 'النشر الاجتماعي' : 'Social Publishing',
                children: [
                    { id: 'social-ops/publisher',     icon: 'fa-paper-plane',           label: ar ? 'نشر محتوى'         : 'New Post'          },
                    { id: 'social-ops/scheduled',     icon: 'fa-clock',                 label: ar ? 'المجدولة'          : 'Scheduled'         },
                    { id: 'social-ops/accounts',      icon: 'fa-users-cog',             label: ar ? 'الحسابات المرتبطة' : 'Connected Accounts'},
                    { id: 'social-ops/social-search', icon: 'fa-magnifying-glass-chart',label: ar ? 'البحث الاجتماعي'  : 'Social Search'     },
                ],
            },
        ],
    },
    {
        id: 'inbox-section',
        label: ar ? 'الرسائل والتفاعل' : 'Inbox & Engagement',
        items: [
            { id: 'inbox',    icon: 'fa-inbox', label: ar ? 'صندوق الرسائل' : 'Unified Inbox' },
            { id: 'workflow', icon: 'fa-robot', label: ar ? 'البوت الذكي'   : 'Smart Bot'     },
        ],
    },
    {
        id: 'growth-section',
        label: ar ? 'قنوات النمو' : 'Growth Channels',
        items: [
            { id: 'ads-ops', icon: 'fa-bullhorn',         label: ar ? 'إدارة الإعلانات'    : 'Ads Ops' },
            { id: 'seo-ops', icon: 'fa-magnifying-glass', label: ar ? 'تحسين محركات البحث' : 'SEO Ops' },
        ],
    },
    {
        id: 'crm-section',
        label: ar ? 'CRM والمبيعات' : 'CRM & Sales',
        items: [
            {
                id: 'crm',
                icon: 'fa-address-card',
                label: ar ? 'إدارة العملاء' : 'CRM',
                children: [
                    { id: 'crm/dashboard', icon: 'fa-gauge-high', label: ar ? 'لوحة المبيعات' : 'Sales Dashboard' },
                    { id: 'crm/customers', icon: 'fa-users',      label: ar ? 'قاعدة العملاء' : 'Customers'       },
                    { id: 'crm/pipeline',  icon: 'fa-filter',     label: ar ? 'مسار المبيعات' : 'Sales Pipeline'  },
                    { id: 'crm/tickets',   icon: 'fa-ticket',     label: ar ? 'تذاكر الدعم'   : 'Support Tickets' },
                ],
            },
        ],
    },
    {
        id: 'intelligence-section',
        label: ar ? 'الذكاء والتحليلات' : 'Intelligence',
        items: [
            { id: 'analytics', icon: 'fa-chart-pie', label: ar ? 'مركز التحليلات' : 'Analytics Hub' },
        ],
    },
    {
        id: 'ops',
        label: ar ? 'التشغيل والإدارة' : 'Operations',
        items: [
            { id: 'integrations',    icon: 'fa-plug',               label: ar ? 'التكاملات'        : 'Integrations'    },
            { id: 'integration-os',  icon: 'fa-network-wired',      label: ar ? 'الأصول المرتبطة'  : 'Connected Assets'},
            { id: 'brands-manage',   icon: 'fa-layer-group',        label: ar ? 'إدارة البراندات'  : 'Manage Brands'   },
            { id: 'team-management', icon: 'fa-users',              label: ar ? 'إدارة الفريق'     : 'Team'            },
            { id: 'billing',         icon: 'fa-credit-card',        label: ar ? 'الباقة والاشتراك' : 'Plan & Billing'  },
            { id: 'error-center',    icon: 'fa-exclamation-triangle',label: ar ? 'مركز الأخطاء'   : 'Error Center'    },
            { id: 'system',          icon: 'fa-cog',                label: ar ? 'إعدادات النظام'   : 'Settings'        },
        ],
    },
];

interface SidebarProps {
    activePage: string;
    onNavigate: (page: string) => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    isMobileOpen: boolean;
    closeMobile: () => void;
    completionSteps?: CompletionStep[];
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
    activePage,
    onNavigate,
    isCollapsed,
    toggleCollapse,
    isMobileOpen,
    closeMobile,
    completionSteps,
}) => {
    const { t, language } = useLanguage();
    const { user } = useAuth();
    const { theme } = useTheme();
    const ar = language === 'ar';
    const logoVariant: LogoVariant = theme === 'dark' ? 'white' : 'blue';
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || (ar ? 'مستخدم' : 'User');
    const userEmail = user?.email || '';
    const navSections = useMemo(() => getNavSections(t, ar), [t, ar]);

    // Map each child page to its parent menu id so the correct section
    // auto-expands when the user lands on a child page via URL or deep link.
    const CHILD_TO_PARENT: Record<string, string> = {
        'brand-knowledge': 'brand-brain', 'brand-brain-review': 'brand-brain', 'brand-analysis': 'brand-brain',
        'content-studio': 'content-hub', 'idea-ops': 'content-hub', 'content-ops': 'content-hub', 'marketing-plans': 'content-hub',
        'media-ops': 'media-hub', 'design-ops': 'media-hub', 'ai-video': 'media-hub',
        'crm/dashboard': 'crm', 'crm/customers': 'crm', 'crm/pipeline': 'crm', 'crm/tickets': 'crm',
        'social-ops/publisher': 'social-ops', 'social-ops/scheduled': 'social-ops',
        'social-ops/accounts': 'social-ops', 'social-ops/social-search': 'social-ops',
    };
    const getDefaultOpenMenus = (page: string): string[] => {
        const defaults: string[] = ['social-ops'];
        const parent = CHILD_TO_PARENT[page];
        if (parent && !defaults.includes(parent)) defaults.push(parent);
        return defaults;
    };
    const [openMenus, setOpenMenus] = useState<string[]>(() => getDefaultOpenMenus(activePage));

    // When the active page changes externally (direct URL / programmatic navigate),
    // ensure the parent menu is open so the active item is visible.
    useEffect(() => {
        const parent = CHILD_TO_PARENT[activePage];
        if (parent) {
            setOpenMenus(prev => prev.includes(parent) ? prev : [...prev, parent]);
        }
    }, [activePage]);

    const toggleMenu = (id: string) => {
        if (isCollapsed) {
            toggleCollapse();
            setTimeout(() => {
                setOpenMenus((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
            }, 60);
            return;
        }

        setOpenMenus((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
    };

    const handleNavigation = (item: NavItem) => {
        if (item.children) {
            toggleMenu(item.id);
            return;
        }

        onNavigate(item.id);
        if (window.innerWidth < 1024) {
            closeMobile();
        }
    };

    const renderItem = (item: NavItem, nested = false) => {
        const hasChildren = !!item.children;
        const isMenuOpen = openMenus.includes(item.id);
        const isActive = hasChildren
            ? (activePage.startsWith(`${item.id}/`) || (item.children?.some(c => c.id === activePage) ?? false))
            : activePage === item.id;

        return (
            <div key={item.id} className="group">
                <button
                    onClick={() => handleNavigation(item)}
                    className={`flex w-full items-center gap-3 rounded-2xl transition-all ${
                        isCollapsed && !nested ? 'justify-center px-0 py-3' : ar ? 'px-3 py-3 text-right' : 'px-3 py-3 text-left'
                    } ${
                        isActive
                            ? 'bg-brand-primary text-white shadow-primary-glow'
                            : 'text-light-text-secondary hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text'
                    } ${nested ? 'text-sm' : 'text-[0.95rem]'}`}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                >
                    <i className={`fas ${item.icon} w-4 shrink-0 text-center ${isActive ? 'text-white' : ''}`} />
                    {!isCollapsed && (
                        <>
                            <span className="flex-1 truncate font-medium">{item.label}</span>
                            {hasChildren && (
                                <i className={`fas fa-chevron-down text-[11px] transition-transform ${isMenuOpen ? 'rotate-180' : ''} ${isActive ? 'text-white/80' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
                            )}
                        </>
                    )}
                </button>

                {hasChildren && !isCollapsed && (
                    <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isMenuOpen ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                            <div className={`${ar ? 'mr-4 border-r pr-3' : 'ml-4 border-l pl-3'} space-y-1 border-light-border/40 dark:border-dark-border/40`}>
                                {item.children?.map((child) => renderItem(child, true))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {isMobileOpen && (
                <div className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm lg:hidden" onClick={closeMobile} />
            )}

            <aside
                className={`fixed top-0 z-50 flex h-full flex-col bg-white/80 backdrop-blur-[24px] saturate-150 transition-all duration-300 dark:bg-[#070e1c]/80 lg:static shadow-[var(--shadow-ambient)] ${
                    ar ? 'right-0 ' : 'left-0 '
                } ${isMobileOpen ? 'translate-x-0' : ar ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isCollapsed ? 'w-[5.25rem]' : 'w-[18.5rem]'}`}
            >
                <div className={`flex items-center gap-3 px-4 pb-3 pt-5 ${isCollapsed ? 'justify-center px-2' : ''}`}>
                    {/* Official mark icon from brand pack — icon-only, always sharp */}
                    <SBrandOpsLogo
                        variant={logoVariant}
                        layout="mark"
                        size="md"
                        className="shrink-0"
                        alt="SBrandOps"
                    />

                    {/* HTML wordmark — crisp at any size, follows brand typography */}
                    {!isCollapsed && (
                        <>
                            <div className="min-w-0 flex-1">
                                <p className="text-[15px] font-bold leading-none tracking-tight text-light-text dark:text-dark-text">
                                    SBrand<span
                                        style={{ background: 'var(--sbo-gradient-primary)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
                                    >Ops</span>
                                </p>
                                <p className="mt-0.5 text-[10px] font-medium tracking-[0.12em] uppercase text-light-text-secondary dark:text-dark-text-secondary">
                                    Brand OS
                                </p>
                            </div>
                            <button
                                onClick={closeMobile}
                                className="ms-auto flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl text-light-text-secondary hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text lg:hidden"
                                aria-label={ar ? 'إغلاق القائمة' : 'Close sidebar'}
                            >
                                <i className="fas fa-times text-sm" />
                            </button>
                        </>
                    )}
                </div>
                <div className="px-3 pb-3">
                    <button
                        onClick={() => {
                            onNavigate('social-ops/publisher');
                            if (window.innerWidth < 1024) {
                                closeMobile();
                            }
                        }}
                        className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary px-3 py-3 text-sm font-semibold text-white shadow-primary-glow transition-transform hover:-translate-y-0.5 ${isCollapsed ? 'px-0' : ''}`}
                        title={ar ? '+ إنشاء منشور جديد' : 'Create new post'}
                        aria-label={ar ? 'إنشاء منشور جديد' : 'Create new post'}
                    >
                        <i className="fas fa-plus text-xs" />
                        {!isCollapsed && <span>{ar ? '+ منشور جديد' : '+ New post'}</span>}
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 pb-4">
                    {navSections.map((section) => (
                        <div key={section.id} className="mb-4">
                            {!isCollapsed && (
                                <div className="px-3 pb-2">
                                    <p className="section-kicker">{section.label}</p>
                                </div>
                            )}
                            <div className="space-y-1">
                                {section.items.map((item) => renderItem(item))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Progress Ring */}
                {completionSteps && completionSteps.length > 0 && (
                    <ProgressRing steps={completionSteps} isCollapsed={isCollapsed} onNavigate={onNavigate} />
                )}

                <div className="mt-auto border-t border-light-border/70 px-3 py-3 dark:border-dark-border/70">
                    <button
                        onClick={() => {
                            onNavigate('user-settings');
                            if (window.innerWidth < 1024) {
                                closeMobile();
                            }
                        }}
                        className={`surface-panel-soft flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-light-text transition-colors hover:bg-light-card dark:text-dark-text dark:hover:bg-dark-card ${isCollapsed ? 'justify-center px-0' : ''}`}
                        title={ar ? 'إعدادات الحساب' : 'Account settings'}
                        aria-label={ar ? 'فتح إعدادات الحساب' : 'Open account settings'}
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-sm font-bold text-white">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{displayName}</p>
                                <p className="truncate text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{userEmail}</p>
                            </div>
                        )}
                    </button>

                    <button
                        onClick={toggleCollapse}
                        className="mt-3 hidden h-10 w-full items-center justify-center gap-2 rounded-2xl border border-light-border/80 text-sm font-medium text-light-text-secondary transition-colors hover:bg-light-card hover:text-light-text dark:border-dark-border/80 dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text lg:flex"
                        title={ar ? 'طي الشريط الجانبي' : 'Toggle sidebar'}
                        aria-label={ar ? 'طي أو توسيع الشريط الجانبي' : 'Toggle sidebar collapse'}
                    >
                        <i
                            className={`fas ${
                                isCollapsed
                                    ? (ar ? 'fa-angles-left' : 'fa-angles-right')
                                    : (ar ? 'fa-angles-right' : 'fa-angles-left')
                            } text-xs`}
                        />
                        {!isCollapsed && <span>{ar ? 'طي الشريط الجانبي' : 'Collapse sidebar'}</span>}
                    </button>
                </div>
            </aside>
        </>
    );
});
