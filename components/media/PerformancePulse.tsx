// components/media/PerformancePulse.tsx
// Learning Loop — Campaign Debrief + Performance Tracking

import React, { useState, useEffect, useCallback } from 'react';
import { NotificationType, MediaProject, MediaProjectPiece, MediaCampaignInsight, BrandHubProfile } from '../../types';
import { getProjectInsights, saveProjectInsights } from '../../services/mediaProjectService';
import { useLanguage } from '../../context/LanguageContext';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PerformancePulseProps {
    project: MediaProject;
    pieces: MediaProjectPiece[];
    brandProfile: BrandHubProfile;
    addNotification: (type: NotificationType, message: string) => void;
    onStartNextCampaign?: () => void;
}

// ── Score ring ────────────────────────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
    const r = 28;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';

    return (
        <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="-rotate-90" width="80" height="80">
                <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-dark-border" />
                <circle
                    cx="40" cy="40" r={r} fill="none" strokeWidth="6"
                    stroke={color} strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-lg font-black text-white leading-none">{score}</span>
                <span className="text-[9px] text-dark-text-secondary">/100</span>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const PerformancePulse: React.FC<PerformancePulseProps> = ({
    project,
    pieces,
    brandProfile,
    addNotification,
    onStartNextCampaign,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [insight, setInsight]       = useState<MediaCampaignInsight | null>(null);
    const [isLoading, setIsLoading]   = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    const publishedPieces = pieces.filter(p => p.status === 'published');
    const masterPieces    = pieces.filter(p => p.isMaster);
    const variantPieces   = pieces.filter(p => !p.isMaster);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getProjectInsights(project.id);
            setInsight(data);
        } catch {
            // non-critical
        } finally {
            setIsLoading(false);
        }
    }, [project.id]);

    useEffect(() => { load(); }, [load]);

    const handleGenerateDebrief = async () => {
        setIsGenerating(true);
        try {
            const { generateCampaignDebrief } = await import('../../services/geminiService');
            const result = await generateCampaignDebrief(
                project.title,
                project.brief ?? null,
                pieces.map(p => ({
                    title: p.title,
                    format: p.format,
                    variantLabel: p.variantLabel,
                    status: p.status,
                    isMaster: p.isMaster,
                })),
                brandProfile,
            );

            const saved = await saveProjectInsights(project.id, project.brandId, {
                ...result,
                piecesSummary: pieces.map(p => ({
                    id: p.id,
                    title: p.title,
                    format: p.format,
                    status: p.status,
                })),
            });
            setInsight(saved);
            addNotification(NotificationType.Success, ar ? 'تم توليد التقرير.' : 'Debrief generated.');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل توليد التقرير.' : 'Debrief failed.');
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Stats strip ───────────────────────────────────────────────────────────

    const stats = [
        { icon: 'fa-layer-group',  color: 'text-brand-secondary', val: pieces.length,         labelAr: 'قطعة',          labelEn: 'Pieces' },
        { icon: 'fa-star',         color: 'text-amber-400',       val: masterPieces.length,   labelAr: 'ماستر',         labelEn: 'Master' },
        { icon: 'fa-code-branch',  color: 'text-purple-400',      val: variantPieces.length,  labelAr: 'نسخة',          labelEn: 'Variants' },
        { icon: 'fa-paper-plane',  color: 'text-emerald-400',     val: publishedPieces.length, labelAr: 'تم النشر',     labelEn: 'Published' },
    ];

    return (
        <div className="space-y-5">

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-2">
                {stats.map(s => (
                    <div key={s.labelEn} className="flex flex-col items-center gap-1.5 rounded-2xl border border-dark-border bg-dark-bg/60 py-3">
                        <i className={`fas ${s.icon} text-base ${s.color}`} />
                        <span className="text-lg font-black text-white leading-none">{s.val}</span>
                        <span className="text-[10px] text-dark-text-secondary">{ar ? s.labelAr : s.labelEn}</span>
                    </div>
                ))}
            </div>

            {/* Pieces breakdown */}
            <div className="rounded-2xl border border-dark-border bg-dark-bg/40">
                <div className="border-b border-dark-border px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                        {ar ? 'حالة المخرجات' : 'Output Status'}
                    </p>
                </div>
                <div className="divide-y divide-dark-border/50">
                    {pieces.map(piece => {
                        const isPub = piece.status === 'published';
                        return (
                            <div key={piece.id} className="flex items-center gap-3 px-4 py-2.5">
                                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] ${
                                    piece.isMaster
                                        ? 'bg-amber-400/10 text-amber-400'
                                        : 'bg-purple-400/10 text-purple-400'
                                }`}>
                                    <i className={`fas ${piece.isMaster ? 'fa-star' : 'fa-code-branch'}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-white">{piece.title}</p>
                                    {piece.format && (
                                        <p className="text-[10px] text-dark-text-secondary">{piece.format}</p>
                                    )}
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    isPub
                                        ? 'bg-emerald-400/10 text-emerald-400'
                                        : piece.status === 'approved'
                                            ? 'bg-blue-400/10 text-blue-400'
                                            : 'bg-dark-card text-dark-text-secondary'
                                }`}>
                                    <i className={`fas ${isPub ? 'fa-check' : 'fa-clock'} text-[8px]`} />
                                    {isPub ? (ar ? 'منشور' : 'Published') : piece.status}
                                </span>
                            </div>
                        );
                    })}
                    {pieces.length === 0 && (
                        <div className="py-6 text-center text-xs text-dark-text-secondary">
                            {ar ? 'لا توجد قطع بعد.' : 'No pieces yet.'}
                        </div>
                    )}
                </div>
            </div>

            {/* AI Debrief */}
            {isLoading ? (
                <div className="py-8 text-center">
                    <i className="fas fa-spinner fa-spin text-xl text-brand-secondary" />
                </div>
            ) : insight ? (
                <div className="space-y-3">
                    {/* Score + header */}
                    <div className="flex items-center gap-4 rounded-2xl border border-dark-border bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 p-4">
                        <ScoreRing score={insight.creativeScore} />
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                                {ar ? 'تقرير الحملة الإبداعي' : 'Creative Debrief'}
                            </p>
                            <p className="mt-0.5 text-sm font-bold text-white">
                                {ar ? 'الدرجة الإبداعية' : 'Creative Score'}
                            </p>
                            <p className="text-[11px] text-dark-text-secondary">
                                {new Date(insight.generatedAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                            </p>
                        </div>
                        <button
                            onClick={handleGenerateDebrief}
                            disabled={isGenerating}
                            className="ms-auto flex items-center gap-1.5 rounded-xl border border-dark-border px-3 py-1.5 text-[11px] font-semibold text-dark-text-secondary transition-colors hover:text-white disabled:opacity-50"
                        >
                            <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-sync-alt'} text-[9px]`} />
                            {ar ? 'تحديث' : 'Refresh'}
                        </button>
                    </div>

                    {/* What worked */}
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                        <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-400">
                            <i className="fas fa-thumbs-up text-[10px]" />
                            {ar ? 'ما الذي نجح؟' : 'What Worked'}
                        </p>
                        <p className="text-sm leading-relaxed text-white">{insight.whatWorked}</p>
                    </div>

                    {/* What to improve */}
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                        <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-400">
                            <i className="fas fa-lightbulb text-[10px]" />
                            {ar ? 'ما الذي يمكن تحسينه؟' : 'What to Improve'}
                        </p>
                        <p className="text-sm leading-relaxed text-white">{insight.whatToImprove}</p>
                    </div>

                    {/* Next campaign recommendation */}
                    <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
                        <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                            <i className="fas fa-arrow-trend-up text-[10px]" />
                            {ar ? 'توصية للمشروع القادم' : 'Next Campaign Recommendation'}
                        </p>
                        <p className="text-sm leading-relaxed text-white">{insight.nextCampaignRecommendation}</p>
                    </div>

                    {/* CTA */}
                    {onStartNextCampaign && (
                        <button
                            onClick={onStartNextCampaign}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-3.5 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5"
                        >
                            <i className="fas fa-wand-magic-sparkles text-xs" />
                            {ar ? 'ابدأ المشروع القادم بهذه الدروس' : 'Start Next Campaign with These Insights'}
                        </button>
                    )}
                </div>
            ) : (
                /* No debrief yet */
                <div className="rounded-2xl border border-dashed border-dark-border bg-dark-bg/40 p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
                        <i className="fas fa-brain text-2xl text-brand-secondary" />
                    </div>
                    <p className="mb-1 font-bold text-white">
                        {ar ? 'حلل حملتك بالذكاء الاصطناعي' : 'Analyse Your Campaign with AI'}
                    </p>
                    <p className="mb-5 text-xs text-dark-text-secondary">
                        {ar
                            ? 'يولد AI تقريرًا عن ما نجح وما يحسّن ويقترح المشروع القادم.'
                            : 'AI generates a debrief on what worked, what to improve, and what to do next.'}
                    </p>
                    <button
                        onClick={handleGenerateDebrief}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                        <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-xs`} />
                        {isGenerating
                            ? (ar ? 'جارٍ التحليل...' : 'Analysing...')
                            : (ar ? 'توليد تقرير الحملة' : 'Generate Campaign Debrief')}
                    </button>
                </div>
            )}
        </div>
    );
};
