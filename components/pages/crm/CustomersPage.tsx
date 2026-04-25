import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageScaffold, PageSection } from '../../shared/PageScaffold';
import { AddCustomerModal } from './AddCustomerModal';
import { CustomerProfilePage } from './CustomerProfilePage';
import {
    CrmCustomer,
    CrmLifecycleStage,
    CrmCustomerFilters,
    CrmCustomerTag,
    CrmStoreProvider,
} from '../../../types';
import {
    getCustomers,
    getTags,
    bulkUpdateLifecycle,
    bulkAddTag,
    LIFECYCLE_STAGE_CONFIG,
} from '../../../services/crmService';
import { useWindowedRows } from '../../../hooks/useWindowedRows';

// ── Sub-components ─────────────────────────────────────────────────────────────

const LifecycleBadge: React.FC<{ stage: CrmLifecycleStage }> = ({ stage }) => {
    const cfg = LIFECYCLE_STAGE_CONFIG[stage];
    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border shadow-sm ${cfg.bg} ${cfg.color} border-current/20`}>
            {cfg.labelAr}
        </span>
    );
};

const SourceBadge: React.FC<{ source?: string; channel?: string }> = ({ source, channel }) => {
    if (!source) return <span className="text-gray-400 text-xs">—</span>;
    const icons: Record<string, string> = {
        facebook: 'fab fa-facebook', instagram: 'fab fa-instagram',
        google: 'fab fa-google', tiktok: 'fab fa-tiktok',
        woocommerce: 'fas fa-shopping-cart', shopify: 'fas fa-store',
        organic: 'fas fa-leaf', paid: 'fas fa-ad', email: 'fas fa-envelope',
    };
    const key = (channel ?? source).toLowerCase();
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
            <i className={`${icons[key] ?? 'fas fa-globe'} opacity-60 text-sm`} />
            {channel ?? source}
        </span>
    );
};

interface BulkActionsBarProps {
    selected: string[];
    tags: CrmCustomerTag[];
    onBulkLifecycle: (stage: CrmLifecycleStage) => void;
    onBulkTag: (tagId: string) => void;
    onClear: () => void;
}
const BulkActionsBar: React.FC<BulkActionsBarProps> = ({ selected, tags, onBulkLifecycle, onBulkTag, onClear }) => (
    <div className="surface-panel-soft flex items-center gap-3 rounded-[1.5rem] !border-0 px-6 py-4 mb-4 shadow-sm">
        <span className="text-sm font-black text-brand-primary whitespace-nowrap">{selected.length} محدد</span>
        <div className="h-6 w-px bg-light-border dark:bg-dark-border" />
        <select
            className="text-sm rounded-xl border border-light-border dark:border-dark-border px-3 py-2 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text outline-none focus:ring-2 focus:ring-brand-primary"
            onChange={e => e.target.value && onBulkLifecycle(e.target.value as CrmLifecycleStage)}
            defaultValue=""
        >
            <option value="" disabled>تغيير المرحلة</option>
            {Object.values(CrmLifecycleStage).map(s => (
                <option key={s} value={s}>{LIFECYCLE_STAGE_CONFIG[s].labelAr}</option>
            ))}
        </select>
        {tags.length > 0 && (
            <select
                className="text-sm rounded-xl border border-light-border dark:border-dark-border px-3 py-2 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text outline-none focus:ring-2 focus:ring-brand-primary"
                onChange={e => e.target.value && onBulkTag(e.target.value)}
                defaultValue=""
            >
                <option value="" disabled>إضافة تاج</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
        )}
        <button onClick={onClear} className="btn ms-auto text-xs font-bold text-red-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
            <i className="fas fa-times me-2" />إلغاء التحديد
        </button>
    </div>
);

interface FiltersDrawerProps {
    filters: CrmCustomerFilters;
    onChange: (f: Partial<CrmCustomerFilters>) => void;
    onClose: () => void;
}
const FiltersDrawer: React.FC<FiltersDrawerProps> = ({ filters, onChange, onClose }) => (
    <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-80 surface-panel h-full shadow-2xl overflow-y-auto p-6 space-y-6 !rounded-none">
            <div className="flex items-center justify-between mb-4 border-b border-light-border/40 pb-4 dark:border-dark-border/40">
                <h3 className="font-black text-light-text dark:text-dark-text text-lg">تصفية العملاء</h3>
                <button onClick={onClose} className="text-light-text-secondary hover:text-brand-primary transition-colors">
                    <i className="fas fa-times text-xl" />
                </button>
            </div>

            {/* Lifecycle */}
            <div>
                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">مرحلة العميل</label>
                <div className="flex flex-wrap gap-2">
                    {Object.values(CrmLifecycleStage).map(s => {
                        const active = filters.lifecycleStage?.includes(s);
                        return (
                            <button
                                key={s}
                                onClick={() => {
                                    const cur = filters.lifecycleStage ?? [];
                                    onChange({ lifecycleStage: active ? cur.filter(x => x !== s) : [...cur, s] });
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                    active
                                        ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                                        : 'bg-light-bg text-light-text-secondary border-light-border dark:bg-dark-bg dark:text-dark-text-secondary dark:border-dark-border hover:border-brand-primary'
                                }`}
                            >
                                {LIFECYCLE_STAGE_CONFIG[s].labelAr}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Orders range */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">طلبات (من)</label>
                    <input type="number" min={0} value={filters.minOrders ?? ''} placeholder="0"
                        onChange={e => onChange({ minOrders: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">طلبات (إلى)</label>
                    <input type="number" min={0} value={filters.maxOrders ?? ''} placeholder="∞"
                        onChange={e => onChange({ maxOrders: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-sm text-light-text dark:text-dark-text outline-none focus:border-brand-primary"
                    />
                </div>
            </div>

            {/* Source */}
            <div>
                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-3">مصدر الاكتساب</label>
                <div className="space-y-2">
                    {['organic', 'paid', 'email', 'social', 'referral', 'woocommerce', 'shopify'].map(src => {
                        const active = filters.acquisitionSource?.includes(src);
                        return (
                            <label key={src} className="flex items-center gap-3 py-1 cursor-pointer group">
                                <input type="checkbox" checked={active ?? false}
                                    onChange={() => {
                                        const cur = filters.acquisitionSource ?? [];
                                        onChange({ acquisitionSource: active ? cur.filter(x => x !== src) : [...cur, src] });
                                    }}
                                    className="w-4 h-4 rounded border-light-border dark:border-dark-border text-brand-primary focus:ring-brand-primary bg-light-bg dark:bg-dark-bg"
                                />
                                <span className="text-sm font-medium text-light-text dark:text-dark-text group-hover:text-brand-primary transition-colors">{src}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="pt-4 border-t border-light-border/40 dark:border-dark-border/40">
                <button
                    onClick={() => onChange({
                        lifecycleStage: undefined, minOrders: undefined, maxOrders: undefined,
                        minSpent: undefined, maxSpent: undefined, acquisitionSource: undefined,
                        hasRefunds: undefined,
                    })}
                    className="w-full btn rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all text-sm py-2.5"
                >
                    مسح كل الفلاتر
                </button>
            </div>
        </div>
    </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────

interface CustomersPageProps {
    brandId: string;
    onViewCustomer: (customerId: string) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ brandId, onViewCustomer }) => {
    const [customers, setCustomers] = useState<CrmCustomer[]>([]);
    const [total, setTotal]         = useState(0);
    const [tags, setTags]           = useState<CrmCustomerTag[]>([]);
    const [loading, setLoading]     = useState(true);
    const [selected, setSelected]   = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters]     = useState<CrmCustomerFilters>({ page: 1, pageSize: 50 });
    const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
    const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);
    const searchRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);
    const {
        containerRef,
        onScroll,
        visibleRows,
        topSpacerHeight,
        bottomSpacerHeight,
        isWindowed,
    } = useWindowedRows(customers, { rowHeight: 68, enabled: !loading && customers.length > 30 });

    const load = useCallback(async () => {
        setLoading(true);
        const [res, tagList] = await Promise.all([
            getCustomers(brandId, filters),
            getTags(brandId),
        ]);
        setCustomers(res.data);
        setTotal(res.total);
        setTags(tagList);
        setLoading(false);
    }, [brandId, filters]);

    useEffect(() => { void load(); }, [load]);

    const handleSearch = (val: string) => {
        if (searchRef.current) clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => {
            setFilters(f => ({ ...f, search: val || undefined, page: 1 }));
        }, 300);
    };

    const updateFilters = (partial: Partial<CrmCustomerFilters>) => {
        setFilters(f => ({ ...f, ...partial, page: 1 }));
    };

    const toggleSelect = (id: string) => {
        setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
    };
    const toggleAll = () => {
        setSelected(sel => sel.length === customers.length ? [] : customers.map(c => c.id));
    };

    const handleBulkLifecycle = async (stage: CrmLifecycleStage) => {
        await bulkUpdateLifecycle(brandId, selected, stage);
        setSelected([]);
        void load();
    };

    const handleBulkTag = async (tagId: string) => {
        await bulkAddTag(brandId, selected, tagId);
        setSelected([]);
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

    const pageSize = filters.pageSize ?? 50;
    const totalPages = Math.ceil(total / pageSize);
    const page = filters.page ?? 1;

    const activeFiltersCount = [
        filters.lifecycleStage?.length,
        filters.minOrders, filters.maxOrders,
        filters.minSpent, filters.maxSpent,
        filters.acquisitionSource?.length,
        filters.hasRefunds,
    ].filter(Boolean).length;

    return (
        <PageScaffold
            kicker="Sales CRM"
            title="قاعدة العملاء"
            description="إدارة العملاء، التصنيفات، والمراحل البيعية."
            stats={[
                { label: 'إجمالي العملاء', value: total.toLocaleString('ar'), icon: 'fa-users' }
            ]}
            actions={
                <div className="flex items-center gap-3">
                    <button className="btn rounded-xl bg-light-card border border-light-border dark:bg-dark-card dark:border-dark-border px-4 py-2.5 text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:shadow-sm transition-all shadow-inner">
                        <i className="fas fa-file-export me-2" />
                        تصدير
                    </button>
                    <button onClick={() => setIsAddCustomerOpen(true)} className="btn rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-primary/20 transition-all hover:-translate-y-0.5 active:scale-95">
                        <i className="fas fa-plus me-2" />
                        عميل جديد
                    </button>
                </div>
            }
        >
            <PageSection className="space-y-4">

            {/* Search + Filters bar */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 min-w-[280px]">
                    <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-light-text-secondary/60 dark:text-dark-text-secondary/60" />
                    <input
                        type="text"
                        placeholder="بحث بالاسم، الإيميل، أو رقم الجوال..."
                        className="w-full pl-4 pr-11 py-3 bg-light-bg/50 border border-light-border dark:bg-dark-bg/50 dark:border-dark-border rounded-xl text-sm text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:bg-light-card dark:focus:bg-dark-card transition-all"
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(true)}
                        className={`relative btn px-5 py-3 border rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                            activeFiltersCount > 0
                                ? 'bg-brand-primary border-brand-primary text-white shadow-sm'
                                : 'bg-light-card border-light-border text-light-text-secondary hover:text-light-text dark:bg-dark-card dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text'
                        }`}
                    >
                        <i className="fas fa-filter text-xs" />
                        تصفية
                        {activeFiltersCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-light-card dark:border-dark-card">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                    <div className="relative">
                        <select
                            value={pageSize}
                            onChange={e => setFilters(f => ({ ...f, pageSize: Number(e.target.value), page: 1 }))}
                            className="appearance-none rounded-xl border border-light-border bg-light-card px-5 py-3 text-sm font-bold text-light-text-secondary dark:border-dark-border dark:bg-dark-card dark:text-dark-text-secondary outline-none focus:ring-2 pr-10"
                        >
                            {[25, 50, 100].map(size => (
                                <option key={size} value={size}>
                                    {size} بالصفحة
                                </option>
                            ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Bulk actions */}
            {selected.length > 0 && (
                <BulkActionsBar
                    selected={selected}
                    tags={tags}
                    onBulkLifecycle={handleBulkLifecycle}
                    onBulkTag={handleBulkTag}
                    onClear={() => setSelected([])}
                />
            )}

            {/* Interactive Grid Table */}
            <div className="surface-panel rounded-[2rem] !border-0 shadow-[var(--shadow-ambient)] overflow-hidden">
                <div ref={containerRef} onScroll={onScroll} className="max-h-[720px] overflow-auto custom-scrollbar">
                    <table className="w-full text-sm text-right">
                        <thead className="sticky top-0 z-10 bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-xl border-b border-light-border/40 dark:border-dark-border/40">
                            <tr>
                                <th className="w-12 px-4 py-4 text-center">
                                    <input type="checkbox"
                                        checked={selected.length === customers.length && customers.length > 0}
                                        onChange={toggleAll}
                                        className="w-4 h-4 rounded border-light-border text-brand-primary bg-light-bg dark:bg-dark-bg focus:ring-brand-primary"
                                    />
                                </th>
                                <th className="px-5 py-4 font-bold text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">العميل</th>
                                <th className="px-4 py-4 font-bold text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">المرحلة</th>
                                <th className="px-4 py-4 font-bold text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">المنشأ</th>
                                <th className="px-4 py-4 font-bold text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">الطلبات</th>
                                <th className="px-4 py-4 font-bold text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">إجمالي القيمة</th>
                                <th className="px-4 py-4 font-bold text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">آخر طلب</th>
                                <th className="px-4 py-4 w-24" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-light-border/20 dark:divide-dark-border/20">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-4"><div className="h-4 w-4 bg-light-border dark:bg-dark-border rounded mx-auto" /></td>
                                        <td className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-light-border dark:bg-dark-border rounded-full" /><div className="h-4 bg-light-border dark:bg-dark-border rounded w-32" /></div></td>
                                        <td className="p-4"><div className="h-6 bg-light-border dark:bg-dark-border rounded-full w-20" /></td>
                                        <td className="p-4"><div className="h-4 bg-light-border dark:bg-dark-border rounded w-16" /></td>
                                        <td className="p-4"><div className="h-4 bg-light-border dark:bg-dark-border rounded w-8" /></td>
                                        <td className="p-4"><div className="h-4 bg-light-border dark:bg-dark-border rounded w-20" /></td>
                                        <td className="p-4"><div className="h-4 bg-light-border dark:bg-dark-border rounded w-24" /></td>
                                        <td className="p-4" />
                                    </tr>
                                ))
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-24 text-center">
                                        <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary shadow-inner mb-4">
                                            <i className="fas fa-users text-2xl" />
                                        </div>
                                        <p className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary">لا يوجد عملاء يطابقون البحث</p>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {isWindowed && topSpacerHeight > 0 && (
                                        <tr aria-hidden="true"><td colSpan={8} className="p-0" style={{ height: `${topSpacerHeight}px` }} /></tr>
                                    )}
                                {(isWindowed ? visibleRows : customers).map(customer => {
                                    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || 'عميل مجهول';
                                    const initials = fullName.slice(0, 2).toUpperCase();
                                    return (
                                        <tr key={customer.id}
                                            className={`group relative transition-all cursor-pointer ${selected.includes(customer.id) ? 'bg-brand-primary/5' : 'hover:bg-light-bg/50 dark:hover:bg-dark-bg/50'}`}
                                            onClick={() => setViewingCustomerId(customer.id)}
                                        >
                                            <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                                                <input type="checkbox"
                                                    checked={selected.includes(customer.id)}
                                                    onChange={() => toggleSelect(customer.id)}
                                                    className="w-4 h-4 rounded border-light-border text-brand-primary bg-light-bg dark:bg-dark-bg focus:ring-brand-primary"
                                                />
                                            </td>
                                            <td className="px-5 py-4 min-w-[200px]">
                                                <div className="flex items-center gap-3">
                                                    {customer.avatarUrl ? (
                                                        <img src={customer.avatarUrl} alt={fullName} className="w-10 h-10 shadow-sm rounded-[1rem] object-cover bg-light-bg" />
                                                    ) : (
                                                        <div className="w-10 h-10 shadow-inner rounded-[1rem] bg-light-bg dark:bg-dark-bg flex items-center justify-center text-sm font-black text-light-text-secondary dark:text-dark-text-secondary">
                                                            {initials}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col">
                                                        <p className="font-bold text-light-text dark:text-dark-text text-sm hover:text-brand-primary transition-colors">{fullName}</p>
                                                        <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{customer.email ?? customer.phone ?? '—'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <LifecycleBadge stage={customer.lifecycleStage} />
                                            </td>
                                            <td className="px-4 py-4">
                                                <SourceBadge source={customer.acquisitionSource} channel={customer.acquisitionChannel} />
                                            </td>
                                            <td className="px-4 py-4 font-black text-light-text dark:text-dark-text">{customer.totalOrders} <span className="text-[10px] text-light-text-secondary font-medium">طلب</span></td>
                                            <td className="px-4 py-4 font-black text-brand-primary">{formatCurrency(customer.totalSpent)}</td>
                                            <td className="px-4 py-4 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                                {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td className="px-4 py-4 text-left" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-light-bg hover:text-green-500 dark:hover:bg-dark-bg text-light-text-secondary transition-colors" title="واتساب">
                                                        <i className="fab fa-whatsapp" />
                                                    </button>
                                                    <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-light-bg hover:text-brand-primary dark:hover:bg-dark-bg text-light-text-secondary transition-colors" title="إيميل">
                                                        <i className="far fa-envelope" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                    {isWindowed && bottomSpacerHeight > 0 && (
                                        <tr aria-hidden="true"><td colSpan={8} className="p-0" style={{ height: `${bottomSpacerHeight}px` }} /></tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-light-bg/50 dark:bg-dark-bg/50 border-t border-light-border/40 dark:border-dark-border/40">
                        <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
                            {((page - 1) * (filters.pageSize ?? 25)) + 1}–{Math.min(page * (filters.pageSize ?? 25), total)} من {total.toLocaleString('ar')}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-light-border dark:border-dark-border disabled:opacity-40 hover:bg-light-card dark:hover:bg-dark-card transition-colors text-light-text dark:text-dark-text"
                            >
                                <i className="fas fa-chevron-right" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                                return (
                                    <button key={p}
                                        onClick={() => setFilters(f => ({ ...f, page: p }))}
                                        className={`w-8 h-8 text-xs font-black rounded-lg border transition-all ${p === page ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'border-light-border dark:border-dark-border text-light-text-secondary hover:bg-light-card dark:hover:bg-dark-card dark:text-dark-text-secondary'}`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
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

            {/* Filters drawer */}
            {showFilters && (
                <FiltersDrawer
                    filters={filters}
                    onChange={updateFilters}
                    onClose={() => setShowFilters(false)}
                />
            )}

            {isAddCustomerOpen && (
                <AddCustomerModal 
                    brandId={brandId} 
                    onClose={() => setIsAddCustomerOpen(false)} 
                    onCustomerAdded={() => { load(); }} 
                />
            )}

            {viewingCustomerId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setViewingCustomerId(null)} />
                    <div className="relative w-full max-w-4xl h-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border shadow-2xl rounded-[2rem] overflow-hidden flex flex-col animate-slide-up">
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative">
                            <button onClick={() => setViewingCustomerId(null)} className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors z-10 shadow-sm">
                                <i className="fas fa-times" />
                            </button>
                            <CustomerProfilePage brandId={brandId} customerId={viewingCustomerId} onBack={() => setViewingCustomerId(null)} />
                        </div>
                    </div>
                </div>
            )}
        </PageScaffold>
    );
};
