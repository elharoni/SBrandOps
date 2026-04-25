import React, { useState, useEffect, useCallback } from 'react';
import { CrmDashboardStats, CrmLifecycleStage } from '../../../types';
import { getCrmDashboardStats, LIFECYCLE_STAGE_CONFIG } from '../../../services/crmService';
import { PageScaffold, PageSection } from '../../shared/PageScaffold';

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    icon: string; label: string; value: string | number;
    sub?: string; color: string; bg: string; trend?: number;
}> = ({ icon, label, value, sub, color, bg, trend }) => (
    <div className={`surface-panel-soft rounded-[1.5rem] !border-0 p-5 transition-transform hover:-translate-y-1 shadow-sm relative overflow-hidden group ${bg.replace('bg-', 'hover:bg-').replace('-50', '-500/5')}`}>
        <div className="flex items-start justify-between mb-3 relative z-10">
            <div className={`w-10 h-10 rounded-[1rem] ${bg} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                <i className={`fas ${icon} ${color} text-lg`} />
            </div>
            {trend !== undefined && (
                <span className={`flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-md ${trend >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    <i className={`fas ${trend >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`}></i>
                    {Math.abs(trend)}%
                </span>
            )}
        </div>
        <div className="relative z-10">
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">{label}</h3>
            <p className={`text-2xl font-black text-light-text dark:text-dark-text tracking-tight`}>{value}</p>
            {sub && <p className="text-[10px] text-light-text-secondary/70 mt-1 dark:text-dark-text-secondary/70">{sub}</p>}
        </div>
        {/* Ambient background glow icon */}
        <i className={`fas ${icon} absolute -bottom-4 -left-4 text-[5rem] opacity-[0.03] rotate-12 transition-transform group-hover:rotate-0`} />
    </div>
);

// ── Lifecycle Donut Chart (CSS-based) ─────────────────────────────────────────

const LifecycleChart: React.FC<{ breakdown: CrmDashboardStats['lifecycleBreakdown'] }> = ({ breakdown }) => {
    const total = breakdown.reduce((s, x) => s + x.count, 0);

    // Simple horizontal bar chart
    return (
        <div className="space-y-2">
            {breakdown
                .sort((a, b) => b.count - a.count)
                .map(item => {
                    const cfg = LIFECYCLE_STAGE_CONFIG[item.stage];
                    return (
                        <div key={item.stage}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                                <span className={`font-medium ${cfg.color}`}>{cfg.labelAr}</span>
                                <span className="text-gray-500">{item.count} ({item.percent}%)</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${cfg.bg.replace('bg-', 'bg-').replace('-50', '-300').replace('-100', '-400')}`}
                                    style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface CrmDashboardPageProps {
    brandId: string;
    onNavigate: (page: string) => void;
}

export const CrmDashboardPage: React.FC<CrmDashboardPageProps> = ({ brandId, onNavigate }) => {
    const [stats, setStats]     = useState<CrmDashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const s = await getCrmDashboardStats(brandId);
        setStats(s);
        setLoading(false);
    }, [brandId]);

    useEffect(() => { void load(); }, [load]);

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

    const formatNum = (n: number) =>
        n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000     ? `${(n / 1_000).toFixed(1)}K`
      : n.toString();

    if (loading || !stats) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-7 w-40 bg-gray-200 rounded" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-28 bg-gray-200 rounded-xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-64 bg-gray-200 rounded-xl" />
                    <div className="h-64 bg-gray-200 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <PageScaffold
            kicker="Sales CRM"
            title="لوحة القيادة والمؤشرات"
            description="نظرة مركزية على أداء المبيعات، ومعدلات الاحتفاظ، والفرص البيعية الذكية."
            stats={[
                { label: 'إجمالي العملاء', value: stats.totalCustomers.toLocaleString('ar'), icon: 'fa-users' },
                { label: 'متوسط LTV', value: formatCurrency(stats.avgLtv), tone: 'text-green-500', icon: 'fa-sack-dollar' },
            ]}
            actions={
                <button onClick={() => void load()} className="btn rounded-xl bg-light-card border border-light-border dark:bg-dark-card dark:border-dark-border px-4 py-2 font-bold text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary active:scale-95 transition-all shadow-inner">
                    <i className="fas fa-sync-alt me-1.5" /> تحديث البيانات
                </button>
            }
        >
            <PageSection className="space-y-6">

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon="fa-users"      label="إجمالي العملاء"    value={stats.totalCustomers.toLocaleString('ar')}  color="text-blue-700"   bg="bg-blue-50"   />
                <KpiCard icon="fa-user-plus"  label="جدد هذا الشهر"    value={stats.newThisMonth}                         color="text-emerald-700" bg="bg-emerald-50" trend={12} />
                <KpiCard icon="fa-redo"       label="معدل التكرار"     value={`${stats.repeatPurchaseRate}%`}             color="text-indigo-700"  bg="bg-indigo-50"  />
                <KpiCard icon="fa-star"       label="متوسط LTV"        value={formatCurrency(stats.avgLtv)}               color="text-amber-700"   bg="bg-amber-50"   />
                <KpiCard icon="fa-money-bill" label="إجمالي الإيراد"   value={formatCurrency(stats.totalRevenue)}         color="text-green-700"   bg="bg-green-50"   />
                <KpiCard icon="fa-shopping-cart" label="متوسط الطلب"  value={formatCurrency(stats.aov)}                  color="text-cyan-700"    bg="bg-cyan-50"    />
                <KpiCard icon="fa-exclamation-triangle" label="في خطر الانسحاب" value={stats.churnRiskCount} color="text-orange-700" bg="bg-orange-50" />
                <KpiCard icon="fa-undo"       label="معدل المرتجعات"   value={`${stats.refundRate}%`}                     color="text-red-700"     bg="bg-red-50"     />
            </div>

            {/* New vs Returning */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="surface-panel rounded-[2rem] p-6 !border-0 shadow-[var(--shadow-ambient)]">
                    <h3 className="text-sm font-bold text-light-text/80 dark:text-dark-text/80 mb-6 flex items-center gap-2">
                        <i className="fas fa-users-rays opacity-50" />
                        الولاء والعملاء العائدون
                    </h3>
                    <div className="flex items-center gap-6">
                        <div className="flex-1">
                            <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-blue-500 font-bold">مكتسب حديثاً</span>
                                <span className="font-mono font-bold text-light-text dark:text-dark-text">{stats.newVsReturning.new}</span>
                            </div>
                            <div className="h-2 bg-light-bg dark:bg-dark-bg rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.totalCustomers > 0 ? (stats.newVsReturning.new / stats.totalCustomers) * 100 : 0}%` }} />
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-emerald-500 font-bold">بنى ولاء (عائد)</span>
                                <span className="font-mono font-bold text-light-text dark:text-dark-text">{stats.newVsReturning.returning}</span>
                            </div>
                            <div className="h-2 bg-light-bg dark:bg-dark-bg rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.totalCustomers > 0 ? (stats.newVsReturning.returning / stats.totalCustomers) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="surface-panel rounded-[2rem] p-6 !border-0 shadow-[var(--shadow-ambient)]">
                    <h3 className="text-sm font-bold text-light-text/80 dark:text-dark-text/80 mb-4 flex items-center gap-2">
                        <i className="fas fa-chart-pie opacity-50" />
                        توزيع مراحل المبيعات
                    </h3>
                    <LifecycleChart breakdown={stats.lifecycleBreakdown} />
                </div>
            </div>

            {/* Top Customers */}
            <div className="surface-panel rounded-[2rem] p-6 !border-0 shadow-[var(--shadow-ambient)]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                        <i className="fas fa-crown text-yellow-500" />
                        عملاء الـ VIP
                    </h3>
                    <button onClick={() => onNavigate('crm/customers')} className="btn text-xs font-bold text-brand-primary hover:text-brand-secondary">
                        مراجعة الكل <i className="fas fa-arrow-left ms-1 text-[10px]" />
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.topCustomers.map((customer, i) => {
                        const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || 'عميل';
                        const stageCfg = LIFECYCLE_STAGE_CONFIG[customer.lifecycleStage];
                        return (
                            <div key={customer.id} className="surface-panel-soft flex items-center gap-4 p-4 rounded-[1.5rem] !border-0 transition-all hover:bg-light-bg/50 dark:hover:bg-dark-bg/50 cursor-pointer">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-[1rem] bg-brand-primary/10 text-brand-primary flex items-center justify-center text-sm font-black shadow-inner">
                                        {fullName.slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary shadow-sm">
                                        {i + 1}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-light-text dark:text-dark-text truncate">{fullName}</p>
                                    <span className={`text-[10px] font-bold ${stageCfg.color}`}>{stageCfg.labelAr}</span>
                                </div>
                                <div className="text-left flex-shrink-0">
                                    <p className="text-sm font-black text-brand-secondary">{formatCurrency(customer.totalSpent)}</p>
                                    <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary">{customer.totalOrders} طلبيات</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Insights List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="surface-panel-soft relative overflow-hidden bg-red-500/5 !border-0 rounded-[1.5rem] p-6 shadow-sm group">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center shadow-inner">
                            <i className="fas fa-heart-crack text-sm" />
                        </div>
                        <h3 className="text-sm font-black text-red-500">مخاطر فقدان ولاء (Churn Risk)</h3>
                        <span className="bg-red-500 text-white shadow-md text-xs font-black px-2 py-0.5 rounded-full ms-auto">{stats.churnRiskCount}</span>
                    </div>
                    <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mb-4">
                        الذكاء الاصطناعي يتوقع أن هؤلاء العملاء على وشك التوقف عن الشراء. نوصي بتفعيل حملة استعادة سريعة.
                    </p>
                    <button onClick={() => onNavigate('crm/customers')} className="btn w-full rounded-xl bg-red-500/10 text-red-500 font-bold py-2.5 text-xs hover:bg-red-500 hover:text-white transition-all">
                        تصفية وعرض القائمة
                    </button>
                    <i className="fas fa-biohazard absolute -bottom-8 -left-6 text-[8rem] text-red-500/5 -rotate-12 transition-transform group-hover:rotate-0" />
                </div>
                <div className="surface-panel-soft relative overflow-hidden bg-green-500/5 !border-0 rounded-[1.5rem] p-6 shadow-sm group">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center shadow-inner">
                            <i className="fas fa-seedling text-sm" />
                        </div>
                        <h3 className="text-sm font-black text-green-500">فرص تصعيد مبيعات (Upsell)</h3>
                        <span className="bg-green-500 text-white shadow-md text-xs font-black px-2 py-0.5 rounded-full ms-auto">{stats.newThisMonth}</span>
                    </div>
                    <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mb-4">
                        هؤلاء العملاء أظهروا سلوك شراء متكرر حديثاً ويمكن استهدافهم بعروض الباقات المتقدمة.
                    </p>
                    <button onClick={() => onNavigate('crm/customers')} className="btn w-full rounded-xl bg-green-500/10 text-green-500 font-bold py-2.5 text-xs hover:bg-green-500 hover:text-white transition-all">
                        تصفية وعرض القائمة
                    </button>
                    <i className="fas fa-chart-line absolute -bottom-8 -left-6 text-[8rem] text-green-500/5 -rotate-12 transition-transform group-hover:rotate-0" />
                </div>
            </div>
        </PageSection>
    </PageScaffold>
    );
};
