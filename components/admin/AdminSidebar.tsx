import React, { useState } from 'react';
import { SystemHealthStatus } from '../../types';

interface NavItem {
    id: string;
    icon: string;
    label: string;
    badge?: number;
}

interface NavGroup {
    title: string;
    titleAr: string;
    items: NavItem[];
}

interface AdminSidebarProps {
    activePage: string;
    onNavigate: (page: string) => void;
    onSwitchToBrand?: () => void;
    onSignOut?: () => void;
    userName?: string;
    userEmail?: string;
    systemHealth?: SystemHealthStatus[];
}

const navGroups: NavGroup[] = [
    {
        title: 'Management',
        titleAr: 'الإدارة',
        items: [
            { id: 'admin-users',   icon: 'fa-users-cog',          label: 'المسؤولون' },
            { id: 'admin-tenants', icon: 'fa-building',            label: 'الحسابات' },
            { id: 'admin-billing', icon: 'fa-file-invoice-dollar', label: 'الفواتير والخطط' },
            { id: 'admin-ai-keys', icon: 'fa-key',                 label: 'مفاتيح AI' },
        ],
    },
    {
        title: 'Monitoring',
        titleAr: 'المراقبة',
        items: [
            { id: 'admin-ai-monitor',    icon: 'fa-brain',     label: 'مراقبة AI' },
            { id: 'admin-queues',        icon: 'fa-tasks',     label: 'قوائم الانتظار' },
            { id: 'admin-system-health', icon: 'fa-heartbeat', label: 'حالة النظام' },
            { id: 'admin-logs',          icon: 'fa-scroll',    label: 'سجلات الأدمن' },
        ],
    },
];

const singleItems: NavItem[] = [
    { id: 'admin-dashboard', icon: 'fa-tachometer-alt', label: 'نظرة عامة' },
    { id: 'admin-settings',  icon: 'fa-cogs',           label: 'إعدادات النظام' },
];

const NavButton: React.FC<{
    item: NavItem;
    isActive: boolean;
    onClick: () => void;
    compact?: boolean;
}> = ({ item, isActive, onClick, compact }) => (
    <button
        onClick={onClick}
        title={compact ? item.label : undefined}
        className={`group w-full flex items-center gap-3 rounded-xl transition-all duration-150 px-3 py-2.5 relative ${
            isActive
                ? 'bg-primary text-white font-bold shadow-md shadow-primary/25'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text'
        }`}
    >
        <i className={`fas ${item.icon} w-5 text-center text-sm flex-shrink-0`} />
        {!compact && <span className="flex-1 text-right text-sm">{item.label}</span>}
        {!compact && item.badge !== undefined && item.badge > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-danger text-white'}`}>
                {item.badge}
            </span>
        )}
        {compact && item.badge !== undefined && item.badge > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />
        )}
    </button>
);

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
    activePage,
    onNavigate,
    onSwitchToBrand,
    onSignOut,
    userName,
    userEmail,
    systemHealth = [],
}) => {
    const [collapsed, setCollapsed] = useState(false);

    const overallHealth = systemHealth.length === 0
        ? 'ok'
        : systemHealth.every(s => s.status === 'ok')
            ? 'ok'
            : systemHealth.some(s => s.status === 'down')
                ? 'down'
                : 'degraded';

    const healthDot = {
        ok:       'bg-success',
        degraded: 'bg-warning',
        down:     'bg-danger animate-pulse',
    }[overallHealth];

    const healthLabel = { ok: 'كل الأنظمة تعمل', degraded: 'أداء منخفض', down: 'خدمة متوقفة' }[overallHealth];

    const initials = userName
        ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <aside
            className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-light-card dark:bg-dark-card border-e border-light-border dark:border-dark-border flex-shrink-0 h-full flex flex-col`}
            style={{ direction: 'rtl' }}
        >
            {/* ── Logo ── */}
            <div className="px-4 py-4 flex items-center justify-between border-b border-light-border dark:border-dark-border min-h-[64px]">
                {!collapsed && (
                    <div className="flex items-center gap-2 min-w-0">
                        <h1 className="text-xl font-bold text-light-text dark:text-dark-text truncate">
                            SBrand<span className="text-primary">Ops</span>
                        </h1>
                        <span className="bg-primary/15 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">ADMIN</span>
                    </div>
                )}
                {collapsed && (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                        <span className="text-primary font-black text-xs">SB</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(c => !c)}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
                >
                    <i className={`fas ${collapsed ? 'fa-chevron-left' : 'fa-chevron-right'} text-xs`} />
                </button>
            </div>

            {/* ── System Health Bar ── */}
            {!collapsed && (
                <div className={`mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium
                    ${overallHealth === 'ok' ? 'bg-success/10 text-success' :
                      overallHealth === 'degraded' ? 'bg-warning/10 text-warning' :
                      'bg-danger/10 text-danger'}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${healthDot}`} />
                    <span className="truncate">{healthLabel}</span>
                </div>
            )}
            {collapsed && (
                <div className="flex justify-center mt-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${healthDot}`} title={healthLabel} />
                </div>
            )}

            {/* ── Nav ── */}
            <nav className="flex-1 p-3 space-y-5 overflow-y-auto mt-2">
                {/* Single items */}
                <div className="space-y-1">
                    {singleItems.map(item => (
                        <NavButton key={item.id} item={item} isActive={activePage === item.id} onClick={() => onNavigate(item.id)} compact={collapsed} />
                    ))}
                </div>

                {/* Groups */}
                {navGroups.map(group => (
                    <div key={group.title}>
                        {!collapsed && (
                            <p className="px-3 mb-2 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">
                                {group.titleAr}
                            </p>
                        )}
                        {collapsed && <div className="border-t border-light-border dark:border-dark-border my-2 mx-1" />}
                        <div className="space-y-1">
                            {group.items.map(item => (
                                <NavButton key={item.id} item={item} isActive={activePage === item.id} onClick={() => onNavigate(item.id)} compact={collapsed} />
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* ── Footer ── */}
            <div className="p-3 border-t border-light-border dark:border-dark-border space-y-1">
                {/* Switch to brand */}
                {onSwitchToBrand && (
                    <button
                        onClick={onSwitchToBrand}
                        title="العودة إلى البراند"
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text transition-colors"
                    >
                        <i className="fas fa-arrow-right-from-bracket w-5 text-center text-sm flex-shrink-0" />
                        {!collapsed && <span className="text-sm">Brand Workspace</span>}
                    </button>
                )}

                {/* User profile */}
                {!collapsed ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-light-bg dark:hover:bg-dark-bg transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{userName || 'Admin'}</p>
                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary truncate">{userEmail || ''}</p>
                        </div>
                        {onSignOut && (
                            <button
                                onClick={onSignOut}
                                title="تسجيل الخروج"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-light-text-secondary hover:text-danger dark:text-dark-text-secondary dark:hover:text-danger"
                            >
                                <i className="fas fa-sign-out-alt text-sm" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex justify-center py-1">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer" title={userName || 'Admin'}>
                            <span className="text-white text-xs font-bold">{initials}</span>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};
