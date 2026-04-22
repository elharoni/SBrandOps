// components/media/ReviewPanel.tsx
// Review & Approval — 3-level review system: Internal → Marketing → Client

import React, { useState, useEffect, useCallback } from 'react';
import { NotificationType, MediaProjectReview, MediaReviewLevel, MediaReviewStatus } from '../../types';
import { getProjectReviews, addProjectReview } from '../../services/mediaProjectService';
import { useLanguage } from '../../context/LanguageContext';

// ── Types ─────────────────────────────────────────────────────────────────────

const LEVELS: { id: MediaReviewLevel; ar: string; en: string; icon: string; desc_ar: string; desc_en: string }[] = [
    {
        id: 'internal',
        ar: 'مراجعة داخلية',
        en: 'Internal Review',
        icon: 'fa-users',
        desc_ar: 'التزام بالبريف، الجودة، مطابقة المقاسات',
        desc_en: 'Brief compliance, quality, format specs',
    },
    {
        id: 'marketing',
        ar: 'مراجعة التسويق',
        en: 'Marketing Review',
        icon: 'fa-chart-line',
        desc_ar: 'قوة الـ Hook، وضوح الرسالة، خدمة الـ Funnel',
        desc_en: 'Hook strength, message clarity, funnel fit',
    },
    {
        id: 'client',
        ar: 'موافقة العميل',
        en: 'Client Approval',
        icon: 'fa-circle-check',
        desc_ar: 'الموافقة النهائية من مدير البراند أو العميل',
        desc_en: 'Final approval from brand manager or client',
    },
];

const STATUS_CONFIG: Record<MediaReviewStatus, { ar: string; en: string; color: string; icon: string }> = {
    pending:           { ar: 'قيد المراجعة', en: 'Pending',           color: 'text-amber-400 bg-amber-400/10',    icon: 'fa-clock' },
    approved:          { ar: 'مُعتمد',       en: 'Approved',          color: 'text-emerald-400 bg-emerald-400/10', icon: 'fa-circle-check' },
    changes_requested: { ar: 'يحتاج تعديل', en: 'Changes Requested', color: 'text-orange-400 bg-orange-400/10',  icon: 'fa-pen' },
    rejected:          { ar: 'مرفوض',        en: 'Rejected',          color: 'text-rose-400 bg-rose-400/10',      icon: 'fa-xmark' },
};

// ── Sub-component: Level Track ────────────────────────────────────────────────

const LevelTrack: React.FC<{
    level: typeof LEVELS[number];
    reviews: MediaProjectReview[];
    ar: boolean;
    onAdd: (level: MediaReviewLevel, status: MediaReviewStatus, comment: string, reviewerName: string) => void;
    isAdding: boolean;
}> = ({ level, reviews, ar, onAdd, isAdding }) => {
    const [expanded, setExpanded] = useState(false);
    const [status, setStatus] = useState<MediaReviewStatus>('approved');
    const [comment, setComment] = useState('');
    const [reviewerName, setReviewerName] = useState('');

    const latest = reviews[0];
    const latestConfig = latest ? STATUS_CONFIG[latest.status] : null;

    const handleSubmit = () => {
        onAdd(level.id, status, comment, reviewerName);
        setComment('');
        setReviewerName('');
        setExpanded(false);
    };

    return (
        <div className={`rounded-2xl border transition-all ${
            latest?.status === 'approved'
                ? 'border-emerald-400/20 bg-emerald-400/5'
                : latest?.status === 'rejected'
                    ? 'border-rose-400/20 bg-rose-400/5'
                    : 'border-dark-border bg-dark-bg/40'
        }`}>
            {/* Level header */}
            <div
                className="flex cursor-pointer items-center gap-3 p-4"
                onClick={() => setExpanded(v => !v)}
            >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                    latest?.status === 'approved'
                        ? 'bg-emerald-400/15 text-emerald-400'
                        : latest?.status === 'rejected'
                            ? 'bg-rose-400/15 text-rose-400'
                            : 'bg-dark-card text-dark-text-secondary'
                }`}>
                    <i className={`fas ${level.icon} text-sm`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{ar ? level.ar : level.en}</p>
                    <p className="text-[11px] text-dark-text-secondary">{ar ? level.desc_ar : level.desc_en}</p>
                </div>
                <div className="flex items-center gap-2">
                    {latestConfig && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${latestConfig.color}`}>
                            <i className={`fas ${latestConfig.icon} text-[8px]`} />
                            {ar ? latestConfig.ar : latestConfig.en}
                        </span>
                    )}
                    <i className={`fas fa-chevron-down text-xs text-dark-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Existing reviews */}
            {reviews.length > 0 && expanded && (
                <div className="border-t border-dark-border/50 px-4 py-3 space-y-2">
                    {reviews.map(r => {
                        const cfg = STATUS_CONFIG[r.status];
                        return (
                            <div key={r.id} className="rounded-xl bg-dark-card p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>
                                        <i className={`fas ${cfg.icon} text-[8px]`} />
                                        {ar ? cfg.ar : cfg.en}
                                    </span>
                                    {r.reviewerName && (
                                        <span className="text-[11px] text-dark-text-secondary">{r.reviewerName}</span>
                                    )}
                                    <span className="ms-auto text-[10px] text-dark-text-secondary">
                                        {new Date(r.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                                    </span>
                                </div>
                                {r.comment && (
                                    <p className="text-xs text-white leading-relaxed">{r.comment}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add review form */}
            {expanded && (
                <div className="border-t border-dark-border/50 px-4 pb-4 pt-3 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-dark-text-secondary">
                        {ar ? 'إضافة مراجعة' : 'Add Review'}
                    </p>

                    {/* Status selector */}
                    <div className="grid grid-cols-2 gap-2">
                        {(['approved', 'changes_requested', 'rejected', 'pending'] as MediaReviewStatus[]).map(s => {
                            const cfg = STATUS_CONFIG[s];
                            return (
                                <button
                                    key={s}
                                    onClick={() => setStatus(s)}
                                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                                        status === s
                                            ? `border-current ${cfg.color}`
                                            : 'border-dark-border text-dark-text-secondary hover:text-white'
                                    }`}
                                >
                                    <i className={`fas ${cfg.icon} text-[10px]`} />
                                    {ar ? cfg.ar : cfg.en}
                                </button>
                            );
                        })}
                    </div>

                    {/* Reviewer name */}
                    <input
                        value={reviewerName}
                        onChange={e => setReviewerName(e.target.value)}
                        placeholder={ar ? 'اسم المراجع (اختياري)' : 'Reviewer name (optional)'}
                        className="w-full rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-xs text-white outline-none transition focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
                    />

                    {/* Comment */}
                    <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={3}
                        placeholder={ar ? 'تعليق أو ملاحظات التعديل...' : 'Comment or change requests...'}
                        className="w-full resize-none rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-xs text-white outline-none transition focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
                    />

                    <button
                        onClick={handleSubmit}
                        disabled={isAdding}
                        className="w-full rounded-xl bg-brand-primary/10 py-2.5 text-xs font-bold text-brand-secondary transition-colors hover:bg-brand-primary/20 disabled:opacity-50"
                    >
                        <i className={`fas ${isAdding ? 'fa-spinner fa-spin' : 'fa-paper-plane'} me-2 text-[10px]`} />
                        {ar ? 'إرسال المراجعة' : 'Submit Review'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Main Panel ────────────────────────────────────────────────────────────────

interface ReviewPanelProps {
    projectId: string;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    onAllApproved?: () => void;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({
    projectId,
    brandId,
    addNotification,
    onAllApproved,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [reviews, setReviews] = useState<MediaProjectReview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getProjectReviews(projectId);
            setReviews(data);
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل تحميل المراجعات.' : 'Failed to load reviews.');
        } finally {
            setIsLoading(false);
        }
    }, [projectId, addNotification, ar]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (
        level: MediaReviewLevel,
        status: MediaReviewStatus,
        comment: string,
        reviewerName: string,
    ) => {
        setIsAdding(true);
        try {
            const review = await addProjectReview(projectId, brandId, {
                reviewLevel: level,
                status,
                comment: comment || undefined,
                reviewerName: reviewerName || undefined,
            });
            setReviews(prev => [review, ...prev]);

            if (status === 'approved') {
                const currentReviews = [review, ...reviews];
                const allLevelsApproved = LEVELS.every(lev =>
                    currentReviews.some(r => r.reviewLevel === lev.id && r.status === 'approved'),
                );
                if (allLevelsApproved) onAllApproved?.();
            }

            addNotification(
                NotificationType.Success,
                ar ? 'تم إضافة المراجعة.' : 'Review added.',
            );
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل إضافة المراجعة.' : 'Failed to add review.');
        } finally {
            setIsAdding(false);
        }
    };

    if (isLoading) {
        return (
            <div className="py-12 text-center">
                <i className="fas fa-spinner fa-spin mb-2 block text-2xl text-brand-secondary" />
            </div>
        );
    }

    // Progress: how many levels have an approved review
    const approvedLevels = LEVELS.filter(lev =>
        reviews.some(r => r.reviewLevel === lev.id && r.status === 'approved'),
    ).length;

    return (
        <div className="space-y-4">
            {/* Progress bar */}
            <div className="rounded-xl border border-dark-border bg-dark-bg/60 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                        {ar ? 'تقدم المراجعة' : 'Review Progress'}
                    </span>
                    <span className="text-brand-secondary font-bold">
                        {approvedLevels} / {LEVELS.length}
                    </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-dark-card">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-primary to-emerald-400 transition-all duration-700"
                        style={{ width: `${(approvedLevels / LEVELS.length) * 100}%` }}
                    />
                </div>
                <div className="mt-2 flex gap-2">
                    {LEVELS.map(lev => {
                        const approved = reviews.some(r => r.reviewLevel === lev.id && r.status === 'approved');
                        return (
                            <span
                                key={lev.id}
                                className={`flex-1 text-center text-[10px] font-semibold ${approved ? 'text-emerald-400' : 'text-dark-text-secondary'}`}
                            >
                                {approved && <i className="fas fa-check me-1 text-[8px]" />}
                                {ar ? lev.ar.split(' ')[0] : lev.en.split(' ')[0]}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Level tracks */}
            {LEVELS.map(level => (
                <LevelTrack
                    key={level.id}
                    level={level}
                    reviews={reviews.filter(r => r.reviewLevel === level.id)}
                    ar={ar}
                    onAdd={handleAdd}
                    isAdding={isAdding}
                />
            ))}
        </div>
    );
};
