import React, { useEffect } from 'react';
import { SystemHealthStatus } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface AdminHeaderProps {
    onSwitchToBrand: () => void;
    systemHealth: SystemHealthStatus[];
    activePageId: string;
    onToggleCommandPalette: () => void;
}

const PAGE_BREADCRUMBS: Record<string, { parent?: string; current: string }> = {
    'admin-dashboard': { current: 'نظرة عامة' },
    'admin-users': { parent: 'Management', current: 'المستخدمون' },
    'admin-tenants': { parent: 'Management', current: 'العملاء' },
    'admin-billing': { parent: 'Management', current: 'الفواتير والخطط' },
    'admin-ai-monitor': { parent: 'Monitoring', current: 'مراقبة AI' },
    'admin-queues': { parent: 'Monitoring', current: 'قوائم الانتظار' },
    'admin-system-health': { parent: 'Monitoring', current: 'حالة النظام' },
    'admin-settings': { current: 'إعدادات النظام' },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
    onSwitchToBrand,
    systemHealth,
    activePageId,
    onToggleCommandPalette,
}) => {
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                onToggleCommandPalette();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onToggleCommandPalette]);

    const overallHealth = systemHealth.every((item) => item.status === 'ok')
        ? 'ok'
        : systemHealth.some((item) => item.status === 'down')
            ? 'down'
            : 'degraded';

    const healthConfig = {
        ok: { icon: 'fa-check-circle', label: 'Healthy', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
        degraded: { icon: 'fa-triangle-exclamation', label: 'Degraded', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
        down: { icon: 'fa-circle-xmark', label: 'Down', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' },
    }[overallHealth];

    const breadcrumb = PAGE_BREADCRUMBS[activePageId] || { current: 'Dashboard' };

    return (
        <header className="sticky top-0 z-20 border-b border-light-border/80 bg-light-bg/85 backdrop-blur-xl dark:border-dark-border/80 dark:bg-dark-bg/85">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 md:px-6">
                <div className="min-w-0">
                    <p className="section-kicker">Admin Control</p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        {breadcrumb.parent && <span className="text-light-text-secondary dark:text-dark-text-secondary">{breadcrumb.parent}</span>}
                        {breadcrumb.parent && <span className="text-light-text-secondary dark:text-dark-text-secondary">/</span>}
                        <span className="truncate font-semibold text-light-text dark:text-dark-text">{breadcrumb.current}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleCommandPalette}
                        className="surface-panel-soft hidden items-center gap-2 rounded-2xl px-3 py-2 text-sm text-light-text-secondary transition-colors hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text md:flex"
                    >
                        <i className="fas fa-search text-xs" />
                        <span>Search admin</span>
                        <span className="rounded-lg bg-light-bg px-1.5 py-0.5 text-[10px] dark:bg-dark-bg">⌘K</span>
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl text-light-text-secondary transition-colors hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text"
                        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    >
                        <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-sm`} />
                    </button>

                    <div className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${healthConfig.className}`}>
                        <i className={`fas ${healthConfig.icon} text-xs`} />
                        <span className="hidden md:inline">{healthConfig.label}</span>
                    </div>

                    <button
                        onClick={onSwitchToBrand}
                        className="surface-panel-soft flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-card dark:text-dark-text dark:hover:bg-dark-card"
                        title="العودة إلى البراند"
                    >
                        <i className="fas fa-arrow-left text-xs" />
                        <span className="hidden md:inline">Brand workspace</span>
                    </button>
                </div>
            </div>
        </header>
    );
};
