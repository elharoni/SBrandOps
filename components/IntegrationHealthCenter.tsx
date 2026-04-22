
import React, { useEffect, useState, useCallback } from 'react';
import { ConnectedAsset, AssetPurpose, SyncStatus } from '../types';
import { fetchConnectedAssets, updateAssetPurposes } from '../services/socialAuthService';
import { useLanguage } from '../context/LanguageContext';

interface Props {
    brandId: string;
}

const SYNC_STATUS_META: Record<SyncStatus, { icon: string; color: string; labelAr: string; labelEn: string }> = {
    [SyncStatus.Active]:          { icon: 'fa-circle-check',   color: 'text-green-500',  labelAr: 'نشط',             labelEn: 'Active' },
    [SyncStatus.NeedsReconnect]:  { icon: 'fa-rotate',         color: 'text-amber-500',  labelAr: 'يحتاج إعادة ربط', labelEn: 'Needs Reconnect' },
    [SyncStatus.TokenExpired]:    { icon: 'fa-clock',          color: 'text-red-500',    labelAr: 'انتهى التوكن',    labelEn: 'Token Expired' },
    [SyncStatus.ScopeMissing]:    { icon: 'fa-shield-halved',  color: 'text-orange-500', labelAr: 'صلاحيات ناقصة',  labelEn: 'Scope Missing' },
    [SyncStatus.WebhookInactive]: { icon: 'fa-plug-circle-xmark', color: 'text-orange-400', labelAr: 'ويب هوك معطل', labelEn: 'Webhook Inactive' },
    [SyncStatus.PartialSync]:     { icon: 'fa-circle-half-stroke', color: 'text-yellow-500', labelAr: 'مزامنة جزئية', labelEn: 'Partial Sync' },
    [SyncStatus.SyncDelayed]:     { icon: 'fa-hourglass-half', color: 'text-yellow-400', labelAr: 'مزامنة متأخرة',  labelEn: 'Sync Delayed' },
    [SyncStatus.Disconnected]:    { icon: 'fa-circle-xmark',   color: 'text-gray-400',   labelAr: 'غير متصل',       labelEn: 'Disconnected' },
};

const PURPOSE_LABELS: Record<AssetPurpose, { ar: string; en: string; icon: string }> = {
    [AssetPurpose.Publishing]: { ar: 'نشر', en: 'Publishing', icon: 'fa-paper-plane' },
    [AssetPurpose.Inbox]:      { ar: 'وارد', en: 'Inbox',     icon: 'fa-comments' },
    [AssetPurpose.Analytics]:  { ar: 'تحليلات', en: 'Analytics', icon: 'fa-chart-bar' },
    [AssetPurpose.Ads]:        { ar: 'إعلانات', en: 'Ads',    icon: 'fa-bullhorn' },
    [AssetPurpose.Commerce]:   { ar: 'تجارة', en: 'Commerce', icon: 'fa-bag-shopping' },
    [AssetPurpose.Seo]:        { ar: 'سيو', en: 'SEO',        icon: 'fa-magnifying-glass' },
};

const ALL_PURPOSES = Object.values(AssetPurpose);

function timeAgo(iso?: string, ar = false): string {
    if (!iso) return ar ? 'لم تتم بعد' : 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return ar ? 'الآن'        : 'Just now';
    if (mins < 60)  return ar ? `منذ ${mins} د` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return ar ? `منذ ${hrs} س` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return ar ? `منذ ${days} يوم` : `${days}d ago`;
}

export const IntegrationHealthCenter: React.FC<Props> = ({ brandId }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [assets, setAssets] = useState<ConnectedAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftPurposes, setDraftPurposes] = useState<AssetPurpose[]>([]);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchConnectedAssets(brandId);
            setAssets(data as ConnectedAsset[]);
        } catch (e: any) {
            setError(e.message ?? 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    useEffect(() => { load(); }, [load]);

    const startEdit = (asset: ConnectedAsset) => {
        setEditingId(asset.id);
        setDraftPurposes([...asset.purposes]);
    };

    const toggleDraftPurpose = (p: AssetPurpose) =>
        setDraftPurposes(prev =>
            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p],
        );

    const saveEdit = async (assetId: string) => {
        setSaving(true);
        try {
            await updateAssetPurposes(assetId, draftPurposes);
            setAssets(prev =>
                prev.map(a => a.id === assetId ? { ...a, purposes: draftPurposes } : a),
            );
            setEditingId(null);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    // Summary counts
    const total     = assets.length;
    const healthy   = assets.filter(a => a.sync_status === SyncStatus.Active).length;
    const warnings  = assets.filter(a => [SyncStatus.PartialSync, SyncStatus.SyncDelayed, SyncStatus.WebhookInactive].includes(a.sync_status)).length;
    const critical  = assets.filter(a => [SyncStatus.NeedsReconnect, SyncStatus.TokenExpired, SyncStatus.ScopeMissing, SyncStatus.Disconnected].includes(a.sync_status)).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <i className="fas fa-circle-notch fa-spin text-2xl text-brand-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <i className="fas fa-triangle-exclamation text-3xl text-red-400" />
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{error}</p>
                <button onClick={load} className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white">
                    {ar ? 'إعادة المحاولة' : 'Retry'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: ar ? 'نشط'     : 'Active',   count: healthy,  color: 'text-green-500', bg: 'bg-green-500/10' },
                    { label: ar ? 'تحذيرات' : 'Warnings', count: warnings, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: ar ? 'حرجة'    : 'Critical', count: critical, color: 'text-red-500',   bg: 'bg-red-500/10' },
                ].map(s => (
                    <div key={s.label} className={`rounded-xl ${s.bg} p-3 text-center`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{s.label}</p>
                    </div>
                ))}
            </div>

            {total === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <i className="fas fa-plug text-4xl text-light-text-secondary dark:text-dark-text-secondary" />
                    <p className="text-sm font-medium text-light-text dark:text-dark-text">
                        {ar ? 'لا توجد منصات مربوطة بعد' : 'No platforms connected yet'}
                    </p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'اذهب إلى الحسابات وابدأ الربط' : 'Go to Accounts to start connecting'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {assets.map(asset => {
                        const statusMeta = SYNC_STATUS_META[asset.sync_status] ?? SYNC_STATUS_META[SyncStatus.Active];
                        const isEditing = editingId === asset.id;

                        return (
                            <div
                                key={asset.id}
                                className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card"
                            >
                                {/* Asset header */}
                                <div className="flex items-start gap-3">
                                    {asset.avatar_url ? (
                                        <img
                                            src={asset.avatar_url}
                                            alt={asset.asset_name}
                                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                                            onError={e => {
                                                (e.target as HTMLImageElement).src =
                                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(asset.asset_name)}&background=2563eb&color=fff`;
                                            }}
                                        />
                                    ) : (
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10">
                                            <i className="fas fa-plug text-brand-primary" />
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-bold text-light-text dark:text-dark-text">
                                                {asset.asset_name}
                                            </p>
                                            {asset.is_primary && (
                                                <span className="rounded bg-brand-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-primary">
                                                    {ar ? 'رئيسي' : 'Primary'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            {asset.platform} · {asset.asset_type.replace('_', ' ')}
                                            {asset.market && ` · ${asset.market.toUpperCase()}`}
                                        </p>
                                    </div>

                                    {/* Status badge */}
                                    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${statusMeta.color} bg-current/10`}>
                                        <i className={`fas ${statusMeta.icon} text-[10px]`} />
                                        <span>{ar ? statusMeta.labelAr : statusMeta.labelEn}</span>
                                    </div>
                                </div>

                                {/* Sync + token info */}
                                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                    <span>
                                        <i className="fas fa-rotate me-1" />
                                        {ar ? 'آخر مزامنة: ' : 'Last sync: '}
                                        {timeAgo(asset.last_synced_at, ar)}
                                    </span>
                                    <span>
                                        <i className={`fas fa-key me-1 ${asset.token_expiring_soon ? 'text-red-400' : ''}`} />
                                        {asset.token_is_valid
                                            ? (asset.token_expiring_soon
                                                ? (ar ? 'التوكن سينتهي قريباً' : 'Token expiring soon')
                                                : (ar ? 'توكن نشط' : 'Token active'))
                                            : (ar ? 'توكن منتهي' : 'Token invalid')}
                                    </span>
                                    <span>
                                        <i className={`fas fa-bolt me-1 ${asset.webhook_active ? 'text-green-400' : 'text-gray-400'}`} />
                                        {asset.webhook_active
                                            ? (ar ? 'Webhook نشط' : 'Webhook active')
                                            : (ar ? 'Webhook معطل' : 'Webhook inactive')}
                                    </span>
                                </div>

                                {/* Purposes */}
                                <div className="mt-3">
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                                                {ar ? 'الوظائف' : 'Purposes'}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {ALL_PURPOSES.map(p => {
                                                    const meta = PURPOSE_LABELS[p];
                                                    const active = draftPurposes.includes(p);
                                                    return (
                                                        <button
                                                            key={p}
                                                            onClick={() => toggleDraftPurpose(p)}
                                                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                                                                active
                                                                    ? 'border-brand-primary bg-brand-primary text-white'
                                                                    : 'border-light-border text-light-text-secondary hover:border-brand-primary dark:border-dark-border dark:text-dark-text-secondary'
                                                            }`}
                                                        >
                                                            <i className={`fas ${meta.icon} text-[10px]`} />
                                                            {ar ? meta.ar : meta.en}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={() => saveEdit(asset.id)}
                                                    disabled={saving || draftPurposes.length === 0}
                                                    className="flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                                >
                                                    {saving
                                                        ? <i className="fas fa-circle-notch fa-spin" />
                                                        : <i className="fas fa-check" />}
                                                    {ar ? 'حفظ' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="rounded-lg border border-light-border px-3 py-1.5 text-xs font-medium text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary"
                                                >
                                                    {ar ? 'إلغاء' : 'Cancel'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-2">
                                            {asset.purposes.map(p => {
                                                const meta = PURPOSE_LABELS[p as AssetPurpose];
                                                if (!meta) return null;
                                                return (
                                                    <span key={p} className="flex items-center gap-1 rounded-lg bg-light-bg px-2 py-0.5 text-[11px] font-medium text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                                                        <i className={`fas ${meta.icon} text-[9px]`} />
                                                        {ar ? meta.ar : meta.en}
                                                    </span>
                                                );
                                            })}
                                            <button
                                                onClick={() => startEdit(asset)}
                                                className="ms-auto text-[11px] text-brand-primary hover:underline"
                                            >
                                                <i className="fas fa-pen-to-square me-1 text-[9px]" />
                                                {ar ? 'تعديل' : 'Edit'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Error message */}
                                {asset.sync_error && (
                                    <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">
                                        <i className="fas fa-triangle-exclamation me-1.5" />
                                        {asset.sync_error}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Refresh */}
            <div className="flex justify-center">
                <button
                    onClick={load}
                    className="flex items-center gap-2 rounded-xl border border-light-border px-4 py-2 text-sm text-light-text-secondary transition-colors hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                >
                    <i className="fas fa-rotate text-xs" />
                    {ar ? 'تحديث الحالة' : 'Refresh status'}
                </button>
            </div>
        </div>
    );
};
