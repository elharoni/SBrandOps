import React from 'react';
import { AnalyticsData } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { EmptyConnectState, DataSourceBadge, SyncStatusBar } from './analyticsHelpers';

interface AdsTabProps {
    data: AnalyticsData;
    brandId: string;
    onNavigate?: (page: string) => void;
}

const AD_METRIC_DEFINITIONS = [
    { key: 'Spend',  formula: 'إجمالي الإنفاق الإعلاني',   icon: 'fa-credit-card',   color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { key: 'CPM',    formula: 'Spend / Impressions × 1000', icon: 'fa-chart-bar',      color: 'text-blue-500',   bg: 'bg-blue-500/10' },
    { key: 'CTR',    formula: 'Clicks / Impressions × 100', icon: 'fa-arrow-pointer',  color: 'text-cyan-500',   bg: 'bg-cyan-500/10' },
    { key: 'CPC',    formula: 'Spend / Clicks',             icon: 'fa-coins',          color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { key: 'CPA',    formula: 'Spend / Conversions',        icon: 'fa-funnel-dollar',  color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { key: 'ROAS',   formula: 'Conversion Value / Spend',   icon: 'fa-arrow-trend-up', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const AD_PROVIDERS = [
    { name: 'Meta Ads',    icon: 'fa-meta',   color: 'text-blue-600 bg-blue-500/10',   description: 'Facebook + Instagram حملات مدفوعة، Lead Ads، Conversion، Reach' },
    { name: 'Google Ads',  icon: 'fa-google', color: 'text-red-500 bg-red-500/10',     description: 'Search، Display، Performance Max، YouTube Ads' },
    { name: 'TikTok Ads',  icon: 'fa-tiktok', color: 'text-cyan-500 bg-cyan-500/10',   description: 'In-Feed Ads، TopView، Branded Hashtag Challenge' },
];

const PROVIDER_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
    meta_ads:   { label: 'Meta Ads',   icon: 'fa-meta',   color: 'text-blue-500' },
    google_ads: { label: 'Google Ads', icon: 'fa-google', color: 'text-red-500' },
    tiktok_ads: { label: 'TikTok Ads', icon: 'fa-tiktok', color: 'text-cyan-500' },
};

function fmt(n: number, locale: string) { return n.toLocaleString(locale, { maximumFractionDigits: 2 }); }

export const AdsTab: React.FC<AdsTabProps> = ({ data, brandId, onNavigate }) => {
    const { language } = useLanguage();
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';

    const ads = data.connectedSources?.ads;
    const ga4Revenue = data.connectedSources?.ga4?.revenue ?? 0;
    const ga4KeyEvents = data.connectedSources?.ga4?.keyEvents ?? 0;
    const hasGA4Hints = ga4Revenue > 0 || ga4KeyEvents > 0;

    if (!ads) {
        return (
            <div className="space-y-6">
                <EmptyConnectState
                    icon="fa-bullhorn"
                    title="لا توجد حسابات إعلانية مرتبطة"
                    description="اربط حسابات الإعلانات لرؤية Spend و ROAS و CPA و CTR و CPC ومقارنة أداء الحملات عبر المنصات من نفس المكان."
                    providers={AD_PROVIDERS.map(p => ({ label: p.name, icon: p.icon, color: p.color }))}
                    actionLabel="فتح مساحة التكاملات"
                    onAction={() => onNavigate?.('integrations')}
                />

                <div className="grid gap-4 md:grid-cols-3">
                    {AD_PROVIDERS.map(provider => (
                        <div key={provider.name} className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${provider.color.split(' ')[1]}`}>
                                    <i className={`fab ${provider.icon} text-lg ${provider.color.split(' ')[0]}`} />
                                </div>
                                <div>
                                    <p className="font-bold text-light-text dark:text-dark-text text-sm">{provider.name}</p>
                                    <span className="text-[10px] rounded-full bg-slate-500/10 px-2 py-0.5 text-slate-500 font-semibold">غير مرتبط</span>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">{provider.description}</p>
                        </div>
                    ))}
                </div>

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

                {hasGA4Hints && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            <i className="fas fa-lightbulb" />
                            تلميح من GA4: تحويلات موجودة بدون بيانات إعلانات
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-xs">
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

    // ── Real ads data ─────────────────────────────────────────────────────────────
    const ctrPct = (ads.avgCtr * 100).toFixed(2);
    const roasQuality = ads.avgRoas >= 4
        ? { text: 'ممتاز (4x+)', color: 'text-emerald-500' }
        : ads.avgRoas >= 2
            ? { text: 'جيد (2-4x)', color: 'text-blue-500' }
            : ads.avgRoas > 0
                ? { text: 'منخفض (أقل من 2x)', color: 'text-amber-500' }
                : null;

    const metrics = [
        {
            label: 'Spend',
            value: `$${fmt(ads.totalSpend, locale)}`,
            sub: 'إجمالي الإنفاق',
            icon: 'fa-credit-card',
            accent: 'text-orange-500',
            bg: 'bg-orange-500/10',
        },
        {
            label: 'Impressions',
            value: ads.totalImpressions.toLocaleString(locale),
            sub: 'إجمالي مرات الظهور',
            icon: 'fa-eye',
            accent: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            label: 'Clicks',
            value: ads.totalClicks.toLocaleString(locale),
            sub: `CTR ${ctrPct}%`,
            icon: 'fa-arrow-pointer',
            accent: 'text-cyan-500',
            bg: 'bg-cyan-500/10',
        },
        {
            label: 'Conversions',
            value: ads.totalConversions.toLocaleString(locale),
            sub: ads.totalConversionValue > 0 ? `قيمة $${fmt(ads.totalConversionValue, locale)}` : 'إجمالي التحويلات',
            icon: 'fa-bullseye',
            accent: 'text-violet-500',
            bg: 'bg-violet-500/10',
        },
        {
            label: 'CPC',
            value: ads.avgCpc > 0 ? `$${ads.avgCpc.toFixed(2)}` : '—',
            sub: 'متوسط تكلفة النقرة',
            icon: 'fa-coins',
            accent: 'text-yellow-500',
            bg: 'bg-yellow-500/10',
        },
        {
            label: 'ROAS',
            value: ads.avgRoas > 0 ? `${ads.avgRoas.toFixed(2)}x` : '—',
            sub: roasQuality?.text ?? 'العائد على الإنفاق',
            icon: 'fa-arrow-trend-up',
            accent: roasQuality?.color ?? 'text-emerald-500',
            bg: 'bg-emerald-500/10',
        },
    ];

    return (
        <div className="space-y-6">

            {/* Sync status */}
            <SyncStatusBar brandId={brandId} providers={['meta_ads', 'google_ads']} />

            {/* Context bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-4 py-3">
                <div>
                    <p className="text-sm font-bold text-light-text dark:text-dark-text">
                        <i className="fas fa-bullhorn me-2 text-orange-500" />
                        {ads.campaignCount > 0 ? `${ads.campaignCount} حملة إعلانية` : 'حسابات الإعلانات'}
                    </p>
                    <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary flex gap-2">
                        {ads.providers.map(p => {
                            const d = PROVIDER_DISPLAY[p];
                            return d ? (
                                <span key={p} className={`flex items-center gap-1 ${d.color}`}>
                                    <i className={`fab ${d.icon} text-[11px]`} />
                                    {d.label}
                                </span>
                            ) : <span key={p}>{p}</span>;
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <i className="fas fa-check-circle me-1" /> مرتبط
                    </span>
                    {ads.lastInsightDate && (
                        <DataSourceBadge source="ad_insights" lastUpdated={ads.lastInsightDate} />
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

            {/* Insights */}
            <div className="space-y-2">
                {ads.avgRoas > 0 && ads.avgRoas < 2 && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm">
                        <i className="fas fa-triangle-exclamation mt-0.5 shrink-0 text-amber-500" />
                        <div>
                            <p className="font-semibold text-amber-700 dark:text-amber-400">ROAS منخفض ({ads.avgRoas.toFixed(2)}x)</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                راجع استهداف الجمهور وصفحات الهبوط لتحسين العائد على الإنفاق الإعلاني.
                            </p>
                        </div>
                    </div>
                )}
                {ads.avgRoas >= 4 && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                        <i className="fas fa-lightbulb mt-0.5 shrink-0 text-emerald-500" />
                        <div>
                            <p className="font-semibold text-emerald-700 dark:text-emerald-400">ROAS ممتاز ({ads.avgRoas.toFixed(2)}x)</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                زيادة الميزانية على الحملات ذات الأداء العالي ستُضاعف العائد.
                            </p>
                        </div>
                    </div>
                )}
                {ads.totalConversions === 0 && ads.totalClicks > 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm">
                        <i className="fas fa-circle-xmark mt-0.5 shrink-0 text-red-500" />
                        <div>
                            <p className="font-semibold text-red-700 dark:text-red-400">لا تحويلات رغم {ads.totalClicks.toLocaleString(locale)} نقرة</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                تحقق من pixel التتبع وصفحات الهبوط وتطابق الرسالة مع الجمهور المستهدف.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Metric definitions */}
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                    تعريف المقاييس
                </p>
                <div className="grid gap-2 text-xs md:grid-cols-3">
                    {AD_METRIC_DEFINITIONS.map(({ key, formula }) => (
                        <div key={key} className="rounded-lg bg-light-bg dark:bg-dark-bg p-3">
                            <p className="font-bold text-light-text dark:text-dark-text">{key}</p>
                            <p className="mt-0.5 text-light-text-secondary dark:text-dark-text-secondary">{formula}</p>
                            <p className="mt-1 text-[10px] opacity-60">ad_insights</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-4 py-3">
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <i className="fas fa-database me-1.5 text-[10px] text-brand-primary" />
                    بيانات الإعلانات مخزنة في جداول <strong>ad_campaigns</strong> و<strong>ad_insights</strong> ومحدَّثة يومياً عبر Edge Function.
                    Google Ads مصدر منفصل تماماً عن GA4 وعن بيانات السوشيال.
                </p>
            </div>
        </div>
    );
};
