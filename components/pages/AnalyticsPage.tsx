/**
 * AnalyticsPage — Analytics Hub
 * Tabs: Overview | Social | Ads | Website | SEO | Content | AI Insights | Export
 *
 * Data rules:
 * - All metric values come from real DB queries (analyticsService.ts)
 * - previousPeriodStats drives trend arrows — no hardcoded percentages
 * - Empty states shown when no data/connection exists
 * - Tokens never exposed to this component
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
import { calculateTrend, TrendBadge } from './analytics/analyticsHelpers';
import { getCompetitiveWatchlists, getContentBriefs } from '../../services/competitiveIntelService';
import { getBriefPerformanceRollups, getWatchlistPerformanceRollups, getAnalyticsData } from '../../services/analyticsService';
import { ContextualAIChip } from '../shared/ContextualAIChip';
import { usePageAnalytics } from '../../hooks/page/usePageAnalytics';
import { SkeletonAnalytics } from '../shared/Skeleton';

const AIPostReviewModal = lazy(() => import('../AIPostReviewModal').then((module) => ({ default: module.AIPostReviewModal })));
const OverviewTab = lazy(() => import('./analytics/OverviewTab').then((module) => ({ default: module.OverviewTab })));
const SocialTab = lazy(() => import('./analytics/SocialTab').then((module) => ({ default: module.SocialTab })));
const AdsTab = lazy(() => import('./analytics/AdsTab').then((module) => ({ default: module.AdsTab })));
const WebsiteTab = lazy(() => import('./analytics/WebsiteTab').then((module) => ({ default: module.WebsiteTab })));
const SEOTab = lazy(() => import('./analytics/SEOTab').then((module) => ({ default: module.SEOTab })));
const ContentTab = lazy(() => import('./analytics/ContentTab').then((module) => ({ default: module.ContentTab })));

type AnalyticsTab = 'overview' | 'social' | 'ads' | 'website' | 'seo' | 'content' | 'insights' | 'export';
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

const ANALYTICS_TABS: { id: AnalyticsTab; label: string; icon: string; badge?: string }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-chart-pie' },
    { id: 'social', label: 'سوشيال', icon: 'fa-hashtag' },
    { id: 'ads', label: 'الإعلانات', icon: 'fa-bullhorn' },
    { id: 'website', label: 'الموقع (GA4)', icon: 'fa-globe' },
    { id: 'seo', label: 'SEO', icon: 'fa-magnifying-glass' },
    { id: 'content', label: 'المحتوى', icon: 'fa-file-lines' },
    { id: 'insights', label: 'AI Insights', icon: 'fa-brain' },
    { id: 'export', label: 'تصدير', icon: 'fa-file-export' },
];

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
    { value: '7d', label: '7 أيام' },
    { value: '30d', label: '30 يوم' },
    { value: '90d', label: '90 يوم' },
];

const dataPointAverage = (values: number[]) => {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
};

const TabFallback: React.FC = () => <SkeletonAnalytics />;

// ── AI Insights Tab ──────────────────────────────────────────────────────────
// Trend badges now use real previousPeriodStats — no hardcoded percentages.
const AIInsightsTab: React.FC<{
    data: AnalyticsData;
    addNotification: (type: NotificationType, m: string) => void;
}> = ({ data, addNotification }) => {
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

    const prev = data.previousPeriodStats;
    const avgEngRate = dataPointAverage(data.engagementRate.map(p => p.rate));
    const prevAvgEngRate = prev && data.overallStats.impressions > 0
        ? (prev.engagement / Math.max(prev.impressions, 1)) * 100
        : null;

    // All trends derived from real data — never hardcoded
    type ChipContext = { message: string; type: 'insight' | 'warning' | 'opportunity' } | undefined;
    const quickMetrics = [
        {
            label: 'Avg. Engagement Rate',
            value: `${avgEngRate.toFixed(2)}%`,
            icon: 'fa-heart',
            color: 'text-pink-500',
            trend: prevAvgEngRate !== null ? calculateTrend(avgEngRate, prevAvgEngRate) : null,
            aiContext: undefined as ChipContext,
        },
        {
            label: 'Total Impressions',
            value: data.overallStats.impressions.toLocaleString(),
            icon: 'fa-eye',
            color: 'text-blue-500',
            trend: prev ? calculateTrend(data.overallStats.impressions, prev.impressions) : null,
            aiContext: undefined as ChipContext,
        },
        {
            label: 'Total Followers',
            value: data.overallStats.totalFollowers.toLocaleString(),
            icon: 'fa-users',
            color: 'text-purple-500',
            trend: prev ? calculateTrend(data.overallStats.totalFollowers, prev.totalFollowers) : null,
            aiContext: undefined as ChipContext,
        },
        {
            label: 'Positive Sentiment',
            value: `${data.overallStats.sentiment.positive}%`,
            icon: 'fa-smile',
            color: 'text-green-500',
            trend: null, // sentiment has no meaningful previous-period comparison yet
            aiContext: (data.overallStats.sentiment.negative > 30
                ? {
                    message: `المشاعر السلبية ${data.overallStats.sentiment.negative}% — راجع المحادثات وردّ على التعليقات لتحسين الانطباع.`,
                    type: 'warning' as const,
                }
                : undefined) as ChipContext,
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
                                    <ContextualAIChip
                                        message={metric.aiContext.message}
                                        type={metric.aiContext.type}
                                        position="bottom"
                                    />
                                )}
                            </div>
                            <TrendBadge trend={metric.trend} />
                        </div>
                        <p className="text-3xl font-black tracking-tight text-light-text dark:text-dark-text">{metric.value}</p>
                        {metric.trend === null && prev === undefined && (
                            <p className="mt-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                                لا توجد فترة مقارنة بعد
                            </p>
                        )}
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
                                {insights.recommendations.map((rec, i) => (
                                    <li key={i} className="flex items-start gap-2 text-light-text-secondary dark:text-dark-text-secondary">
                                        <i className="fas fa-arrow-right mt-0.5 shrink-0 text-xs text-purple-500" />
                                        <span>{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {!insights && !loading && (
                    <div className="py-8 text-center text-light-text-secondary dark:text-dark-text-secondary">
                        <i className="fas fa-robot mb-3 text-4xl opacity-40" />
                        <p className="text-sm">اضغط "توليد التحليل" للحصول على insights مفصلة من Gemini AI بناءً على بياناتك الحقيقية</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Export Tab ────────────────────────────────────────────────────────────────
const ExportTab: React.FC<{ data: AnalyticsData; addNotification: (type: NotificationType, m: string) => void }> = ({ data, addNotification }) => {
    const attrData = useMemo(() => buildAttributionData(data), [data]);
    const today = new Date().toISOString().split('T')[0];

    const exportCSV = (rows: Record<string, unknown>[], filename: string) => {
        if (rows.length === 0) {
            addNotification(NotificationType.Warning, 'لا توجد بيانات للتصدير — اربط حساباتك أولاً.');
            return;
        }
        const headers = Object.keys(rows[0] ?? {});
        const csv = [
            headers.join(','),
            ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
        ].join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        addNotification(NotificationType.Success, `✅ تم تصدير ${filename}`);
    };

    const exportJSON = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-full-${today}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addNotification(NotificationType.Success, '✅ تم تصدير ملف JSON الكامل');
    };

    const ga4Source = data.connectedSources?.ga4;
    const searchSource = data.connectedSources?.searchConsole;
    const hasGA4 = Boolean(ga4Source);
    const hasSearch = Boolean(searchSource);
    const hasEngagement = data.engagementRate.length > 0;
    const hasFollowerGrowth = (data.followerGrowth?.length ?? 0) > 0;
    const hasAdSpend = attrData.some((c) => (c.spend ?? 0) > 0);
    const connectedCount = [hasGA4, hasSearch, hasEngagement].filter(Boolean).length;

    const reports: {
        title: string;
        description: string;
        icon: string;
        available: boolean;
        badge?: string;
        action: () => void;
    }[] = [
        {
            title: 'تقرير الأداء العام',
            description: 'Followers, Reach, Impressions, Engagement, Sentiment',
            icon: 'fa-chart-bar',
            available: true,
            action: () => exportCSV([
                { المقياس: 'إجمالي المتابعين', القيمة: data.overallStats.totalFollowers },
                { المقياس: 'الوصول (Reach)', القيمة: data.overallStats.reach },
                { المقياس: 'Impressions', القيمة: data.overallStats.impressions },
                { المقياس: 'التفاعل', القيمة: data.overallStats.engagement },
                { المقياس: 'المنشورات', القيمة: data.overallStats.postsPublished },
                { المقياس: 'Positive Sentiment %', القيمة: `${data.overallStats.sentiment.positive}%` },
                { المقياس: 'Neutral Sentiment %', القيمة: `${data.overallStats.sentiment.neutral}%` },
                { المقياس: 'Negative Sentiment %', القيمة: `${data.overallStats.sentiment.negative}%` },
            ], `analytics-overview-${today}.csv`),
        },
        {
            title: 'تقرير Engagement',
            description: 'Engagement Rate per Platform',
            icon: 'fa-heart',
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
            description: 'Impressions, Engagement, Engagement Rate per Channel',
            icon: 'fa-sitemap',
            available: attrData.length > 0,
            action: () => exportCSV(attrData.map((c) => ({
                channel: c.channel,
                impressions: c.impressions,
                engagement: c.engagement,
                'engagement_rate%': `${c.engagementRate}%`,
                spend_usd: c.spend != null ? `$${c.spend}` : '—',
                revenue_usd: c.revenue != null ? `$${c.revenue}` : '—',
                roas: c.roas != null ? `${c.roas}x` : '—',
                cpa_usd: c.cpa != null ? `$${c.cpa}` : '—',
            })), `attribution-${today}.csv`),
        },
        {
            title: 'تقرير Ad Spend',
            description: hasAdSpend ? 'ROAS, CPA, Spend, Revenue per channel' : 'يتطلب ربط Meta Ads أو Google Ads',
            icon: 'fa-ad',
            available: hasAdSpend,
            action: () => exportCSV(attrData.filter((c) => (c.spend ?? 0) > 0).map((c) => ({
                channel: c.channel,
                spend_usd: c.spend != null ? `$${c.spend}` : '—',
                revenue_usd: c.revenue != null ? `$${c.revenue}` : '—',
                roas: c.roas != null ? `${c.roas}x` : '—',
                cpa_usd: c.cpa != null ? `$${c.cpa}` : '—',
                impressions: c.impressions,
            })), `ad-spend-${today}.csv`),
        },
        {
            title: 'تقرير GA4',
            description: hasGA4
                ? `Sessions, Revenue, Bounce Rate — ${ga4Source?.propertyName ?? 'GA4'}`
                : 'يتطلب ربط Google Analytics 4 من التكاملات',
            icon: 'fa-chart-area',
            badge: hasGA4 ? 'مرتبط' : 'غير مرتبط',
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
            icon: 'fa-magnifying-glass',
            badge: hasSearch ? 'مرتبط' : 'غير مرتبط',
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {reports.map((report) => (
                    <div
                        key={report.title}
                        className={`surface-panel flex items-start gap-4 rounded-2xl p-5 transition-all hover:-translate-y-1 ${!report.available ? 'opacity-60 grayscale-[50%]' : ''}`}
                    >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
                            <i className={`fas ${report.icon} text-xl text-brand-primary`} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h4 className="truncate text-sm font-bold text-light-text dark:text-dark-text">{report.title}</h4>
                                {report.badge && (
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${report.available ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/20 text-slate-500'}`}>
                                        {report.badge}
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">{report.description}</p>
                        </div>
                        <button
                            onClick={report.action}
                            disabled={!report.available}
                            title={!report.available ? 'يتطلب ربط الحساب أولاً' : 'تحميل CSV'}
                            className="btn flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-primary/10 px-3 py-2 text-xs font-bold text-brand-primary transition-all hover:bg-brand-primary hover:text-white disabled:cursor-not-allowed disabled:bg-slate-500/10 disabled:text-slate-500 disabled:opacity-50"
                        >
                            <i className="fas fa-download text-[10px]" />
                            CSV
                        </button>
                    </div>
                ))}
            </div>

            <div className="surface-panel flex flex-col items-start gap-4 rounded-2xl p-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <h4 className="flex items-center gap-2 text-base font-bold text-light-text dark:text-dark-text">
                        <i className="fas fa-print text-brand-secondary" />
                        طباعة التقرير الشامل
                    </h4>
                    <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">استخدم خيار الطباعة لتوليد نسخة PDF جاهزة للعرض للإدارة.</p>
                </div>
                <button onClick={() => window.print()} className="btn rounded-xl bg-light-bg px-5 py-2.5 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 dark:bg-dark-bg text-light-text dark:text-dark-text">
                    <i className="fas fa-file-pdf text-red-500" /> حفظ PDF
                </button>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
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

    // Sync from React Query fresh data
    useEffect(() => { if (queriedAnalytics) setLiveData(queriedAnalytics); }, [queriedAnalytics]);

    // Reset when brand switches
    useEffect(() => { setLiveData(analyticsData); }, [analyticsData]);

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
        () => dataPointAverage(liveData.engagementRate.map((p) => p.rate)),
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

        return () => { isMounted = false; };
    }, [brandId, period]);

    const activeTabMeta = ANALYTICS_TABS.find((tab) => tab.id === activeTab) ?? ANALYTICS_TABS[0];

    const briefRollupMap = useMemo(() => new Map(briefRollups.map((r) => [r.briefId, r])), [briefRollups]);
    const watchlistRollupMap = useMemo(() => new Map(watchlistRollups.map((r) => [r.watchlistId, r])), [watchlistRollups]);

    const briefPerformanceRows = useMemo(() => {
        return savedBriefs.map((brief) => {
            const rollup = briefRollupMap.get(brief.id);
            const linkedPosts = scheduledPosts.filter((p) => p.briefId === brief.id);
            return {
                brief,
                linkedPosts: rollup?.linkedPosts ?? linkedPosts.length,
                publishedCount: rollup?.publishedPosts ?? linkedPosts.filter((p) => p.status === PostStatus.Published).length,
                scheduledCount: rollup?.scheduledPosts ?? linkedPosts.filter((p) => p.status === PostStatus.Scheduled).length,
                platformSpread: rollup?.platformSpread ?? new Set(linkedPosts.flatMap((p) => p.platforms)).size,
                totalImpressions: rollup?.totalImpressions ?? 0,
                totalEngagement: rollup?.totalEngagement ?? 0,
                totalClicks: rollup?.totalClicks ?? 0,
                lastPublishedAt: rollup?.lastPublishedAt,
            };
        }).sort((a, b) =>
            b.totalEngagement - a.totalEngagement ||
            b.publishedCount - a.publishedCount ||
            b.linkedPosts - a.linkedPosts
        );
    }, [briefRollupMap, savedBriefs, scheduledPosts]);

    const watchlistPerformanceRows = useMemo(() => {
        return watchlists.map((watchlist) => {
            const rollup = watchlistRollupMap.get(watchlist.id);
            const briefs = savedBriefs.filter((b) => b.watchlistId === watchlist.id);
            const linkedBriefIds = new Set(briefs.map((b) => b.id));
            const linkedPosts = scheduledPosts.filter((p) =>
                p.watchlistId === watchlist.id || (p.briefId ? linkedBriefIds.has(p.briefId) : false)
            );
            return {
                watchlist,
                briefsCount: rollup?.briefsCount ?? briefs.length,
                linkedPosts: rollup?.linkedPosts ?? linkedPosts.length,
                publishedCount: rollup?.publishedPosts ?? linkedPosts.filter((p) => p.status === PostStatus.Published).length,
                scheduledCount: rollup?.scheduledPosts ?? linkedPosts.filter((p) => p.status === PostStatus.Scheduled).length,
                platformSpread: rollup?.platformSpread ?? new Set(linkedPosts.flatMap((p) => p.platforms)).size,
                totalImpressions: rollup?.totalImpressions ?? 0,
                totalEngagement: rollup?.totalEngagement ?? 0,
                totalClicks: rollup?.totalClicks ?? 0,
                lastPublishedAt: rollup?.lastPublishedAt,
            };
        }).sort((a, b) => b.totalEngagement - a.totalEngagement || b.publishedCount - a.publishedCount);
    }, [savedBriefs, scheduledPosts, watchlistRollupMap, watchlists]);

    const attributedPostsCount = useMemo(
        () => scheduledPosts.filter((p) => p.briefId || p.watchlistId).length,
        [scheduledPosts],
    );

    const attributedImpressions = useMemo(
        () => briefRollups.reduce((sum, r) => sum + r.totalImpressions, 0),
        [briefRollups],
    );

    const ga4Connection = useMemo(
        () => brandConnections.find((c) => c.provider === 'ga4' && c.status !== 'disconnected') ?? null,
        [brandConnections],
    );
    const searchConsoleConnection = useMemo(
        () => brandConnections.find((c) => c.provider === 'search_console' && c.status !== 'disconnected') ?? null,
        [brandConnections],
    );

    const ga4Source = liveData.connectedSources?.ga4;
    const searchSource = liveData.connectedSources?.searchConsole;

    const renderTab = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <OverviewTab data={liveData} period={period} />
                    </Suspense>
                );
            case 'social':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <SocialTab data={liveData} period={period} />
                    </Suspense>
                );
            case 'ads':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <AdsTab data={liveData} onNavigate={onNavigate} />
                    </Suspense>
                );
            case 'website':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <WebsiteTab data={liveData} onNavigate={onNavigate} />
                    </Suspense>
                );
            case 'seo':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <SEOTab data={liveData} onNavigate={onNavigate} />
                    </Suspense>
                );
            case 'content':
                return (
                    <Suspense fallback={<TabFallback />}>
                        <ContentTab data={liveData} onReviewPost={setPostToReview} />
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
            description="بيانات حقيقية من المصادر المرتبطة — السوشيال والإعلانات والموقع والسيو في مكان واحد."
            actions={
                <div className="flex items-center gap-2">
                    {/* Period selector */}
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
                    {/* Manual refresh */}
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
                {
                    label: t.analytics.impressions,
                    value: liveData.overallStats.impressions.toLocaleString(),
                    icon: 'fa-eye',
                },
                {
                    label: t.analytics.engagement,
                    value: liveData.overallStats.engagement.toLocaleString(),
                    icon: 'fa-heart',
                },
                {
                    label: t.analytics.posts,
                    value: liveData.overallStats.postsPublished.toLocaleString(),
                    icon: 'fa-newspaper',
                },
                {
                    label: t.analytics.engagementRate,
                    value: `${averageEngagementRate.toFixed(2)}%`,
                    tone: 'text-brand-primary',
                    icon: 'fa-chart-line',
                },
            ]}
        >
            {/* Mobile signal cards */}
            <div className="lg:hidden mb-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">الإشارات الرئيسية</p>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: 'Impressions', value: liveData.overallStats.impressions.toLocaleString(), icon: 'fa-eye', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                        { label: 'التفاعل', value: liveData.overallStats.engagement.toLocaleString(), icon: 'fa-heart', color: 'text-rose-500', bg: 'bg-rose-500/10' },
                        { label: 'المنشورات', value: liveData.overallStats.postsPublished.toLocaleString(), icon: 'fa-paper-plane', color: 'text-violet-500', bg: 'bg-violet-500/10' },
                        { label: 'معدل التفاعل', value: `${averageEngagementRate.toFixed(1)}%`, icon: 'fa-chart-line', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-3.5">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                                <i className={`fas ${s.icon} text-sm ${s.color}`} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-base font-bold text-light-text dark:text-dark-text truncate">{s.value}</p>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Connection callouts for GA4 + Search Console */}
            <div className="grid gap-4 md:grid-cols-2">
                <ProviderConnectionCallout
                    title="GA4"
                    description="خاصية Google Analytics 4 المحفوظة للبراند — تظهر بياناتها في تبويب الموقع."
                    connection={ga4Connection}
                    brandAssets={brandAssets}
                    emptyTitle="لا توجد خاصية GA4 محفوظة بعد"
                    emptyDescription="اربط Google Analytics 4 من مساحة التكاملات لعرض Sessions والإيرادات وبيانات الموقع هنا."
                    primaryActionLabel="فتح مساحة التكاملات"
                    onPrimaryAction={() => onNavigate('integrations')}
                    secondaryActionLabel="تبويب الموقع"
                    onSecondaryAction={() => setActiveTab('website')}
                />
                <ProviderConnectionCallout
                    title="Search Console"
                    description="خصائص البحث العضوي — تظهر بياناتها في تبويب SEO."
                    connection={searchConsoleConnection}
                    brandAssets={brandAssets}
                    emptyTitle="لا توجد خصائص Search Console محفوظة بعد"
                    emptyDescription="اربط Search Console من مساحة التكاملات لعرض Clicks وCTR والترتيب."
                    primaryActionLabel="فتح مساحة التكاملات"
                    onPrimaryAction={() => onNavigate('integrations')}
                    secondaryActionLabel="تبويب SEO"
                    onSecondaryAction={() => setActiveTab('seo')}
                />
            </div>

            {/* Connected web measurement summary */}
            {(ga4Source || searchSource) && (
                <PageSection
                    title="Connected Web Measurement"
                    description="Scoped metrics from the saved GA4 property and Search Console site tied to this brand."
                >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {[
                            {
                                label: 'GA4 Sessions',
                                value: (ga4Source?.sessions ?? 0).toLocaleString(),
                                sub: ga4Source?.propertyName ?? 'No GA4 property selected',
                                available: Boolean(ga4Source),
                            },
                            {
                                label: 'GA4 Revenue',
                                value: `$${Math.round(ga4Source?.revenue ?? 0).toLocaleString()}`,
                                sub: ga4Source ? `${(ga4Source.bounceRate * 100).toFixed(1)}% bounce rate` : 'No GA4 revenue data yet',
                                available: Boolean(ga4Source),
                            },
                            {
                                label: 'Search Clicks',
                                value: (searchSource?.clicks ?? 0).toLocaleString(),
                                sub: searchSource?.siteUrl ?? 'No Search Console site selected',
                                available: Boolean(searchSource),
                            },
                            {
                                label: 'Search Impressions',
                                value: (searchSource?.impressions ?? 0).toLocaleString(),
                                sub: searchSource
                                    ? `CTR ${(searchSource.ctr * 100).toFixed(2)}% · Avg pos ${searchSource.avgPosition.toFixed(1)}`
                                    : 'No Search Console data yet',
                                available: Boolean(searchSource),
                            },
                        ].map(({ label, value, sub, available }) => (
                            <div
                                key={label}
                                className={`rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface ${!available ? 'opacity-50' : ''}`}
                            >
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                                <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{value}</p>
                                <p className="mt-1 truncate text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{sub}</p>
                            </div>
                        ))}
                    </div>
                </PageSection>
            )}

            {/* Brief & Watchlist attribution */}
            <PageSection
                title="Brief & Watchlist Performance"
                description="Rollups from attributed post analytics, with fallback counts when attribution sync has not populated metrics yet."
            >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                            {[
                                { label: 'Saved Briefs', value: savedBriefs.length },
                                { label: 'Attributed Posts', value: attributedPostsCount },
                                { label: 'Attributed Impressions', value: attributedImpressions.toLocaleString() },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-2xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                                    <p className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">{value}</p>
                                </div>
                            ))}
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
                                                {[
                                                    { label: 'Linked', value: linkedPosts },
                                                    { label: 'Scheduled', value: scheduledCount },
                                                    { label: 'Impressions', value: totalImpressions.toLocaleString() },
                                                    { label: 'Engagement', value: totalEngagement.toLocaleString() },
                                                    { label: 'Platforms', value: platformSpread },
                                                ].map(({ label, value }) => (
                                                    <div key={label}>
                                                        <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                                                        <p className="mt-1 font-semibold text-light-text dark:text-dark-text">{value}</p>
                                                    </div>
                                                ))}
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
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Rollups across briefs and posts</span>
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
                                            {[
                                                { label: 'Briefs', value: briefsCount },
                                                { label: 'Linked', value: linkedPosts },
                                                { label: 'Scheduled', value: scheduledCount },
                                            ].map(({ label, value }) => (
                                                <div key={label}>
                                                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                                                    <p className="mt-1 font-semibold text-light-text dark:text-dark-text">{value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Impressions', value: totalImpressions.toLocaleString() },
                                                { label: 'Engagement', value: totalEngagement.toLocaleString() },
                                                { label: 'Platforms', value: platformSpread },
                                            ].map(({ label, value }) => (
                                                <div key={label}>
                                                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                                                    <p className="mt-1 font-semibold text-light-text dark:text-dark-text">{value}</p>
                                                </div>
                                            ))}
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

            {/* Tab navigation + content */}
            <PageSection
                title={activeTabMeta.label}
                description="بيانات حقيقية من المصادر المرتبطة. الأرقام المعروضة تعكس الفترة الزمنية المختارة فقط."
                className="overflow-hidden"
            >
                <div className="mb-6 overflow-x-auto">
                    <nav className="flex min-w-max gap-1.5">
                        {ANALYTICS_TABS.map((tab) => {
                            // Badge logic: show "live" dot for tabs with connected data
                            const hasData =
                                (tab.id === 'website' && Boolean(liveData.connectedSources?.ga4)) ||
                                (tab.id === 'seo' && Boolean(liveData.connectedSources?.searchConsole)) ||
                                (tab.id === 'social' && liveData.engagementRate.length > 0) ||
                                (tab.id === 'content' && liveData.topPosts.length > 0);

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                                        activeTab === tab.id
                                            ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                                            : 'bg-light-bg text-light-text-secondary hover:bg-light-border/60 hover:text-light-text dark:bg-dark-bg dark:text-dark-text-secondary dark:hover:bg-dark-border/70 dark:hover:text-dark-text'
                                    }`}
                                >
                                    <i className={`fas ${tab.icon} text-xs`} />
                                    {tab.label}
                                    {hasData && activeTab !== tab.id && (
                                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-light-bg dark:ring-dark-bg" />
                                    )}
                                </button>
                            );
                        })}
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
