import React from 'react';
import { AnalyticsData } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { EmptyConnectState, DataSourceBadge } from './analyticsHelpers';

interface WebsiteTabProps {
    data: AnalyticsData;
    onNavigate?: (page: string) => void;
}

export const WebsiteTab: React.FC<WebsiteTabProps> = ({ data, onNavigate }) => {
    const { language } = useLanguage();
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';

    const ga4 = data.connectedSources?.ga4;

    if (!ga4) {
        return (
            <EmptyConnectState
                icon="fa-chart-area"
                title="Google Analytics 4 غير مرتبط"
                description="اربط GA4 لعرض Sessions وRevenue ومعدل الارتداد ومدة التفاعل وKey Events لموقعك مباشرةً هنا — منفصلاً عن بيانات السوشيال والإعلانات."
                providers={[
                    { label: 'Google Analytics 4', icon: 'fa-google', color: 'text-orange-500 bg-orange-500/10' },
                ]}
                actionLabel="ربط GA4 من التكاملات"
                onAction={() => onNavigate?.('integrations')}
            />
        );
    }

    const engagementRate = ga4.sessions > 0
        ? ((ga4.engagedSessions / ga4.sessions) * 100).toFixed(1)
        : '—';

    const avgEngTimeMin = Math.floor(ga4.avgEngagementTimeSec / 60);
    const avgEngTimeSec = Math.round(ga4.avgEngagementTimeSec % 60);
    const avgEngTimeLabel = ga4.avgEngagementTimeSec > 0
        ? `${avgEngTimeMin}:${String(avgEngTimeSec).padStart(2, '0')} دقيقة`
        : '—';

    const metrics = [
        {
            label: 'Sessions',
            value: ga4.sessions.toLocaleString(locale),
            sub: 'إجمالي الزيارات',
            icon: 'fa-globe',
            accent: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            label: 'Engaged Sessions',
            value: ga4.engagedSessions.toLocaleString(locale),
            sub: `${engagementRate}% من الزيارات`,
            icon: 'fa-mouse-pointer',
            accent: 'text-cyan-500',
            bg: 'bg-cyan-500/10',
        },
        {
            label: 'Bounce Rate',
            value: `${(ga4.bounceRate * 100).toFixed(1)}%`,
            sub: 'معدل الارتداد',
            icon: 'fa-right-from-bracket',
            accent: ga4.bounceRate > 0.6 ? 'text-red-500' : 'text-emerald-500',
            bg: ga4.bounceRate > 0.6 ? 'bg-red-500/10' : 'bg-emerald-500/10',
        },
        {
            label: 'Avg Engagement Time',
            value: avgEngTimeLabel,
            sub: 'متوسط وقت التفاعل',
            icon: 'fa-clock',
            accent: 'text-violet-500',
            bg: 'bg-violet-500/10',
        },
        {
            label: 'Key Events',
            value: ga4.keyEvents.toLocaleString(locale),
            sub: 'conversions / events',
            icon: 'fa-bullseye',
            accent: 'text-amber-500',
            bg: 'bg-amber-500/10',
        },
        {
            label: 'Revenue',
            value: ga4.revenue > 0 ? `$${Math.round(ga4.revenue).toLocaleString()}` : '—',
            sub: ga4.revenue > 0 ? 'Ecommerce revenue' : 'لا توجد بيانات إيرادات',
            icon: 'fa-dollar-sign',
            accent: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
        },
    ];

    return (
        <div className="space-y-6">

            {/* Property context */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-4 py-3">
                <div>
                    <p className="text-sm font-bold text-light-text dark:text-dark-text">
                        <i className="fas fa-chart-area me-2 text-orange-500" />
                        {ga4.propertyName}
                    </p>
                    {ga4.websiteUrl && (
                        <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">{ga4.websiteUrl}</p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <i className="fas fa-check-circle me-1" /> مرتبط
                    </span>
                    {ga4.lastFactDate && (
                        <DataSourceBadge source="analytics_page_facts" lastUpdated={ga4.lastFactDate} />
                    )}
                </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {metrics.map(({ label, value, sub, icon, accent, bg }) => (
                    <div key={label} className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                                <i className={`fas ${icon} text-sm ${accent}`} />
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                        </div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">{value}</p>
                        <p className="mt-0.5 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Engagement quality insight */}
            {ga4.sessions > 0 && (
                <div className="space-y-2">
                    {ga4.bounceRate > 0.7 && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm">
                            <i className="fas fa-triangle-exclamation mt-0.5 shrink-0 text-red-500" />
                            <div>
                                <p className="font-semibold text-red-700 dark:text-red-400">معدل الارتداد مرتفع ({(ga4.bounceRate * 100).toFixed(1)}%)</p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                    70%+ من الزوار يغادرون دون تفاعل. راجع سرعة الموقع، Landing Pages، وملاءمة المحتوى للجمهور.
                                </p>
                            </div>
                        </div>
                    )}
                    {ga4.engagedSessions / ga4.sessions > 0.6 && (
                        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                            <i className="fas fa-lightbulb mt-0.5 shrink-0 text-emerald-500" />
                            <div>
                                <p className="font-semibold text-emerald-700 dark:text-emerald-400">جودة تفاعل ممتازة ({engagementRate}%)</p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                    أكثر من 60% من الزوار يتفاعلون مع المحتوى — فرصة لتحسين التحويلات.
                                </p>
                            </div>
                        </div>
                    )}
                    {ga4.revenue === 0 && ga4.keyEvents > 0 && (
                        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm">
                            <i className="fas fa-circle-info mt-0.5 shrink-0 text-amber-500" />
                            <p className="text-amber-700 dark:text-amber-400">
                                يوجد {ga4.keyEvents.toLocaleString()} Key Event لكن لا توجد بيانات إيرادات — تأكد من تفعيل Ecommerce tracking في GA4.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Architecture note */}
            <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-4 py-3">
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <i className="fas fa-database me-1.5 text-[10px] text-brand-primary" />
                    بيانات GA4 مخزنة في جدول <strong>analytics_page_facts</strong> ومحدَّثة عبر Edge Function مجدولة.
                    Google Analytics 4 مصدر منفصل تماماً عن Google Ads وعن بيانات السوشيال.
                </p>
            </div>
        </div>
    );
};
