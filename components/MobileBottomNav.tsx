import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface Props {
    activePage: string;
    onNavigate: (page: string) => void;
    onOpenSidebar: () => void;
    unreadCount?: number;
}

const tabs = (ar: boolean) => [
    { id: 'mobile-home', icon: 'fa-home', label: ar ? 'الرئيسية' : 'Home' },
    { id: 'inbox', icon: 'fa-inbox', label: ar ? 'الرسائل' : 'Inbox' },
    { id: 'content-studio', icon: 'fa-pen-nib', label: ar ? 'المحتوى' : 'Content' },
    { id: 'analytics', icon: 'fa-chart-pie', label: ar ? 'الأداء' : 'Analytics' },
    { id: '__menu__', icon: 'fa-bars', label: ar ? 'المزيد' : 'More' },
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
            {/* Single high-fidelity glassmorphic backdrop */}
            <div className="absolute inset-0 bg-white/80 dark:bg-[#070e1c]/80 backdrop-blur-[24px] saturate-160 border-t border-light-border/50 dark:border-dark-border/30 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.25)]" />

            <div className="relative flex items-center justify-around px-2.5 pt-2 pb-2">
                {navTabs.map(tab => {
                    const isMenu = tab.id === '__menu__';
                    const isActive = !isMenu && (activePage === tab.id || activePage.startsWith(tab.id + '/'));

                    return (
                        <button
                            key={tab.id}
                            onClick={() => isMenu ? onOpenSidebar() : onNavigate(tab.id)}
                            className="relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-90"
                            aria-label={tab.label}
                        >
                            {/* Active indicator and pill */}
                            {isActive && (
                                <>
                                    {/* Top active glowing line */}
                                    <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full bg-brand-primary shadow-[0_0_8px_rgba(37,99,235,0.7)]" />
                                    {/* Active background pill */}
                                    <div className="absolute inset-0 rounded-2xl bg-brand-primary/8 dark:bg-brand-primary/12" />
                                </>
                            )}

                            <div className="relative z-10">
                                <i className={`fas ${tab.icon} text-lg transition-all duration-300 ${isActive
                                        ? 'text-brand-primary scale-110'
                                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                    }`} />
                                {tab.id === 'inbox' && unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#070e1c]">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>

                            <span className={`relative z-10 text-[10px] font-bold tracking-tight transition-colors duration-300 ${isActive
                                    ? 'text-brand-primary font-black'
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
