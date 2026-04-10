import React from 'react';

interface NavGroup {
    title: string;
    items: { id: string; icon: string; label: string; }[];
}

const navGroups: NavGroup[] = [
    {
        title: 'Management',
        items: [
            { id: 'admin-users', icon: 'fa-users-cog', label: 'المستخدمون' },
            { id: 'admin-tenants', icon: 'fa-building', label: 'العملاء' },
            { id: 'admin-billing', icon: 'fa-file-invoice-dollar', label: 'الفواتير والخطط' },
        ]
    },
    {
        title: 'Monitoring',
        items: [
            { id: 'admin-ai-monitor', icon: 'fa-brain', label: 'مراقبة AI' },
            { id: 'admin-queues', icon: 'fa-tasks', label: 'قوائم الانتظار' },
            { id: 'admin-system-health', icon: 'fa-heartbeat', label: 'حالة النظام' },
        ]
    }
];

const singleItems = [
    { id: 'admin-dashboard', icon: 'fa-tachometer-alt', label: 'نظرة عامة' },
    { id: 'admin-settings', icon: 'fa-cogs', label: 'إعدادات النظام' },
]

export const AdminSidebar: React.FC<{ activePage: string; onNavigate: (page: string) => void; }> = ({ activePage, onNavigate }) => {
    return (
        <aside className="w-64 bg-light-card dark:bg-dark-card border-s border-light-border dark:border-dark-border flex-shrink-0 h-full flex flex-col">
            <div className="px-6 py-4 flex items-center justify-center border-b border-light-border dark:border-dark-border">
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">SBrand<span className="text-primary">Ops</span></h1>
                <span className="ms-2 bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">ADMIN</span>
            </div>
            <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
                {singleItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center gap-3 text-right rounded-lg transition-all duration-200 px-4 py-2.5 ${
                            activePage === item.id
                                ? 'bg-primary text-white font-bold shadow-lg shadow-primary/30'
                                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text'
                        }`}
                    >
                        <i className={`fas ${item.icon} w-5 text-center`}></i>
                        <span>{item.label}</span>
                    </button>
                ))}

                {navGroups.map(group => (
                    <div key={group.title}>
                        <h3 className="px-4 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{group.title}</h3>
                        <div className="space-y-1 mt-2">
                            {group.items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    className={`w-full flex items-center gap-3 text-right rounded-lg transition-all duration-200 px-4 py-2.5 ${
                                        activePage === item.id
                                            ? 'bg-primary text-white font-bold'
                                            : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text'
                                    }`}
                                >
                                    <i className={`fas ${item.icon} w-5 text-center`}></i>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
};
