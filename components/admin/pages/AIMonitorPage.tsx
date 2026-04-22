// components/admin/pages/AIMonitorPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AIMetric } from '../../../types';
import { GlobalBrainStats, getGlobalBrainStats } from '../../../services/evaluationService';
import { SKILL_REGISTRY } from '../../../services/skillEngine';
import { SkillType } from '../../../types';
import { ChartContainer } from '../shared/ui/ChartContainer';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';

interface AIMonitorPageProps {
    metrics: AIMetric[];
    isLoading: boolean;
}

type PeriodDays = 7 | 30 | 90;

// ── helpers ──────────────────────────────────────────────────────────────────

const SKILL_LABEL = (k: string) => SKILL_REGISTRY[k as SkillType]?.nameAr ?? k;
const SKILL_ICON  = (k: string): string => {
    const map: Partial<Record<SkillType, string>> = {
        [SkillType.ContentGeneration]:      'fa-pen-nib',
        [SkillType.OccasionOpportunity]:    'fa-calendar-star',
        [SkillType.ConversationReply]:      'fa-comments',
        [SkillType.CampaignBrief]:          'fa-bullhorn',
        [SkillType.MarketingPlanSuggestion]:'fa-map',
        [SkillType.HashtagResearch]:        'fa-hashtag',
        [SkillType.CompetitorAnalysis]:     'fa-chess',
        [SkillType.ContentCalendar]:        'fa-calendar-alt',
        [SkillType.AdCopywriting]:          'fa-ad',
        [SkillType.SEOContentBrief]:        'fa-search',
        [SkillType.AudienceInsight]:        'fa-users',
        [SkillType.BrandVoiceCheck]:        'fa-microphone',
        [SkillType.LeadQualification]:      'fa-filter',
        [SkillType.FollowUpSequence]:       'fa-envelope-open-text',
    };
    return map[k as SkillType] ?? 'fa-robot';
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}س`;
    return `${Math.floor(hrs / 24)}ي`;
}

// ── KPI card ─────────────────────────────────────────────────────────────────

const KPI: React.FC<{ icon: string; label: string; value: string; sub?: string; accent?: string }> = ({ icon, label, value, sub, accent = 'text-primary' }) => (
    <div className="bg-light-card dark:bg-dark-card rounded-2xl p-5 border border-light-border dark:border-dark-border flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <i className={`fas ${icon} text-sm ${accent}`} />
        </div>
        <div className="min-w-0">
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-0.5">{label}</p>
            <p className="text-2xl font-black text-light-text dark:text-dark-text">{value}</p>
            {sub && <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ── Mini bar for quality signal ───────────────────────────────────────────────

const QualityBar: React.FC<{ used: number; edited: number; rejected: number }> = ({ used, edited, rejected }) => {
    const total = used + edited + rejected;
    if (!total) return <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">—</span>;
    return (
        <div className="flex h-2 rounded-full overflow-hidden w-24 gap-px">
            <div className="bg-emerald-500 rounded-s-full" style={{ width: `${(used / total) * 100}%` }} />
            <div className="bg-blue-400" style={{ width: `${(edited / total) * 100}%` }} />
            <div className="bg-rose-400 rounded-e-full" style={{ width: `${(rejected / total) * 100}%` }} />
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

export const AIMonitorPage: React.FC<AIMonitorPageProps> = ({ metrics, isLoading }) => {
    const [period, setPeriod]       = useState<PeriodDays>(30);
    const [brainStats, setBrainStats] = useState<GlobalBrainStats | null>(null);
    const [brainLoading, setBrainLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'brain' | 'tokens'>('brain');

    const loadBrainStats = useCallback(async () => {
        setBrainLoading(true);
        const stats = await getGlobalBrainStats(period);
        setBrainStats(stats);
        setBrainLoading(false);
    }, [period]);

    useEffect(() => { void loadBrainStats(); }, [loadBrainStats]);

    // Token analytics (from legacy AIMetric)
    const overallStats = useMemo(() => {
        if (!metrics.length) return { totalTokens: 0, avgLatency: '0', estimatedCost: 0 };
        const totalTokens   = metrics.reduce((s, m) => s + m.tokens, 0);
        const avgLatency    = (metrics.reduce((s, m) => s + m.latency, 0) / metrics.length).toFixed(0);
        const estimatedCost = (totalTokens / 1_000_000) * 0.5;
        return { totalTokens, avgLatency, estimatedCost };
    }, [metrics]);

    const tokensByFeature = useMemo(() => {
        const map = new Map<string, number>();
        metrics.forEach(m => map.set(m.feature, (map.get(m.feature) ?? 0) + m.tokens));
        return Array.from(map.entries()).map(([name, tokens]) => ({ name, tokens }));
    }, [metrics]);

    const tokensOverTime = useMemo(() => {
        const map = new Map<string, number>();
        metrics.forEach(m => {
            const d = new Date(m.timestamp).toISOString().split('T')[0];
            map.set(d, (map.get(d) ?? 0) + m.tokens);
        });
        return Array.from(map.entries())
            .map(([date, tokens]) => ({ date, tokens }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [metrics]);

    // Skill chart data
    const skillChartData = brainStats
        ? Object.entries(brainStats.bySkill)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8)
            .map(([key, val]) => ({
                name: SKILL_LABEL(key).length > 16 ? SKILL_LABEL(key).slice(0, 16) + '…' : SKILL_LABEL(key),
                استخدم: Math.round(val.usedRate * 100),
                رُفض:   Math.round(val.rejectedRate * 100),
            }))
        : [];

    if ((brainLoading && !brainStats) || (isLoading && !metrics.length && !brainStats)) {
        return (
            <div className="space-y-6 animate-pulse">
                <SkeletonLoader className="h-10 w-64" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonLoader key={i} className="h-24" />)}
                </div>
                <SkeletonLoader className="h-80" />
            </div>
        );
    }

    return (
        <div className="space-y-6" style={{ direction: 'rtl' }}>

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-light-text dark:text-dark-text">مراقبة Platform Brain</h1>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">أداء الذكاء الاصطناعي عبر جميع البراندز</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Section toggle */}
                    <div className="flex items-center gap-1 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border p-1">
                        <button onClick={() => setActiveSection('brain')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeSection === 'brain' ? 'bg-primary text-white shadow' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                            <i className="fas fa-brain me-1.5" />عقل البراند
                        </button>
                        <button onClick={() => setActiveSection('tokens')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeSection === 'tokens' ? 'bg-primary text-white shadow' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                            <i className="fas fa-coins me-1.5" />التوكنز
                        </button>
                    </div>
                    {/* Period picker (brain section only) */}
                    {activeSection === 'brain' && (
                        <div className="flex items-center gap-1 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border p-1">
                            {([7, 30, 90] as PeriodDays[]).map(d => (
                                <button key={d} onClick={() => setPeriod(d)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${period === d ? 'bg-primary text-white shadow' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                                    {d}ي
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ══════ BRAIN SECTION ══════ */}
            {activeSection === 'brain' && brainStats && (
                <div className="space-y-6">

                    {/* Global KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KPI icon="fa-bolt" label="إجمالي التنفيذات" value={brainStats.totalExecutions.toLocaleString()} sub={`آخر ${period} يوم`} />
                        <KPI icon="fa-building" label="البراندز النشطة"  value={brainStats.uniqueBrands.toString()} accent="text-blue-500" />
                        <KPI icon="fa-check-circle" label="معدل الاستخدام العام"
                            value={`${Math.round(brainStats.globalUsedRate * 100)}%`}
                            sub={`${Math.round(brainStats.globalRejectedRate * 100)}% رُفض`}
                            accent="text-emerald-500"
                        />
                        <KPI icon="fa-star" label="متوسط التقييم"
                            value={brainStats.avgRating > 0 ? brainStats.avgRating.toFixed(1) : '—'}
                            sub="من 5 نجوم"
                            accent="text-amber-500"
                        />
                    </div>

                    {/* Two-column: Skill chart + Brand table */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Skill performance chart */}
                        <ChartContainer title="أداء المهارات (استخدام vs رفض)">
                            {brainLoading ? (
                                <SkeletonLoader className="h-64" />
                            ) : skillChartData.length === 0 ? (
                                <div className="flex items-center justify-center h-64 text-sm text-light-text-secondary dark:text-dark-text-secondary">لا توجد بيانات</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={skillChartData} layout="vertical" margin={{ right: 16 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                                        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} stroke="var(--color-text-secondary)" fontSize={11} />
                                        <YAxis type="category" dataKey="name" stroke="var(--color-text-secondary)" fontSize={11} width={100} />
                                        <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: 12 }} />
                                        <Bar dataKey="استخدم" fill="#10b981" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="رُفض"   fill="#f43f5e" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartContainer>

                        {/* Brand rankings */}
                        <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
                            <div className="px-5 py-4 border-b border-light-border dark:border-dark-border">
                                <h3 className="font-bold text-light-text dark:text-dark-text text-sm">تصنيف البراندز</h3>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">حسب عدد التنفيذات</p>
                            </div>
                            <div className="divide-y divide-light-border dark:divide-dark-border">
                                {brainLoading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="px-5 py-3">
                                            <SkeletonLoader className="h-8" />
                                        </div>
                                    ))
                                ) : brainStats.byBrand.length === 0 ? (
                                    <div className="px-5 py-10 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">لا توجد بيانات</div>
                                ) : (
                                    brainStats.byBrand.slice(0, 8).map((b, i) => (
                                        <div key={b.brandId} className="px-5 py-3 flex items-center gap-3">
                                            <span className="text-xs font-black text-light-text-secondary dark:text-dark-text-secondary w-5 text-center">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-light-text dark:text-dark-text truncate font-mono">{b.brandId.slice(0, 12)}…</p>
                                                <QualityBar
                                                    used={Math.round(b.usedRate * b.total)}
                                                    edited={0}
                                                    rejected={Math.round((1 - b.usedRate) * b.total)}
                                                />
                                            </div>
                                            <div className="text-end flex-shrink-0">
                                                <p className="text-sm font-black text-light-text dark:text-dark-text">{b.total}</p>
                                                <p className="text-[10px] text-emerald-500 font-bold">{Math.round(b.usedRate * 100)}%</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* All skills table */}
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
                        <div className="px-5 py-4 border-b border-light-border dark:border-dark-border">
                            <h3 className="font-bold text-light-text dark:text-dark-text text-sm">تفصيل كل المهارات</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm" style={{ direction: 'rtl' }}>
                                <thead>
                                    <tr className="bg-light-bg dark:bg-dark-bg text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        <th className="px-5 py-3 text-start font-semibold">المهارة</th>
                                        <th className="px-4 py-3 text-center font-semibold">تقييمات</th>
                                        <th className="px-4 py-3 text-center font-semibold">استُخدم</th>
                                        <th className="px-4 py-3 text-center font-semibold">رُفض</th>
                                        <th className="px-4 py-3 text-center font-semibold">تقييم</th>
                                        <th className="px-4 py-3 text-start font-semibold">الجودة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-light-border dark:divide-dark-border">
                                    {brainLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i}><td colSpan={6} className="px-5 py-3"><SkeletonLoader className="h-6" /></td></tr>
                                        ))
                                    ) : Object.keys(brainStats.bySkill).length === 0 ? (
                                        <tr><td colSpan={6} className="px-5 py-10 text-center text-light-text-secondary dark:text-dark-text-secondary text-sm">لا توجد بيانات في هذه الفترة</td></tr>
                                    ) : (
                                        Object.entries(brainStats.bySkill)
                                            .sort((a, b) => b[1].total - a[1].total)
                                            .map(([key, val]) => (
                                                <tr key={key} className="hover:bg-light-bg/50 dark:hover:bg-dark-bg/50 transition-colors">
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <i className={`fas ${SKILL_ICON(key)} text-xs text-primary w-4 text-center`} />
                                                            <span className="font-semibold text-light-text dark:text-dark-text">{SKILL_LABEL(key)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-light-text dark:text-dark-text">{val.total}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-emerald-500">{Math.round(val.usedRate * 100)}%</td>
                                                    <td className="px-4 py-3 text-center font-bold text-rose-400">{Math.round(val.rejectedRate * 100)}%</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {val.avgRating > 0 ? (
                                                            <span className="text-amber-400 font-bold">{val.avgRating.toFixed(1)} ★</span>
                                                        ) : <span className="text-light-text-secondary dark:text-dark-text-secondary">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <QualityBar
                                                            used={Math.round(val.usedRate * val.total)}
                                                            edited={0}
                                                            rejected={Math.round(val.rejectedRate * val.total)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent executions feed */}
                    <div className="bg-light-card dark:bg-dark-card rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
                        <div className="px-5 py-4 border-b border-light-border dark:border-dark-border">
                            <h3 className="font-bold text-light-text dark:text-dark-text text-sm">آخر التنفيذات (كل البراندز)</h3>
                        </div>
                        <div className="divide-y divide-light-border dark:divide-dark-border">
                            {brainLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="px-5 py-3"><SkeletonLoader className="h-10" /></div>
                                ))
                            ) : brainStats.recentExecutions.length === 0 ? (
                                <div className="px-5 py-10 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">لا توجد تنفيذات</div>
                            ) : (
                                brainStats.recentExecutions.slice(0, 15).map(ex => (
                                    <div key={ex.id} className="px-5 py-3 flex items-start gap-3 hover:bg-light-bg/50 dark:hover:bg-dark-bg/50 transition-colors">
                                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <i className={`fas ${SKILL_ICON(ex.skillType)} text-[10px] text-primary`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-xs font-bold text-light-text dark:text-dark-text">{SKILL_LABEL(ex.skillType)}</span>
                                                <span className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary bg-light-bg dark:bg-dark-bg px-1.5 py-0.5 rounded">{ex.brandId?.slice(0, 8)}</span>
                                            </div>
                                            {ex.rawOutput && (
                                                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary line-clamp-1">{ex.rawOutput}</p>
                                            )}
                                        </div>
                                        <div className="flex-shrink-0 text-end">
                                            <p className={`text-[11px] font-bold ${ex.confidence >= 0.8 ? 'text-emerald-500' : ex.confidence >= 0.6 ? 'text-yellow-500' : 'text-rose-400'}`}>
                                                {Math.round(ex.confidence * 100)}%
                                            </p>
                                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{timeAgo(ex.createdAt)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════ TOKENS SECTION ══════ */}
            {activeSection === 'tokens' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KPI icon="fa-coins"     label="إجمالي التوكنز (30 يوم)"  value={overallStats.totalTokens.toLocaleString()} />
                        <KPI icon="fa-stopwatch" label="متوسط زمن الاستجابة"      value={`${overallStats.avgLatency}ms`} accent="text-blue-500" />
                        <KPI icon="fa-dollar-sign" label="التكلفة التقديرية (30 يوم)" value={`$${overallStats.estimatedCost.toFixed(2)}`} accent="text-amber-500" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartContainer title="استخدام التوكنز حسب الميزة">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={tokensByFeature} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis type="number" stroke="var(--color-text-secondary)" fontSize={12} />
                                    <YAxis type="category" dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} width={120} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }} />
                                    <Bar dataKey="tokens" name="Tokens" fill="#8884d8" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                        <ChartContainer title="استخدام التوكنز عبر الزمن">
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={tokensOverTime}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={12}
                                        tickFormatter={tick => new Date(tick).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} />
                                    <YAxis stroke="var(--color-text-secondary)" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }} />
                                    <Line type="monotone" dataKey="tokens" name="Tokens" stroke="#82ca9d" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>
                </div>
            )}
        </div>
    );
};
