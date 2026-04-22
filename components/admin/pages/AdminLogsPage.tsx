// components/admin/pages/AdminLogsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AdminLog } from '../../../types';
import { getAdminLogs } from '../../../services/adminService';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';

const entityTypeColor: Record<string, string> = {
    tenant:   'bg-blue-500/20 text-blue-400',
    user:     'bg-purple-500/20 text-purple-400',
    billing:  'bg-yellow-500/20 text-yellow-400',
    settings: 'bg-gray-500/20 text-gray-400',
    ai_key:   'bg-green-500/20 text-green-400',
    system:   'bg-red-500/20 text-red-400',
};

const EntityBadge: React.FC<{ type: string }> = ({ type }) => {
    const cls = entityTypeColor[type] || 'bg-gray-500/20 text-gray-400';
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{type || 'system'}</span>;
};

const PageSkeleton: React.FC = () => (
    <div className="space-y-4 animate-pulse">
        <SkeletonLoader className="h-10 w-64" />
        <SkeletonLoader className="h-8 w-80" />
        {[1, 2, 3, 4, 5].map(i => <SkeletonLoader key={i} className="h-16 w-full" />)}
    </div>
);

export const AdminLogsPage: React.FC = () => {
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        const data = await getAdminLogs();
        setLogs(data);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const entityTypes = ['all', ...Array.from(new Set(logs.map(l => l.entityType).filter(Boolean)))];

    const filtered = logs.filter(log => {
        const matchSearch = !search ||
            log.action.toLowerCase().includes(search.toLowerCase()) ||
            log.adminName.toLowerCase().includes(search.toLowerCase()) ||
            log.adminEmail.toLowerCase().includes(search.toLowerCase());
        const matchType = filterType === 'all' || log.entityType === filterType;
        return matchSearch && matchType;
    });

    if (loading) return <PageSkeleton />;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">سجلات الأدمن</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        جميع الإجراءات التي قام بها المسؤولون في النظام.
                    </p>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-4 py-2 border border-light-border dark:border-dark-border rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
                >
                    <i className="fas fa-sync-alt"></i>
                    تحديث
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="ابحث بالإجراء أو الاسم..."
                    className="flex-1 min-w-[200px] px-3 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-sm text-light-text dark:text-dark-text"
                />
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="px-3 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-sm text-light-text dark:text-dark-text"
                >
                    {entityTypes.map(t => (
                        <option key={t} value={t}>{t === 'all' ? 'جميع الأنواع' : t}</option>
                    ))}
                </select>
            </div>

            {/* Logs List */}
            {filtered.length === 0 ? (
                <div className="bg-light-card dark:bg-dark-card rounded-lg border border-light-border dark:border-dark-border p-12 text-center">
                    <i className="fas fa-clipboard-list text-4xl text-light-text-secondary dark:text-dark-text-secondary mb-3"></i>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">لا توجد سجلات مطابقة</p>
                </div>
            ) : (
                <div className="bg-light-card dark:bg-dark-card rounded-lg border border-light-border dark:border-dark-border overflow-hidden">
                    <div className="divide-y divide-light-border dark:divide-dark-border">
                        {filtered.map(log => (
                            <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <i className="fas fa-user-shield text-primary text-sm"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm text-light-text dark:text-dark-text">{log.adminName}</span>
                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{log.adminEmail}</span>
                                        <EntityBadge type={log.entityType} />
                                    </div>
                                    <p className="text-sm text-light-text dark:text-dark-text mt-0.5">{log.action}</p>
                                    {log.entityId && (
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono mt-0.5">
                                            ID: {log.entityId}
                                        </p>
                                    )}
                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                        <details className="mt-1">
                                            <summary className="text-xs text-primary cursor-pointer">تفاصيل إضافية</summary>
                                            <pre className="text-xs bg-light-bg dark:bg-dark-bg rounded p-2 mt-1 overflow-x-auto text-light-text-secondary dark:text-dark-text-secondary">
                                                {JSON.stringify(log.metadata, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0 text-left">
                                    {new Date(log.createdAt).toLocaleString('ar-EG')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
                إجمالي السجلات: {filtered.length} من {logs.length}
            </p>
        </div>
    );
};
