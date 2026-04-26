import React from 'react';
import { AnalyticsData } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { LightweightLineChart, MetricBarList } from '../../shared/LightweightCharts';
import { CHANNEL_COLORS, EmptyConnectState } from './analyticsHelpers';

interface SocialTabProps {
    data: AnalyticsData;
    period: string;
}

const PLATFORM_SERIES = [
    { key: 'Facebook', label: 'Facebook', color: CHANNEL_COLORS.Facebook },
    { key: 'Instagram', label: 'Instagram', color: CHANNEL_COLORS.Instagram },
    { key: 'X', label: 'X / Twitter', color: CHANNEL_COLORS.X },
    { key: 'TikTok', label: 'TikTok', color: CHANNEL_COLORS.TikTok },
    { key: 'LinkedIn', label: 'LinkedIn', color: CHANNEL_COLORS.LinkedIn },
    { key: 'YouTube', label: 'YouTube', color: CHANNEL_COLORS.YouTube },
];

export const SocialTab: React.FC<SocialTabProps> = ({ data, period }) => {
    const { language } = useLanguage();
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';

    const hasFollowerHistory = (data.followerGrowth?.length ?? 0) > 0;
    const hasEngagementData = data.engagementRate.length > 0;
    const hasPlatformData = Object.keys(data.platformBreakdown ?? {}).length > 0;

    // Detect which platforms have history data
    const activeSeries = PLATFORM_SERIES.filter(s =>
        (data.followerGrowth ?? []).some(entry => entry[s.key] !== undefined)
    );

    const platformBreakdownRows = Object.entries(data.platformBreakdown ?? {})
        .map(([platform, { impressions, engagement }]) => ({
            platform,
            impressions,
            engagement,
            engRate: impressions > 0 ? ((engagement / impressions) * 100).toFixed(2) : '0.00',
        }))
        .sort((a, b) => b.engagement - a.engagement);

    if (!hasFollowerHistory && !hasEngagementData && !hasPlatformData) {
        return (
            <EmptyConnectState
                icon="fa-hashtag"
                title="لا توجد بيانات سوشيال بعد"
                description="ابدأ بنشر محتوى على منصات التواصل الاجتماعي المرتبطة لتظهر هنا بيانات المتابعين والتفاعل والوصول."
                providers={[
                    { label: 'Facebook', icon: 'fa-facebook', color: 'text-blue-500 bg-blue-500/10' },
                    { label: 'Instagram', icon: 'fa-instagram', color: 'text-pink-500 bg-pink-500/10' },
                    { label: 'TikTok', icon: 'fa-tiktok', color: 'text-cyan-500 bg-cyan-500/10' },
                    { label: 'LinkedIn', icon: 'fa-linkedin', color: 'text-blue-600 bg-blue-600/10' },
                ]}
            />
        );
    }

    return (
        <div className="space-y-6">

            {/* Follower growth chart */}
            {hasFollowerHistory ? (
                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-light-text dark:text-dark-text">
                                <i className="fas fa-users me-2 text-violet-500" />
                                نمو المتابعين
                            </h3>
                            <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                مصدر: follower_history — لقطات يومية/أسبوعية
                            </p>
                        </div>
                        <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
                            {data.overallStats.totalFollowers.toLocaleString(locale)} إجمالي
                        </span>
                    </div>
                    <div className="h-[280px]">
                        <LightweightLineChart
                            data={data.followerGrowth}
                            xKey="date"
                            formatX={(value) =>
                                new Date(String(value)).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
                            }
                            series={activeSeries.length > 0 ? activeSeries : PLATFORM_SERIES.slice(0, 2)}
                        />
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-6 text-center">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <i className="fas fa-clock me-2 opacity-60" />
                        بيانات نمو المتابعين ستظهر بعد المزامنة الأولى عبر analytics-aggregator.
                    </p>
                </div>
            )}

            {/* Engagement rate + platform breakdown */}
            <div className="grid gap-4 md:grid-cols-2">

                {/* Engagement rate bar chart */}
                {hasEngagementData && (
                    <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                        <h3 className="mb-4 font-bold text-light-text dark:text-dark-text">
                            <i className="fas fa-heart me-2 text-rose-500" />
                            معدل التفاعل بالمنصة
                        </h3>
                        <MetricBarList
                            items={[...data.engagementRate]
                                .sort((a, b) => b.rate - a.rate)
                                .map(p => ({
                                    label: p.platform,
                                    value: p.rate,
                                    suffix: '%',
                                    color: CHANNEL_COLORS[p.platform] ?? '#6366f1',
                                }))}
                            maxValue={Math.max(...data.engagementRate.map(p => p.rate), 0.1)}
                        />
                        <p className="mt-3 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                            محسوب: (engagement / impressions) × 100 لكل منصة
                        </p>
                    </div>
                )}

                {/* Platform summary table */}
                {hasPlatformData && (
                    <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                        <h3 className="mb-4 font-bold text-light-text dark:text-dark-text">
                            <i className="fas fa-chart-bar me-2 text-blue-500" />
                            توزيع الأداء بالمنصة
                        </h3>
                        <div className="space-y-2">
                            {platformBreakdownRows.map(({ platform, impressions, engagement, engRate }) => (
                                <div
                                    key={platform}
                                    className="flex items-center justify-between rounded-xl bg-light-bg dark:bg-dark-bg px-3 py-2.5 text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: CHANNEL_COLORS[platform] ?? '#6366f1' }}
                                        />
                                        <span className="font-semibold text-light-text dark:text-dark-text">{platform}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-light-text-secondary dark:text-dark-text-secondary">
                                        <span>{impressions.toLocaleString(locale)} impr.</span>
                                        <span>{engagement.toLocaleString(locale)} eng.</span>
                                        <span className="font-bold" style={{ color: CHANNEL_COLORS[platform] ?? '#6366f1' }}>
                                            {engRate}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Totals summary */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    {
                        label: 'إجمالي المتابعين',
                        value: data.overallStats.totalFollowers.toLocaleString(locale),
                        icon: 'fa-users',
                        color: 'text-violet-500',
                        bg: 'bg-violet-500/10',
                        source: 'social_accounts',
                    },
                    {
                        label: 'Impressions',
                        value: data.overallStats.impressions.toLocaleString(locale),
                        icon: 'fa-eye',
                        color: 'text-blue-500',
                        bg: 'bg-blue-500/10',
                        source: 'post_analytics + snapshots',
                    },
                    {
                        label: 'التفاعل',
                        value: data.overallStats.engagement.toLocaleString(locale),
                        icon: 'fa-heart',
                        color: 'text-rose-500',
                        bg: 'bg-rose-500/10',
                        source: 'post_analytics',
                    },
                ].map(({ label, value, icon, color, bg, source }) => (
                    <div key={label} className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-4">
                        <div className="flex items-center gap-2">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                                <i className={`fas ${icon} text-sm ${color}`} />
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{value}</p>
                        <p className="mt-0.5 text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-70">{source}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
