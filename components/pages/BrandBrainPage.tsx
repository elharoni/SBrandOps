import React, { useState, useEffect, useCallback } from 'react';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import { getBrandSkillsReport } from '../../services/evaluationService';
import { getBrandRecentExecutions, BrainExecution } from '../../services/evaluationService';
import { getBrandKnowledge } from '../../services/brandKnowledgeService';
import { SKILL_REGISTRY } from '../../services/skillEngine';
import { SkillStats, SkillType, BrandKnowledgeEntry, NotificationType } from '../../types';

interface BrandBrainPageProps {
    brandId: string;
    brandName?: string;
    addNotification?: (type: NotificationType, message: string) => void;
    onNavigate?: (page: string) => void;
}

type ActiveTab = 'skills' | 'executions' | 'knowledge' | 'trend';
type PeriodDays = 7 | 30 | 90;

// Arabic labels for each skill type (from SKILL_REGISTRY)
const SKILL_LABEL = (skillType: string): string =>
    SKILL_REGISTRY[skillType as SkillType]?.nameAr ?? skillType;

const SKILL_ICON: Partial<Record<SkillType, string>> = {
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

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
    product:         'المنتجات',
    faq:             'الأسئلة الشائعة',
    policy:          'السياسات',
    competitor:      'المنافسون',
    scenario_script: 'سيناريوهات',
};

const KNOWLEDGE_TYPE_ICONS: Record<string, string> = {
    product:         'fa-box',
    faq:             'fa-question-circle',
    policy:          'fa-shield-alt',
    competitor:      'fa-chess-knight',
    scenario_script: 'fa-film',
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
}

function ConfidenceBar({ value }: { value: number }) {
    const pct = Math.round(value * 100);
    const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-rose-400';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-bold tabular-nums text-light-text-secondary dark:text-dark-text-secondary w-8 text-end">{pct}%</span>
        </div>
    );
}

function SkillCard({ skillType, stats }: { skillType: string; stats: SkillStats }) {
    const icon = SKILL_ICON[skillType as SkillType] ?? 'fa-robot';
    const usedPct     = Math.round(stats.usedRate     * 100);
    const editedPct   = Math.round(stats.editedRate   * 100);
    const rejectedPct = Math.round(stats.rejectedRate * 100);
    const qualityColor = usedPct >= 60 ? 'text-emerald-500' : usedPct >= 35 ? 'text-yellow-500' : 'text-rose-400';

    return (
        <div className="surface-panel-soft rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                        <i className={`fas ${icon} text-xs text-brand-secondary`} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-light-text dark:text-dark-text leading-tight">{SKILL_LABEL(skillType)}</p>
                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{stats.totalExecutions} تقييم</p>
                    </div>
                </div>
                <span className={`text-xs font-black ${qualityColor}`}>{usedPct}%</span>
            </div>

            {/* Stacked bars */}
            <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] w-10 text-light-text-secondary dark:text-dark-text-secondary text-end">استُخدم</span>
                    <div className="flex-1 h-2 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${usedPct}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold w-7 text-end tabular-nums text-emerald-500">{usedPct}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] w-10 text-light-text-secondary dark:text-dark-text-secondary text-end">عُدِّل</span>
                    <div className="flex-1 h-2 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${editedPct}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold w-7 text-end tabular-nums text-blue-400">{editedPct}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] w-10 text-light-text-secondary dark:text-dark-text-secondary text-end">رُفض</span>
                    <div className="flex-1 h-2 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                        <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${rejectedPct}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold w-7 text-end tabular-nums text-rose-400">{rejectedPct}%</span>
                </div>
            </div>

            {stats.averageRating > 0 && (
                <div className="flex items-center gap-1 pt-0.5">
                    {[1,2,3,4,5].map(s => (
                        <i key={s} className={`fas fa-star text-[9px] ${s <= Math.round(stats.averageRating) ? 'text-amber-400' : 'text-light-border dark:text-dark-border'}`} />
                    ))}
                    <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary ms-1">{stats.averageRating.toFixed(1)}</span>
                </div>
            )}
        </div>
    );
}

export const BrandBrainPage: React.FC<BrandBrainPageProps> = ({ brandId, brandName, addNotification: _addNotification, onNavigate }) => {
    const [activeTab, setActiveTab]       = useState<ActiveTab>('skills');
    const [period, setPeriod]             = useState<PeriodDays>(30);
    const [skillsReport, setSkillsReport] = useState<Record<string, SkillStats>>({});
    const [executions, setExecutions]     = useState<BrainExecution[]>([]);
    const [knowledge, setKnowledge]       = useState<BrandKnowledgeEntry[]>([]);
    const [loading, setLoading]           = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const [report, execs, knowledge] = await Promise.all([
            getBrandSkillsReport(brandId, period),
            getBrandRecentExecutions(brandId, 30),
            getBrandKnowledge(brandId),
        ]);
        setSkillsReport(report);
        setExecutions(execs);
        setKnowledge(knowledge);
        setLoading(false);
    }, [brandId, period]);

    useEffect(() => { void load(); }, [load]);

    // Derived stats
    const totalEvals = Object.values(skillsReport).reduce((s, r) => s + r.totalExecutions, 0);
    const allUsedRates = Object.values(skillsReport).filter(r => r.totalExecutions > 0).map(r => r.usedRate);
    const avgUsed = allUsedRates.length ? allUsedRates.reduce((a, b) => a + b, 0) / allUsedRates.length : 0;
    const bestSkill = Object.entries(skillsReport).sort((a, b) => b[1].usedRate - a[1].usedRate)[0];
    const knowledgeByType = knowledge.reduce<Record<string, number>>((acc, k) => {
        acc[k.type] = (acc[k.type] ?? 0) + 1;
        return acc;
    }, {});

    // ── Confidence trend data (last 30 days from executions) ─────────────────
    const today = new Date();
    const trendDays = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (29 - i));
        return { date: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}` };
    });
    const execByDay = executions.reduce<Record<string, number[]>>((acc, ex) => {
        const day = ex.createdAt.slice(0, 10);
        if (!acc[day]) acc[day] = [];
        acc[day].push(ex.confidence);
        return acc;
    }, {});
    const trendData = trendDays.map(({ date, label }) => {
        const vals = execByDay[date] ?? [];
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        return { date, label, avg, count: vals.length };
    });
    const trendAvgOverall = trendData.filter(d => d.avg !== null);
    const trendGlobalAvg = trendAvgOverall.length
        ? trendAvgOverall.reduce((s, d) => s + (d.avg ?? 0), 0) / trendAvgOverall.length
        : null;

    const tabs: { id: ActiveTab; label: string; icon: string }[] = [
        { id: 'skills',     label: 'أداء المهارات',    icon: 'fa-brain' },
        { id: 'executions', label: 'التنفيذات الأخيرة', icon: 'fa-history' },
        { id: 'knowledge',  label: 'قاعدة المعرفة',    icon: 'fa-database' },
        { id: 'trend',      label: 'مسار الثقة',        icon: 'fa-chart-line' },
    ];

    return (
        <PageScaffold
            kicker="Platform Brain"
            title="عقل البراند الذكي"
            description={`تفاصيل أداء الذكاء الاصطناعي وقاعدة المعرفة${brandName ? ` لـ ${brandName}` : ''}`}
            stats={[
                { label: 'إجمالي التقييمات', value: totalEvals.toString(), icon: 'fa-chart-bar' },
                { label: 'معدل الاستخدام',   value: `${Math.round(avgUsed * 100)}%`, icon: 'fa-circle-check' },
                { label: 'إدخالات المعرفة',  value: knowledge.length.toString(), icon: 'fa-brain' },
            ]}
            actions={
                <div className="flex items-center gap-1 rounded-xl bg-light-bg dark:bg-dark-bg p-1 border border-light-border dark:border-dark-border">
                    {([7, 30, 90] as PeriodDays[]).map(d => (
                        <button key={d} onClick={() => setPeriod(d)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${period === d ? 'bg-brand-primary text-white shadow' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                            {d} يوم
                        </button>
                    ))}
                </div>
            }
        >
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-light-border dark:border-dark-border px-1 mb-6 -mt-2">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${activeTab === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}>
                        <i className={`fas ${tab.icon} text-xs`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <PageSection className="pt-0">

                {/* ── Skills Tab ── */}
                {activeTab === 'skills' && (
                    <div className="space-y-5">
                        {/* Best skill callout */}
                        {bestSkill && !loading && (
                            <div className="flex items-center gap-3 rounded-2xl bg-brand-primary/5 border border-brand-primary/20 px-4 py-3">
                                <i className="fas fa-trophy text-amber-400 text-sm" />
                                <span className="text-sm text-light-text dark:text-dark-text">
                                    أفضل مهارة: <strong className="text-brand-primary">{SKILL_LABEL(bestSkill[0])}</strong>
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary"> — {Math.round(bestSkill[1].usedRate * 100)}% معدل استخدام</span>
                                </span>
                            </div>
                        )}

                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-36 rounded-2xl bg-light-bg dark:bg-dark-bg animate-pulse" />
                                ))}
                            </div>
                        ) : Object.keys(skillsReport).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <i className="fas fa-brain text-4xl text-light-text-secondary/30 dark:text-dark-text-secondary/30" />
                                <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">لا توجد بيانات في هذه الفترة</p>
                                <p className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60">استخدم ميزات AI وستظهر هنا تلقائياً</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(skillsReport)
                                    .sort((a, b) => b[1].totalExecutions - a[1].totalExecutions)
                                    .map(([skillType, stats]) => (
                                        <SkillCard key={skillType} skillType={skillType} stats={stats} />
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Executions Tab ── */}
                {activeTab === 'executions' && (
                    <div className="space-y-3">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-16 rounded-2xl bg-light-bg dark:bg-dark-bg animate-pulse" />
                            ))
                        ) : executions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <i className="fas fa-history text-4xl text-light-text-secondary/30 dark:text-dark-text-secondary/30" />
                                <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">لا توجد تنفيذات بعد</p>
                            </div>
                        ) : (
                            executions.map(ex => (
                                <div key={ex.id} className="surface-panel-soft rounded-2xl px-4 py-3 flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <i className={`fas ${SKILL_ICON[ex.skillType as SkillType] ?? 'fa-robot'} text-xs text-brand-secondary`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-sm font-bold text-light-text dark:text-dark-text">{SKILL_LABEL(ex.skillType)}</span>
                                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0">{timeAgo(ex.createdAt)}</span>
                                        </div>
                                        <ConfidenceBar value={ex.confidence} />
                                        {ex.rawOutput && (
                                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-1.5 line-clamp-2 leading-relaxed">{ex.rawOutput}</p>
                                        )}
                                    </div>
                                    <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${ex.brandPolicyPassed ? 'bg-emerald-400' : 'bg-rose-400'}`} title={ex.brandPolicyPassed ? 'اجتاز سياسة البراند' : 'لم يجتز السياسة'} />
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── Knowledge Tab ── */}
                {activeTab === 'knowledge' && (
                    <div className="space-y-4">
                        {/* Shortcut to BrandKnowledgePage */}
                        {onNavigate && (
                            <button
                                onClick={() => onNavigate('brand-knowledge')}
                                className="w-full bg-dark-card border border-dark-border rounded-2xl p-5 text-right hover:border-brand-primary/40 transition-all group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <i className="fas fa-book-open text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm">قاعدة المعرفة</h3>
                                        <p className="text-[11px] text-dark-text-secondary">المنتجات، الأسئلة، السياسات</p>
                                    </div>
                                </div>
                                <p className="text-xs text-dark-text-secondary leading-relaxed">
                                    أضف معلومات براندك لتحسين دقة الذكاء الاصطناعي في كل العمليات
                                </p>
                                <div className="mt-3 flex items-center gap-1 text-brand-primary text-xs font-semibold group-hover:gap-2 transition-all">
                                    <span>فتح قاعدة المعرفة</span>
                                    <i className="fas fa-arrow-left text-[10px]" />
                                </div>
                            </button>
                        )}

                        {/* Type breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {Object.entries(KNOWLEDGE_TYPE_LABELS).map(([type, label]) => (
                                <div key={type} className="surface-panel-soft rounded-2xl p-4 text-center space-y-2">
                                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center mx-auto">
                                        <i className={`fas ${KNOWLEDGE_TYPE_ICONS[type]} text-sm text-brand-secondary`} />
                                    </div>
                                    <p className="text-2xl font-black text-light-text dark:text-dark-text">{knowledgeByType[type] ?? 0}</p>
                                    <p className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Entry list */}
                        {knowledge.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <i className="fas fa-database text-4xl text-light-text-secondary/30 dark:text-dark-text-secondary/30" />
                                <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">قاعدة المعرفة فارغة</p>
                                <p className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60">أضف معلومات عن المنتجات والسياسات من صفحة هوية البراند</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {knowledge.map(entry => (
                                    <div key={entry.id} className="surface-panel-soft rounded-xl px-4 py-3 flex items-center gap-3">
                                        <i className={`fas ${KNOWLEDGE_TYPE_ICONS[entry.type]} text-xs text-brand-secondary w-4 text-center`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{entry.title}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-1">{entry.content}</p>
                                        </div>
                                        <span className="text-[10px] bg-light-bg dark:bg-dark-bg px-2 py-0.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border flex-shrink-0">
                                            {KNOWLEDGE_TYPE_LABELS[entry.type]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Trend Tab ── */}
                {activeTab === 'trend' && (() => {
                    const W = 560, H = 180;
                    const pad = { top: 16, right: 12, bottom: 32, left: 38 };
                    const plotW = W - pad.left - pad.right;
                    const plotH = H - pad.top - pad.bottom;
                    const n = trendData.length;
                    const xOf = (i: number) => pad.left + (i / (n - 1)) * plotW;
                    const yOf = (v: number) => pad.top + (1 - v) * plotH;
                    // Build polyline segments (split at gaps)
                    const segments: string[][] = [];
                    let seg: string[] = [];
                    trendData.forEach((d, i) => {
                        if (d.avg !== null) {
                            seg.push(`${xOf(i).toFixed(1)},${yOf(d.avg).toFixed(1)}`);
                        } else {
                            if (seg.length > 1) segments.push(seg);
                            seg = [];
                        }
                    });
                    if (seg.length > 1) segments.push(seg);
                    const gridLines = [0.25, 0.5, 0.75, 1.0];
                    const dotDays = trendData.filter((_, i) => i % 5 === 0 || i === n - 1);

                    return (
                        <div className="space-y-5">
                            {/* Summary cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="surface-panel-soft rounded-2xl p-4 text-center">
                                    <p className="text-2xl font-black text-brand-primary">
                                        {trendGlobalAvg !== null ? `${Math.round(trendGlobalAvg * 100)}%` : '—'}
                                    </p>
                                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mt-1">متوسط الثقة (30 يوم)</p>
                                </div>
                                <div className="surface-panel-soft rounded-2xl p-4 text-center">
                                    <p className="text-2xl font-black text-emerald-500">{trendAvgOverall.length}</p>
                                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mt-1">أيام نشاط</p>
                                </div>
                                <div className="surface-panel-soft rounded-2xl p-4 text-center">
                                    <p className="text-2xl font-black text-amber-400">{executions.length}</p>
                                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mt-1">إجمالي التنفيذات</p>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="surface-panel-soft rounded-2xl p-4">
                                <p className="text-sm font-bold text-light-text dark:text-dark-text mb-4">مسار ثقة الذكاء الاصطناعي — آخر 30 يوم</p>
                                {executions.length === 0 && !loading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                                        <i className="fas fa-chart-line text-4xl text-light-text-secondary/30 dark:text-dark-text-secondary/30" />
                                        <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">لا توجد بيانات بعد</p>
                                        <p className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60">استخدم ميزات AI وسيظهر المسار هنا</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320, maxHeight: 200 }}>
                                            {/* Grid lines */}
                                            {gridLines.map(v => (
                                                <g key={v}>
                                                    <line
                                                        x1={pad.left} y1={yOf(v)}
                                                        x2={pad.left + plotW} y2={yOf(v)}
                                                        stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
                                                    />
                                                    <text x={pad.left - 4} y={yOf(v) + 4} textAnchor="end"
                                                        className="fill-current text-light-text-secondary dark:text-dark-text-secondary"
                                                        style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>
                                                        {Math.round(v * 100)}
                                                    </text>
                                                </g>
                                            ))}
                                            {/* Zero line */}
                                            <line x1={pad.left} y1={yOf(0)} x2={pad.left + plotW} y2={yOf(0)}
                                                stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
                                            {/* Global average reference line */}
                                            {trendGlobalAvg !== null && (
                                                <line x1={pad.left} y1={yOf(trendGlobalAvg)} x2={pad.left + plotW} y2={yOf(trendGlobalAvg)}
                                                    stroke="#a78bfa" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 3" />
                                            )}
                                            {/* Area fill under polyline */}
                                            {segments.map((pts, si) => {
                                                const first = pts[0].split(',');
                                                const last = pts[pts.length - 1].split(',');
                                                const areaPath = `M${first[0]},${yOf(0)} L${pts.join(' L')} L${last[0]},${yOf(0)} Z`;
                                                return <path key={si} d={areaPath} fill="#7c3aed" fillOpacity={0.08} />;
                                            })}
                                            {/* Polyline segments */}
                                            {segments.map((pts, si) => (
                                                <polyline key={si} points={pts.join(' ')}
                                                    fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                            ))}
                                            {/* Data dots */}
                                            {trendData.map((d, i) => d.avg !== null && (
                                                <circle key={i} cx={xOf(i)} cy={yOf(d.avg)} r={2.5}
                                                    fill="#7c3aed" stroke="white" strokeWidth={1.5} />
                                            ))}
                                            {/* X-axis labels (every 5th day) */}
                                            {dotDays.map(d => {
                                                const i = trendData.indexOf(d);
                                                return (
                                                    <text key={d.date} x={xOf(i)} y={H - 4} textAnchor="middle"
                                                        className="fill-current text-light-text-secondary dark:text-dark-text-secondary"
                                                        style={{ fontSize: 8 }}>
                                                        {d.label}
                                                    </text>
                                                );
                                            })}
                                        </svg>
                                    </div>
                                )}
                                {/* Legend */}
                                {trendGlobalAvg !== null && (
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-light-border dark:border-dark-border">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-0.5 bg-violet-500 rounded" />
                                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">ثقة يومية</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-px bg-violet-400 opacity-60" style={{ borderTop: '1px dashed' }} />
                                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">المتوسط العام {Math.round(trendGlobalAvg * 100)}%</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Daily breakdown table */}
                            {trendAvgOverall.length > 0 && (
                                <div className="surface-panel-soft rounded-2xl overflow-hidden">
                                    <div className="px-4 py-3 border-b border-light-border dark:border-dark-border">
                                        <p className="text-sm font-bold text-light-text dark:text-dark-text">تفاصيل يومية</p>
                                    </div>
                                    <div className="divide-y divide-light-border dark:divide-dark-border max-h-64 overflow-y-auto">
                                        {[...trendAvgOverall].reverse().map(d => (
                                            <div key={d.date} className="px-4 py-2.5 flex items-center gap-3">
                                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-16 flex-shrink-0 font-mono">{d.date.slice(5)}</span>
                                                <div className="flex-1">
                                                    <div className="h-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                                                        <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.round((d.avg ?? 0) * 100)}%` }} />
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold tabular-nums text-violet-500 w-10 text-end">{Math.round((d.avg ?? 0) * 100)}%</span>
                                                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary w-16 text-end">{d.count} تنفيذ</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

            </PageSection>
        </PageScaffold>
    );
};
