/**
 * CRM Analytics Deep Dive Page
 * Tabs: RFM Distribution · Retention Cohorts · Revenue by Segment · Churn Trends · Cross-sell Opportunities
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    CrmRfmSegment,
    CrmRetentionCohort,
    CrmRevenueBySegment,
    CrmChurnTrend,
    CrmCrossSellOpportunity,
} from '../../../types';
import {
    getRfmDistribution,
    getRetentionCohorts,
    getRevenueBySegment,
    getChurnTrends,
    getCrossSellOpportunities,
    computeAndUpsertRfmScores,
    computeAndUpsertCohorts,
    RFM_SEGMENT_META,
} from '../../../services/crmAnalyticsService';

// ── Sub-tab types ─────────────────────────────────────────────────────────────

type AnalyticsTab = 'rfm' | 'cohorts' | 'revenue' | 'churn' | 'crosssell';

const ANALYTICS_TABS: { id: AnalyticsTab; label: string; icon: string }[] = [
    { id: 'rfm',      label: 'RFM',             icon: 'fa-bullseye' },
    { id: 'cohorts',  label: 'الاحتفاظ',        icon: 'fa-th' },
    { id: 'revenue',  label: 'الإيراد',          icon: 'fa-dollar-sign' },
    { id: 'churn',    label: 'الاضطراب',         icon: 'fa-user-minus' },
    { id: 'crosssell',label: 'فرص البيع',       icon: 'fa-crosshairs' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCur = (n: number) =>
    new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

// ── RFM Distribution ──────────────────────────────────────────────────────────

type RfmItem = { segment: CrmRfmSegment; count: number; label: string; labelAr: string; color: string; bg: string; description: string };

const RfmTab: React.FC<{ brandId: string }> = ({ brandId }) => {
    const [data, setData]       = useState<RfmItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const d = await getRfmDistribution(brandId);
        setData(d as RfmItem[]);
        setLoading(false);
    }, [brandId]);

    useEffect(() => { void load(); }, [load]);

    const total = data.reduce((s, d) => s + d.count, 0);

    const handleRecompute = async () => {
        setComputing(true);
        await computeAndUpsertRfmScores(brandId);
        await load();
        setComputing(false);
    };

    if (loading) return <div className="space-y-2">{Array.from({length:6}).map((_,i)=><div key={i} className="h-10 bg-gray-200 rounded animate-pulse"/>)}</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-800">توزيع RFM</h3>
                    <p className="text-xs text-gray-500">{total.toLocaleString('ar')} عميل مصنّف</p>
                </div>
                <button
                    onClick={handleRecompute}
                    disabled={computing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                >
                    {computing
                        ? <><i className="fas fa-circle-notch fa-spin" /> جاري الحساب...</>
                        : <><i className="fas fa-sync-alt" /> إعادة الحساب</>
                    }
                </button>
            </div>

            {/* Segment bars */}
            <div className="space-y-2">
                {data
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map(seg => {
                        const pct = total > 0 ? (seg.count / total) * 100 : 0;
                        return (
                            <div key={seg.segment} className="bg-white border border-gray-200 rounded-xl p-3">
                                <div className="flex items-center gap-3 mb-1.5">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${seg.bg} ${seg.color}`}>
                                        {seg.labelAr}
                                    </span>
                                    <span className="text-xs text-gray-500 flex-1 truncate">{seg.description}</span>
                                    <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                                        {seg.count.toLocaleString('ar')}
                                    </span>
                                    <span className="text-xs text-gray-400 w-10 text-left flex-shrink-0">
                                        {pct.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${seg.bg.replace('bg-', 'bg-').replace('-100', '-400')}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* RFM Scoring guide */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-600 mb-2">كيف يُحسب RFM؟</h4>
                <div className="grid grid-cols-3 gap-3 text-xs text-gray-600">
                    <div className="text-center">
                        <p className="font-semibold text-purple-700 text-sm">R</p>
                        <p>Recency</p>
                        <p className="text-gray-400">آخر طلب</p>
                    </div>
                    <div className="text-center">
                        <p className="font-semibold text-indigo-700 text-sm">F</p>
                        <p>Frequency</p>
                        <p className="text-gray-400">عدد الطلبات</p>
                    </div>
                    <div className="text-center">
                        <p className="font-semibold text-green-700 text-sm">M</p>
                        <p>Monetary</p>
                        <p className="text-gray-400">إجمالي الإنفاق</p>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">كل بُعد يُسجَّل 1–5 · المجموع 3–15</p>
            </div>
        </div>
    );
};

// ── Retention Cohorts ─────────────────────────────────────────────────────────

const CohortsTab: React.FC<{ brandId: string }> = ({ brandId }) => {
    const [cohorts, setCohorts] = useState<CrmRetentionCohort[]>([]);
    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setCohorts(await getRetentionCohorts(brandId));
        setLoading(false);
    }, [brandId]);

    useEffect(() => { void load(); }, [load]);

    const handleRecompute = async () => {
        setComputing(true);
        await computeAndUpsertCohorts(brandId);
        await load();
        setComputing(false);
    };

    // Build cohort matrix
    const cohortMonths = [...new Set(cohorts.map(c => c.cohortMonth))].sort().reverse().slice(0, 12);
    const maxPeriod    = Math.max(...cohorts.map(c => c.periodNumber), 0);

    const rateCell = (cohortMonth: string, period: number): number | null => {
        const entry = cohorts.find(c => c.cohortMonth === cohortMonth && c.periodNumber === period);
        return entry ? entry.retentionRate : null;
    };

    const heatColor = (rate: number | null): string => {
        if (rate === null) return 'bg-gray-50 text-gray-300';
        if (rate >= 80)   return 'bg-green-600 text-white';
        if (rate >= 60)   return 'bg-green-400 text-white';
        if (rate >= 40)   return 'bg-yellow-300 text-gray-800';
        if (rate >= 20)   return 'bg-orange-300 text-gray-800';
        return 'bg-red-300 text-gray-800';
    };

    if (loading) return <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-800">مصفوفة الاحتفاظ بالعملاء</h3>
                    <p className="text-xs text-gray-500">نسبة العملاء المتبقين بعد كل شهر منذ الاكتساب</p>
                </div>
                <button onClick={handleRecompute} disabled={computing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                    {computing ? <><i className="fas fa-circle-notch fa-spin" /> جاري...</> : <><i className="fas fa-sync-alt" /> تحديث</>}
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
                <table className="text-xs min-w-max">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-right font-medium text-gray-600 sticky right-0 bg-gray-50 z-10">كوهورت</th>
                            <th className="px-3 py-3 text-center font-medium text-gray-600">الحجم</th>
                            {Array.from({ length: Math.min(maxPeriod + 1, 12) }, (_, i) => (
                                <th key={i} className="px-3 py-3 text-center font-medium text-gray-600 min-w-12">
                                    {i === 0 ? 'م0' : `م${i}`}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {cohortMonths.map(month => {
                            const cohortSize = cohorts.find(c => c.cohortMonth === month && c.periodNumber === 0)?.cohortSize ?? 0;
                            return (
                                <tr key={month}>
                                    <td className="px-4 py-2.5 font-medium text-gray-700 sticky right-0 bg-white">{month}</td>
                                    <td className="px-3 py-2.5 text-center text-gray-500">{cohortSize.toLocaleString('ar')}</td>
                                    {Array.from({ length: Math.min(maxPeriod + 1, 12) }, (_, i) => {
                                        const rate = rateCell(month, i);
                                        return (
                                            <td key={i} className={`px-3 py-2.5 text-center font-medium rounded-sm ${heatColor(rate)}`}>
                                                {rate !== null ? `${rate.toFixed(0)}%` : '—'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {cohortMonths.length === 0 && (
                            <tr><td colSpan={15} className="py-8 text-center text-gray-400">لا توجد بيانات كوهورت</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>درجة الاحتفاظ:</span>
                {[
                    { cls: 'bg-green-600', label: '80%+' },
                    { cls: 'bg-green-400', label: '60–80%' },
                    { cls: 'bg-yellow-300', label: '40–60%' },
                    { cls: 'bg-orange-300', label: '20–40%' },
                    { cls: 'bg-red-300', label: '<20%' },
                ].map(l => (
                    <span key={l.label} className="flex items-center gap-1">
                        <span className={`w-3 h-3 rounded-sm ${l.cls}`} />
                        {l.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

// ── Revenue by Segment ────────────────────────────────────────────────────────

const RevenueTab: React.FC<{ brandId: string }> = ({ brandId }) => {
    const [data, setData]       = useState<CrmRevenueBySegment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void getRevenueBySegment(brandId).then(d => { setData(d); setLoading(false); });
    }, [brandId]);

    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);

    if (loading) return <div className="space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse"/>)}</div>;

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold text-gray-800">الإيراد حسب مرحلة دورة الحياة</h3>
                <p className="text-xs text-gray-500">إجمالي LTV لكل شريحة</p>
            </div>

            {/* KPI bar */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">إجمالي LTV</p>
                <p className="text-2xl font-bold text-gray-900">{formatCur(totalRevenue)}</p>
                <div className="mt-3 flex h-4 rounded-full overflow-hidden gap-px">
                    {data.map((seg, i) => (
                        <div
                            key={i}
                            style={{ width: `${seg.percentageOfTotal}%` }}
                            className={SEG_COLORS[i % SEG_COLORS.length]}
                            title={`${seg.segment}: ${seg.percentageOfTotal.toFixed(1)}%`}
                        />
                    ))}
                </div>
            </div>

            {/* Breakdown rows */}
            <div className="space-y-2">
                {data.map((seg, i) => (
                    <div key={seg.segment} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${SEG_COLORS[i % SEG_COLORS.length]}`} />
                            <span className="text-sm font-semibold text-gray-800 capitalize flex-1">{seg.segment}</span>
                            <span className="text-xs text-gray-400">{seg.customerCount} عميل</span>
                            <span className="text-xs text-gray-400">متوسط LTV: {formatCur(seg.avgLtv)}</span>
                            <span className="font-bold text-gray-900">{formatCur(seg.revenue)}</span>
                            <span className="text-xs text-gray-400 w-12 text-left">{seg.percentageOfTotal.toFixed(1)}%</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${SEG_COLORS[i % SEG_COLORS.length]}`} style={{ width: `${seg.percentageOfTotal}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SEG_COLORS = ['bg-purple-500', 'bg-indigo-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-red-400', 'bg-gray-400'];

// ── Churn Trends ──────────────────────────────────────────────────────────────

const ChurnTab: React.FC<{ brandId: string }> = ({ brandId }) => {
    const [data, setData]       = useState<CrmChurnTrend[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void getChurnTrends(brandId).then(d => { setData(d); setLoading(false); });
    }, [brandId]);

    const maxChurn = Math.max(...data.map(d => d.churnedCount), 1);
    const avgChurnRate = data.length ? data.reduce((s, d) => s + d.churnRate, 0) / data.length : 0;

    if (loading) return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-800">اتجاه الاضطراب الشهري</h3>
                    <p className="text-xs text-gray-500">عدد العملاء الذين غادروا كل شهر</p>
                </div>
                <div className="text-left">
                    <p className="text-xs text-gray-400">متوسط معدل الاضطراب</p>
                    <p className="text-xl font-bold text-red-600">{avgChurnRate.toFixed(2)}%</p>
                </div>
            </div>

            {/* Bar chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-end gap-2 h-40">
                    {data.map(item => {
                        const height = maxChurn > 0 ? (item.churnedCount / maxChurn) * 100 : 0;
                        return (
                            <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs text-gray-500">{item.churnedCount}</span>
                                <div
                                    className="w-full bg-red-400 rounded-t transition-all duration-500 hover:bg-red-500"
                                    style={{ height: `${height}%`, minHeight: item.churnedCount > 0 ? 4 : 0 }}
                                    title={`${item.month}: ${item.churnedCount} (${item.churnRate}%)`}
                                />
                                <span className="text-xs text-gray-400 text-center" style={{ fontSize: '10px' }}>
                                    {item.month.slice(5)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">الشهر</th>
                            <th className="px-4 py-2.5 text-center font-medium text-gray-500 text-xs">عملاء في البداية</th>
                            <th className="px-4 py-2.5 text-center font-medium text-gray-500 text-xs">الاضطراب</th>
                            <th className="px-4 py-2.5 text-center font-medium text-gray-500 text-xs">المعدل</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.slice().reverse().slice(0, 6).map(item => (
                            <tr key={item.month} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-700">{item.month}</td>
                                <td className="px-4 py-2 text-center text-gray-500">{item.totalAtStart.toLocaleString('ar')}</td>
                                <td className="px-4 py-2 text-center text-red-600 font-medium">{item.churnedCount}</td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`text-xs font-semibold ${item.churnRate > 5 ? 'text-red-600' : item.churnRate > 2 ? 'text-orange-500' : 'text-green-600'}`}>
                                        {item.churnRate.toFixed(2)}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ── Cross-sell Opportunities ──────────────────────────────────────────────────

const CrossSellTab: React.FC<{ brandId: string }> = ({ brandId }) => {
    const [data, setData]       = useState<CrmCrossSellOpportunity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void getCrossSellOpportunities(brandId).then(d => { setData(d); setLoading(false); });
    }, [brandId]);

    const totalPotential = data.reduce((s, d) => s + d.potentialValue, 0);

    if (loading) return <div className="space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse"/>)}</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-800">فرص البيع المتقاطع / الترقية</h3>
                    <p className="text-xs text-gray-500">عملاء 1–3 طلبات · LTV عالي · غير churned</p>
                </div>
                <div className="text-left">
                    <p className="text-xs text-gray-400">القيمة المحتملة</p>
                    <p className="text-xl font-bold text-indigo-700">{formatCur(totalPotential)}</p>
                </div>
            </div>

            <div className="space-y-2">
                {data.length === 0
                    ? <p className="text-center text-gray-400 py-8">لا توجد فرص متاحة حالياً</p>
                    : data.map(opp => (
                        <div key={opp.customerId} className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                    {opp.customerName.slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm text-gray-900">{opp.customerName}</span>
                                        <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded-full">{opp.currentSegment}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {opp.recommendedProducts.map((p, i) => (
                                            <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                    {opp.lastOrderDate && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            <i className="fas fa-calendar-alt mr-1" />
                                            آخر طلب: {new Date(opp.lastOrderDate).toLocaleDateString('ar-SA')}
                                        </p>
                                    )}
                                </div>
                                <div className="text-left flex-shrink-0">
                                    <p className="text-xs text-gray-400">قيمة محتملة</p>
                                    <p className="font-bold text-green-700 text-sm">{formatCur(opp.potentialValue)}</p>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface CrmAnalyticsPageProps {
    brandId: string;
}

export const CrmAnalyticsPage: React.FC<CrmAnalyticsPageProps> = ({ brandId }) => {
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('rfm');

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-gray-900">تحليلات CRM المتقدمة</h1>
                <p className="text-sm text-gray-500">RFM · الاحتفاظ · الإيراد · الاضطراب · فرص البيع</p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 pb-px">
                {ANALYTICS_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <i className={`fas ${tab.icon} text-xs`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div>
                {activeTab === 'rfm'      && <RfmTab       brandId={brandId} />}
                {activeTab === 'cohorts'  && <CohortsTab   brandId={brandId} />}
                {activeTab === 'revenue'  && <RevenueTab   brandId={brandId} />}
                {activeTab === 'churn'    && <ChurnTab     brandId={brandId} />}
                {activeTab === 'crosssell'&& <CrossSellTab brandId={brandId} />}
            </div>
        </div>
    );
};
