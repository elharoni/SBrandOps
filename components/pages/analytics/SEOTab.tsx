import React from 'react';
import { AnalyticsData } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { EmptyConnectState, DataSourceBadge } from './analyticsHelpers';

interface SEOTabProps {
    data: AnalyticsData;
    onNavigate?: (page: string) => void;
}

export const SEOTab: React.FC<SEOTabProps> = ({ data, onNavigate }) => {
    const { language } = useLanguage();
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';

    const seo = data.connectedSources?.searchConsole;

    if (!seo) {
        return (
            <EmptyConnectState
                icon="fa-magnifying-glass"
                title="Google Search Console غير مرتبط"
                description="اربط Search Console لرؤية Clicks وImpressions وCTR ومتوسط موضع البحث لموقعك في نتائج Google — منفصلاً عن Google Ads."
                providers={[
                    { label: 'Google Search Console', icon: 'fa-google', color: 'text-green-500 bg-green-500/10' },
                ]}
                actionLabel="ربط Search Console من التكاملات"
                onAction={() => onNavigate?.('integrations')}
            />
        );
    }

    const ctrPercent = (seo.ctr * 100).toFixed(2);

    // Position quality classification
    const positionLabel = seo.avgPosition <= 3
        ? { text: 'ممتاز (Top 3)', color: 'text-emerald-500' }
        : seo.avgPosition <= 10
            ? { text: 'جيد (الصفحة الأولى)', color: 'text-blue-500' }
            : seo.avgPosition <= 20
                ? { text: 'متوسط (أسفل الصفحة الأولى)', color: 'text-amber-500' }
                : { text: 'ضعيف (صفحة 2+)', color: 'text-red-500' };

    const ctrQuality = seo.ctr >= 0.05
        ? { text: 'ممتاز (5%+)', color: 'text-emerald-500' }
        : seo.ctr >= 0.02
            ? { text: 'متوسط (2-5%)', color: 'text-amber-500' }
            : { text: 'منخفض (أقل من 2%)', color: 'text-red-500' };

    const metrics = [
        {
            label: 'Clicks',
            value: seo.clicks.toLocaleString(locale),
            sub: 'نقرات من نتائج البحث',
            icon: 'fa-arrow-pointer',
            accent: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            label: 'Impressions',
            value: seo.impressions.toLocaleString(locale),
            sub: 'ظهور في نتائج البحث',
            icon: 'fa-eye',
            accent: 'text-cyan-500',
            bg: 'bg-cyan-500/10',
        },
        {
            label: 'CTR',
            value: `${ctrPercent}%`,
            sub: ctrQuality.text,
            icon: 'fa-percent',
            accent: ctrQuality.color,
            bg: 'bg-light-surface dark:bg-dark-surface',
        },
        {
            label: 'Average Position',
            value: seo.avgPosition.toFixed(1),
            sub: positionLabel.text,
            icon: 'fa-ranking-star',
            accent: positionLabel.color,
            bg: 'bg-light-surface dark:bg-dark-surface',
        },
        {
            label: 'Indexed Pages',
            value: seo.indexedPages.toLocaleString(locale),
            sub: 'صفحات مفهرسة من Search Console',
            icon: 'fa-file-lines',
            accent: 'text-violet-500',
            bg: 'bg-violet-500/10',
        },
    ];

    return (
        <div className="space-y-6">

            {/* Site context */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-4 py-3">
                <div>
                    <p className="text-sm font-bold text-light-text dark:text-dark-text">
                        <i className="fas fa-magnifying-glass me-2 text-green-500" />
                        {seo.siteUrl}
                    </p>
                    <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        Google Search Console
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <i className="fas fa-check-circle me-1" /> مرتبط
                    </span>
                    {seo.lastFactDate && (
                        <DataSourceBadge source="seo_page_facts" lastUpdated={seo.lastFactDate} />
                    )}
                </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {metrics.map(({ label, value, sub, icon, accent, bg }) => (
                    <div key={label} className="rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                                <i className={`fas ${icon} text-sm ${accent}`} />
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
                        </div>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">{value}</p>
                        <p className={`mt-0.5 text-[11px] ${accent === 'text-emerald-500' || accent === 'text-blue-500' ? accent : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                            {sub}
                        </p>
                    </div>
                ))}
            </div>

            {/* SEO quality signals */}
            <div className="space-y-2">
                {seo.avgPosition > 10 && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm">
                        <i className="fas fa-triangle-exclamation mt-0.5 shrink-0 text-amber-500" />
                        <div>
                            <p className="font-semibold text-amber-700 dark:text-amber-400">
                                متوسط الترتيب {seo.avgPosition.toFixed(1)} — خارج الصفحة الأولى
                            </p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                الصفحة الأولى تبدأ من موضع 1-10. ركّز على تحسين المحتوى وبناء الروابط الداخلية للكلمات المفتاحية ذات الأولوية.
                            </p>
                        </div>
                    </div>
                )}
                {seo.ctr < 0.02 && seo.impressions > 100 && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm">
                        <i className="fas fa-arrow-down mt-0.5 shrink-0 text-red-500" />
                        <div>
                            <p className="font-semibold text-red-700 dark:text-red-400">
                                CTR منخفض ({ctrPercent}%) رغم {seo.impressions.toLocaleString(locale)} ظهور
                            </p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                حسّن meta titles وdescriptions لجعلها أكثر جذباً في نتائج البحث.
                            </p>
                        </div>
                    </div>
                )}
                {seo.clicks > 0 && seo.avgPosition <= 5 && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                        <i className="fas fa-lightbulb mt-0.5 shrink-0 text-emerald-500" />
                        <div>
                            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                                أداء SEO ممتاز — متوسط الترتيب {seo.avgPosition.toFixed(1)}
                            </p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                الموقع ضمن الصفحة الأولى. ركّز الآن على تحويل الزوار القادمين من البحث.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Formula definitions */}
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                    تعريف المقاييس
                </p>
                <div className="grid gap-2 text-xs md:grid-cols-3">
                    {[
                        { name: 'CTR', formula: 'Clicks ÷ Impressions × 100', source: 'Search Console' },
                        { name: 'Average Position', formula: 'متوسط ترتيب الموقع لكل الكلمات المفتاحية', source: 'Search Console' },
                        { name: 'Indexed Pages', formula: 'عدد الصفحات المفهرسة الفريدة في نتائج Google', source: 'seo_page_facts' },
                    ].map(({ name, formula, source }) => (
                        <div key={name} className="rounded-lg bg-light-bg dark:bg-dark-bg p-3">
                            <p className="font-bold text-light-text dark:text-dark-text">{name}</p>
                            <p className="mt-0.5 text-light-text-secondary dark:text-dark-text-secondary">{formula}</p>
                            <p className="mt-1 text-[10px] opacity-60">{source}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Separation note */}
            <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-4 py-3">
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <i className="fas fa-circle-info me-1.5 text-[10px] text-brand-primary" />
                    Search Console = بيانات SEO العضوي فقط. لبيانات Google Ads المدفوعة، انتقل إلى تبويب <strong>الإعلانات</strong>.
                </p>
            </div>
        </div>
    );
};
