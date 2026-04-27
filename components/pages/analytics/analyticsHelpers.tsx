import React, { useEffect, useState } from 'react';
import { AnalyticsData, SyncJobStatus } from '../../../types';
import { getLastSyncJobs, syncAnalytics } from '../../../services/analyticsService';

// --- Color palette per platform/channel ---
export const CHANNEL_COLORS: Record<string, string> = {
    Facebook: '#2563eb',
    Instagram: '#e024a3',
    X: '#94a3b8',
    TikTok: '#00f2ea',
    LinkedIn: '#0a66c2',
    Google: '#ea4335',
    Email: '#f59e0b',
    YouTube: '#ff0000',
};

export const ATTRIBUTION_MODELS = ['First Touch', 'Last Touch', 'Linear', 'Time Decay'] as const;

// --- Pure calculation helpers ---

/**
 * Calculate percentage change between current and previous value.
 * Returns null if previous is 0 (no baseline to compare against).
 */
export function calculateTrend(current: number, previous: number): { pct: string; up: boolean } | null {
    if (previous === 0) return null;
    const delta = ((current - previous) / previous) * 100;
    return {
        pct: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
        up: delta >= 0,
    };
}

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

// --- Shared UI Components ---

interface TrendBadgeProps {
    trend: { pct: string; up: boolean } | null;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({ trend }) => {
    if (!trend) return null;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            trend.up
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
        }`}>
            <i className={`fas ${trend.up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} text-[9px]`} />
            {trend.pct}
        </span>
    );
};

interface DataSourceBadgeProps {
    source: string;
    lastUpdated?: string | null;
}

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ source, lastUpdated }) => (
    <div className="flex items-center gap-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
        <i className="fas fa-database text-[8px] opacity-60" />
        <span>{source}</span>
        {lastUpdated && (
            <>
                <span className="opacity-40">·</span>
                <span>{new Date(lastUpdated).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>
            </>
        )}
    </div>
);

interface EmptyConnectStateProps {
    icon: string;
    title: string;
    description: string;
    providers?: Array<{ label: string; icon: string; color: string }>;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyConnectState: React.FC<EmptyConnectStateProps> = ({
    icon,
    title,
    description,
    providers,
    actionLabel,
    onAction,
}) => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg py-14 text-center gap-4 px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
            <i className={`fas ${icon} text-2xl text-brand-primary`} />
        </div>
        <div className="max-w-md">
            <p className="text-base font-bold text-light-text dark:text-dark-text">{title}</p>
            <p className="mt-2 text-sm leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
        </div>
        {providers && providers.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
                {providers.map(({ label, icon: pIcon, color }) => (
                    <span key={label} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${color}`}>
                        <i className={`fab ${pIcon} text-[11px]`} />
                        {label}
                    </span>
                ))}
            </div>
        )}
        {actionLabel && onAction && (
            <button
                onClick={onAction}
                className="mt-1 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
            >
                <i className="fas fa-plug me-2 text-xs" />
                {actionLabel}
            </button>
        )}
    </div>
);

interface MetricCardProps {
    title: string;
    value: string;
    icon: string;
    sub?: string;
    trend?: { pct: string; up: boolean } | null;
    source?: string;
    accent?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, sub, trend, source, accent }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border space-y-1">
        <div className="flex items-center justify-between">
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1.5">
                <i className={`fas ${icon} text-[11px] ${accent ?? 'text-brand-primary'}`} />
                {title}
            </p>
            {trend !== undefined && <TrendBadge trend={trend ?? null} />}
        </div>
        <p className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{sub}</p>}
        {source && (
            <div className="pt-1">
                <DataSourceBadge source={source} />
            </div>
        )}
    </div>
);

interface SyncWarningBannerProps {
    message: string;
}

export const SyncWarningBanner: React.FC<SyncWarningBannerProps> = ({ message }) => (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
        <i className="fas fa-triangle-exclamation mt-0.5 shrink-0 text-amber-500" />
        <p className="text-amber-700 dark:text-amber-400">{message}</p>
    </div>
);

const SYNC_PROVIDER_LABELS: Record<string, string> = {
    ga4: 'GA4',
    search_console: 'Search Console',
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
};

interface SyncStatusBarProps {
    brandId: string;
    providers: string[];
    onSynced?: () => void;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ brandId, providers, onSynced }) => {
    const [jobs, setJobs] = useState<SyncJobStatus[]>([]);
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        getLastSyncJobs(brandId).then(setJobs).catch(() => {});
    }, [brandId]);

    const relevant = jobs.filter((j) => providers.includes(j.provider));
    if (relevant.length === 0) return null;

    const handleRetry = async () => {
        setRetrying(true);
        try {
            await syncAnalytics(brandId);
            const fresh = await getLastSyncJobs(brandId);
            setJobs(fresh);
            onSynced?.();
        } catch {
            // silent — user sees no change
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-3 py-2 text-[11px]">
            {relevant.map((job) => {
                const label = SYNC_PROVIDER_LABELS[job.provider] ?? job.provider;
                const time = job.finishedAt ?? job.startedAt;
                const timeLabel = time
                    ? new Date(time).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : null;
                return (
                    <div key={job.provider} className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            job.status === 'success' ? 'bg-emerald-500'
                            : job.status === 'failed' ? 'bg-red-500'
                            : 'animate-pulse bg-amber-500'
                        }`} />
                        <span className="font-semibold text-light-text dark:text-dark-text">{label}</span>
                        {timeLabel && (
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">{timeLabel}</span>
                        )}
                        {job.recordsSynced > 0 && (
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">
                                · {job.recordsSynced.toLocaleString('ar-EG')} سجل
                            </span>
                        )}
                        {job.status === 'failed' && (
                            <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 font-semibold text-red-600 dark:text-red-400">
                                فشل
                            </span>
                        )}
                    </div>
                );
            })}
            <button
                onClick={handleRetry}
                disabled={retrying}
                className="ms-auto flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-light-text-secondary transition-colors hover:bg-light-bg hover:text-light-text disabled:opacity-50 dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-dark-text"
            >
                <i className={`fas fa-sync-alt text-[9px] ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'جارٍ...' : 'مزامنة'}
            </button>
        </div>
    );
};
