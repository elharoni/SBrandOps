import React, { useState, useEffect, useCallback } from 'react';
import { PageScaffold, PageSection } from '../../shared/PageScaffold';
import {
    CrmTicket,
    CrmTicketStatus,
    CrmTicketPriority,
    CrmTicketStats,
    CrmTicketFilters,
} from '../../../types';
import {
    getTickets,
    getTicketStats,
    createTicket,
    updateTicketStatus,
} from '../../../services/crmTicketsService';

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CrmTicketStatus, { labelAr: string; badge: string }> = {
    open:        { labelAr: 'مفتوحة',        badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    in_progress: { labelAr: 'قيد المعالجة',  badge: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
    resolved:    { labelAr: 'محلولة',         badge: 'bg-green-500/10 text-green-600 border-green-500/20' },
    closed:      { labelAr: 'مغلقة',          badge: 'bg-gray-400/10 text-gray-500 border-gray-400/20' },
};

const PRIORITY_CONFIG: Record<CrmTicketPriority, { icon: string; color: string; labelAr: string }> = {
    low:    { icon: 'fa-arrow-down', color: 'text-gray-400',   labelAr: 'منخفض' },
    medium: { icon: 'fa-minus',      color: 'text-blue-400',   labelAr: 'متوسط' },
    high:   { icon: 'fa-arrow-up',   color: 'text-orange-400', labelAr: 'مرتفع' },
    urgent: { icon: 'fa-fire',       color: 'text-red-500',    labelAr: 'عاجل' },
};

const SOURCE_ICON: Record<string, string> = {
    email:  'fas fa-envelope',
    chat:   'fas fa-comments',
    phone:  'fas fa-phone',
    social: 'fas fa-hashtag',
    manual: 'fas fa-pencil-alt',
};

const STATUS_FILTER_TABS: { key: CrmTicketStatus | 'all'; labelAr: string }[] = [
    { key: 'all',        labelAr: 'الكل' },
    { key: 'open',       labelAr: 'مفتوحة' },
    { key: 'in_progress',labelAr: 'قيد المعالجة' },
    { key: 'resolved',   labelAr: 'محلولة' },
    { key: 'closed',     labelAr: 'مغلقة' },
];

// ── Create Ticket Modal ────────────────────────────────────────────────────────

interface CreateTicketModalProps {
    brandId: string;
    onClose: () => void;
    onCreated: () => void;
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({ brandId, onClose, onCreated }) => {
    const [subject,      setSubject]      = useState('');
    const [description,  setDescription]  = useState('');
    const [priority,     setPriority]     = useState<CrmTicketPriority>('medium');
    const [source,       setSource]       = useState<string>('manual');
    const [saving,       setSaving]       = useState(false);
    const [error,        setError]        = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim()) { setError('الموضوع مطلوب'); return; }
        setSaving(true);
        const result = await createTicket(brandId, { subject: subject.trim(), description: description.trim() || undefined, priority, source });
        setSaving(false);
        if (!result) { setError('حدث خطأ أثناء الحفظ'); return; }
        onCreated();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg surface-panel rounded-[2rem] shadow-2xl p-8 animate-slide-up">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-black text-light-text dark:text-dark-text">تذكرة جديدة</h2>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-light-bg dark:bg-dark-bg text-light-text-secondary hover:text-red-500 transition-colors">
                        <i className="fas fa-times" />
                    </button>
                </div>

                <form onSubmit={e => void handleSubmit(e)} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الموضوع *</label>
                        <input
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="وصف مختصر للمشكلة أو الاستفسار"
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الوصف</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder="تفاصيل إضافية اختيارية..."
                            className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الأولوية</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as CrmTicketPriority)}
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary"
                            >
                                {(Object.entries(PRIORITY_CONFIG) as [CrmTicketPriority, typeof PRIORITY_CONFIG[CrmTicketPriority]][]).map(([k, v]) => (
                                    <option key={k} value={k}>{v.labelAr}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">المصدر</label>
                            <select
                                value={source}
                                onChange={e => setSource(e.target.value)}
                                className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-4 py-3 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary"
                            >
                                <option value="manual">يدوي</option>
                                <option value="email">إيميل</option>
                                <option value="chat">محادثة</option>
                                <option value="phone">هاتف</option>
                                <option value="social">سوشيال</option>
                            </select>
                        </div>
                    </div>

                    {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 rounded-xl border border-light-border dark:border-dark-border text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                            إلغاء
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-3 rounded-xl bg-brand-primary text-white text-sm font-bold shadow-lg shadow-brand-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:translate-y-0">
                            {saving ? <><i className="fas fa-spinner fa-spin me-2" />جاري الحفظ...</> : 'إنشاء التذكرة'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Status Quick-Change Dropdown ───────────────────────────────────────────────

interface StatusDropdownProps {
    ticket: CrmTicket;
    brandId: string;
    onUpdated: () => void;
}

const StatusDropdown: React.FC<StatusDropdownProps> = ({ ticket, brandId, onUpdated }) => {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const change = async (status: CrmTicketStatus) => {
        if (status === ticket.status) { setOpen(false); return; }
        setSaving(true);
        await updateTicketStatus(brandId, ticket.id, status);
        setSaving(false);
        setOpen(false);
        onUpdated();
    };

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setOpen(o => !o)}
                disabled={saving}
                className={`flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold gap-1.5 transition-colors ${STATUS_CONFIG[ticket.status].badge} hover:opacity-80`}
            >
                {saving ? <i className="fas fa-spinner fa-spin" /> : STATUS_CONFIG[ticket.status].labelAr}
                <i className="fas fa-chevron-down text-[8px]" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-20 w-40 surface-panel rounded-xl shadow-xl py-1 border border-light-border dark:border-dark-border overflow-hidden">
                        {(Object.entries(STATUS_CONFIG) as [CrmTicketStatus, typeof STATUS_CONFIG[CrmTicketStatus]][]).map(([k, v]) => (
                            <button
                                key={k}
                                onClick={() => void change(k)}
                                className={`w-full text-right px-4 py-2.5 text-xs font-bold transition-colors hover:bg-light-bg dark:hover:bg-dark-bg ${k === ticket.status ? 'opacity-40 cursor-default' : ''}`}
                            >
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border ${v.badge}`}>{v.labelAr}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// ── Stats Cards ────────────────────────────────────────────────────────────────

const formatResolutionTime = (minutes?: number): string => {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes}د`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}س ${m}د` : `${h}س`;
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export interface CrmTicketsPageProps {
    brandId: string;
}

export const CrmTicketsPage: React.FC<CrmTicketsPageProps> = ({ brandId }) => {
    const [tickets,       setTickets]       = useState<CrmTicket[]>([]);
    const [total,         setTotal]         = useState(0);
    const [stats,         setStats]         = useState<CrmTicketStats | null>(null);
    const [loading,       setLoading]       = useState(true);
    const [filters,       setFilters]       = useState<CrmTicketFilters>({ page: 1, pageSize: 25 });
    const [statusTab,     setStatusTab]     = useState<CrmTicketStatus | 'all'>('all');
    const [searchVal,     setSearchVal]     = useState('');
    const [isCreateOpen,  setIsCreateOpen]  = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [res, s] = await Promise.all([
            getTickets(brandId, filters),
            getTicketStats(brandId),
        ]);
        setTickets(res.data);
        setTotal(res.total);
        setStats(s);
        setLoading(false);
    }, [brandId, filters]);

    useEffect(() => { void load(); }, [load]);

    const applyStatusTab = (tab: CrmTicketStatus | 'all') => {
        setStatusTab(tab);
        setFilters(f => ({ ...f, status: tab === 'all' ? undefined : [tab], page: 1 }));
    };

    const handleSearch = (val: string) => {
        setSearchVal(val);
        setFilters(f => ({ ...f, search: val || undefined, page: 1 }));
    };

    const pageSize   = filters.pageSize ?? 25;
    const page       = filters.page ?? 1;
    const totalPages = Math.ceil(total / pageSize);

    return (
        <PageScaffold
            kicker="Support Ops"
            title="تذاكر الدعم"
            description="إدارة العملاء وحل الشكاوى وتلبية الاستفسارات الواردة."
            stats={[
                { label: 'إجمالي التذاكر', value: (stats?.total ?? 0).toString(), icon: 'fa-ticket' }
            ]}
            actions={
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="btn rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-primary/20 transition-all hover:-translate-y-0.5 active:scale-95"
                >
                    <i className="fas fa-ticket-alt me-2" />
                    تذكرة جديدة
                </button>
            }
        >
            <PageSection className="space-y-6">

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="surface-panel-soft rounded-[1.5rem] !border-0 p-5 shadow-sm text-center">
                    {loading ? <div className="h-8 bg-light-border dark:bg-dark-border rounded animate-pulse mb-1" /> : <div className="text-3xl font-black text-light-text dark:text-dark-text">{stats?.open ?? 0}</div>}
                    <div className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">تذاكر مفتوحة</div>
                </div>
                <div className="surface-panel-soft rounded-[1.5rem] !border-0 p-5 shadow-sm text-center">
                    {loading ? <div className="h-8 bg-light-border dark:bg-dark-border rounded animate-pulse mb-1" /> : <div className="text-3xl font-black text-yellow-500">{stats?.inProgress ?? 0}</div>}
                    <div className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">قيد المعالجة</div>
                </div>
                <div className="surface-panel-soft rounded-[1.5rem] !border-0 p-5 shadow-sm text-center">
                    {loading ? <div className="h-8 bg-light-border dark:bg-dark-border rounded animate-pulse mb-1" /> : <div className="text-3xl font-black text-red-500">{stats?.urgent ?? 0}</div>}
                    <div className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">تذاكر عاجلة</div>
                </div>
                <div className="surface-panel-soft rounded-[1.5rem] !border-0 p-5 shadow-sm text-center">
                    {loading ? <div className="h-8 bg-light-border dark:bg-dark-border rounded animate-pulse mb-1" /> : <div className="text-3xl font-black text-green-500">{formatResolutionTime(stats?.avgResolutionMinutes)}</div>}
                    <div className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">متوسط وقت الحل</div>
                </div>
            </div>

            {/* List panel */}
            <div className="surface-panel rounded-[2rem] overflow-hidden !border-0 shadow-[var(--shadow-ambient)]">

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 p-6 border-b border-light-border/40 dark:border-dark-border/40">
                    {/* Status tabs */}
                    <div className="flex gap-1.5 flex-wrap">
                        {STATUS_FILTER_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => applyStatusTab(tab.key)}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                                    statusTab === tab.key
                                        ? 'bg-brand-primary text-white shadow-sm'
                                        : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                }`}
                            >
                                {tab.labelAr}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative ms-auto flex-1 min-w-[220px] max-w-xs">
                        <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-light-text-secondary/50 dark:text-dark-text-secondary/50 text-xs" />
                        <input
                            type="text"
                            placeholder="بحث في التذاكر..."
                            value={searchVal}
                            onChange={e => handleSearch(e.target.value)}
                            className="w-full pl-4 pr-9 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="divide-y divide-light-border/40 dark:divide-dark-border/40">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-6 animate-pulse">
                                <div className="w-12 h-12 bg-light-border dark:bg-dark-border rounded-2xl flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-light-border dark:bg-dark-border rounded w-2/3" />
                                    <div className="h-3 bg-light-border dark:bg-dark-border rounded w-1/3" />
                                </div>
                                <div className="h-7 w-24 bg-light-border dark:bg-dark-border rounded-full" />
                            </div>
                        ))
                    ) : tickets.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary shadow-inner mb-4">
                                <i className="fas fa-ticket text-2xl" />
                            </div>
                            <p className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary">
                                {statusTab === 'all' ? 'لا توجد تذاكر بعد' : `لا توجد تذاكر بحالة "${STATUS_CONFIG[statusTab as CrmTicketStatus]?.labelAr ?? statusTab}"`}
                            </p>
                            <p className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-1">ابدأ بإنشاء أول تذكرة دعم</p>
                        </div>
                    ) : (
                        tickets.map(ticket => {
                            const pCfg = PRIORITY_CONFIG[ticket.priority];
                            return (
                                <div key={ticket.id} className="group flex items-center justify-between p-6 transition-all hover:bg-light-bg/50 dark:hover:bg-dark-bg/50">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-light-bg shadow-inner dark:bg-dark-bg">
                                            <i className={`fas ${pCfg.icon} ${pCfg.color}`} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-light-text dark:text-dark-text group-hover:text-brand-primary transition-colors line-clamp-1 cursor-default">
                                                {ticket.subject}
                                            </h4>
                                            <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                                <span className="font-mono opacity-60">{ticket.id.slice(0, 8).toUpperCase()}</span>
                                                <span>•</span>
                                                <span title={pCfg.labelAr}><i className={`${SOURCE_ICON[ticket.source] ?? 'fas fa-circle'} opacity-60 me-1`} />{ticket.source}</span>
                                                <span>•</span>
                                                <span>{new Date(ticket.createdAt).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short' })}</span>
                                                {ticket.assigneeName && (
                                                    <>
                                                        <span>•</span>
                                                        <span><i className="fas fa-user-circle me-1 opacity-60" />{ticket.assigneeName}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`hidden lg:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${PRIORITY_CONFIG[ticket.priority].color} bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border`}>
                                            <i className={`fas ${pCfg.icon} text-[10px]`} />
                                            {pCfg.labelAr}
                                        </span>
                                        <StatusDropdown ticket={ticket} brandId={brandId} onUpdated={load} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-light-bg/50 dark:bg-dark-bg/50 border-t border-light-border/40 dark:border-dark-border/40">
                        <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
                            {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} من {total.toLocaleString('ar')}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-light-border dark:border-dark-border disabled:opacity-40 hover:bg-light-card dark:hover:bg-dark-card transition-colors text-light-text dark:text-dark-text"
                            >
                                <i className="fas fa-chevron-right" />
                            </button>
                            <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary px-2">{page} / {totalPages}</span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-light-border dark:border-dark-border disabled:opacity-40 hover:bg-light-card dark:hover:bg-dark-card transition-colors text-light-text dark:text-dark-text"
                            >
                                <i className="fas fa-chevron-left" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            </PageSection>

            {isCreateOpen && (
                <CreateTicketModal
                    brandId={brandId}
                    onClose={() => setIsCreateOpen(false)}
                    onCreated={() => { setIsCreateOpen(false); void load(); }}
                />
            )}
        </PageScaffold>
    );
};
