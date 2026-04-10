/**
 * AnalyticsPage — Extended Analytics Hub
 * Tabs: Overview | Attribution | Revenue Model | AI Insights | Export Reports
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
    AIAnalyticsInsights,
    AnalyticsData,
    BrandHubProfile,
    BriefPerformanceRollup,
    CompetitiveWatchlist,
    NotificationType,
    PostStatus,
    PostPerformance,
    PublisherBrief,
    ScheduledPost,
    WatchlistPerformanceRollup,
} from '../../types';
import type { BrandAsset, BrandConnection } from '../../services/brandConnectionService';
import { useLanguage } from '../../context/LanguageContext';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import { ProviderConnectionCallout } from '../shared/ProviderConnectionCallout';
import { buildAttributionData } from './analytics/analyticsHelpers';
import { getCompetitiveWatchlists, getContentBriefs } from '../../services/competitiveIntelService';
import { getBriefPerformanceRollups, getWatchlistPerformanceRollups, getAnalyticsData } from '../../services/analyticsService';
import { ContextualAIChip } from '../shared/ContextualAIChip';
import { usePageAnalytics } from '../../hooks/page/usePageAnalytics';

const AIPostReviewModal = lazy(() => import('../AIPostReviewModal').then((module) => ({ default: module.AIPostReviewModal })));
const OverviewTab = lazy(() => import('./analytics/OverviewTab').then((module) => ({ default: module.OverviewTab })));
const AttributionTab = lazy(() => import('./analytics/AttributionTab').then((module) => ({ default: module.AttributionTab })));
const RevenueModelTab = lazy(() => import('./analytics/RevenueModelTab').then((module) => ({ default: module.RevenueModelTab })));

type AnalyticsTab = 'overview' | 'attribution' | 'revenue' | 'insights' | 'export';
type AnalyticsPeriod = '7d' | '30d' | '90d';

interface AnalyticsPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    brandProfile: BrandHubProfile;
    analyticsData: AnalyticsData;
    brandId: string;
    scheduledPosts: ScheduledPost[];
    brandConnections: BrandConnection[];
    brandAssets: BrandAsset | null;
    onNavigate: (page: string) => void;
}

const ANALYTICS_TABS: { id: AnalyticsTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'الأداء العام', icon: 'fa-chart-line' },
    { id: 'attribution', label: 'Attribution', icon: 'fa-sitemap' },
    { id: 'revenue', label: 'نموذج الإيرادات', icon: 'fa-dollar-sign' },
    { id: 'insights', label: 'AI Insights', icon: 'fa-brain' },
    { id: 'export', label: 'تصدير التقارير', icon: 'fa-file-export' },
];

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
    { value: '7d', label: '7 أيام' },
    { value: '30d', label: '30 يوم' },
    { value: '90d', label: '90 يوم' },
];

const dataPointAverage = (values: number[]) => {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const TabFallback: React.FC = () => (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-light-border bg-light-bg/60 dark:border-dark-border dark:bg-dark-bg/50">
        <div className="flex items-center gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <i className="fas fa-circle-notch fa-spin" />
            <span>Loading analytics module…</span>
        </div>
    </div>
);

const AIInsightsTab: React.FC<{ data: AnalyticsData; addNotification: (type: NotificationType, m: string) => void }> = ({ data, addNotification }) => {
    const { t } = useLanguage();
    const [insights, setInsights] = useState<AIAnalyticsInsights | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);

        try {
            const { generateAnalyticsInsights } = await import('../../services/geminiService');
            const result = await generateAnalyticsInsights(data);
            setInsights(result);
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد التحليل — حاول مرة ثانية');
        } finally {
            setLoading(false);
        }
    };

    const quickMetrics = [
        {
            label: 'Avg. Engagement Rate',
            value: `${(data.engagementRate.reduce((sum, point) => sum + point.rate, 0) / Math.max(data.engagementRate.length, 1)).toFixed(2)}%`,
            icon: 'fa-heart',
            color: 'text-pink-500',
            trend: '+2.4%',
            trendUp: true
        },
        { label: 'Total Impressions', value: data.overallStats.impressions.toLocaleString(), icon: 'fa-eye', color: 'text-blue-500', trend: '+15.2%', trendUp: true },
        { label: 'Total Followers', value: data.overallStats.totalFollowers.toLocaleString(), icon: 'fa-users', color: 'text-purple-500', trend: '+1.1%', trendUp: true },
        { 
            label: 'Positive Sentiment', 
            value: `${data.overallStats.sentiment.positive}%`, 
            icon: 'fa-smile', 
            color: 'text-green-500', 
            trend: '-0.3%', 
            trendUp: false,
            aiContext: { message: 'انخفاض وتيرة المشاعر الإيجابية ناتج عن منشورين مؤخراً. يقترح النظام الرد على التعليقات لاحتواء الوضع.', type: 'warning' as const }
        },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                {quickMetrics.map((metric) => (
                    <div key={metric.label} className="surface-panel rounded-2xl p-6 transition-all hover:-translate-y-1">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <i className={`fas ${metric.icon} ${metric.color} text-sm`} />
                                <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{metric.label}</p>
                                {metric.aiContext && (
                                    <ContextualAIChip message={metric.aiContext.message} type={metric.aiContext.type} position="bottom" />
                                )}
                            </div>
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${metric.trendUp ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                                <i className={`fas ${metric.trendUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} />
                                {metric.trend}
                            </span>
                        </div>
                        <p className="text-3xl font-black tracking-tight text-light-text dark:text-dark-text">{metric.value}</p>
                    </div>
                ))}
            </div>

            <div className="surface-panel space-y-6 rounded-3xl p-8">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-light-text dark:text-dark-text">
                        <i className="fas fa-brain text-purple-500" />
                        تحليل ذكاء اصطناعي متعمق
                    </h3>
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className={`btn min-w-[160px] rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-primary-glow transition-all hover:opacity-90 disabled:opacity-50 ${loading ? 'loading' : ''}`}
                    >
                        <i className="fas fa-magic" /> {t.analytics.generateInsightsNow}
                    </button>
                </div>

                {loading && (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="h-40 rounded-2xl bg-[#cad3df]/40 dark:bg-dark-surface skeleton" />
                        <div className="h-40 rounded-2xl bg-[#cad3df]/40 dark:bg-dark-surface skeleton" />
                        <div className="h-40 rounded-2xl bg-[#cad3df]/40 dark:bg-dark-surface skeleton" />
                    </div>
                )}

                {insights && !loading && (
                    <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-3">
                        <div className="surface-panel-soft rounded-2xl border-l-[4px] border-l-blue-500 p-6">
                            <h4 className="mb-3 flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300">
                                <i className="fas fa-chart-bar" />
                                {t.analytics.summary}
                            </h4>
                            <p className="leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">{insights.summary}</p>
                        </div>
                        <div className="surface-panel-soft rounded-2xl border-l-[4px] border-l-green-500 p-6">
                            <h4 className="mb-3 flex items-center gap-2 font-bold text-green-700 dark:text-green-300">
                                <i className="fas fa-trending-up" />
                                {t.analytics.keyTrends}
                            </h4>
                            <p className="leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">{insights.trends}</p>
                        </div>
                        <div className="surface-panel-soft rounded-2xl border-l-[4px] border-l-purple-500 p-6">
                            <h4 className="mb-3 flex items-center gap-2 font-bold text-purple-700 dark:text-purple-300">
                                <i className="fas fa-lightbulb" />
                                {t.analytics.recommendations}
                            </h4>
                            <ul className="space-y-1.5">
                                {insights.recommendations.map((recommendation, index) => (
                                    <li key={index} className="flex items-start gap-2 text-light-text-secondary dark:text-dark-text-secondary">
                                        <i className="fas fa-arrow-right mt-0.5 shrink-0 text-xs text-purple-500" />
                                        <span>{recommendation}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {!insights && !loading && (
                    <div className="py-8 text-center text-light-text-secondary dark:text-dark-text-secondary">
                        <i className="fas fa-robot mb-3 text-4xl opacity-40" />
                        <p className="text-sm">اضغط "توليد التحليل" للحصول على insights مفصلة من Gemini AI</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ExportTab: React.FC<{ data: AnalyticsData; addNotification: (type: NotificationType, m: string) => void }> = ({ data, addNotification }) => {
    const attrData = useMemo(() => buildAttributionData(data), [data]);
    const today = new Date().toISOString().split('T')[0];

    const exportCSV = (rows: Record<string, unknown>[], filename: string) => {
        if (rows.length === 0) {
            addNotification(NotificationType.Warning, 'لا توجد بيانات للتصدير بعد — اربط حساباتك أولاً.');
            return;
        }
        const headers = Object.keys(rows[0] ?? {});
        const csv = [
            headers.join(','),
            ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(',')),
        ].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        addNotification(NotificationType.Success, `✅ تم تصدير ${filename}`);
    };

    const exportJSON = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `analytics-full-${today}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        addNotification(NotificationType.Success, '✅ تم تصدير ملف JSON الكامل');
    };

    const ga4Source = data.connectedSources?.ga4;
    const searchSource = data.connectedSources?.searchConsole;
    const hasGA4 = Boolean(ga4Source);
    const hasSearch = Boolean(searchSource);
    const hasEngagement = data.engagementRate.length > 0;
    const hasFollowerGrowth = (data.followerGrowth?.length ?? 0) > 0;
    const hasAdSpend = attrData.some((c) => c.spend > 0);
    const connectedCount = [hasGA4, hasSearch, hasEngagement].filter(Boolean).length;

    const reports: {
        title: string;
        description: string;
        icon: string;
        color: string;
        available: boolean;
        badge?: string;
        action: () => void;
    }[] = [
        {
            title: 'تقرير الأداء العام',
            description: 'Followers, Impressions, Engagement, Sentiment',
            icon: 'fa-chart-bar',
            color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
            available: true,
            action: () => exportCSV([
                { المقياس: 'إجمالي المتابعين', القيمة: data.overallStats.totalFollowers },
                { المقياس: 'Impressions', القيمة: data.overallStats.impressions },
                { المقياس: 'Engagement', القيمة: data.overallStats.engagement },
                { المقياس: 'منشورات منشورة', القيمة: data.overallStats.postsPublished },
                { المقياس: 'Positive Sentiment %', القيمة: `${data.overallStats.sentiment.positive}%` },
                { المقياس: 'Neutral Sentiment %', القيمة: `${data.overallStats.sentiment.neutral}%` },
                { المقياس: 'Negative Sentiment %', القيمة: `${data.overallStats.sentiment.negative}%` },
            ], `analytics-overview-${today}.csv`),
        },
        {
            title: 'تقرير Engagement',
            description: 'Engagement Rate per Platform',
            icon: 'fa-heart',
            color: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-400',
            available: hasEngagement,
            action: () => exportCSV(data.engagementRate.map((p) => ({
                platform: p.platform,
                engagement_rate: `${p.rate}%`,
            })), `engagement-${today}.csv`),
        },
        {
            title: 'نمو المتابعين',
            description: 'Follower growth timeline per platform',
            icon: 'fa-users',
            color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
            available: hasFollowerGrowth,
            action: () => exportCSV(
                (data.followerGrowth ?? []).map((entry) => ({ date: entry.date, ...entry })),
                `follower-growth-${today}.csv`,
            ),
        },
        {
            title: 'أفضل المنشورات',
            description: `Top ${data.topPosts.length} posts by engagement`,
            icon: 'fa-star',
            color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400',
            available: data.topPosts.length > 0,
            action: () => exportCSV(data.topPosts.map((post, i) => ({
                rank: i + 1,
                post_id: post.id,
                content: post.content,
                engagement: post.engagement,
            })), `top-posts-${today}.csv`),
        },
        {
            title: 'تقرير Attribution',
            description: 'ROAS, CPA, CVR, Revenue per Channel',
            icon: 'fa-funnel-dollar',
            color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',
            available: attrData.length > 0,
            action: () => exportCSV(attrData.map((c) => ({
                channel: c.channel,
                impressions: c.impressions,
                clicks: c.clicks,
                'ctr%': `${c.ctr}%`,
                conversions: c.conversions,
                'cvr%': `${c.cvr}%`,
                spend_usd: `$${c.spend}`,
                revenue_usd: `$${c.revenue}`,
                roas: `${c.roas}x`,
                cpa_usd: `$${c.cpa}`,
            })), `attribution-${today}.csv`),
        },
        {
            title: 'تقرير Ad Spend',
            description: hasAdSpend ? 'ROAS, CPA, Spend, Revenue per channel' : 'يتطلب ربط Meta Ads أو Google Ads',
            icon: 'fa-ad',
            color: hasAdSpend
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400'
                : 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500',
            available: hasAdSpend,
            action: () => exportCSV(attrData.filter((c) => c.spend > 0).map((c) => ({
                channel: c.channel,
                spend_usd: `$${c.spend}`,
                revenue_usd: `$${c.revenue}`,
                roas: `${c.roas}x`,
                cpa_usd: `$${c.cpa}`,
                impressions: c.impressions,
                clicks: c.clicks,
            })), `ad-spend-${today}.csv`),
        },
        {
            title: 'تقرير GA4',
            description: hasGA4
                ? `Sessions, Revenue, Bounce Rate — ${ga4Source?.propertyName ?? 'GA4'}`
                : 'يتطلب ربط Google Analytics 4 من التكاملات',
            icon: 'fa-chart-area',
            badge: hasGA4 ? 'مرتبط' : 'غير مرتبط',
            color: hasGA4
                ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400'
                : 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500',
            available: hasGA4,
            action: () => exportCSV([
                { المقياس: 'Sessions', القيمة: ga4Source?.sessions ?? 0 },
                { المقياس: 'Engaged Sessions', القيمة: ga4Source?.engagedSessions ?? 0 },
                { المقياس: 'Revenue (USD)', القيمة: `$${Math.round(ga4Source?.revenue ?? 0)}` },
                { المقياس: 'Bounce Rate', القيمة: `${((ga4Source?.bounceRate ?? 0) * 100).toFixed(1)}%` },
                { المقياس: 'Avg Engagement Time (sec)', القيمة: Math.round(ga4Source?.avgEngagementTimeSec ?? 0) },
                { المقياس: 'Key Events', القيمة: ga4Source?.keyEvents ?? 0 },
                { المقياس: 'Property Name', القيمة: ga4Source?.propertyName ?? '' },
                { المقياس: 'Last Data Date', القيمة: ga4Source?.lastFactDate ?? '' },
            ], `ga4-report-${today}.csv`),
        },
        {
            title: 'تقرير Search Console',
            description: hasSearch
                ? `Clicks, Impressions, CTR, Position — ${searchSource?.siteUrl ?? ''}`
                : 'يتطلب ربط Google Search Console من التكاملات',
            icon: 'fa-search',
            badge: hasSearch ? 'مرتبط' : 'غير مرتبط',
            color: hasSearch
                ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400'
                : 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500',
            available: hasSearch,
            action: () => exportCSV([
                { المقياس: 'Clicks', القيمة: searchSource?.clicks ?? 0 },
                { المقياس: 'Impressions', القيمة: searchSource?.impressions ?? 0 },
                { المقياس: 'CTR %', القيمة: `${((searchSource?.ctr ?? 0) * 100).toFixed(2)}%` },
                { المقياس: 'Avg Position', القيمة: (searchSource?.avgPosition ?? 0).toFixed(1) },
                { المقياس: 'Indexed Pages', القيمة: searchSource?.indexedPages ?? 0 },
                { المقياس: 'Site URL', القيمة: searchSource?.siteUrl ?? '' },
                { المقياس: 'Last Data Date', القيمة: searchSource?.lastFactDate ?? '' },
            ], `search-console-${today}.csv`),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <i className="fas fa-file-export text-brand-primary" />
                        <h3 className="font-bold text-light-text dark:text-dark-text">تصدير التقارير</h3>
                        <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                            {reports.filter((r) => r.available).length}/{reports.length} متاح
                        </span>
                    </div>
                    <button
                        onClick={exportJSON}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-light-border dark:border-dark-border hover:border-brand-primary text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition-colors"
                    >
                        <i className="fas fa-code text-[10px]" />تصدير JSON
                    </button>
                </div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    ملفات CSV متوافقة مع Excel (مع دعم كامل للعربية) وGoogle Sheets
                </p>
                {connectedCount === 0 ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">
                        <i className="fas fa-triangle-exclamation text-[10px]" />
                        لم يتم ربط GA4 أو Search Console — اربطهما من صفحة التكاملات لتفعيل تقاريرهما
                    </div>
                ) : (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-xl px-3 py-2">
                        <i className="fas fa-check-circle text-[10px]" />
                        {connectedCount} مصدر بيانات مرتبط — التقارير المظلّلة تعكس بياناتك الحقيقية
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {reports.map((report) => {
                    const bgClass = report.color.split(' ').find(c => c.startsWith('bg-')) || 'bg-brand-primary/10';
                    const textClass = report.color.split(' ').find(c => c.startsWith('text-')) || 'text-brand-primary';
                    const borderBase = bgClass.replace('bg-', '');
                    
                    return (
                        <div
                            key={report.title}
                            className={`surface-panel flex items-start gap-5 rounded-3xl !border-y-0 !border-r-0 !border-l-[6px] border-${borderBase.split('-')[0]}-500 p-6 shadow-[var(--shadow-ambient)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-directional)] ${!report.available ? 'opacity-60 grayscale-[50%]' : ''}`}
                        >
                            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${bgClass} ${textClass}`}>
                                <i className={`fas ${report.icon} text-2xl`} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="truncate text-base font-bold text-light-text dark:text-dark-text">{report.title}</h4>
                                    {report.badge && (
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${report.available ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/20 text-slate-500'}`}>
                                            {report.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1.5 line-clamp-2 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">{report.description}</p>
                            </div>
                            <button
                                onClick={report.action}
                                disabled={!report.available}
                                title={!report.available ? 'يتطلب ربط الحساب أولاً' : 'تحميل CSV'}
                                className="btn flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary/10 px-4 py-2.5 text-xs font-bold text-brand-primary transition-transform hover:bg-brand-primary hover:text-white disabled:cursor-not-allowed disabled:bg-slate-500/10 disabled:text-slate-500 disabled:opacity-50"
                            >
                                <i className="fas fa-download" />
                                CSV
                            </button>
                        </div>
                    );
                })}
            </div>


            <div className="surface-panel mt-8 flex flex-col items-start gap-4 rounded-3xl p-8 shadow-[var(--shadow-ambient)] md:flex-row md:items-center md:justify-between">
                <div>
                    <h4 className="flex items-center gap-2 text-lg font-bold text-light-text dark:text-dark-text">
                        <i className="fas fa-print text-brand-secondary" />
                        طباعة التقرير الشامل
                    </h4>
                    <p className="mt-1 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">استخدم خيار الطباعة لتوليد نسخة PDF جاهزة للعرض للإدارة.</p>
                </div>
                <button onClick={() => window.print()} className="btn rounded-2xl bg-light-bg px-6 py-3 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 dark:bg-dark-bg text-light-text dark:text-dark-text">
                    <i className="fas fa-file-pdf text-red-500" /> حفظ PDF
                </button>
            </div>
        </div>
    );
};

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
    addNotification,
    brandProfile,
    analyticsData,
    brandId,
    scheduledPosts,
    brandConnections,
    brandAssets,
    onNavigate,
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
    const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
    const { data: queriedAnalytics } = usePageAnalytics(brandId);

    const [liveData, setLiveData] = useState<AnalyticsData>(analyticsData);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [postToReview, setPostToReview] = useState<PostPerformance | null>(null);
    const [savedBriefs, setSavedBriefs] = useState<PublisherBrief[]>([]);
    const [watchlists, setWatchlists] = useState<CompetitiveWatchlist[]>([]);
    const [briefRollups, setBriefRollups] = useState<BriefPerformanceRollup[]>([]);
    const [watchlistRollups, setWatchlistRollups] = useState<WatchlistPerformanceRollup[]>([]);

    // Sync from React Query when fresh data arrives (lazy fetch on mount)
    useEffect(() => { if (queriedAnalytics) setLiveData(queriedAnalytics); }, [queriedAnalytics]);

    // T2: When analyticsData prop changes (brand switch), reset to new brand's fallback
    useEffect(() => { setLiveData(analyticsData); }, [analyticsData]);

    // T2+T5: Refresh analytics on period change or manual trigger
    const refreshAnalytics = useCallback(async (selectedPeriod: AnalyticsPeriod = period) => {
        setIsRefreshing(true);
        try {
            const fresh = await getAnalyticsData(
                brandId,
                { period: selectedPeriod, platforms: [] },
                { brandConnections, brandAssets },
            );
            setLiveData(fresh);
            setLastRefreshed(new Date());
        } catch {
            addNotification(NotificationType.Error, 'فشل تحديث بيانات Analytics');
        } finally {
            setIsRefreshing(false);
        }
    }, [brandId, period, brandConnections, brandAssets, addNotification]);

    const handlePeriodChange = (newPeriod: AnalyticsPeriod) => {
        setPeriod(newPeriod);
        void refreshAnalytics(newPeriod);
    };

    const averageEngagementRate = useMemo(
        () => dataPointAverage(liveData.engagementRate.map((point) => point.rate)),
        [liveData.engagementRate]
    );

    useEffect(() => {
        let isMounted = true;

        const loadReferences = async () => {
            const [briefResults, watchlistResults, briefRollupResults, watchlistRollupResults] = await Promise.all([
                getContentBriefs(brandId),
                getCompetitiveWatchlists(brandId),
                getBriefPerformanceRollups(brandId, period),
                getWatchlistPerformanceRollups(brandId, period),
            ]);

            if (!isMounted) return;
            setSavedBriefs(briefResults);
            setWatchlists(watchlistResults);
            setBriefRollups(briefRollupResults);
            setWatchlistRollups(watchlistRollupResults);
        };

        void loadReferences();

        return () => {
            isMounted = false;
        };
    }, [brandId, period]);

    const activeTabMeta = ANALYTICS_TABS.find((tab) => tab.id === activeTab) ?? ANALYTICS_TABS[0];

    const briefRollupMap = useMemo(
        () => new Map(briefRollups.map((row) => [row.briefId, row])),
        [briefRollups],
    );

    const watchlistRollupMap = useMemo(
        () => new Map(watchlistRollups.map((row) => [row.watchlistId, row])),
        [watchlistRollups],
    );

    const briefPerformanceRows = useMemo(() => {
        return savedBriefs.map((brief) => {
            const rollup = briefRollupMap.get(brief.id);
            const linkedPosts = scheduledPosts.filter((post) => post.briefId === brief.id);
            const fallbackPublishedCount = linkedPosts.filter((post) => post.status === PostStatus.Published).length;
            const fallbackScheduledCount = linkedPosts.filter((post) => post.status === PostStatus.Scheduled).length;
            const fallbackPlatformSpread = new Set(linkedPosts.flatMap((post) => post.platforms)).size;

            return {
                brief,
                linkedPosts: rollup?.linkedPosts ?? linkedPosts.length,
                publishedCount: rollup?.publishedPosts ?? fallbackPublishedCount,
                scheduledCount: rollup?.scheduledPosts ?? fallbackScheduledCount,
                platformSpread: rollup?.platformSpread ?? fallbackPlatformSpread,
                totalImpressions: rollup?.totalImpressions ?? 0,
                totalEngagement: rollup?.totalEngagement ?? 0,
                totalClicks: rollup?.totalClicks ?? 0,
                lastPublishedAt: rollup?.lastPublishedAt,
            };
        }).sort((a, b) => {
            if (b.totalEngagement !== a.totalEngagement) return b.totalEngagement - a.totalEngagement;
            if (b.publishedCount !== a.publishedCount) return b.publishedCount - a.publishedCount;
            return b.linkedPosts - a.linkedPosts;
        });
    }, [briefRollupMap, savedBriefs, scheduledPosts]);

    const watchlistPerformanceRows = useMemo(() => {
        return watchlists.map((watchlist) => {
            const rollup = watchlistRollupMap.get(watchlist.id);
            const briefs = savedBriefs.filter((brief) => brief.watchlistId === watchlist.id);
            const linkedBriefIds = new Set(briefs.map((brief) => brief.id));
            const linkedPosts = scheduledPosts.filter((post) => post.watchlistId === watchlist.id || (post.briefId ? linkedBriefIds.has(post.briefId) : false));
            const fallbackPublishedCount = linkedPosts.filter((post) => post.status === PostStatus.Published).length;
            const fallbackScheduledCount = linkedPosts.filter((post) => post.status === PostStatus.Scheduled).length;
            const fallbackPlatformSpread = new Set(linkedPosts.flatMap((post) => post.platforms)).size;

            return {
                watchlist,
                briefsCount: rollup?.briefsCount ?? briefs.length,
                linkedPosts: rollup?.linkedPosts ?? linkedPosts.length,
                publishedCount: rollup?.publishedPosts ?? fallbackPublishedCount,
                scheduledCount: rollup?.scheduledPosts ?? fallbackScheduledCount,
                platformSpread: rollup?.platformSpread ?? fallbackPlatformSpread,
                totalImpressions: rollup?.totalImpressions ?? 0,
                totalEngagement: rollup?.totalEngagement ?? 0,
                totalClicks: rollup?.totalClicks ?? 0,
                lastPublishedAt: rollup?.lastPublishedAt,
            };
        }).sort((a, b) => b.totalEngagement - a.totalEngagement || b.publishedCount - a.publishedCount || b.linkedPosts - a.linkedPosts);
    }, [savedBriefs, scheduledPosts, watchlistRollupMap, watchlists]);

    const attributedPostsCount = useMemo(
        () => scheduledPosts.filter((post) => post.briefId || post.watchlistId).length,
        [scheduledPosts],
    );

    const attributedImpressions = useMemo(
        () => briefRollups.reduce((sum, row) => sum + row.totalImpressions, 0),
        [briefRollups],
    );
    const ga4Connection = useMemo(
        () => brandConnections.find((connection) => connection.provider === 'ga4' && connection.status !== 'disconnected') ?? null,
        [brandConnections],
    );
    const searchConsoleConnection = useMemo(
        () => brandConnections.find((connection) => connection.provider === 'search_console' && connection.status !== 'disconnected') ?? null,
        [brandConnections],
    );
    const ga4Source = liveData.connectedSources?.ga4;
    const searchSource = liveData.connectedSources?.searchConsole;

    const renderTab = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <OverviewTab data={liveData} onReviewPost={setPostToReview} />
                    </Suspense>
                );
            case 'attribution':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <AttributionTab data={liveData} />
                    </Suspense>
                );
            case 'revenue':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <RevenueModelTab data={liveData} />
                    </Suspense>
                );
            case 'insights':
                return <AIInsightsTab data={liveData} addNotification={addNotification} />;
            case 'export':
                return <ExportTab data={liveData} addNotification={addNotification} />;
            default:
                return null;
        }
    };

    return (
        <PageScaffold
            kicker="Analytics Hub"
            title={t.analytics.title}
            description="راقب القنوات، افهم الإسناد، وحوّل الأداء إلى قرارات تنفيذية من نفس المساحة."
            actions={
                <div className="flex items-center gap-2">
                    {/* T2: Period selector */}
                    <div className="flex items-center gap-1 rounded-xl border border-light-border bg-light-surface p-1 dark:border-dark-border dark:bg-dark-surface">
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handlePeriodChange(opt.value)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    period === opt.value
                                        ? 'bg-brand-primary text-white shadow-sm'
                                        : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {/* T5: Manual refresh with last-updated */}
                    <button
                        onClick={() => refreshAnalytics()}
                        disabled={isRefreshing}
                        title={`آخر تحديث: ${lastRefreshed.toLocaleTimeString('ar-EG')}`}
                        className="flex items-center gap-1.5 rounded-xl border border-light-border bg-light-surface px-3 py-2 text-xs font-semibold text-light-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-50 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-secondary"
                    >
                        <i className={`fas fa-sync-alt text-[10px] ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'جارٍ التحديث...' : 'تحديث'}
                    </button>
                </div>
            }
            stats={[
                { label: t.analytics.impressions, value: liveData.overallStats.impressions.toLocaleString() },
                { label: t.analytics.engagement, value: liveData.overallStats.engagement.toLocaleString() },
                { label: t.analytics.posts, value: liveData.overallStats.postsPublished.toLocaleString() },
                { label: t.analytics.engagementRate, value: `${averageEngagementRate.toFixed(2)}%`, tone: 'text-brand-primary' },
            ]}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <ProviderConnectionCallout
                    title="GA4"
                    description="Ø®ØµØ§Ø¦Øµ Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø© Ù„Ù„Ø¨Ø±Ø§Ù†Ø¯ ÙˆØ§Ù„ØªÙŠ ÙŠØ¬Ø¨ Ø£Ù† ØªØ®Ø¯Ù… Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ± ÙˆØ§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠØ©."
                    connection={ga4Connection}
                    brandAssets={brandAssets}
                    emptyTitle="Ù„Ø§ ØªÙˆØ¬Ø¯ Ø®Ø§ØµÙŠØ© GA4 Ù…Ø­ÙÙˆØ¸Ø© Ø¨Ø¹Ø¯"
                    emptyDescription="Ø§Ø±Ø¨Ø· Google Analytics 4 Ù…Ù† Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª Ù„Ø­ÙØ¸ Ø§Ù„Ø®ØµØ§Ø¦Øµ ÙˆØ¥Ø¸Ù‡Ø§Ø± Ø­Ø§Ù„Ø© Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø© Ù‡Ù†Ø§."
                    primaryActionLabel="ÙØªØ­ Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª"
                    onPrimaryAction={() => onNavigate('integrations')}
                    secondaryActionLabel="ÙØªØ­ Analytics"
                    onSecondaryAction={() => onNavigate('analytics')}
                />
                <ProviderConnectionCallout
                    title="Search Console"
                    description="Ø®ØµØ§Ø¦Øµ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ø¹Ø¶ÙˆÙŠ Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ù‡Ø°Ù‡ Ø§Ù„Ø¨Ø±Ø§Ù†Ø¯ Ù„Ù„Ø¸Ù‡ÙˆØ± ÙˆØ§Ù„Ø§Ù†Ø·Ø¨Ø§Ø¹Ø§Øª ÙˆØ§Ù„Ù…ÙˆØ§Ù‚Ø¹."
                    connection={searchConsoleConnection}
                    brandAssets={brandAssets}
                    emptyTitle="Ù„Ø§ ØªÙˆØ¬Ø¯ Ø®ØµØ§Ø¦Øµ Search Console Ù…Ø­ÙÙˆØ¸Ø© Ø¨Ø¹Ø¯"
                    emptyDescription="Ø§Ø±Ø¨Ø· Search Console Ù…Ù† Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª Ù„ÙƒÙŠ ØªØ¸Ù‡Ø± Ø§Ù„Ù…ÙˆØ§Ù‚Ø¹ Ø§Ù„Ù…ÙˆØ«Ù‚Ø© ÙˆØ­Ø§Ù„Ø© Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø© ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ø´Ø§Ø´Ø©."
                    primaryActionLabel="ÙØªØ­ Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙƒØ§Ù…Ù„Ø§Øª"
                    onPrimaryAction={() => onNavigate('integrations')}
                    secondaryActionLabel="ÙØªØ­ SEO Ops"
                    onSecondaryAction={() => onNavigate('seo-ops')}
                />
            </div>

            {(ga4Source || searchSource) && (
                <PageSection
                    title="Connected Web Measurement"
                    description="Scoped metrics from the saved GA4 property and Search Console site tied to this brand connection."
                >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">GA4 sessions</p>
                            <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{(ga4Source?.sessions ?? 0).toLocaleString()}</p>
                            <p className="mt-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{ga4Source?.propertyName ?? 'No GA4 property selected'}</p>
                        </div>
                        <div className="rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">GA4 revenue</p>
                            <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">${Math.round(ga4Source?.revenue ?? 0).toLocaleString()}</p>
                            <p className="mt-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                {ga4Source ? `${(ga4Source.bounceRate * 100).toFixed(1)}% bounce rate` : 'No GA4 revenue data yet'}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Search clicks</p>
                            <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{(searchSource?.clicks ?? 0).toLocaleString()}</p>
                            <p className="mt-1 truncate text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{searchSource?.siteUrl ?? 'No Search Console site selected'}</p>
                        </div>
                        <div className="rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Search impressions</p>
                            <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{(searchSource?.impressions ?? 0).toLocaleString()}</p>
                            <p className="mt-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                {searchSource ? `CTR ${(searchSource.ctr * 100).toFixed(2)}% · Avg pos ${searchSource.avgPosition.toFixed(1)}` : 'No Search Console performance data yet'}
                            </p>
                        </div>
                    </div>
                </PageSection>
            )}

            <PageSection
                title="Brief & Watchlist Performance"
                description="Direct rollups from attributed post analytics, with fallback counts only when attribution sync has not populated metrics yet."
            >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Saved Briefs</p>
                                <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{savedBriefs.length}</p>
                            </div>
                            <div className="rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Attributed Posts</p>
                                <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{attributedPostsCount}</p>
                            </div>
                            <div className="rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Attributed Impressions</p>
                                <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{attributedImpressions.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="font-semibold text-light-text dark:text-dark-text">Top performing briefs</h3>
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Direct metrics from attributed post analytics</span>
                            </div>
                            <div className="space-y-3">
                                {briefPerformanceRows.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-light-border bg-light-bg p-4 text-sm text-light-text-secondary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary">
                                        لا توجد briefs مرتبطة بمنشورات بعد.
                                    </div>
                                ) : (
                                    briefPerformanceRows.slice(0, 5).map(({ brief, linkedPosts, publishedCount, scheduledCount, totalImpressions, totalEngagement, totalClicks, platformSpread, lastPublishedAt }) => (
                                        <div key={brief.id} className="rounded-xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">{brief.title}</p>
                                                    <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{brief.angle}</p>
                                                </div>
                                                <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">
                                                    {publishedCount} published
                                                </span>
                                            </div>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-5">
                                                <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Linked posts</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{linkedPosts}</p></div>
                                                <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Scheduled</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{scheduledCount}</p></div>
                                                <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Impressions</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{totalImpressions.toLocaleString()}</p></div>
                                                <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Engagement</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{totalEngagement.toLocaleString()}</p></div>
                                                <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Platform spread</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{platformSpread}</p></div>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                                <span>Clicks: {totalClicks.toLocaleString()}</span>
                                                <span>{lastPublishedAt ? `Last published ${new Date(lastPublishedAt).toLocaleDateString()}` : 'No published date yet'}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-semibold text-light-text dark:text-dark-text">Watchlist influence</h3>
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Rollups across briefs and posts attributed to each tracked watchlist</span>
                        </div>
                        <div className="space-y-3">
                            {watchlistPerformanceRows.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-light-border bg-light-bg p-4 text-sm text-light-text-secondary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary">
                                    لا توجد watchlists مرتبطة بـ briefs أو منشورات حتى الآن.
                                </div>
                            ) : (
                                watchlistPerformanceRows.slice(0, 5).map(({ watchlist, briefsCount, linkedPosts, publishedCount, scheduledCount, totalImpressions, totalEngagement, totalClicks, platformSpread, lastPublishedAt }) => (
                                    <div key={watchlist.id} className="rounded-xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-light-text dark:text-dark-text">{watchlist.name}</p>
                                                <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{watchlist.query}</p>
                                            </div>
                                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                {publishedCount} published
                                            </span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-3">
                                            <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Briefs</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{briefsCount}</p></div>
                                            <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Linked posts</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{linkedPosts}</p></div>
                                            <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Scheduled</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{scheduledCount}</p></div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-3">
                                            <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Impressions</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{totalImpressions.toLocaleString()}</p></div>
                                            <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Engagement</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{totalEngagement.toLocaleString()}</p></div>
                                            <div><p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Platform spread</p><p className="mt-1 font-semibold text-light-text dark:text-dark-text">{platformSpread}</p></div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                            <span>Clicks: {totalClicks.toLocaleString()}</span>
                                            <span>{lastPublishedAt ? `Last published ${new Date(lastPublishedAt).toLocaleDateString()}` : 'No published date yet'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </PageSection>

            <PageSection
                title={activeTabMeta.label}
                description="بدّل بين الأداء العام، الإسناد، نموذج الإيرادات، والتحليلات المدعومة بالذكاء الاصطناعي."
                className="overflow-hidden"
            >
                <div className="mb-6 overflow-x-auto">
                    <nav className="flex min-w-max gap-2">
                        {ANALYTICS_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                                        : 'bg-light-bg text-light-text-secondary hover:bg-light-border/60 hover:text-light-text dark:bg-dark-bg dark:text-dark-text-secondary dark:hover:bg-dark-border/70 dark:hover:text-dark-text'
                                }`}
                            >
                                <i className={`fas ${tab.icon} text-xs`} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {renderTab()}
            </PageSection>

            {postToReview && (
                <Suspense fallback={null}>
                    <AIPostReviewModal post={postToReview} onClose={() => setPostToReview(null)} brandProfile={brandProfile} />
                </Suspense>
            )}
        </PageScaffold>
    );
};
