import React, { useEffect, useState } from 'react';
import { fetchAdminDataAnalytics, AdminDataAnalytics } from '../../../services/adminDataAnalyticsService';
import { KPICard } from '../shared/ui/KPICard';
import { ChartContainer } from '../shared/ui/ChartContainer';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';
import { LightweightLineChart, MetricBarList } from '../../shared/LightweightCharts';

const SKILL_LABELS: Record<string, string> = {
    reply_suggestion: 'اقتراح رد',
    content_generation: 'توليد محتوى',
    ad_copy: 'نص إعلاني',
    email_draft: 'مسودة بريد',
    hashtag_suggestion: 'هاشتاق',
    image_prompt: 'وصف صورة',
    social_caption: 'كابشن سوشيال',
    seo_meta: 'SEO Meta',
    translation: 'ترجمة',
    summarization: 'تلخيص',
};

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
    product: 'منتج / خدمة',
    faq: 'أسئلة شائعة',
    policy: 'سياسات',
    competitor: 'منافسين',
    scenario_script: 'سكريبت محادثة',
};

const KNOWLEDGE_COLORS: Record<string, string> = {
    product: '#2563eb',
    faq: '#8b5cf6',
    policy: '#10b981',
    competitor: '#f59e0b',
    scenario_script: '#ef4444',
};

function star(rating: number | null): string {
    if (rating === null) return '—';
    return `${rating.toFixed(1)} ★`;
}

function pct(v: number): string {
    return `${v.toFixed(1)}%`;
}

const Skeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonLoader key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonLoader className="h-72" />
            <SkeletonLoader className="h-72" />
        </div>
        <SkeletonLoader className="h-64" />
    </div>
);

export const AdminDataAnalyticsPage: React.FC = () => {
    const [data, setData] = useState<AdminDataAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAdminDataAnalytics()
            .then(setData)
            .catch(e => setError(e?.message ?? 'خطأ في جلب البيانات'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Skeleton />;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-danger">
                <i className="fas fa-triangle-exclamation text-4xl opacity-60" />
                <p className="text-sm font-medium">{error}</p>
            </div>
        );
    }

    if (!data) return null;

    const { totals, executionStats, knowledgeStats, trendLast30Days, skillStats } = data;

    // Aggregate skill stats across brands for global view
    const globalSkillMap = new Map<string, { total: number; used: number; edited: number; rejected: number; converted: number; ratings: number[] }>();
    for (const row of skillStats) {
        if (!globalSkillMap.has(row.skill_type)) {
            globalSkillMap.set(row.skill_type, { total: 0, used: 0, edited: 0, rejected: 0, converted: 0, ratings: [] });
        }
        const entry = globalSkillMap.get(row.skill_type)!;
        entry.total += row.total_evaluations;
        entry.used   += (row.used_pct   / 100) * row.total_evaluations;
        entry.edited += (row.edited_pct / 100) * row.total_evaluations;
        entry.rejected += (row.rejected_pct / 100) * row.total_evaluations;
        entry.converted += (row.conversion_pct / 100) * row.total_evaluations;
        if (row.avg_rating !== null) entry.ratings.push(row.avg_rating);
    }

    const skillBarItems = executionStats.slice(0, 8).map(s => ({
        label: SKILL_LABELS[s.skill_type] ?? s.skill_type,
        value: s.total,
        color: '#2563eb',
        suffix: ' تنفيذ',
    }));

    const knowledgeBarItems = knowledgeStats.map(k => ({
        label: KNOWLEDGE_TYPE_LABELS[k.type] ?? k.type,
        value: k.total,
        color: KNOWLEDGE_COLORS[k.type] ?? '#6b7280',
        suffix: ' عنصر',
    }));

    const maxExec = Math.max(...skillBarItems.map(i => i.value), 1);
    const maxKnow = Math.max(...knowledgeBarItems.map(i => i.value), 1);

    return (
        <div className="space-y-8" dir="rtl">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-database text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-light-text dark:text-dark-text">تحليل قاعدة البيانات</h1>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        أداء محرك المهارات · معرفة البراند · اتجاهات الاستخدام
                    </p>
                </div>
                <div className="ms-auto text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <i className="fas fa-clock me-1 opacity-60" />
                    بيانات حقيقية من الإنتاج
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="إجمالي التنفيذات"
                    value={totals.totalExecutions.toLocaleString('ar')}
                    icon="fa-bolt"
                    trendValue="skill executions"
                    isPositive={true}
                    onClick={() => {}}
                />
                <KPICard
                    title="تقييمات المستخدمين"
                    value={totals.totalEvaluations.toLocaleString('ar')}
                    icon="fa-star"
                    trendValue="evaluations"
                    isPositive={true}
                    onClick={() => {}}
                />
                <KPICard
                    title="عناصر المعرفة"
                    value={totals.totalKnowledgeItems.toLocaleString('ar')}
                    icon="fa-brain"
                    trendValue="brand knowledge"
                    isPositive={true}
                    onClick={() => {}}
                />
                <KPICard
                    title="براندات تستخدم AI"
                    value={totals.totalBrandsWithSkills.toLocaleString('ar')}
                    icon="fa-building"
                    trendValue="brands active"
                    isPositive={true}
                    onClick={() => {}}
                />
            </div>

            {/* Summary metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-gauge-high text-blue-500 text-xl" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                            {(totals.avgConfidence * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">متوسط ثقة النموذج</p>
                    </div>
                </div>
                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-star text-amber-500 text-xl" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                            {totals.avgRating !== null ? totals.avgRating.toFixed(2) : '—'} / 5
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">متوسط تقييم المستخدمين</p>
                    </div>
                </div>
                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-chart-line text-green-500 text-xl" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">
                            {trendLast30Days.reduce((s, p) => s + p.count, 0).toLocaleString('ar')}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">تنفيذات آخر 30 يوم</p>
                    </div>
                </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartContainer title="تنفيذات المهارات — آخر 30 يوم">
                    <div className="h-[240px]">
                        {trendLast30Days.length > 0 ? (
                            <LightweightLineChart
                                data={trendLast30Days as unknown as Record<string, string | number>[]}
                                xKey="date"
                                formatX={(v) => new Date(String(v)).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                                series={[{ key: 'count', label: 'تنفيذات', color: '#2563eb' }]}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary text-sm">
                                لا توجد بيانات بعد
                            </div>
                        )}
                    </div>
                </ChartContainer>

                <ChartContainer title="أكثر المهارات استخداماً">
                    {skillBarItems.length > 0 ? (
                        <MetricBarList items={skillBarItems} maxValue={maxExec} />
                    ) : (
                        <div className="h-48 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary text-sm">
                            لا توجد تنفيذات بعد
                        </div>
                    )}
                </ChartContainer>
            </div>

            {/* Knowledge base breakdown */}
            <ChartContainer title="قاعدة معرفة البراند — توزيع الأنواع">
                {knowledgeBarItems.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <MetricBarList
                            items={knowledgeBarItems}
                            maxValue={maxKnow}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            {knowledgeStats.map(k => (
                                <div key={k.type} className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: KNOWLEDGE_COLORS[k.type] ?? '#6b7280' }} />
                                        <span className="text-xs font-medium text-light-text dark:text-dark-text truncate">
                                            {KNOWLEDGE_TYPE_LABELS[k.type] ?? k.type}
                                        </span>
                                    </div>
                                    <p className="text-2xl font-bold text-light-text dark:text-dark-text">{k.total}</p>
                                    <div className="flex gap-3 mt-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                        <span className="text-green-500">{k.active} فعّال</span>
                                        {k.inactive > 0 && <span className="text-danger">{k.inactive} معطّل</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-32 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary text-sm">
                        لا توجد عناصر معرفة بعد
                    </div>
                )}
            </ChartContainer>

            {/* Skill performance table */}
            <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                        <i className="fas fa-table text-primary" />
                        أداء المهارات — تفاصيل إشارات المستخدمين
                    </h3>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        مجمّع من جميع البراندات — يساعد في معرفة أي المهارات تحتاج تحسين
                    </p>
                </div>
                <div className="overflow-x-auto">
                    {globalSkillMap.size > 0 ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-light-bg dark:bg-dark-bg text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    <th className="px-4 py-3 text-right font-semibold">المهارة</th>
                                    <th className="px-4 py-3 text-center font-semibold">التقييمات</th>
                                    <th className="px-4 py-3 text-center font-semibold text-green-500">استُخدم</th>
                                    <th className="px-4 py-3 text-center font-semibold text-blue-400">عُدِّل</th>
                                    <th className="px-4 py-3 text-center font-semibold text-danger">رُفض</th>
                                    <th className="px-4 py-3 text-center font-semibold text-amber-400">تحويل</th>
                                    <th className="px-4 py-3 text-center font-semibold">التقييم</th>
                                    <th className="px-4 py-3 text-center font-semibold">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-border dark:divide-dark-border">
                                {Array.from(globalSkillMap.entries())
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .map(([skill_type, v]) => {
                                        const usedPct = v.total > 0 ? (v.used / v.total) * 100 : 0;
                                        const rejPct  = v.total > 0 ? (v.rejected / v.total) * 100 : 0;
                                        const editPct = v.total > 0 ? (v.edited / v.total) * 100 : 0;
                                        const convPct = v.total > 0 ? (v.converted / v.total) * 100 : 0;
                                        const avgR = v.ratings.length ? v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length : null;
                                        const health = rejPct > 30 ? 'danger' : rejPct > 15 ? 'warning' : 'ok';
                                        return (
                                            <tr key={skill_type} className="hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                                                <td className="px-4 py-3 font-medium text-light-text dark:text-dark-text">
                                                    {SKILL_LABELS[skill_type] ?? skill_type}
                                                </td>
                                                <td className="px-4 py-3 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                                    {v.total.toLocaleString('ar')}
                                                </td>
                                                <td className="px-4 py-3 text-center text-green-500 font-semibold">{pct(usedPct)}</td>
                                                <td className="px-4 py-3 text-center text-blue-400">{pct(editPct)}</td>
                                                <td className="px-4 py-3 text-center text-danger">{pct(rejPct)}</td>
                                                <td className="px-4 py-3 text-center text-amber-400">{pct(convPct)}</td>
                                                <td className="px-4 py-3 text-center">{star(avgR)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                                        health === 'ok'      ? 'bg-green-500/10 text-green-500' :
                                                        health === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                                        'bg-danger/10 text-danger'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                                            health === 'ok' ? 'bg-green-500' : health === 'warning' ? 'bg-amber-500' : 'bg-danger'
                                                        }`} />
                                                        {health === 'ok' ? 'جيد' : health === 'warning' ? 'يحتاج مراجعة' : 'ضعيف'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-16 text-center text-light-text-secondary dark:text-dark-text-secondary text-sm">
                            <i className="fas fa-inbox text-3xl opacity-30 mb-3 block" />
                            لا توجد تقييمات مهارات بعد
                        </div>
                    )}
                </div>
            </div>

            {/* Execution health: policy failures + approvals */}
            {executionStats.some(e => e.policy_failed > 0 || e.requires_approval > 0) && (
                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-light-border dark:border-dark-border">
                        <h3 className="font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                            <i className="fas fa-shield-exclamation text-amber-500" />
                            تنبيهات تنفيذ — سياسة البراند وطلبات الموافقة
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-light-bg dark:bg-dark-bg text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    <th className="px-4 py-3 text-right font-semibold">المهارة</th>
                                    <th className="px-4 py-3 text-center font-semibold">إجمالي التنفيذات</th>
                                    <th className="px-4 py-3 text-center font-semibold text-danger">خالف السياسة</th>
                                    <th className="px-4 py-3 text-center font-semibold text-amber-500">يحتاج موافقة</th>
                                    <th className="px-4 py-3 text-center font-semibold">متوسط الوقت</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-border dark:divide-dark-border">
                                {executionStats
                                    .filter(e => e.policy_failed > 0 || e.requires_approval > 0)
                                    .map(e => (
                                        <tr key={e.skill_type} className="hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                                            <td className="px-4 py-3 font-medium text-light-text dark:text-dark-text">
                                                {SKILL_LABELS[e.skill_type] ?? e.skill_type}
                                            </td>
                                            <td className="px-4 py-3 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                                {e.total.toLocaleString('ar')}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {e.policy_failed > 0
                                                    ? <span className="text-danger font-semibold">{e.policy_failed}</span>
                                                    : <span className="text-green-500">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {e.requires_approval > 0
                                                    ? <span className="text-amber-500 font-semibold">{e.requires_approval}</span>
                                                    : <span className="text-green-500">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                                {e.avg_execution_ms !== null ? `${e.avg_execution_ms} ms` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Strategic insights */}
            <div className="bg-gradient-to-br from-primary/5 to-brand-secondary/5 border border-primary/20 rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                    <i className="fas fa-lightbulb text-amber-400" />
                    توجيهات استراتيجية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {totals.totalExecutions === 0 && (
                        <Insight icon="fa-circle-info" color="blue" text="لا توجد تنفيذات بعد — ابدأ بتشغيل المهارات لترى الإحصائيات هنا." />
                    )}
                    {totals.avgConfidence > 0 && totals.avgConfidence < 0.7 && (
                        <Insight icon="fa-triangle-exclamation" color="amber" text={`متوسط ثقة النموذج ${(totals.avgConfidence * 100).toFixed(0)}% — راجع جودة المدخلات أو prompt engineering.`} />
                    )}
                    {Array.from(globalSkillMap.entries()).some(([, v]) => v.total > 0 && (v.rejected / v.total) > 0.3) && (
                        <Insight icon="fa-thumbs-down" color="red" text="بعض المهارات معدل رفضها أكثر من 30% — تحتاج إعادة ضبط أو تدريب إضافي." />
                    )}
                    {totals.totalKnowledgeItems > 0 && knowledgeStats.some(k => k.inactive > k.active) && (
                        <Insight icon="fa-archive" color="amber" text="عدد عناصر المعرفة المعطّلة يتجاوز الفعّال في بعض الأنواع — راجع جودة المحتوى." />
                    )}
                    {totals.totalEvaluations > 10 && (totals.avgRating ?? 0) >= 4 && (
                        <Insight icon="fa-trophy" color="green" text={`ممتاز! متوسط التقييم ${totals.avgRating?.toFixed(1)} — المستخدمون راضون عن مخرجات AI.`} />
                    )}
                    {executionStats.some(e => e.avg_execution_ms !== null && e.avg_execution_ms > 5000) && (
                        <Insight icon="fa-clock" color="amber" text="بعض المهارات تستغرق أكثر من 5 ثوانٍ — راجع أداء الـ Edge Functions." />
                    )}
                    {totals.totalBrandsWithSkills === 0 && totals.totalExecutions === 0 && (
                        <Insight icon="fa-rocket" color="blue" text="النظام جاهز — شجّع المستخدمين على تجربة مهارات AI في محتواهم." />
                    )}
                </div>
            </div>
        </div>
    );
};

const Insight: React.FC<{ icon: string; color: string; text: string }> = ({ icon, color, text }) => {
    const colorMap: Record<string, string> = {
        blue:  'bg-blue-500/10 text-blue-500',
        amber: 'bg-amber-500/10 text-amber-500',
        red:   'bg-danger/10 text-danger',
        green: 'bg-green-500/10 text-green-500',
    };
    return (
        <div className={`flex items-start gap-3 rounded-xl p-3 ${colorMap[color] ?? colorMap.blue}`}>
            <i className={`fas ${icon} mt-0.5 flex-shrink-0`} />
            <p className="text-sm leading-relaxed">{text}</p>
        </div>
    );
};
