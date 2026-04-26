import React, { useMemo } from 'react';
import { AnalyticsData, PostPerformance } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { CHANNEL_COLORS } from './analyticsHelpers';

interface ContentTabProps {
    data: AnalyticsData;
    onReviewPost: (post: PostPerformance) => void;
}

export const ContentTab: React.FC<ContentTabProps> = ({ data, onReviewPost }) => {
    const { language } = useLanguage();
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';

    const hasTopPosts = data.topPosts.length > 0;
    const hasPlatformData = Object.keys(data.platformBreakdown ?? {}).length > 0;

    const totalEngagement = data.topPosts.reduce((sum, p) => sum + p.engagement, 0);

    const platformRanking = useMemo(() =>
        Object.entries(data.platformBreakdown ?? {})
            .map(([platform, { impressions, engagement }]) => ({
                platform,
                impressions,
                engagement,
                engRate: impressions > 0 ? (engagement / impressions) * 100 : 0,
            }))
            .sort((a, b) => b.engRate - a.engRate),
        [data.platformBreakdown]
    );

    if (!hasTopPosts && !hasPlatformData) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg py-14 text-center gap-4 px-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
                    <i className="fas fa-file-lines text-2xl text-brand-primary" />
                </div>
                <div className="max-w-md">
                    <p className="text-base font-bold text-light-text dark:text-dark-text">لا توجد بيانات محتوى بعد</p>
                    <p className="mt-2 text-sm leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">
                        ابدأ بنشر محتوى على منصات السوشيال المرتبطة، ستظهر هنا قائمة أفضل المنشورات أداءً مرتبةً حسب التفاعل.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Platform performance ranking */}
            {platformRanking.length > 0 && (
                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-bold text-light-text dark:text-dark-text">
                            <i className="fas fa-trophy me-2 text-amber-500" />
                            أداء المنصات
                        </h3>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">مرتبة حسب معدل التفاعل</p>
                    </div>
                    <div className="space-y-3">
                        {platformRanking.map(({ platform, impressions, engagement, engRate }, idx) => {
                            const maxEngRate = platformRanking[0]?.engRate ?? 1;
                            return (
                                <div key={platform} className="flex items-center gap-4">
                                    <span className={`w-5 shrink-0 text-center text-xs font-black ${idx === 0 ? 'text-amber-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                        {idx + 1}
                                    </span>
                                    <div className="flex flex-1 items-center gap-3">
                                        <div className="flex w-24 shrink-0 items-center gap-2">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[platform] ?? '#6366f1' }} />
                                            <span className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{platform}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="h-2 overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${Math.max((engRate / maxEngRate) * 100, 4)}%`,
                                                        backgroundColor: CHANNEL_COLORS[platform] ?? '#6366f1',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            <span>{impressions.toLocaleString(locale)} impr.</span>
                                            <span>{engagement.toLocaleString(locale)} eng.</span>
                                            <span className="w-14 font-bold" style={{ color: CHANNEL_COLORS[platform] ?? '#6366f1' }}>
                                                {engRate.toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Top posts table */}
            {hasTopPosts && (
                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-bold text-light-text dark:text-dark-text">
                            <i className="fas fa-star me-2 text-yellow-500" />
                            أفضل المنشورات أداءً
                        </h3>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {data.topPosts.length} منشور · مرتب حسب التفاعل الكلي
                        </p>
                    </div>
                    <div className="space-y-2">
                        {data.topPosts.map((post, idx) => {
                            const share = totalEngagement > 0
                                ? ((post.engagement / totalEngagement) * 100).toFixed(1)
                                : '0';
                            return (
                                <div
                                    key={post.id}
                                    className="group flex items-center gap-4 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg px-4 py-3 transition-colors hover:border-brand-primary/40 hover:bg-light-surface dark:hover:bg-dark-surface"
                                >
                                    <span className={`w-6 shrink-0 text-center text-sm font-black ${
                                        idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-400' : 'text-light-text-secondary dark:text-dark-text-secondary'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <p className="flex-1 truncate text-sm text-light-text dark:text-dark-text">
                                        {post.content || '—'}
                                    </p>
                                    <div className="flex shrink-0 items-center gap-4 text-xs">
                                        <div className="text-right">
                                            <p className="font-bold text-light-text dark:text-dark-text">
                                                {post.engagement.toLocaleString(locale)}
                                            </p>
                                            <p className="text-light-text-secondary dark:text-dark-text-secondary">تفاعل ({share}%)</p>
                                        </div>
                                        <button
                                            onClick={() => onReviewPost(post)}
                                            className="rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-3 py-1.5 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-0 transition-all group-hover:opacity-100 hover:border-brand-primary hover:text-brand-primary"
                                        >
                                            <i className="fas fa-robot me-1 text-[10px]" />
                                            AI Review
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Content insights */}
            {hasTopPosts && (
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-4">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">أعلى منشور تفاعلاً</p>
                        <p className="mt-2 text-xl font-bold text-light-text dark:text-dark-text">
                            {(data.topPosts[0]?.engagement ?? 0).toLocaleString(locale)}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {data.topPosts[0]?.content?.slice(0, 50) ?? '—'}
                        </p>
                    </div>
                    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-4">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">متوسط التفاعل للمنشور</p>
                        <p className="mt-2 text-xl font-bold text-light-text dark:text-dark-text">
                            {data.topPosts.length > 0
                                ? Math.round(totalEngagement / data.topPosts.length).toLocaleString(locale)
                                : '—'}
                        </p>
                        <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            من أفضل {data.topPosts.length} منشور
                        </p>
                    </div>
                    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-4">
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">أفضل منصة محتوى</p>
                        <p className="mt-2 text-xl font-bold text-light-text dark:text-dark-text">
                            {platformRanking[0]?.platform ?? '—'}
                        </p>
                        <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {platformRanking[0] ? `${platformRanking[0].engRate.toFixed(2)}% معدل تفاعل` : ''}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
