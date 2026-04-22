import React, { useMemo, useState } from 'react';
import { NavItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ProgressRing, CompletionStep } from './shared/ProgressRing';

interface NavSection {
    id: string;
    label: string;
    items: NavItem[];
}

const getNavSections = (t: any, ar: boolean): NavSection[] => [
    {
        id: 'command',
        label: ar ? 'القيادة' : 'Command',
        items: [
            { id: 'dashboard', icon: 'fa-house-chimney', label: ar ? 'مركز التشغيل' : 'Control Center' },
            { id: 'calendar',  icon: 'fa-calendar-alt',  label: ar ? 'التقويم'        : t.nav.calendar   },
        ],
    },
    {
        id: 'brand-brain-section',
        label: ar ? 'عقل البراند' : 'Brand Brain',
        items: [
            { id: 'brand-hub',           icon: 'fa-brain',                 label: ar ? 'هوية وصوت البراند' : 'Brand Identity'     },
            { id: 'brand-knowledge',     icon: 'fa-book-open',             label: ar ? 'قاعدة المعرفة'     : 'Knowledge Base'      },
            { id: 'brand-brain',         icon: 'fa-microchip',             label: ar ? 'Platform Brain'    : 'Platform Brain'      },
            { id: 'brand-brain-review',  icon: 'fa-circle-check',          label: ar ? 'مراجعة عقل البراند': 'Review Brand Brain'  },
            { id: 'brand-analysis',      icon: 'fa-magnifying-glass-plus', label: ar ? 'تحليل البراند'     : 'Brand Analysis'      },
        ],
    },
    {
        id: 'content-engine-section',
        label: ar ? 'محرك المحتوى' : 'Content Engine',
        items: [
            {
                id: 'content-engine',
                icon: 'fa-wand-magic-sparkles',
                label: ar ? 'إنشاء المحتوى' : 'Content Engine',
                children: [
                    { id: 'media-ops',      icon: 'fa-clapperboard',  label: ar ? 'إنتاج الميديا'   : 'Media Production' },
                    { id: 'content-studio', icon: 'fa-pen-nib',      label: ar ? 'استوديو المحتوى' : 'Content Studio'   },
                    { id: 'idea-ops',       icon: 'fa-lightbulb',    label: ar ? 'بنك الأفكار'     : 'Idea Bank'        },
                    { id: 'content-ops',    icon: 'fa-layer-group',  label: ar ? 'لوحة المحتوى'   : 'Content Pipeline' },
                    { id: 'marketing-plans',icon: 'fa-clipboard-list',label: ar ? 'خطط التسويق'   : 'Marketing Plans'  },
                    { id: 'design-ops',     icon: 'fa-palette',      label: ar ? 'التصميمات'       : 'Designs'          },
                    { id: 'ai-video',       icon: 'fa-film',         label: ar ? 'استوديو الفيديو' : 'Video Studio'     },
                    { id: 'asset-library',  icon: 'fa-photo-film',   label: ar ? 'مكتبة الأصول'   : 'Asset Library'    },
                ],
            },
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
                    { id: 'social-ops/publisher',    icon: 'fa-paper-plane',          label: ar ? 'نشر محتوى'         : t.nav.publisher   },
                    { id: 'social-ops/scheduled',    icon: 'fa-clock',                label: ar ? 'المجدولة'          : 'Scheduled'        },
                    { id: 'social-ops/accounts',     icon: 'fa-users-cog',            label: ar ? 'الحسابات المرتبطة' : t.nav.accounts     },
                    { id: 'social-ops/social-search',icon: 'fa-magnifying-glass-chart',label: ar ? 'البحث الاجتماعي'  : 'Social Search'    },
                ],
            },
        ],
    },
    {
        id: 'inbox-section',
        label: ar ? 'الرسائل والردود' : 'Inbox & Replies',
        items: [
            { id: 'inbox',       icon: 'fa-inbox',      label: ar ? 'صندوق الرسائل'  : 'Message Inbox'    },
            { id: 'crm/tickets', icon: 'fa-ticket-alt', label: ar ? 'تذاكر الدعم'    : 'Support Tickets'  },
            { id: 'workflow',    icon: 'fa-diagram-project', label: ar ? 'الفلوهات والأتمتة' : 'Flows & Automation' },
        ],
    },
    {
        id: 'ads-section',
        label: ar ? 'ذكاء الإعلانات' : 'Ads Intelligence',
        items: [
            { id: 'ads-ops', icon: 'fa-bullhorn', label: ar ? 'إدارة الإعلانات' : t.nav.ads },
        ],
    },
    {
        id: 'seo-section',
        label: ar ? 'SEO والموقع' : 'SEO & Website',
        items: [
            { id: 'seo-ops', icon: 'fa-search-location', label: ar ? 'تحسين محركات البحث' : t.nav.seo },
        ],
    },
    {
        id: 'analytics-section',
        label: ar ? 'التحليلات والنمو' : 'Analytics & Growth',
        items: [
            { id: 'analytics',     icon: 'fa-chart-pie',    label: ar ? 'التحليلات'      : t.nav.analytics },
            { id: 'crm/dashboard', icon: 'fa-gauge-high',   label: ar ? 'لوحة المبيعات'  : 'Sales Dashboard'},
            { id: 'crm/customers', icon: 'fa-users',        label: ar ? 'قاعدة العملاء'  : 'Customers'      },
            { id: 'crm/pipeline',  icon: 'fa-funnel-dollar',label: ar ? 'مسار المبيعات'  : 'Sales Pipeline'  },
        ],
    },
    {
        id: 'ops',
        label: ar ? 'التشغيل والإدارة' : 'Operations',
        items: [
            { id: 'integrations',    icon: 'fa-plug',               label: ar ? 'التكاملات والربط'  : 'Integrations'   },
            { id: 'integration-os',  icon: 'fa-network-wired',      label: ar ? 'نظام الأصول'       : 'Asset Registry'  },
            { id: 'team-management', icon: 'fa-users',              label: ar ? 'إدارة الفريق'      : 'Team'           },
            { id: 'billing',         icon: 'fa-credit-card',        label: ar ? 'الباقة والاشتراك'  : 'Plan & Billing' },
            { id: 'error-center',    icon: 'fa-exclamation-triangle',label: ar ? 'مركز الأخطاء'    : 'Error Center'   },
            { id: 'system',          icon: 'fa-cog',                label: ar ? 'إعدادات النظام'    : t.nav.system     },
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
    const ar = language === 'ar';
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || (ar ? 'مستخدم' : 'User');
    const userEmail = user?.email || '';
    const navSections = useMemo(() => getNavSections(t, ar), [t, ar]);
    const [openMenus, setOpenMenus] = useState<string[]>(['social-ops']);

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
                <div className={`flex items-center gap-3 px-4 pb-3 pt-5 ${isCollapsed ? 'justify-center px-0' : ''}`}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-primary text-sm font-black tracking-tight text-white shadow-primary-glow">
                        SB
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                                SBrand<span className="text-brand-primary">Ops</span>
                            </p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Brand Operating System</p>
                        </div>
                    )}
                    <button
                        onClick={closeMobile}
                        className="ms-auto flex h-[44px] w-[44px] items-center justify-center rounded-xl text-light-text-secondary hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text lg:hidden"
                        aria-label={ar ? 'إغلاق القائمة' : 'Close sidebar'}
                    >
                        <i className="fas fa-times text-sm" />
                    </button>
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
