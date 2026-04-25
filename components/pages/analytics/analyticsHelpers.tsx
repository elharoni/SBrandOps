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

export const buildAttributionData = (data: AnalyticsData) => {
    const breakdown = data.platformBreakdown ?? {};
    const platforms = Object.keys(breakdown);
    if (platforms.length === 0) return [];

    return platforms.map((platform) => {
        const { impressions, engagement } = breakdown[platform];
        return {
            channel: platform,
            impressions,
            engagement,
            engagementRate: impressions > 0 ? Number(((engagement / impressions) * 100).toFixed(2)) : 0,
            clicks: null as number | null,
            conversions: null as number | null,
            revenue: null as number | null,
            spend: null as number | null,
            cvr: null as number | null,
            cpa: null as number | null,
            roas: null as number | null,
            ctr: null as number | null,
        };
    });
};

export const buildRevenueModelData = (data: AnalyticsData) => {
    const breakdown = data.platformBreakdown ?? {};
    const platforms = Object.keys(breakdown);
    if (platforms.length === 0) return [];

    return platforms.map((platform) => ({
        channel: platform,
        firstTouch: null as number | null,
        lastTouch: null as number | null,
        linear: null as number | null,
        timeDecay: null as number | null,
    }));
};

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
