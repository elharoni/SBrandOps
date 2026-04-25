import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AnalyticsData } from '../../../types';
import { buildAttributionData, CHANNEL_COLORS } from './analyticsHelpers';

interface AttributionTabProps {
    data: AnalyticsData;
}

export const AttributionTab: React.FC<AttributionTabProps> = ({ data }) => {
    const attrData = useMemo(() => buildAttributionData(data), [data]);
    const hasData = attrData.length > 0;
    const totalImpressions = attrData.reduce((sum, ch) => sum + ch.impressions, 0);
    const totalEngagement = attrData.reduce((sum, ch) => sum + ch.engagement, 0);

    if (!hasData) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg py-16 text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
                    <i className="fas fa-sitemap text-2xl text-brand-primary" />
                </div>
                <div>
                    <p className="text-base font-bold text-light-text dark:text-dark-text">لا توجد بيانات للإسناد بعد</p>
                    <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-sm mx-auto">
                        ابدأ بنشر محتوى على منصات التواصل لتظهر هنا بيانات Impressions والتفاعل الحقيقية.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Ad data callout */}
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
                <i className="fas fa-triangle-exclamation mt-0.5 shrink-0 text-amber-500" />
                <div>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">بيانات Impressions والتفاعل مباشرة من المنشورات. </span>
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">
                        لرؤية ROAS وCPA والإيرادات والتحويلات اربط حسابات <strong>Facebook Ads</strong> أو <strong>Google Ads</strong> من صفحة التكاملات.
                    </span>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <i className="fas fa-eye" /> Total Impressions
                    </p>
                    <p className="text-2xl font-bold text-light-text dark:text-dark-text mt-1">{totalImpressions.toLocaleString()}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">across all channels</p>
                </div>
                <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <i className="fas fa-heart" /> Total Engagement
                    </p>
                    <p className="text-2xl font-bold text-light-text dark:text-dark-text mt-1">{totalEngagement.toLocaleString()}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">likes + comments + shares</p>
                </div>
                <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <i className="fas fa-credit-card" /> Total Ad Spend
                    </p>
                    <p className="text-2xl font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">—</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">يتطلب ربط حسابات الإعلانات</p>
                </div>
                <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <i className="fas fa-check-circle" /> Total Conversions
                    </p>
                    <p className="text-2xl font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">—</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">يتطلب ربط حسابات الإعلانات</p>
                </div>
            </div>

            {/* Impressions by channel chart */}
            <div className="bg-light-card dark:bg-dark-card p-5 rounded-2xl border border-light-border dark:border-dark-border">
                <h3 className="mb-4 font-bold text-light-text dark:text-dark-text">Impressions by Channel</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={attrData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="channel" stroke="var(--color-text-secondary)" fontSize={12} />
                        <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip
                            formatter={(value: number) => [value.toLocaleString(), 'Impressions']}
                            contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        />
                        <Bar dataKey="impressions" radius={[6, 6, 0, 0]}>
                            {attrData.map((entry, index) => (
                                <Cell key={index} fill={CHANNEL_COLORS[entry.channel] ?? '#6366f1'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-light-border dark:border-dark-border">
                <table className="w-full text-sm">
                    <thead className="bg-light-surface dark:bg-dark-surface text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary">
                        <tr>
                            {['القناة', 'Impressions', 'Engagement', 'Eng. Rate', 'Spend', 'Revenue', 'ROAS', 'CPA'].map((header) => (
                                <th key={header} className="px-4 py-3 text-start whitespace-nowrap">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border dark:divide-dark-border">
                        {attrData.map((ch) => (
                            <tr key={ch.channel} className="transition-colors hover:bg-light-border/20 dark:hover:bg-dark-border/20">
                                <td className="px-4 py-3 font-semibold" style={{ color: CHANNEL_COLORS[ch.channel] }}>{ch.channel}</td>
                                <td className="px-4 py-3">{ch.impressions.toLocaleString()}</td>
                                <td className="px-4 py-3">{ch.engagement.toLocaleString()}</td>
                                <td className="px-4 py-3">{ch.engagementRate}%</td>
                                <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary">—</td>
                                <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary">—</td>
                                <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary">—</td>
                                <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary">—</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
