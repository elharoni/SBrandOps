import React from 'react';
import { AnalyticsData } from '../../../types';

export const CHANNEL_COLORS: Record<string, string> = {
    Facebook: '#2563eb',
    Instagram: '#e024a3',
    X: '#94a3b8',
    TikTok: '#00f2ea',
    LinkedIn: '#0a66c2',
    Google: '#ea4335',
    Email: '#f59e0b',
};

export const ATTRIBUTION_MODELS = ['First Touch', 'Last Touch', 'Linear', 'Time Decay'] as const;

export const buildAttributionData = (_data: AnalyticsData) => {
    const channels = [
        { channel: 'Facebook', impressions: 45000, clicks: 3200, conversions: 128, revenue: 25600, spend: 3500 },
        { channel: 'Instagram', impressions: 62000, clicks: 4800, conversions: 192, revenue: 38400, spend: 4200 },
        { channel: 'TikTok', impressions: 88000, clicks: 5600, conversions: 112, revenue: 22400, spend: 2800 },
        { channel: 'Google', impressions: 31000, clicks: 6200, conversions: 248, revenue: 74400, spend: 8100 },
        { channel: 'Email', impressions: 18000, clicks: 2900, conversions: 174, revenue: 43500, spend: 1200 },
        { channel: 'LinkedIn', impressions: 12000, clicks: 840, conversions: 42, revenue: 12600, spend: 1800 },
    ];

    return channels.map((channel) => ({
        ...channel,
        cvr: Number(((channel.conversions / channel.clicks) * 100).toFixed(2)),
        cpa: Number((channel.spend / channel.conversions).toFixed(2)),
        roas: Number((channel.revenue / channel.spend).toFixed(2)),
        ctr: Number(((channel.clicks / channel.impressions) * 100).toFixed(2)),
    }));
};

export const buildRevenueModelData = () => [
    { channel: 'Facebook', firstTouch: 8000, lastTouch: 4000, linear: 5500, timeDecay: 4800 },
    { channel: 'Instagram', firstTouch: 12000, lastTouch: 9000, linear: 10000, timeDecay: 11000 },
    { channel: 'TikTok', firstTouch: 6000, lastTouch: 3000, linear: 4000, timeDecay: 3500 },
    { channel: 'Google', firstTouch: 15000, lastTouch: 22000, linear: 18000, timeDecay: 20000 },
    { channel: 'Email', firstTouch: 5000, lastTouch: 14000, linear: 9000, timeDecay: 13000 },
];

export const MetricCard: React.FC<{ title: string; value: string; icon: string; sub?: string }> = ({ title, value, icon, sub }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
            <i className={`fas ${icon}`} />
            {title}
        </p>
        <p className="text-2xl font-bold text-light-text dark:text-dark-text mt-1">{value}</p>
        {sub && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{sub}</p>}
    </div>
);
