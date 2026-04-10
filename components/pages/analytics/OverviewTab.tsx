import React from 'react';
import { AnalyticsData, PostPerformance } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { LightweightLineChart, MetricBarList } from '../../shared/LightweightCharts';
import { MetricCard } from './analyticsHelpers';

interface OverviewTabProps {
    data: AnalyticsData;
    onReviewPost: (post: PostPerformance) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data, onReviewPost }) => {
    const { t, language } = useLanguage();
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <MetricCard title={t.analytics.totalFollowers} value={data.overallStats.totalFollowers.toLocaleString()} icon="fa-users" />
                <MetricCard title={t.analytics.impressions} value={data.overallStats.impressions.toLocaleString()} icon="fa-eye" />
                <MetricCard title={t.analytics.engagement} value={data.overallStats.engagement.toLocaleString()} icon="fa-heart" />
                <MetricCard title={t.analytics.posts} value={data.overallStats.postsPublished.toLocaleString()} icon="fa-paper-plane" />
                <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border col-span-2 md:col-span-1">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t.analytics.sentimentAnalysis}</p>
                    <div className="flex h-full items-center justify-around">
                        <span className="font-bold text-green-500">{data.overallStats.sentiment.positive}% <i className="far fa-smile" /></span>
                        <span className="font-bold text-gray-400">{data.overallStats.sentiment.neutral}% <i className="far fa-meh" /></span>
                        <span className="font-bold text-red-500">{data.overallStats.sentiment.negative}% <i className="far fa-frown" /></span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="bg-light-card dark:bg-dark-card p-5 rounded-xl border border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text mb-4">{t.analytics.followerGrowth}</h3>
                    <div className="h-[300px]">
                        <LightweightLineChart
                            data={data.followerGrowth}
                            xKey="date"
                            formatX={(value) => new Date(String(value)).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                            series={[
                                { key: 'Facebook', label: 'Facebook', color: '#2563eb' },
                                { key: 'Instagram', label: 'Instagram', color: '#e024a3' },
                                { key: 'X', label: 'X', color: '#94a3b8' },
                            ]}
                        />
                    </div>
                </div>

                <div className="bg-light-card dark:bg-dark-card p-5 rounded-xl border border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text mb-4">{t.analytics.engagementRate}</h3>
                    <MetricBarList
                        items={data.engagementRate.map((point) => ({
                            label: point.platform,
                            value: point.rate,
                            suffix: '%',
                            color:
                                point.platform === 'Facebook'
                                    ? '#2563eb'
                                    : point.platform === 'Instagram'
                                        ? '#e024a3'
                                        : point.platform === 'X'
                                            ? '#94a3b8'
                                            : '#0ea5e9',
                        }))}
                        maxValue={Math.max(...data.engagementRate.map((point) => point.rate), 10)}
                    />
                </div>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-5 rounded-xl border border-light-border dark:border-dark-border">
                <h3 className="font-bold text-light-text dark:text-dark-text mb-4">{t.analytics.topPosts}</h3>
                <div className="space-y-3">
                    {data.topPosts.map((post) => (
                        <div key={post.id} className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg flex items-center justify-between">
                            <p className="flex-1 truncate pr-4 text-sm text-light-text dark:text-dark-text">{post.content}</p>
                            <div className="flex shrink-0 items-center gap-4">
                                <span className="text-sm font-bold text-light-text dark:text-dark-text">
                                    {post.engagement.toLocaleString()} {t.analytics.engagement}
                                </span>
                                <button onClick={() => onReviewPost(post)} className="text-xs font-bold text-brand-pink hover:underline">
                                    {t.analytics.reviewAI}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
