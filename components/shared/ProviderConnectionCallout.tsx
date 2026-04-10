import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { BrandAsset, BrandConnection, SyncHealth } from '../../services/brandConnectionService';
import { getConnectionAssetLabels } from '../../services/providerConnectionService';

const STATUS_STYLES: Record<BrandConnection['status'], { tone: string; labelAr: string; labelEn: string }> = {
    connected: { tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', labelAr: 'متصل', labelEn: 'Connected' },
    expired: { tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', labelAr: 'منتهي', labelEn: 'Expired' },
    needs_reauth: { tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', labelAr: 'يحتاج إعادة توثيق', labelEn: 'Needs re-auth' },
    paused: { tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', labelAr: 'متوقف', labelEn: 'Paused' },
    error: { tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', labelAr: 'خطأ', labelEn: 'Error' },
    disconnected: { tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', labelAr: 'مفصول', labelEn: 'Disconnected' },
};

const HEALTH_STYLES: Record<SyncHealth, { tone: string; labelAr: string; labelEn: string }> = {
    healthy: { tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', labelAr: 'صحي', labelEn: 'Healthy' },
    degraded: { tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', labelAr: 'متراجع', labelEn: 'Degraded' },
    failing: { tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', labelAr: 'متعثر', labelEn: 'Failing' },
    unknown: { tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', labelAr: 'غير معروف', labelEn: 'Unknown' },
};

interface ProviderConnectionCalloutProps {
    title: string;
    description: string;
    connection: BrandConnection | null;
    brandAssets: BrandAsset | null;
    emptyTitle: string;
    emptyDescription: string;
    primaryActionLabel?: string;
    onPrimaryAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
}

function formatDateTime(value: string | null, locale: string, fallback: string): string {
    if (!value) return fallback;

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function StatusPill({ tone, label }: { tone: string; label: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
            {label}
        </span>
    );
}

export const ProviderConnectionCallout: React.FC<ProviderConnectionCalloutProps> = ({
    title,
    description,
    connection,
    brandAssets,
    emptyTitle,
    emptyDescription,
    primaryActionLabel,
    onPrimaryAction,
    secondaryActionLabel,
    onSecondaryAction,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const locale = ar ? 'ar-EG' : 'en-US';

    if (!connection) {
        return (
            <div className="rounded-[1.5rem] border border-dashed border-light-border/80 bg-light-card/80 p-5 dark:border-dark-border/70 dark:bg-dark-card/70">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">
                    {title}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-light-text dark:text-dark-text">{emptyTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">{emptyDescription}</p>
                {(primaryActionLabel || secondaryActionLabel) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {primaryActionLabel && onPrimaryAction && (
                            <button type="button" onClick={onPrimaryAction} className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-primary/90">
                                {primaryActionLabel}
                            </button>
                        )}
                        {secondaryActionLabel && onSecondaryAction && (
                            <button type="button" onClick={onSecondaryAction} className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text">
                                {secondaryActionLabel}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    const status = STATUS_STYLES[connection.status];
    const health = HEALTH_STYLES[connection.sync_health];
    const assetLabels = getConnectionAssetLabels(connection, brandAssets);

    return (
        <div className="rounded-[1.5rem] border border-light-border/80 bg-light-card/90 p-5 dark:border-dark-border/70 dark:bg-dark-card/85">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">
                        {title}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-light-text dark:text-dark-text">
                        {connection.external_account_name || emptyTitle}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <StatusPill tone={status.tone} label={ar ? status.labelAr : status.labelEn} />
                    <StatusPill tone={health.tone} label={ar ? health.labelAr : health.labelEn} />
                </div>
            </div>

            {assetLabels.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {assetLabels.map((label) => (
                        <span key={`${connection.id}-${label}`} className="inline-flex max-w-full items-center rounded-full bg-light-bg px-2.5 py-1 text-[11px] font-medium text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                            {label}
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-light-bg/70 px-4 py-3 dark:bg-dark-bg/70">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'آخر مزامنة' : 'Last sync'}
                    </p>
                    <p className="mt-1 text-sm font-medium text-light-text dark:text-dark-text">
                        {formatDateTime(connection.last_sync_at, locale, ar ? 'لم تتم بعد' : 'Not synced yet')}
                    </p>
                </div>
                <div className="rounded-2xl bg-light-bg/70 px-4 py-3 dark:bg-dark-bg/70">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'المعرف الخارجي' : 'External ID'}
                    </p>
                    <p className="mt-1 break-all text-sm font-medium text-light-text dark:text-dark-text">
                        {connection.external_account_id || (ar ? 'غير متوفر' : 'Not available')}
                    </p>
                </div>
            </div>

            {connection.last_error && (
                <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-xs leading-6 text-rose-600 dark:text-rose-300">
                    {ar ? 'آخر خطأ:' : 'Last error:'} {connection.last_error}
                </p>
            )}

            {(primaryActionLabel || secondaryActionLabel) && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {primaryActionLabel && onPrimaryAction && (
                        <button type="button" onClick={onPrimaryAction} className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-primary/90">
                            {primaryActionLabel}
                        </button>
                    )}
                    {secondaryActionLabel && onSecondaryAction && (
                        <button type="button" onClick={onSecondaryAction} className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text">
                            {secondaryActionLabel}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
