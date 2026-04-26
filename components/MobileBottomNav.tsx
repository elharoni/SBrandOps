import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface Props {
    activePage: string;
    onNavigate: (page: string) => void;
    onOpenSidebar: () => void;
    unreadCount?: number;
}

const tabs = (ar: boolean) => [
    { id: 'mobile-home',    icon: 'fa-home',        label: ar ? 'الرئيسية' : 'Home'      },
    { id: 'inbox',          icon: 'fa-inbox',        label: ar ? 'الرسائل'  : 'Inbox'     },
    { id: 'content-studio', icon: 'fa-pen-nib',      label: ar ? 'المحتوى'  : 'Content'   },
    { id: 'analytics',      icon: 'fa-chart-pie',    label: ar ? 'الأداء'   : 'Analytics' },
    { id: '__menu__',       icon: 'fa-bars',          label: ar ? 'المزيد'   : 'More'      },
];

export const MobileBottomNav: React.FC<Props> = ({ activePage, onNavigate, onOpenSidebar, unreadCount = 0 }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const navTabs = tabs(ar);

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-[60] lg:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {/* Blur backdrop */}
            <div className="absolute inset-0 bg-white/85 dark:bg-[#070e1c]/90 backdrop-blur-[20px] saturate-150 border-t border-light-border/60 dark:border-dark-border/50" />

            <div className="relative flex items-center justify-around px-2 pt-2 pb-2">
                {navTabs.map(tab => {
                    const isMenu = tab.id === '__menu__';
                    const isActive = !isMenu && (activePage === tab.id || activePage.startsWith(tab.id + '/'));

                    return (
                        <button
                            key={tab.id}
                            onClick={() => isMenu ? onOpenSidebar() : onNavigate(tab.id)}
                            className="relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 px-2 rounded-2xl transition-all duration-200 active:scale-90"
                            aria-label={tab.label}
                        >
                            {/* Active pill background */}
                            {isActive && (
                                <div className="absolute inset-0 rounded-2xl bg-brand-primary/10" />
                            )}

                            <div className="relative">
                                <i className={`fas ${tab.icon} text-lg transition-all duration-200 ${
                                    isActive
                                        ? 'text-brand-primary'
                                        : 'text-light-text-secondary dark:text-dark-text-secondary'
                                }`} />
                                {tab.id === 'inbox' && unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>

                            <span className={`text-[10px] font-medium transition-colors duration-200 ${
                                isActive
                                    ? 'text-brand-primary'
                                    : 'text-light-text-secondary dark:text-dark-text-secondary'
                            }`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
