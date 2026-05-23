import React, { useState, useEffect, useCallback } from 'react';
import { BrandHubProfile, NotificationType, BrandConsistencyEvaluation } from '../../types';
import { getMemoryEntries, deleteMemoryEntry, BrandMemoryEntry, MemoryType } from '../../services/brandMemoryService';
import { evaluateContentConsistency } from '../../services/geminiService';
import { getBrandSkillsReport } from '../../services/evaluationService';
import { SkillStats } from '../../types';
import { ScoreDonut } from '../shared/ScoreDonut';

interface AIMemoryTabContentProps {
    profile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
}

const SKILL_NAMES: Record<string, string> = {
    ContentGeneration:       'توليد محتوى',
    OccasionOpportunity:     'تحويل مناسبة لفرصة',
    ConversationReply:       'محرك محادثات البراند',
    CampaignBrief:           'بريف حملة تسويقية',
    MarketingPlanSuggestion: 'اقتراح خطة تسويق',
    HashtagResearch:         'بحث هاشتاقات',
    CompetitorAnalysis:      'تحليل منافس',
    ContentCalendar:         'تقويم المحتوى',
    AdCopywriting:           'كتابة نص إعلاني',
    SEOContentBrief:         'بريف محتوى SEO',
    AudienceInsight:         'تحليل الجمهور',
    BrandVoiceCheck:         'فحص صوت البراند',
    LeadQualification:       'تأهيل عميل محتمل',
    FollowUpSequence:        'سلسلة رسائل متابعة',
};

export const AIMemoryTabContent: React.FC<AIMemoryTabContentProps> = ({ profile, brandId, addNotification }) => {
    // AI Memory States
    const [memoryEntries, setMemoryEntries] = useState<BrandMemoryEntry[]>([]);
    const [isLoadingMemory, setIsLoadingMemory] = useState(false);
    const [memoryFilter, setMemoryFilter] = useState<MemoryType | 'all'>('all');

    // Consistency Evaluator States
    const [contentToEvaluate, setContentToEvaluate] = useState('');
    const [evaluationResult, setEvaluationResult] = useState<BrandConsistencyEvaluation | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);

    // Skills Performance States
    const [skillsReport, setSkillsReport] = useState<Record<string, SkillStats>>({});
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [statsDays, setStatsDays] = useState(30);

    const loadMemoryEntries = useCallback(async () => {
        setIsLoadingMemory(true);
        try {
            const entries = await getMemoryEntries(brandId);
            setMemoryEntries(entries);
        } catch {
            addNotification(NotificationType.Error, 'فشل تحميل سجل التعلّم للذاكرة');
        } finally {
            setIsLoadingMemory(false);
        }
    }, [brandId, addNotification]);

    const loadSkillStats = useCallback(async (days: number) => {
        setIsLoadingStats(true);
        try {
            const report = await getBrandSkillsReport(brandId, days);
            setSkillsReport(report);
        } catch (err) {
            console.warn('[BrandHub] skills report error:', err);
        } finally {
            setIsLoadingStats(false);
        }
    }, [brandId]);

    useEffect(() => {
        loadMemoryEntries();
    }, [loadMemoryEntries]);

    useEffect(() => {
        loadSkillStats(statsDays);
    }, [statsDays, loadSkillStats]);

    const handleEvaluateContent = async () => {
        if (!contentToEvaluate.trim()) return;
        setIsEvaluating(true);
        setEvaluationResult(null);
        try {
            const result = await evaluateContentConsistency(contentToEvaluate, profile);
            setEvaluationResult(result);
            addNotification(NotificationType.Success, '✅ تم تقييم اتساق المحتوى بنجاح');
        } catch (error) {
            addNotification(NotificationType.Error, 'فشل في تقييم المحتوى.');
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleDeleteMemory = async (entryId: string) => {
        try {
            await deleteMemoryEntry(brandId, entryId);
            setMemoryEntries(prev => prev.filter(e => e.id !== entryId));
            addNotification(NotificationType.Success, '🗑️ تم إزالة الإدخال من الذاكرة');
        } catch {
            addNotification(NotificationType.Error, 'فشل إزالة إدخال الذاكرة');
        }
    };

    const MEMORY_TYPE_CONFIG: Record<MemoryType, { label: string; icon: string; color: string }> = {
        approved_caption:     { label: 'موافق عليه',    icon: 'fa-check-circle',  color: 'text-emerald-400 bg-emerald-500/10' },
        tone_correction:      { label: 'تصحيح نبرة',   icon: 'fa-pen',           color: 'text-blue-400 bg-blue-500/10' },
        rejected_caption:     { label: 'مرفوض',        icon: 'fa-times-circle',  color: 'text-red-400 bg-red-500/10' },
        high_performing_post: { label: 'أداء عالٍ',    icon: 'fa-fire',          color: 'text-amber-400 bg-amber-500/10' },
        audience_insight:     { label: 'رؤية جمهور',   icon: 'fa-users',         color: 'text-purple-400 bg-purple-500/10' },
        avoided_topic:        { label: 'موضوع محظور',  icon: 'fa-ban',           color: 'text-orange-400 bg-orange-500/10' },
    };

    const filteredMemory = memoryFilter === 'all' ? memoryEntries : memoryEntries.filter(e => e.memoryType === memoryFilter);
    const skillEntries = Object.entries(skillsReport);
    const totalAll = skillEntries.reduce((s, [, v]) => s + v.totalExecutions, 0);
    const bestSkill = skillEntries.sort((a, b) => b[1].usedRate - a[1].usedRate)[0];

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fas fa-brain text-brand-pink animate-pulse"></i>
                    ذاكرة AI ومقياس الاتساق
                </h2>
                <p className="text-xs text-dark-text-secondary mt-0.5">مراجعة التعلّم التراكمي وتدقيق اتساق المحتوى ومستوى أداء النموذج</p>
            </div>

            {/* سجل التعلم */}
            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between gap-3 flex-wrap relative z-10">
                    <div>
                        <p className="text-sm font-bold text-white">سجل التعلّم للذكاء الاصطناعي</p>
                        <p className="text-xs text-dark-text-secondary">البيانات التي يتذكرها النموذج لضبط أسلوبه وصياغته</p>
                    </div>
                    <button onClick={loadMemoryEntries} className="text-xs text-brand-primary hover:text-brand-secondary flex items-center gap-1.5 transition-all">
                        <i className="fas fa-rotate-right text-[10px]"></i>
                        تحديث الذاكرة
                    </button>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-2 flex-wrap relative z-10">
                    {([
                        { key: 'all',               label: 'الكل' },
                        { key: 'approved_caption',  label: 'موافق عليه' },
                        { key: 'tone_correction',   label: 'تصحيح نبرة' },
                        { key: 'rejected_caption',  label: 'مرفوض' },
                        { key: 'high_performing_post', label: 'أداء عالٍ' },
                    ] as const).map(f => (
                        <button
                            key={f.key}
                            onClick={() => setMemoryFilter(f.key as MemoryType | 'all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                memoryFilter === f.key
                                    ? 'bg-gradient-to-r from-brand-pink to-brand-purple text-white shadow-md shadow-brand-pink/20 scale-[1.02]'
                                    : 'bg-slate-950/40 text-dark-text-secondary hover:border-white/20 hover:text-white border border-white/5'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Summary bar */}
                {memoryEntries.length > 0 && (
                    <div className="bg-slate-950/30 border border-white/5 rounded-xl px-4 py-3 text-xs text-dark-text-secondary relative z-10">
                        <i className="fas fa-info-circle text-brand-secondary me-1"></i>
                        تم تعلّم <strong className="text-white font-bold">{memoryEntries.length}</strong> تفصيل سلوكي —{' '}
                        {memoryEntries.filter(e => e.memoryType === 'approved_caption').length} موافق،{' '}
                        {memoryEntries.filter(e => e.memoryType === 'tone_correction').length} تصحيحات،{' '}
                        {memoryEntries.filter(e => e.memoryType === 'high_performing_post').length} أداء استثنائي.
                    </div>
                )}

                {/* Entries list */}
                {isLoadingMemory ? (
                    <div className="space-y-2 relative z-10">
                        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-950/30 rounded-xl animate-pulse border border-white/5" />)}
                    </div>
                ) : filteredMemory.length === 0 ? (
                    <div className="text-center py-10 bg-slate-950/20 rounded-xl border border-white/5 text-dark-text-secondary relative z-10">
                        <i className="fas fa-brain text-2xl opacity-20 block mb-2 text-brand-secondary/40"></i>
                        <p className="text-xs">الذاكرة خالية حالياً</p>
                        <p className="text-[10px] mt-1 opacity-70">عند التفاعل مع استوديو المحتوى وتقييم المخرجات بنعم/لا ستظهر النتائج هنا</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar relative z-10 pr-1">
                        {filteredMemory.map(entry => {
                            const cfg = MEMORY_TYPE_CONFIG[entry.memoryType] ?? { label: entry.memoryType, icon: 'fa-circle', color: 'text-gray-400 bg-gray-500/10' };
                            return (
                                <div key={entry.id} className="flex items-start gap-3 bg-slate-950/45 border border-white/5 rounded-xl p-3 hover:border-white/10 hover:bg-slate-950/60 transition-all duration-200">
                                    <span className={`flex-shrink-0 text-[9px] px-2 py-0.5 rounded-full font-bold ${cfg.color}`}>
                                        <i className={`fas ${cfg.icon} me-1`}></i>{cfg.label}
                                    </span>
                                    <p className="text-xs text-white/90 flex-1 leading-relaxed line-clamp-3">{entry.content}</p>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[9px] text-dark-text-secondary font-mono">
                                            {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('ar-EG') : '—'}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteMemory(entry.id)}
                                            className="w-7 h-7 rounded-lg bg-slate-950/50 border border-white/5 flex items-center justify-center text-dark-text-secondary hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                                            title="حذف"
                                        >
                                            <i className="fas fa-trash-alt text-[10px]"></i>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* مُقيِّم اتساق البراند */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none" />
                    <h3 className="font-bold text-white text-sm relative z-10">مُقيِّم اتساق المحتوى للبراند</h3>
                    <p className="text-xs text-dark-text-secondary relative z-10 font-medium">ضع أي نص (إعلان، كابشن، منشور، مقال) للتحقق من مدى التزامه بنبرة وهوية براندك.</p>
                    <textarea
                        value={contentToEvaluate}
                        onChange={e => setContentToEvaluate(e.target.value)}
                        rows={6}
                        placeholder="الصق المحتوى هنا للتحليل..."
                        className="w-full p-3.5 bg-slate-950/45 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-650 focus:border-brand-primary/60 focus:outline-none resize-none transition-all focus:ring-2 focus:ring-brand-primary/20 relative z-10"
                    />
                    <button 
                        onClick={handleEvaluateContent} 
                        disabled={isEvaluating || !contentToEvaluate.trim()} 
                        className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(37,99,235,0.25)] disabled:opacity-50 hover:opacity-95 transition-all text-xs font-black relative z-10 active:scale-[0.99]"
                    >
                        {isEvaluating ? (
                            <><i className="fas fa-spinner fa-spin me-1"></i> جاري التدقيق والتحليل...</>
                        ) : 'بدء تقييم الاتساق'}
                    </button>
                </div>

                <div className="flex flex-col items-center justify-center bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-2xl p-6 min-h-[220px] shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                    <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-brand-secondary/5 rounded-full blur-2xl pointer-events-none animate-pulse" />
                    {isEvaluating && (
                        <div className="text-center space-y-3 relative z-10">
                            <i className="fas fa-spinner fa-spin text-3xl text-brand-secondary"></i>
                            <p className="text-xs text-dark-text-secondary animate-pulse">يقوم AI بمسح الكلمات وفحص النبرة...</p>
                        </div>
                    )}
                    {evaluationResult && !isEvaluating && (
                        <div className="w-full flex flex-col items-center animate-fade-in-down relative z-10">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
                            <div className="relative z-10">
                                <ScoreDonut score={evaluationResult.score} />
                            </div>
                            <p className="relative z-10 text-xs text-center text-white/95 mt-5 leading-relaxed bg-slate-950/30 border border-white/5 p-4 rounded-xl w-full">{evaluationResult.feedback}</p>
                        </div>
                    )}
                    {!isEvaluating && !evaluationResult && (
                        <div className="text-center text-dark-text-secondary space-y-2.5 relative z-10">
                            <i className="fas fa-shield-halved text-3xl opacity-25 text-brand-secondary"></i>
                            <p className="text-xs font-bold text-white">نتيجة التقييم ستظهر هنا</p>
                            <p className="text-[10px] opacity-70">درجة التوافق من 100 مع تحليل أسلوبي متكامل</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Recommendations */}
            {evaluationResult && !isEvaluating && (
                <div className="bg-slate-900/35 border border-white/5 backdrop-blur-md rounded-2xl p-6 space-y-3 shadow-2xl animate-fade-in relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                    <div className="absolute -top-12 -left-12 w-32 h-32 bg-brand-secondary/5 rounded-full blur-2xl pointer-events-none" />
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5 relative z-10">
                        <i className="fas fa-wand-magic-sparkles text-brand-secondary" />
                        توصيات مقترحة لتحسين المحتوى
                    </h4>
                    <ul className="space-y-2 text-xs text-dark-text-secondary relative z-10">
                        {evaluationResult.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-white/80 bg-slate-950/20 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                                <i className="fas fa-arrow-left text-[9px] text-brand-pink mt-1.5 flex-shrink-0" />
                                <span className="leading-relaxed">{rec}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* أداء مهارات الذكاء الاصطناعي */}
            <div className="space-y-5 pt-5 border-t border-white/5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <i className="fas fa-chart-bar text-brand-pink animate-pulse" />
                            أداء مهارات الذكاء الاصطناعي
                        </h3>
                        <p className="text-xs text-dark-text-secondary mt-0.5">مدى اعتماد فريقك على مخرجات AI ومعدل التعديل والرفض</p>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950/45 border border-white/5 rounded-xl p-1 shrink-0">
                        {([7, 30, 90] as const).map(d => (
                            <button
                                key={d}
                                onClick={() => setStatsDays(d)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    statsDays === d ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'text-dark-text-secondary hover:text-white'
                                }`}
                            >
                                {d} يوم
                            </button>
                        ))}
                    </div>
                </div>

                {isLoadingStats ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-950/30 rounded-xl animate-pulse border border-white/5" />)}
                    </div>
                ) : skillEntries.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 bg-slate-900/20">
                        <i className="fas fa-chart-bar text-3xl text-dark-text-secondary mb-2 block opacity-35 text-brand-secondary" />
                        <p className="text-xs text-dark-text-secondary">لا توجد بيانات استخدام كافية حالياً</p>
                        <p className="text-[10px] text-dark-text-secondary/60 mt-1">ابدأ بتوليد المحتوى وقيّمه لبناء إحصائيات الأداء للمهارات</p>
                    </div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-xl p-4 text-center shadow-2xl relative overflow-hidden hover:border-white/10 transition-colors duration-200">
                                <p className="text-2xl font-black text-white">{totalAll}</p>
                                <p className="text-[10px] text-dark-text-secondary mt-1">إجمالي التقييمات</p>
                            </div>
                            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-xl p-4 text-center shadow-2xl relative overflow-hidden hover:border-white/10 transition-colors duration-200">
                                <p className="text-2xl font-black text-emerald-400">
                                    {totalAll > 0
                                        ? Math.round(skillEntries.reduce((s, [, v]) => s + v.usedRate * v.totalExecutions, 0) / totalAll * 100)
                                        : 0}%
                                </p>
                                <p className="text-[10px] text-dark-text-secondary mt-1">معدل الاستخدام والموافقة</p>
                            </div>
                            <div className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-xl p-4 text-center shadow-2xl relative overflow-hidden hover:border-white/10 transition-colors duration-200">
                                <p className="text-2xl font-black text-brand-secondary">
                                    {bestSkill ? (SKILL_NAMES[bestSkill[0]] ?? bestSkill[0]).split(' ')[0] : '—'}
                                </p>
                                <p className="text-[10px] text-dark-text-secondary mt-1 font-bold">المهارة الأعلى أداءً</p>
                            </div>
                        </div>

                        {/* Skills Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {skillEntries
                                .sort((a, b) => b[1].totalExecutions - a[1].totalExecutions)
                                .map(([skillType, stats]) => {
                                    const nameAr = SKILL_NAMES[skillType] ?? skillType;
                                    const usedPct   = Math.round(stats.usedRate * 100);
                                    const editedPct = Math.round(stats.editedRate * 100);
                                    const rejPct    = Math.round(stats.rejectedRate * 100);
                                    return (
                                        <div key={skillType} className="bg-slate-900/40 border border-white/5 backdrop-blur-md rounded-xl p-5 space-y-4 shadow-2xl relative overflow-hidden hover:border-white/10 transition-all duration-300">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs font-bold text-white leading-relaxed">{nameAr}</p>
                                                <span className="text-[9px] font-bold text-dark-text-secondary bg-slate-950/40 border border-white/5 px-2.5 py-1 rounded-full shrink-0">
                                                    {stats.totalExecutions} تقييم
                                                </span>
                                            </div>

                                            {/* Segmented Bar */}
                                            <div className="h-2 w-full rounded-full overflow-hidden flex gap-px bg-slate-950/60 p-[1px]">
                                                {usedPct > 0   && <div className="bg-emerald-500 rounded-full" style={{ width: `${usedPct}%` }} title={`موافقة ${usedPct}%`} />}
                                                {editedPct > 0 && <div className="bg-brand-primary rounded-full"   style={{ width: `${editedPct}%` }} title={`تعديل ${editedPct}%`} />}
                                                {rejPct > 0    && <div className="bg-rose-500 rounded-full"   style={{ width: `${rejPct}%` }} title={`رفض ${rejPct}%`} />}
                                            </div>

                                            <div className="flex items-center justify-between text-[9px] flex-wrap gap-2">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <span className="flex items-center gap-1.5 text-emerald-450">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                                        {usedPct}% موافقة
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-brand-secondary">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary inline-block" />
                                                        {editedPct}% تعديل
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-rose-450">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                                                        {rejPct}% رفض
                                                    </span>
                                                </div>
                                                {stats.averageRating > 0 && (
                                                    <span className="text-yellow-400 font-bold shrink-0">★ {stats.averageRating.toFixed(1)}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
