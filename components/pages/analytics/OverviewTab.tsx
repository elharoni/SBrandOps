import React, { useMemo } from 'react';
import { AnalyticsData } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { DonutBreakdown } from '../../shared/LightweightCharts';
import { MetricCard, calculateTrend, CHANNEL_COLORS } from './analyticsHelpers';

interface OverviewTabProps {
    data: AnalyticsData;
    period: string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data, period }) => {
    const { language } = useLanguage();
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';
    const prev = data.previousPeriodStats;

    const avgEngRate = useMemo(() => {
        const rates = data.engagementRate;
        if (rates.length === 0) return 0;
        return rates.reduce((sum, p) => sum + p.rate, 0) / rates.length;
    }, [data.engagementRate]);

    const topPlatform = useMemo(() => {
        const entries = Object.entries(data.platformBreakdown ?? {});
        if (entries.length === 0) return null;
        return entries.sort((a, b) => b[1].engagement - a[1].engagement)[0];
    }, [data.platformBreakdown]);

    const periodLabel = period === '7d' ? '7 أيام' : period === '30d' ? '30 يوم' : '90 يوم';

    const metricsConfig = [
        {
            title: 'إجمالي المتابعين',
            value: data.overallStats.totalFollowers.toLocaleString(locale),
            icon: 'fa-users',
            accent: 'text-violet-500',
            trend: prev ? calculateTrend(data.overallStats.totalFollowers, prev.totalFollowers) : null,
            source: 'حسابات السوشيال',
        },
        {
            title: 'الوصول (Reach)',
            value: data.overallStats.reach > 0
                ? data.overallStats.reach.toLocaleString(locale)
                : data.overallStats.impressions.toLocaleString(locale),
            icon: 'fa-eye',
            accent: 'text-cyan-500',
            trend: prev ? calculateTrend(
                data.overallStats.reach || data.overallStats.impressions,
                prev.reach || prev.impressions,
            ) : null,
            source: 'analytics_snapshots',
        },
        {
            title: 'Impressions',
            value: data.overallStats.impressions.toLocaleString(locale),
            icon: 'fa-chart-bar',
            accent: 'text-blue-500',
            trend: prev ? calculateTrend(data.overallStats.impressions, prev.impressions) : null,
            source: 'post_analytics + snapshots',
        },
        {
            title: 'التفاعل',
            value: data.overallStats.engagement.toLocaleString(locale),
            icon: 'fa-heart',
            accent: 'text-rose-500',
            trend: prev ? calculateTrend(data.overallStats.engagement, prev.engagement) : null,
            source: 'post_analytics',
        },
        {
            title: 'المنشورات',
            value: data.overallStats.postsPublished.toLocaleString(locale),
            icon: 'fa-paper-plane',
            accent: 'text-amber-500',
            trend: prev ? calculateTrend(data.overallStats.postsPublished, prev.postsPublished) : null,
            source: 'scheduled_posts',
        },
        {
            title: 'معدل التفاعل',
            value: `${avgEngRate.toFixed(2)}%`,
            icon: 'fa-chart-line',
            accent: 'text-emerald-500',
            trend: null,
            source: 'محسوب: engagement / impressions',
            sub: 'متوسط عبر المنصات',
        },
    ];

    const sentimentSegments = [
        { label: 'إيجابي', value: data.overallStats.sentiment.positive, color: '#22c55e' },
        { label: 'محايد', value: data.overallStats.sentiment.neutral, color: '#94a3b8' },
        { label: 'سلبي', value: data.overallStats.sentiment.negative, color: '#ef4444' },
    ];

    const hasSentiment = data.overallStats.sentiment.positive + data.overallStats.sentiment.neutral + data.overallStats.sentiment.negative > 0;

    const ga4 = data.connectedSources?.ga4;
    const seo = data.connectedSources?.searchConsole;

    return (
        <div className="space-y-6">

            {/* Trend context strip */}
            {prev ? (
                <div className="flex items-center gap-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border px-4 py-2.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <i className="fas fa-info-circle text-brand-primary text-[11px]" />
                    الأسهم تقارن آخر <strong className="text-light-text dark:text-dark-text">{periodLabel}</strong> بالفترة السابقة المماثلة بناءً على بيانات حقيقية.
                </div>
            ) : (
                <div className="flex items-center gap-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border px-4 py-2.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <i className="fas fa-circle-info text-[11px] text-amber-500" />
                    لا توجد بيانات فترة سابقة للمقارنة — ستظهر أسهم الاتجاه بعد تجميع أكثر من دورة واحدة.
                </div>
            )}

            {/* Key metric cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {metricsConfig.map((m) => (
                    <MetricCard
                        key={m.title}
                        title={m.title}
                        value={m.value}
                        icon={m.icon}
                        accent={m.accent}
                        trend={m.trend}
                        source={m.source}
                        sub={m.sub}
                    />
                ))}
            </div>

            {/* Signal row: top platform + GA4 + Search Console */}
            <div className="grid gap-4 md:grid-cols-3">

                {/* Top performing platform */}
                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                        أفضل منصة أداءً
                    </p>
                    {topPlatform ? (
                        <div>
                            <div className="flex items-center gap-2">
                                <span
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: CHANNEL_COLORS[topPlatform[0]] ?? '#6366f1' }}
                                />
                                <p className="text-xl font-black text-light-text dark:text-dark-text">{topPlatform[0]}</p>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary">Impressions</p>
                                    <p className="font-bold text-light-text dark:text-dark-text">{topPlatform[1].impressions.toLocaleString(locale)}</p>
                                </div>
                                <div>
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary">Engagement</p>
                                    <p className="font-bold text-light-text dark:text-dark-text">{topPlatform[1].engagement.toLocaleString(locale)}</p>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                معدل التفاعل: {topPlatform[1].impressions > 0
                                    ? ((topPlatform[1].engagement / topPlatform[1].impressions) * 100).toFixed(2)
                                    : '0'}%
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            لا توجد بيانات منصات بعد
                        </p>
                    )}
                </div>

                {/* GA4 summary (if connected) */}
                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                            الموقع (GA4)
                        </p>
                        {ga4 ? (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                مرتبط
                            </span>
                        ) : (
                            <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                غير مرتبط
                            </span>
                        )}
                    </div>
                    {ga4 ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Sessions</p>
                                <p className="mt-0.5 font-bold text-light-text dark:text-dark-text">{ga4.sessions.toLocaleString(locale)}</p>
                            </div>
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Revenue</p>
                                <p className="mt-0.5 font-bold text-light-text dark:text-dark-text">${Math.round(ga4.revenue).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Bounce Rate</p>
                                <p className="mt-0.5 font-bold text-light-text dark:text-dark-text">{(ga4.bounceRate * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Key Events</p>
                                <p className="mt-0.5 font-bold text-light-text dark:text-dark-text">{ga4.keyEvents.toLocaleString(locale)}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                            اربط Google Analytics 4 من صفحة التكاملات لعرض بيانات الموقع هنا.
                        </p>
                    )}
                </div>

                {/* Search Console summary (if connected) */}
                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                            SEO (Search Console)
                        </p>
                        {seo ? (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                مرتبط
                            </span>
                        ) : (
                            <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                غير مرتبط
                            </span>
                        )}
                    </div>
                    {seo ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Clicks</p>
                                <p className="mt-0.5 font-bold text-light-text dark:text-dark-text">{seo.clicks.toLocaleString(locale)}</p>
                            </div>
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Impressions</p>
                                <p className="mt-0.5 font-bold text-light-text dark:text-dark-text">{seo.impressions.toLocaleString(locale)}</p>
                            </div>
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">CTR</p>
                                <p className="mt-0.5 font-bold text-light-text dark:text-dark-text">{(seo.ctr * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Avg Position</p>
                                <p className="mt-0.5 font-bold text-light-text dark:text-dark-text">{seo.avgPosition.toFixed(1)}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                            اربط Google Search Console لعرض بيانات الكلمات المفتاحية والنقرات هنا.
                        </p>
                    )}
                </div>
            </div>

            {/* Sentiment breakdown */}
            {hasSentiment && (
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                        <p className="mb-4 text-sm font-bold text-light-text dark:text-dark-text">
                            <i className="fas fa-face-smile me-2 text-green-500" />
                            تحليل المشاعر
                        </p>
                        <DonutBreakdown
                            segments={sentimentSegments.filter(s => s.value > 0)}
                            centerLabel="Sentiment"
                        />
                        <p className="mt-3 text-[11px] text-light-text-secondary dark:text-dark-text-secondary text-center">
                            مصدر: محادثات Inbox المحللة تلقائياً
                        </p>
                    </div>

                    {/* Platform engagement comparison */}
                    {data.engagementRate.length > 0 && (
                        <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                            <p className="mb-4 text-sm font-bold text-light-text dark:text-dark-text">
                                <i className="fas fa-chart-bar me-2 text-blue-500" />
                                معدل التفاعل بالمنصة
                            </p>
                            <div className="space-y-3">
                                {[...data.engagementRate]
                                    .sort((a, b) => b.rate - a.rate)
                                    .map(({ platform, rate }) => {
                                        const max = Math.max(...data.engagementRate.map(p => p.rate), 0.01);
                                        return (
                                            <div key={platform} className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-medium text-light-text dark:text-dark-text">{platform}</span>
                                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{rate}%</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${Math.max((rate / max) * 100, 4)}%`,
                                                            backgroundColor: CHANNEL_COLORS[platform] ?? '#6366f1',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Warning/opportunity callouts derived from real data */}
            {(() => {
                const callouts: Array<{ type: 'warning' | 'opportunity' | 'info'; msg: string }> = [];

                if (data.overallStats.sentiment.negative > 30) {
                    callouts.push({ type: 'warning', msg: `نسبة المشاعر السلبية مرتفعة (${data.overallStats.sentiment.negative}%) — راجع المحادثات وردّ على التعليقات السلبية.` });
                }
                if (!ga4 && !seo) {
                    callouts.push({ type: 'opportunity', msg: 'اربط Google Analytics 4 وSearch Console لرؤية أداء الموقع والكلمات المفتاحية ضمن هذه اللوحة.' });
                }
                if (data.overallStats.impressions > 0 && avgEngRate < 1) {
                    callouts.push({ type: 'warning', msg: `معدل التفاعل منخفض (${avgEngRate.toFixed(2)}%) — جرّب تنويع أنواع المحتوى أو تعديل أوقات النشر.` });
                }
                if (prev && data.overallStats.engagement < prev.engagement) {
                    callouts.push({ type: 'warning', msg: 'التفاعل انخفض عن الفترة السابقة — راجع نوع المحتوى والتوقيت في تبويب المحتوى.' });
                }
                if (prev && data.overallStats.impressions > prev.impressions * 1.2) {
                    callouts.push({ type: 'opportunity', msg: 'الوصول ارتفع بأكثر من 20% عن الفترة السابقة — فرصة لزيادة التحويلات.' });
                }

                if (callouts.length === 0) return null;

                return (
                    <div className="space-y-2">
                        {callouts.map((c, i) => (
                            <div key={i} className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border ${
                                c.type === 'warning'
                                    ? 'bg-amber-500/8 border-amber-500/20 text-amber-700 dark:text-amber-400'
                                    : c.type === 'opportunity'
                                        ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-blue-500/8 border-blue-500/20 text-blue-700 dark:text-blue-400'
                            }`}>
                                <i className={`fas mt-0.5 shrink-0 ${
                                    c.type === 'warning' ? 'fa-triangle-exclamation text-amber-500' :
                                    c.type === 'opportunity' ? 'fa-lightbulb text-emerald-500' :
                                    'fa-circle-info text-blue-500'
                                }`} />
                                <span>{c.msg}</span>
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
};
