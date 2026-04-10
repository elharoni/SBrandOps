import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AnalyticsData } from '../../../types';
import { buildAttributionData, CHANNEL_COLORS, MetricCard } from './analyticsHelpers';

interface AttributionTabProps {
    data: AnalyticsData;
}

export const AttributionTab: React.FC<AttributionTabProps> = ({ data }) => {
    const attrData = useMemo(() => buildAttributionData(data), [data]);
    const [metric, setMetric] = useState<'roas' | 'cpa' | 'cvr' | 'revenue'>('roas');

    const metricMeta: Record<string, { label: string; format: (value: number) => string; color: string }> = {
        roas: { label: 'ROAS', format: (value) => `${value}x`, color: '#10b981' },
        cpa: { label: 'CPA ($)', format: (value) => `$${value}`, color: '#f59e0b' },
        cvr: { label: 'CVR (%)', format: (value) => `${value}%`, color: '#3b82f6' },
        revenue: { label: 'Revenue ($)', format: (value) => `$${value.toLocaleString()}`, color: '#8b5cf6' },
    };

    const currentMetric = metricMeta[metric];
    const totalRevenue = attrData.reduce((sum, channel) => sum + channel.revenue, 0);
    const totalSpend = attrData.reduce((sum, channel) => sum + channel.spend, 0);
    const blendedRoas = Number((totalRevenue / totalSpend).toFixed(2));

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <MetricCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} icon="fa-dollar-sign" sub="across all channels" />
                <MetricCard title="Total Ad Spend" value={`$${totalSpend.toLocaleString()}`} icon="fa-credit-card" sub="blended" />
                <MetricCard title="Blended ROAS" value={`${blendedRoas}x`} icon="fa-chart-line" sub="revenue / spend" />
                <MetricCard title="Total Conversions" value={attrData.reduce((sum, channel) => sum + channel.conversions, 0).toString()} icon="fa-check-circle" sub="all channels" />
            </div>

            <div className="flex flex-wrap gap-2">
                {(['roas', 'cpa', 'cvr', 'revenue'] as const).map((key) => (
                    <button
                        key={key}
                        onClick={() => setMetric(key)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                            metric === key
                                ? 'bg-brand-primary text-white'
                                : 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border/30 dark:hover:bg-dark-border/30'
                        }`}
                    >
                        {metricMeta[key].label}
                    </button>
                ))}
            </div>

            <div className="bg-light-card dark:bg-dark-card p-5 rounded-2xl border border-light-border dark:border-dark-border">
                <h3 className="mb-4 font-bold text-light-text dark:text-dark-text">{currentMetric.label} by Channel</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={attrData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="channel" stroke="var(--color-text-secondary)" fontSize={12} />
                        <YAxis stroke="var(--color-text-secondary)" fontSize={12} />
                        <Tooltip
                            formatter={(value: number) => [currentMetric.format(value), currentMetric.label]}
                            contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        />
                        <Bar dataKey={metric} fill={currentMetric.color} radius={[6, 6, 0, 0]}>
                            {attrData.map((entry, index) => (
                                <Cell key={index} fill={CHANNEL_COLORS[entry.channel] ?? currentMetric.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-light-border dark:border-dark-border">
                <table className="w-full text-sm">
                    <thead className="bg-light-surface dark:bg-dark-surface text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary">
                        <tr>
                            {['القناة', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'CVR', 'Spend', 'Revenue', 'ROAS', 'CPA'].map((header) => (
                                <th key={header} className="px-4 py-3 text-start whitespace-nowrap">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border dark:divide-dark-border">
                        {attrData.map((channel) => (
                            <tr key={channel.channel} className="transition-colors hover:bg-light-border/20 dark:hover:bg-dark-border/20">
                                <td className="px-4 py-3 font-semibold" style={{ color: CHANNEL_COLORS[channel.channel] }}>{channel.channel}</td>
                                <td className="px-4 py-3">{channel.impressions.toLocaleString()}</td>
                                <td className="px-4 py-3">{channel.clicks.toLocaleString()}</td>
                                <td className="px-4 py-3">{channel.ctr}%</td>
                                <td className="px-4 py-3">{channel.conversions}</td>
                                <td className="px-4 py-3">{channel.cvr}%</td>
                                <td className="px-4 py-3">${channel.spend.toLocaleString()}</td>
                                <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">${channel.revenue.toLocaleString()}</td>
                                <td className="px-4 py-3 font-bold text-brand-primary">{channel.roas}x</td>
                                <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary">${channel.cpa}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
