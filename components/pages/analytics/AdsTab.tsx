import React from 'react';
import { AnalyticsData } from '../../../types';
import { EmptyConnectState } from './analyticsHelpers';

interface AdsTabProps {
    data: AnalyticsData;
    onNavigate?: (page: string) => void;
}

const AD_METRIC_DEFINITIONS = [
    { key: 'Spend', formula: 'إجمالي الإنفاق الإعلاني', icon: 'fa-credit-card', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { key: 'CPM', formula: 'Spend / Impressions × 1000', icon: 'fa-chart-bar', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { key: 'CTR', formula: 'Clicks / Impressions × 100', icon: 'fa-arrow-pointer', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { key: 'CPC', formula: 'Spend / Clicks', icon: 'fa-coins', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { key: 'CPA', formula: 'Spend / Conversions', icon: 'fa-funnel-dollar', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { key: 'ROAS', formula: 'Conversion Value / Spend', icon: 'fa-arrow-trend-up', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const AD_PROVIDERS = [
    {
        name: 'Meta Ads',
        icon: 'fa-meta',
        color: 'text-blue-600 bg-blue-500/10',
        description: 'Facebook + Instagram حملات مدفوعة، Lead Ads، Conversion، Reach',
    },
    {
        name: 'Google Ads',
        icon: 'fa-google',
        color: 'text-red-500 bg-red-500/10',
        description: 'Search، Display، Performance Max، YouTube Ads',
    },
    {
        name: 'TikTok Ads',
        icon: 'fa-tiktok',
        color: 'text-cyan-500 bg-cyan-500/10',
        description: 'In-Feed Ads، TopView، Branded Hashtag Challenge',
    },
];

export const AdsTab: React.FC<AdsTabProps> = ({ data, onNavigate }) => {
    // Check if any ad spend data is available (future: from connected ad accounts)
    const hasAdData = false; // Will become true when ad API integration is complete

    // GA4 revenue can hint at conversions even without ad accounts
    const ga4Revenue = data.connectedSources?.ga4?.revenue ?? 0;
    const ga4KeyEvents = data.connectedSources?.ga4?.keyEvents ?? 0;
    const hasGA4Hints = ga4Revenue > 0 || ga4KeyEvents > 0;

    if (!hasAdData) {
        return (
            <div className="space-y-6">
                <EmptyConnectState
                    icon="fa-bullhorn"
                    title="لا توجد حسابات إعلانية مرتبطة"
                    description="اربط حسابات الإعلانات لرؤية Spend و ROAS و CPA و CTR و CPC ومقارنة أداء الحملات عبر المنصات من نفس المكان."
                    providers={AD_PROVIDERS.map(p => ({
                        label: p.name,
                        icon: p.icon,
                        color: p.color,
                    }))}
                    actionLabel="فتح مساحة التكاملات"
                    onAction={() => onNavigate?.('integrations')}
                />

                {/* Provider details */}
                <div className="grid gap-4 md:grid-cols-3">
                    {AD_PROVIDERS.map(provider => (
                        <div key={provider.name} className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${provider.color.split(' ')[1]}`}>
                                    <i className={`fab ${provider.icon} text-lg ${provider.color.split(' ')[0]}`} />
                                </div>
                                <div>
                                    <p className="font-bold text-light-text dark:text-dark-text text-sm">{provider.name}</p>
                                    <span className="text-[10px] rounded-full bg-slate-500/10 px-2 py-0.5 text-slate-500 font-semibold">
                                        غير مرتبط
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">
                                {provider.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Metrics preview — what you'll see when connected */}
                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                    <p className="mb-4 text-sm font-bold text-light-text dark:text-dark-text">
                        <i className="fas fa-eye me-2 text-brand-primary opacity-70" />
                        المقاييس التي ستظهر بعد الربط
                    </p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {AD_METRIC_DEFINITIONS.map(({ key, formula, icon, color, bg }) => (
                            <div key={key} className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-3 opacity-70">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${bg}`}>
                                        <i className={`fas ${icon} text-[11px] ${color}`} />
                                    </div>
                                    <span className="text-xs font-bold text-light-text dark:text-dark-text">{key}</span>
                                </div>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{formula}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* GA4 conversion hint */}
                {hasGA4Hints && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            <i className="fas fa-lightbulb" />
                            تلميح من GA4: تحويلات موجودة بدون بيانات إعلانات
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">GA4 Revenue</p>
                                <p className="mt-1 font-bold text-light-text dark:text-dark-text">${Math.round(ga4Revenue).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Key Events</p>
                                <p className="mt-1 font-bold text-light-text dark:text-dark-text">{ga4KeyEvents.toLocaleString()}</p>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            اربط Meta Ads أو Google Ads لحساب ROAS وCPA مقارنةً بهذه التحويلات.
                        </p>
                    </div>
                )}

                {/* Architecture note */}
                <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-4 py-3">
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        <i className="fas fa-lock me-1.5 text-[10px] text-brand-primary" />
                        <strong className="text-light-text dark:text-dark-text">أمان: </strong>
                        tokens إعلانية مشفرة AES-256-GCM وتُقرأ فقط من Edge Functions. لا يُعرض أي token في الواجهة الأمامية.
                    </p>
                </div>
            </div>
        );
    }

    // Future: render real ad data here when API integration is complete
    return <div />;
};
